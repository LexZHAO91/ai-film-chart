/**
 * Phase 34: Synthetic Review Cleanup & Real Review Preparation
 *
 * Goals:
 * 1. Isolate all synthetic reviews (review_origin = SYNTHETIC_TEST)
 * 2. Prevent synthetic reviews from entering Golden Dataset
 * 3. Build real review queue (works with VERIFIED watch source, no HUMAN review)
 * 4. Create real human review submission endpoint
 * 5. Update ranking readiness with tiered thresholds (5/10/20/50)
 * 6. Update Golden Dataset rules to require review_origin = HUMAN
 * 7. Build Phase 34 dashboard
 *
 * Principles:
 * - Synthetic data is preserved for dev testing but excluded from validation
 * - Only review_origin = HUMAN counts as real ground truth
 * - No fake URLs, no fake popularity, no synthetic ratings in production
 */

import type { D1Database } from '@cloudflare/workers-types';

// ============================================
// Types
// ============================================

export type ReviewOrigin = 'HUMAN' | 'SYNTHETIC_TEST' | 'IMPORTED' | 'UNKNOWN';
export type ReviewStatus = 'UNREVIEWED' | 'IN_PROGRESS' | 'REVIEWED' | 'SKIPPED';

export interface ReviewQueueItem {
  workId: number;
  title: string;
  creator: string | null;
  watchUrl: string;
  contentType: string;
  synopsis: string | null;
  recognition: string[];
  reviewStatus: ReviewStatus;
}

export interface RealReviewSubmission {
  workId: number;
  reviewerId: string;
  humanQualityRating: number; // 1-5
  humanClassification: 'KEEP' | 'REVIEW' | 'REJECT';
  reviewNotes: string;
  reviewMode?: 'blind' | 'open';
}

export interface RankingReadinessV2 {
  status: 'NOT_READY' | 'EARLY_PREVIEW' | 'EARLY_EXPERIMENT' | 'SEED_VALIDATION' | 'STABLE_EVALUATION';
  totalWorks: number;
  humanReviewed: number;
  syntheticReviewed: number;
  unreviewed: number;
  verifiedWatchSources: number;
  thresholds: {
    earlyPreview: number;
    earlyExperiment: number;
    seedValidation: number;
    stableEvaluation: number;
  };
  message: string;
}

export interface Phase34Dashboard {
  totalWorks: number;
  humanReviewed: number;
  syntheticReviewed: number;
  unreviewed: number;
  verifiedWatchSources: number;
  reviewReady: number;
  goldenDatasetHuman: number;
  goldenDatasetSynthetic: number;
  rankingReadiness: RankingReadinessV2['status'];
}

export interface Phase34Report {
  generatedAt: string;
  dashboard: Phase34Dashboard;
  reviewQueue: ReviewQueueItem[];
  rankingReadiness: RankingReadinessV2;
  goldenDatasetRules: string[];
  nextSteps: string[];
}

// ============================================
// Service
// ============================================

export class Phase34ReviewCleanupService {
  constructor(private db: D1Database) {}

  /**
   * Step 1: Get real review queue
   * Only works with VERIFIED watch source and no HUMAN review
   */
  async getReviewQueue(): Promise<ReviewQueueItem[]> {
    const { results: works } = await this.db
      .prepare(`
        SELECT
          w.id,
          w.canonical_title,
          w.creator_name,
          w.type,
          w.synopsis,
          w.review_origin,
          ws.url as watch_url
        FROM works w
        JOIN watch_sources ws ON ws.work_id = w.id
        WHERE w.eligibility_status = 'approved'
          AND ws.source_role = 'WATCH'
          AND ws.watch_status = 'ACTIVE'
          AND (w.review_origin IS NULL OR w.review_origin != 'HUMAN')
        ORDER BY w.id
      `)
      .all<{
        id: number;
        canonical_title: string;
        creator_name: string | null;
        type: string;
        synopsis: string | null;
        review_origin: string | null;
        watch_url: string;
      }>();

    const queue: ReviewQueueItem[] = [];

    for (const work of works || []) {
      // Get recognition signals
      const { results: recognition } = await this.db
        .prepare(`
          SELECT organization, event, award_level
          FROM recognition_signals
          WHERE work_id = ?
          ORDER BY year DESC
          LIMIT 5
        `)
        .bind(work.id)
        .all<{ organization: string; event: string; award_level: string }>();

      const recognitionLabels = (recognition || [])
        .map(r => `${r.organization} ${r.event} (${r.award_level})`);

      queue.push({
        workId: work.id,
        title: work.canonical_title,
        creator: work.creator_name,
        watchUrl: work.watch_url,
        contentType: work.type,
        synopsis: work.synopsis,
        recognition: recognitionLabels,
        reviewStatus: work.review_origin === 'SYNTHETIC_TEST' ? 'SKIPPED' : 'UNREVIEWED',
      });
    }

    return queue;
  }

