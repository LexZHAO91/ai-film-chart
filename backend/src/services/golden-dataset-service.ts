/**
 * Golden Dataset Service
 *
 * 管理 Golden Dataset 的准入、审计和报告：
 * - validation_eligible 规则
 * - authenticity_status 管理
 * - Data Trust 可解释评分
 * - Golden Dataset Report 生成
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface GoldenDatasetCriteria {
  minDataTrustScore: number;
  requireVerifiedAuthenticity: boolean;
  requireHumanQuality: boolean;
  requireWatchSource: boolean;
}

export interface GoldenDatasetReport {
  snapshotName: string;
  totalWorks: number;
  verifiedCount: number;
  unverifiedCount: number;
  invalidCount: number;
  syntheticCount: number;
  qualityDistribution: Record<number, number>;
  sourceDistribution: Record<string, number>;
  recognitionDistribution: Record<string, number>;
  dataTrustStats: { average: number; median: number; min: number; max: number };
  reviewerStats: { reviewerCount: number; agreementRate: number | null };
  goldenWorks: GoldenWork[];
}

export interface GoldenWork {
  workId: number;
  title: string;
  authenticityStatus: string;
  dataTrustScore: number | null;
  dataTrustLevel: string | null;
  humanQuality: number | null;
  validationEligible: boolean;
  watchSources: string[];
  recognitionCount: number;
}

export class GoldenDatasetService {
  private defaultCriteria: GoldenDatasetCriteria = {
    minDataTrustScore: 50,
    requireVerifiedAuthenticity: true,
    requireHumanQuality: true,
    requireWatchSource: true,
  };

  constructor(private db: D1Database) {}

  /**
   * 评估单个作品是否符合 Golden Dataset 标准
   */
  async evaluateWorkEligibility(workId: number, criteria?: Partial<GoldenDatasetCriteria>): Promise<{
    eligible: boolean;
    reasons: string[];
    work: GoldenWork | null;
  }> {
    const mergedCriteria = { ...this.defaultCriteria, ...criteria };
    const reasons: string[] = [];

    const work = await this.db
      .prepare(`
        SELECT w.id, w.canonical_title, w.authenticity_status, w.data_trust_score,
               w.data_trust_level, w.human_quality_rating, w.validation_eligible,
               w.synthetic_test_data
        FROM works w
        WHERE w.id = ? AND w.eligibility_status = 'approved'
      `)
      .bind(workId)
      .first<{
        id: number;
        canonical_title: string;
        authenticity_status: string;
        data_trust_score: number | null;
        data_trust_level: string | null;
        human_quality_rating: number | null;
        validation_eligible: number;
        synthetic_test_data: number;
      }>();

    if (!work) {
      return { eligible: false, reasons: ['Work not found or not approved'], work: null };
    }

    // Check synthetic
    if (work.synthetic_test_data === 1) {
      reasons.push('Work is marked as synthetic test data');
    }

    // Check authenticity
    if (mergedCriteria.requireVerifiedAuthenticity && work.authenticity_status !== 'VERIFIED') {
      reasons.push(`Authenticity status is ${work.authenticity_status}, not VERIFIED`);
    }

    // Check data trust
    if (work.data_trust_score === null || work.data_trust_score < mergedCriteria.minDataTrustScore) {
      reasons.push(`Data trust score ${work.data_trust_score} below threshold ${mergedCriteria.minDataTrustScore}`);
    }

    // Check human quality
    if (mergedCriteria.requireHumanQuality && work.human_quality_rating === null) {
      reasons.push('No human quality rating');
    }

    // Check watch sources
    const { results: watchSources } = await this.db
      .prepare('SELECT source_type FROM watch_sources WHERE work_id = ? AND verification_status = ?')
      .bind(workId, 'VERIFIED')
      .all<{ source_type: string }>();

    if (mergedCriteria.requireWatchSource && (!watchSources || watchSources.length === 0)) {
      reasons.push('No verified watch source');
    }

    const eligible = reasons.length === 0;

    const goldenWork: GoldenWork = {
      workId: work.id,
      title: work.canonical_title,
      authenticityStatus: work.authenticity_status,
      dataTrustScore: work.data_trust_score,
      dataTrustLevel: work.data_trust_level,
      humanQuality: work.human_quality_rating,
      validationEligible: eligible,
      watchSources: (watchSources || []).map(s => s.source_type),
      recognitionCount: 0,
    };

    return { eligible, reasons, work: goldenWork };
  }

  /**
   * 批量更新 validation_eligible
   */
  async updateGoldenDataset(criteria?: Partial<GoldenDatasetCriteria>): Promise<{
    totalEvaluated: number;
    newlyEligible: number;
    newlyIneligible: number;
  }> {
    const { results: works } = await this.db
      .prepare('SELECT id FROM works WHERE eligibility_status = ?')
      .bind('approved')
      .all<{ id: number }>();

    let totalEvaluated = 0;
    let newlyEligible = 0;
    let newlyIneligible = 0;

    for (const row of works || []) {
      totalEvaluated++;
      const { eligible } = await this.evaluateWorkEligibility(row.id, criteria);

      const current = await this.db
        .prepare('SELECT validation_eligible FROM works WHERE id = ?')
        .bind(row.id)
        .first<{ validation_eligible: number }>();

      const wasEligible = current?.validation_eligible === 1;

      await this.db
        .prepare('UPDATE works SET validation_eligible = ? WHERE id = ?')
        .bind(eligible ? 1 : 0, row.id)
        .run();

      if (eligible && !wasEligible) newlyEligible++;
      if (!eligible && wasEligible) newlyIneligible++;
    }

    return { totalEvaluated, newlyEligible, newlyIneligible };
  }

  /**
   * 生成 Golden Dataset Report
   */
  async generateReport(snapshotName: string = 'default'): Promise<GoldenDatasetReport> {
    // Get all golden dataset works
    const { results: works } = await this.db
      .prepare(`
        SELECT w.id, w.canonical_title, w.authenticity_status, w.data_trust_score,
               w.data_trust_level, w.human_quality_rating, w.validation_eligible,
               w.synthetic_test_data
        FROM works w
        WHERE w.eligibility_status = 'approved'
        ORDER BY w.id
      `)
      .all<{
        id: number;
        canonical_title: string;
        authenticity_status: string;
        data_trust_score: number | null;
        data_trust_level: string | null;
        human_quality_rating: number | null;
        validation_eligible: number;
        synthetic_test_data: number;
      }>();

    const allWorks = works || [];
    const goldenWorks = allWorks.filter(w => w.validation_eligible === 1);

    // Quality distribution
    const qualityDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const w of goldenWorks) {
      if (w.human_quality_rating !== null && w.human_quality_rating >= 1 && w.human_quality_rating <= 5) {
        qualityDistribution[w.human_quality_rating] = (qualityDistribution[w.human_quality_rating] || 0) + 1;
      }
    }

    // Source distribution
    const { results: sourceResults } = await this.db
      .prepare(`
        SELECT ws.source_type, COUNT(DISTINCT ws.work_id) as count
        FROM watch_sources ws
        JOIN works w ON ws.work_id = w.id
        WHERE w.validation_eligible = 1
        GROUP BY ws.source_type
      `)
      .all<{ source_type: string; count: number }>();

    const sourceDistribution: Record<string, number> = {};
    for (const row of sourceResults || []) {
      sourceDistribution[row.source_type] = row.count;
    }

    // Recognition distribution
    const { results: recogResults } = await this.db
      .prepare(`
        SELECT re.award_level, COUNT(*) as count
        FROM recognition_events re
        JOIN works w ON re.work_id = w.id
        WHERE w.validation_eligible = 1
        GROUP BY re.award_level
      `)
      .all<{ award_level: string; count: number }>();

    const recognitionDistribution: Record<string, number> = {};
    for (const row of recogResults || []) {
      recognitionDistribution[row.award_level] = row.count;
    }

    // Data trust stats
    const trustScores = goldenWorks.map(w => w.data_trust_score).filter((s): s is number => s !== null);
    const dataTrustStats = {
      average: trustScores.length > 0 ? Math.round(trustScores.reduce((a, b) => a + b, 0) / trustScores.length) : 0,
      median: trustScores.length > 0 ? trustScores.sort((a, b) => a - b)[Math.floor(trustScores.length / 2)] : 0,
      min: trustScores.length > 0 ? Math.min(...trustScores) : 0,
      max: trustScores.length > 0 ? Math.max(...trustScores) : 0,
    };

    // Reviewer stats
    const { results: reviewerResult } = await this.db
      .prepare('SELECT COUNT(DISTINCT reviewer_id) as count FROM human_baseline_rankings')
      .all<{ count: number }>();
    const reviewerCount = reviewerResult?.[0]?.count || 0;

    // Calculate agreement rate if multiple reviewers
    let agreementRate: number | null = null;
    if (reviewerCount >= 2) {
      const { results: agreements } = await this.db
        .prepare(`
          SELECT agreement_level, COUNT(*) as count
          FROM reviewer_agreements
          GROUP BY agreement_level
        `)
        .all<{ agreement_level: string; count: number }>();

      const total = (agreements || []).reduce((sum, a) => sum + a.count, 0);
      const good = (agreements || []).filter(a => a.agreement_level === 'PERFECT' || a.agreement_level === 'GOOD').reduce((sum, a) => sum + a.count, 0);
      agreementRate = total > 0 ? Math.round((good / total) * 100) : null;
    }

    return {
      snapshotName,
      totalWorks: allWorks.length,
      verifiedCount: allWorks.filter(w => w.authenticity_status === 'VERIFIED').length,
      unverifiedCount: allWorks.filter(w => w.authenticity_status === 'UNVERIFIED').length,
      invalidCount: allWorks.filter(w => w.authenticity_status === 'INVALID').length,
      syntheticCount: allWorks.filter(w => w.synthetic_test_data === 1).length,
      qualityDistribution,
      sourceDistribution,
      recognitionDistribution,
      dataTrustStats,
      reviewerStats: { reviewerCount, agreementRate },
      goldenWorks: goldenWorks.map(w => ({
        workId: w.id,
        title: w.canonical_title,
        authenticityStatus: w.authenticity_status,
        dataTrustScore: w.data_trust_score,
        dataTrustLevel: w.data_trust_level,
        humanQuality: w.human_quality_rating,
        validationEligible: w.validation_eligible === 1,
        watchSources: [],
        recognitionCount: 0,
      })),
    };
  }

  /**
   * 保存 Golden Dataset Snapshot
   */
  async saveSnapshot(report: GoldenDatasetReport): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO golden_dataset_snapshots
        (snapshot_name, total_works, verified_count, unverified_count, invalid_count,
         quality_distribution_json, source_distribution_json, recognition_distribution_json,
         data_trust_stats_json, reviewer_stats_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        report.snapshotName,
        report.totalWorks,
        report.verifiedCount,
        report.unverifiedCount,
        report.invalidCount,
        JSON.stringify(report.qualityDistribution),
        JSON.stringify(report.sourceDistribution),
        JSON.stringify(report.recognitionDistribution),
        JSON.stringify(report.dataTrustStats),
        JSON.stringify(report.reviewerStats)
      )
      .run();
  }

  /**
   * 生成 Markdown 报告
   */
  generateMarkdownReport(report: GoldenDatasetReport): string {
    const lines = [
      '# Golden Dataset Report',
      '',
      `Snapshot: ${report.snapshotName}`,
      `Generated at: ${new Date().toISOString()}`,
      '',
      '---',
      '',
      '## Dataset Overview',
      '',
      `- Total Works: ${report.totalWorks}`,
      `- Verified: ${report.verifiedCount}`,
      `- Unverified: ${report.unverifiedCount}`,
      `- Invalid: ${report.invalidCount}`,
      `- Synthetic: ${report.syntheticCount}`,
      `- Golden Dataset (Eligible): ${report.goldenWorks.length}`,
      '',
      '## Quality Distribution',
      ...Object.entries(report.qualityDistribution).map(([q, count]) => `- Quality ${q}: ${count} (${report.goldenWorks.length > 0 ? ((count / report.goldenWorks.length) * 100).toFixed(1) : 0}%)`),
      '',
      '## Source Distribution',
      ...Object.entries(report.sourceDistribution).map(([source, count]) => `- ${source}: ${count}`),
      '',
      '## Recognition Distribution',
      ...Object.entries(report.recognitionDistribution).map(([recog, count]) => `- ${recog}: ${count}`),
      '',
      '## Data Trust Stats',
      `- Average: ${report.dataTrustStats.average}`,
      `- Median: ${report.dataTrustStats.median}`,
      `- Min: ${report.dataTrustStats.min}`,
      `- Max: ${report.dataTrustStats.max}`,
      '',
      '## Reviewer Stats',
      `- Reviewer Count: ${report.reviewerStats.reviewerCount}`,
      report.reviewerStats.agreementRate !== null ? `- Agreement Rate: ${report.reviewerStats.agreementRate}%` : '- Agreement Rate: N/A (single reviewer)',
      '',
      '## Golden Works',
      ...report.goldenWorks.map(w => `- ${w.title} (Trust: ${w.dataTrustScore}, Quality: ${w.humanQuality})`),
    ];

    return lines.join('\n');
  }
}