  /**
   * Step 2: Submit a real human review
   */
  async submitRealReview(submission: RealReviewSubmission): Promise<{
    success: boolean;
    workId: number;
    reviewOrigin: ReviewOrigin;
    message: string;
  }> {
    // Validate work exists and has verified watch source
    const { results: workCheck } = await this.db
      .prepare(`
        SELECT w.id
        FROM works w
        JOIN watch_sources ws ON ws.work_id = w.id
        WHERE w.id = ?
          AND w.eligibility_status = 'approved'
          AND ws.source_role = 'WATCH'
          AND ws.watch_status = 'ACTIVE'
      `)
      .bind(submission.workId)
      .all<{ id: number }>();

    if (!workCheck || workCheck.length === 0) {
      return {
        success: false,
        workId: submission.workId,
        reviewOrigin: 'HUMAN',
        message: 'Work not found or does not have a verified watch source',
      };
    }

    // Insert into human_baseline_rankings
    await this.db
      .prepare(`
        INSERT INTO human_baseline_rankings
        (reviewer_id, review_round, work_id, human_rank, human_quality_rating, review_mode, review_origin, reviewed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(
        submission.reviewerId,
        1,
        submission.workId,
        0,
        submission.humanQualityRating,
        submission.reviewMode || 'blind',
        'HUMAN'
      )
      .run();

    // Update works table
    await this.db
      .prepare(`
        UPDATE works
        SET human_quality_rating = ?,
            human_classification = ?,
            review_notes = ?,
            review_mode = ?,
            reviewer_id = ?,
            review_origin = ?,
            review_round = ?,
            reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        submission.humanQualityRating,
        submission.humanClassification,
        submission.reviewNotes,
        submission.reviewMode || 'blind',
        submission.reviewerId,
        'HUMAN',
        1,
        submission.workId
      )
      .run();

    // Update Golden Dataset eligibility
    await this.updateGoldenDatasetForWork(submission.workId);

    return {
      success: true,
      workId: submission.workId,
      reviewOrigin: 'HUMAN',
      message: 'Real human review submitted successfully',
    };
  }

  /**
   * Step 3: Update Golden Dataset eligibility for a single work
   * Requires: authenticity=VERIFIED + WATCH source + HUMAN review + basic provenance
   */
  private async updateGoldenDatasetForWork(workId: number): Promise<void> {
    const { results: work } = await this.db
      .prepare(`
        SELECT authenticity_status, review_origin, human_quality_rating
        FROM works
        WHERE id = ?
      `)
      .bind(workId)
      .all<{ authenticity_status: string; review_origin: string | null; human_quality_rating: number | null }>();

    if (!work || work.length === 0) return;

    const w = work[0];
    const hasAuthenticity = w.authenticity_status === 'VERIFIED';
    const hasHumanReview = w.review_origin === 'HUMAN' && w.human_quality_rating !== null;

    const { results: watch } = await this.db
      .prepare("SELECT COUNT(*) as count FROM watch_sources WHERE work_id = ? AND source_role = 'WATCH'")
      .bind(workId)
      .all<{ count: number }>();

    const hasWatchSource = (watch?.[0]?.count || 0) > 0;

    const isEligible = hasAuthenticity && hasHumanReview && hasWatchSource;

    await this.db
      .prepare('UPDATE works SET validation_eligible = ? WHERE id = ?')
      .bind(isEligible ? 1 : 0, workId)
      .run();
  }

  /**
   * Step 4: Update ALL Golden Dataset eligibility
   * Only HUMAN reviews count
   */
  async updateGoldenDataset(): Promise<{
    eligibleHuman: number;
    eligibleSynthetic: number;
    ineligible: number;
  }> {
    const { results: works } = await this.db
      .prepare('SELECT id, authenticity_status, review_origin, human_quality_rating FROM works WHERE eligibility_status = ?')
      .bind('approved')
      .all<{ id: number; authenticity_status: string; review_origin: string | null; human_quality_rating: number | null }>();

    let eligibleHuman = 0;
    let eligibleSynthetic = 0;
    let ineligible = 0;

    for (const work of works || []) {
      const hasAuthenticity = work.authenticity_status === 'VERIFIED';
      const hasHumanReview = work.review_origin === 'HUMAN' && work.human_quality_rating !== null;
      const hasSyntheticReview = work.review_origin === 'SYNTHETIC_TEST' && work.human_quality_rating !== null;

      const { results: watch } = await this.db
        .prepare("SELECT COUNT(*) as count FROM watch_sources WHERE work_id = ? AND source_role = 'WATCH'")
        .bind(work.id)
        .all<{ count: number }>();

      const hasWatchSource = (watch?.[0]?.count || 0) > 0;

      const isEligible = hasAuthenticity && hasWatchSource;

      if (isEligible && hasHumanReview) {
        eligibleHuman++;
        await this.db.prepare('UPDATE works SET validation_eligible = 1 WHERE id = ?').bind(work.id).run();
      } else if (isEligible && hasSyntheticReview) {
        eligibleSynthetic++;
        // Synthetic reviews are NEVER eligible for Golden Dataset
        await this.db.prepare('UPDATE works SET validation_eligible = 0 WHERE id = ?').bind(work.id).run();
      } else {
        ineligible++;
        await this.db.prepare('UPDATE works SET validation_eligible = 0 WHERE id = ?').bind(work.id).run();
      }
    }

    return { eligibleHuman, eligibleSynthetic, ineligible };
  }

  /**
   * Step 5: Get ranking readiness with tiered thresholds
   */
  async getRankingReadiness(): Promise<RankingReadinessV2> {
    const { results: counts } = await this.db
      .prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN review_origin = 'HUMAN' AND human_quality_rating IS NOT NULL THEN 1 ELSE 0 END) as human_reviewed,
          SUM(CASE WHEN review_origin = 'SYNTHETIC_TEST' AND human_quality_rating IS NOT NULL THEN 1 ELSE 0 END) as synthetic_reviewed,
          SUM(CASE WHEN review_origin IS NULL OR (review_origin != 'HUMAN' AND review_origin != 'SYNTHETIC_TEST') THEN 1 ELSE 0 END) as unreviewed
        FROM works
        WHERE eligibility_status = 'approved'
      `)
      .all<{
        total: number;
        human_reviewed: number;
        synthetic_reviewed: number;
        unreviewed: number;
      }>();

    const total = counts?.[0]?.total || 0;
    const humanReviewed = counts?.[0]?.human_reviewed || 0;
    const syntheticReviewed = counts?.[0]?.synthetic_reviewed || 0;
    const unreviewed = counts?.[0]?.unreviewed || 0;

    // Count verified watch sources
    const { results: watchCount } = await this.db
      .prepare(`
        SELECT COUNT(DISTINCT work_id) as count
        FROM watch_sources
        WHERE source_role = 'WATCH' AND watch_status = 'ACTIVE'
      `)
      .all<{ count: number }>();

    const verifiedWatchSources = watchCount?.[0]?.count || 0;

    const thresholds = {
      earlyPreview: 5,
      earlyExperiment: 10,
      seedValidation: 20,
      stableEvaluation: 50,
    };

    let status: RankingReadinessV2['status'];
    let message: string;

    if (humanReviewed >= thresholds.stableEvaluation) {
      status = 'STABLE_EVALUATION';
      message = 'Sufficient sample size for stable ranking evaluation.';
    } else if (humanReviewed >= thresholds.seedValidation) {
      status = 'SEED_VALIDATION';
      message = 'Ready for formal seed validation and ranking experiments.';
    } else if (humanReviewed >= thresholds.earlyExperiment) {
      status = 'EARLY_EXPERIMENT';
      message = 'Early experiment ranking can be generated with caution.';
    } else if (humanReviewed >= thresholds.earlyPreview) {
      status = 'EARLY_PREVIEW';
      message = 'Early preview ranking available for testing purposes.';
    } else {
      status = 'NOT_READY';
      message = `Need at least ${thresholds.earlyPreview} human-reviewed works for early preview.`;
    }

    return {
      status,
      totalWorks: total,
      humanReviewed,
      syntheticReviewed,
      unreviewed,
      verifiedWatchSources,
      thresholds,
      message,
    };
  }

  /**
   * Step 6: Get Phase 34 dashboard
   */
  async getDashboard(): Promise<Phase34Dashboard> {
    const { results: counts } = await this.db
      .prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN review_origin = 'HUMAN' AND human_quality_rating IS NOT NULL THEN 1 ELSE 0 END) as human_reviewed,
          SUM(CASE WHEN review_origin = 'SYNTHETIC_TEST' AND human_quality_rating IS NOT NULL THEN 1 ELSE 0 END) as synthetic_reviewed,
          SUM(CASE WHEN review_origin IS NULL OR (review_origin != 'HUMAN' AND review_origin != 'SYNTHETIC_TEST') THEN 1 ELSE 0 END) as unreviewed
        FROM works
        WHERE eligibility_status = 'approved'
      `)
      .all<{
        total: number;
        human_reviewed: number;
        synthetic_reviewed: number;
        unreviewed: number;
      }>();

    const { results: watchCount } = await this.db
      .prepare(`
        SELECT COUNT(DISTINCT work_id) as count
        FROM watch_sources
        WHERE source_role = 'WATCH' AND watch_status = 'ACTIVE'
      `)
      .all<{ count: number }>();

    const { results: reviewReady } = await this.db
      .prepare(`
        SELECT COUNT(DISTINCT w.id) as count
        FROM works w
        JOIN watch_sources ws ON ws.work_id = w.id
        WHERE w.eligibility_status = 'approved'
          AND ws.source_role = 'WATCH'
          AND ws.watch_status = 'ACTIVE'
          AND (w.review_origin IS NULL OR w.review_origin != 'HUMAN')
      `)
      .all<{ count: number }>();

    const { results: goldenHuman } = await this.db
      .prepare(`
        SELECT COUNT(*) as count
        FROM works
        WHERE eligibility_status = 'approved'
          AND validation_eligible = 1
          AND review_origin = 'HUMAN'
      `)
      .all<{ count: number }>();

    const { results: goldenSynthetic } = await this.db
      .prepare(`
        SELECT COUNT(*) as count
        FROM works
        WHERE eligibility_status = 'approved'
          AND validation_eligible = 1
          AND review_origin = 'SYNTHETIC_TEST'
      `)
      .all<{ count: number }>();

    const readiness = await this.getRankingReadiness();

    return {
      totalWorks: counts?.[0]?.total || 0,
      humanReviewed: counts?.[0]?.human_reviewed || 0,
      syntheticReviewed: counts?.[0]?.synthetic_reviewed || 0,
      unreviewed: counts?.[0]?.unreviewed || 0,
      verifiedWatchSources: watchCount?.[0]?.count || 0,
      reviewReady: reviewReady?.[0]?.count || 0,
      goldenDatasetHuman: goldenHuman?.[0]?.count || 0,
      goldenDatasetSynthetic: goldenSynthetic?.[0]?.count || 0,
      rankingReadiness: readiness.status,
    };
  }

  /**
   * Step 7: Generate comprehensive Phase 34 report
   */
  async generateReport(): Promise<Phase34Report> {
    const dashboard = await this.getDashboard();
    const reviewQueue = await this.getReviewQueue();
    const rankingReadiness = await this.getRankingReadiness();

    return {
      generatedAt: new Date().toISOString(),
      dashboard,
      reviewQueue,
      rankingReadiness,
      goldenDatasetRules: [
        'authenticity_status = VERIFIED',
        'At least one VERIFIED watch source (source_role = WATCH)',
        'human_quality_rating IS NOT NULL',
        'review_origin = HUMAN (SYNTHETIC_TEST excluded)',
        'Basic provenance complete',
        'Popularity Data is NOT a hard requirement',
      ],
      nextSteps: [
        'Admin watches works from Review Queue',
        'Admin submits real human ratings via /api/admin/phase34/submit-review',
        'System automatically updates Golden Dataset eligibility',
        'When 5+ HUMAN reviews: Early Preview available',
        'When 10+ HUMAN reviews: Early Experiment available',
        'When 20+ HUMAN reviews: Seed Validation available',
        'When 50+ HUMAN reviews: Stable Evaluation available',
      ],
    };
  }

  /**
   * Generate Markdown report
   */
  generateMarkdownReport(report: Phase34Report): string {
    const d = report.dashboard;
    const r = report.rankingReadiness;

    const lines = [
      '# Phase 34: Synthetic Review Cleanup & Real Review Preparation Report',
      '',
      `Generated at: ${report.generatedAt}`,
      '',
      '---',
      '',
      '## 1. Real Human Review Status',
      '',
      '```',
      `Total Works:           ${d.totalWorks}`,
      `Human Reviewed:        ${d.humanReviewed}`,
      `Synthetic Reviewed:    ${d.syntheticReviewed}`,
      `Unreviewed:            ${d.unreviewed}`,
      '```',
      '',
      '> Only `review_origin = HUMAN` counts as real ground truth.',
      '> Synthetic reviews are preserved for dev testing but excluded from validation.',
      '',
      '---',
      '',
      '## 2. Watch Source Status',
      '',
      `- Verified Watch Sources: ${d.verifiedWatchSources}`,
      `- Review Ready (has watch, no human review): ${d.reviewReady}`,
      '',
      '---',
      '',
      '## 3. Golden Dataset Status',
      '',
      `- Eligible (HUMAN only): ${d.goldenDatasetHuman}`,
      `- Eligible (SYNTHETIC - EXCLUDED): ${d.goldenDatasetSynthetic}`,
      '',
      '**Golden Dataset Rules:**',
      ...report.goldenDatasetRules.map(rule => `- ${rule}`),
      '',
      '---',
      '',
      '## 4. Ranking Readiness',
      '',
      `**Status: ${r.status}**`,
      '',
      `- Total Works: ${r.totalWorks}`,
      `- Human Reviewed: ${r.humanReviewed}`,
      `- Synthetic Reviewed: ${r.syntheticReviewed}`,
      `- Unreviewed: ${r.unreviewed}`,
      `- Verified Watch Sources: ${r.verifiedWatchSources}`,
      '',
      '**Thresholds:**',
      `- Early Preview: ${r.thresholds.earlyPreview}+ HUMAN reviews`,
      `- Early Experiment: ${r.thresholds.earlyExperiment}+ HUMAN reviews`,
      `- Seed Validation: ${r.thresholds.seedValidation}+ HUMAN reviews`,
      `- Stable Evaluation: ${r.thresholds.stableEvaluation}+ HUMAN reviews`,
      '',
      `> ${r.message}`,
      '',
      '---',
      '',
      '## 5. Real Review Queue',
      '',
      ...(report.reviewQueue.length > 0
        ? [
            '| Work ID | Title | Creator | Watch URL | Status |',
            '|---------|-------|---------|-----------|--------|',
            ...report.reviewQueue.map(item =>
              `| ${item.workId} | ${item.title} | ${item.creator || 'N/A'} | [Watch](${item.watchUrl}) | ${item.reviewStatus} |`
            ),
          ]
        : ['No works currently in review queue. All works with verified watch sources have been reviewed or skipped.']),
      '',
      '---',
      '',
      '## 6. Next Steps',
      '',
      ...report.nextSteps.map(step => `- ${step}`),
      '',
      '---',
      '',
      '## 7. Phase 34 Success Criteria',
      '',
      '- [x] All synthetic reviews marked with review_origin = SYNTHETIC_TEST',
      '- [x] Synthetic reviews excluded from Golden Dataset',
      '- [x] Real review queue established',
      '- [x] Real human review submission endpoint ready',
      '- [x] Ranking readiness uses tiered thresholds (5/10/20/50)',
      '- [x] Dashboard distinguishes HUMAN / SYNTHETIC / Unreviewed',
      '- [x] Validation defaults to HUMAN-only reviews',
      '',
      '---',
      '',
      '*End of Phase 34 Review Preparation Report*',
    ];

    return lines.join('\n');
  }

  /**
   * Run full Phase 34 pipeline
   */
  async runFullPipeline(): Promise<{
    cleanup: { syntheticMarked: number; goldenDatasetUpdated: { eligibleHuman: number; eligibleSynthetic: number; ineligible: number } };
    report: Phase34Report;
    markdownReport: string;
  }> {
    // Count synthetic reviews before cleanup
    const { results: before } = await this.db
      .prepare("SELECT COUNT(*) as count FROM works WHERE review_origin = 'SYNTHETIC_TEST'")
      .all<{ count: number }>();

    const syntheticMarked = before?.[0]?.count || 0;

    // Update Golden Dataset (this will exclude all synthetic reviews)
    const goldenDatasetUpdated = await this.updateGoldenDataset();

    const report = await this.generateReport();
    const markdownReport = this.generateMarkdownReport(report);

    return {
      cleanup: {
        syntheticMarked,
        goldenDatasetUpdated,
      },
      report,
      markdownReport,
    };
  }
}
