/**
 * Ranking Laboratory Report Service
 *
 * 生成完整的 Ranking Laboratory Report，包含：
 * - Dataset 统计
 * - Ranking A/B/C 结果
 * - Validation Metrics
 * - Conflict Cases
 * - Import Audit
 * - Recommendations
 */

import type { D1Database } from '@cloudflare/workers-types';
import { RankingValidationService, type RankingValidationResult } from './ranking-validation-service';
import { RankingConflictService, type ConflictDataset } from './ranking-conflict-service';
import { ImportAuditService, type ImportAuditResult } from './import-audit-service';
import { RankMovementService, type RankMovement } from './rank-movement-service';

export interface LaboratoryReport {
  generatedAt: string;
  dataset: DatasetSection;
  rankings: RankingsSection;
  validation: ValidationSection;
  conflicts: ConflictsSection;
  importAudit: ImportAuditSection;
  recommendations: string[];
}

export interface DatasetSection {
  totalWorks: number;
  sourceDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
  recognitionDistribution: Record<string, number>;
  humanQualityDistribution: Record<number, number>;
}

export interface RankingsSection {
  rankingA: { workId: number; title: string; rank: number; score: number }[];
  rankingB: { workId: number; title: string; rank: number; score: number }[];
  rankingC: { workId: number; title: string; rank: number; score: number }[];
}

export interface ValidationSection {
  precisionAt5: number;
  precisionAt10: number;
  meanQualityAt5: number | 'insufficient';
  meanQualityAt10: number | 'insufficient';
  qualityPrecisionAt10: number;
  badWorkRateAt10: number;
  spearmanCorrelation: number | 'insufficient';
  groundTruthImbalanced: boolean;
}

export interface ConflictsSection {
  popularButLowQuality: number;
  lowPopularityHighQuality: number;
  highRecognitionLowPopularity: number;
  highMomentum: number;
  smallRatingSample: number;
  totalConflicts: number;
}

export interface ImportAuditSection {
  totalSubmitted: number;
  imported: number;
  rejected: number;
  rejectionBreakdown: Record<string, number>;
}

export class RankingLaboratoryReportService {
  private validationService: RankingValidationService;
  private conflictService: RankingConflictService;
  private auditService: ImportAuditService;
  private rankMovementService: RankMovementService;

  constructor(private db: D1Database) {
    this.validationService = new RankingValidationService(db);
    this.conflictService = new RankingConflictService(db);
    this.auditService = new ImportAuditService(db);
    this.rankMovementService = new RankMovementService();
  }

  /**
   * 生成完整的 Laboratory Report
   */
  async generateReport(
    rankingA: { workId: number; title: string; score: number }[],
    rankingB: { workId: number; title: string; score: number }[],
    rankingC: { workId: number; title: string; score: number }[],
    auditResult?: ImportAuditResult
  ): Promise<LaboratoryReport> {
    // 1. Dataset 统计
    const dataset = await this.generateDatasetSection();

    // 2. Rankings
    const rankings: RankingsSection = {
      rankingA: rankingA.map((r, i) => ({ ...r, rank: i + 1 })),
      rankingB: rankingB.map((r, i) => ({ ...r, rank: i + 1 })),
      rankingC: rankingC.map((r, i) => ({ ...r, rank: i + 1 })),
    };

    // 3. Validation (使用 Full Ranking C 进行验证)
    const validationResult = await this.validationService.validateRanking(
      rankingC.map(r => r.workId)
    );

    const validation: ValidationSection = {
      precisionAt5: validationResult.precisionAt5,
      precisionAt10: validationResult.precisionAt10,
      meanQualityAt5: validationResult.meanQualityAt5,
      meanQualityAt10: validationResult.meanQualityAt10,
      qualityPrecisionAt10: validationResult.qualityPrecisionAt10,
      badWorkRateAt10: validationResult.badWorkRateAt10,
      spearmanCorrelation: validationResult.spearmanCorrelation,
      groundTruthImbalanced: validationResult.groundTruthImbalanced,
    };

    // 4. Conflicts
    const allWorkIds = [...new Set([...rankingA, ...rankingB, ...rankingC].map(r => r.workId))];
    const conflictDataset = await this.conflictService.analyzeConflicts(allWorkIds);

    const conflicts: ConflictsSection = {
      popularButLowQuality: conflictDataset.popularButLowQuality.length,
      lowPopularityHighQuality: conflictDataset.lowPopularityHighQuality.length,
      highRecognitionLowPopularity: conflictDataset.highRecognitionLowPopularity.length,
      highMomentum: conflictDataset.highMomentum.length,
      smallRatingSample: conflictDataset.smallRatingSample.length,
      totalConflicts: conflictDataset.totalConflicts,
    };

    // 5. Import Audit
    const importAudit: ImportAuditSection = auditResult
      ? {
          totalSubmitted: auditResult.totalSubmitted,
          imported: auditResult.imported,
          rejected: auditResult.totalSubmitted - auditResult.imported,
          rejectionBreakdown: {
            duplicated: auditResult.duplicated,
            invalid: auditResult.invalid,
            eligibilityRejected: auditResult.eligibilityRejected,
            missingMetadata: auditResult.missingMetadata,
            otherRejected: auditResult.otherRejected,
          },
        }
      : {
          totalSubmitted: 0,
          imported: 0,
          rejected: 0,
          rejectionBreakdown: {},
        };

    // 6. Recommendations
    const recommendations = this.generateRecommendations(validation, conflicts, dataset);

    return {
      generatedAt: new Date().toISOString(),
      dataset,
      rankings,
      validation,
      conflicts,
      importAudit,
      recommendations,
    };
  }

  private async generateDatasetSection(): Promise<DatasetSection> {
    // Total works (use eligibility_status instead of status)
    const { results: totalResult } = await this.db
      .prepare('SELECT COUNT(*) as count FROM works WHERE eligibility_status = ?')
      .bind('approved')
      .all<{ count: number }>();
    const totalWorks = totalResult?.[0]?.count || 0;

    // Source distribution
    const { results: sourceResults } = await this.db
      .prepare('SELECT source_type, COUNT(*) as count FROM work_sources GROUP BY source_type')
      .all<{ source_type: string; count: number }>();
    const sourceDistribution: Record<string, number> = {};
    for (const row of sourceResults || []) {
      sourceDistribution[row.source_type] = row.count;
    }

    // Type distribution
    const { results: typeResults } = await this.db
      .prepare('SELECT type as content_type, COUNT(*) as count FROM works WHERE eligibility_status = ? GROUP BY type')
      .bind('approved')
      .all<{ content_type: string; count: number }>();
    const typeDistribution: Record<string, number> = {};
    for (const row of typeResults || []) {
      typeDistribution[row.content_type] = row.count;
    }

    // Recognition distribution
    const { results: recogResults } = await this.db
      .prepare(`
        SELECT re.award_level as event_type, COUNT(*) as count
        FROM recognition_events re
        JOIN works w ON re.work_id = w.id
        WHERE w.eligibility_status = ?
        GROUP BY re.award_level
      `)
      .bind('approved')
      .all<{ event_type: string; count: number }>();
    const recognitionDistribution: Record<string, number> = {};
    for (const row of recogResults || []) {
      recognitionDistribution[row.event_type] = row.count;
    }

    // Human quality distribution
    const { results: qualityResults } = await this.db
      .prepare('SELECT human_quality_rating, COUNT(*) as count FROM works WHERE eligibility_status = ? AND human_quality_rating IS NOT NULL GROUP BY human_quality_rating')
      .bind('approved')
      .all<{ human_quality_rating: number; count: number }>();
    const humanQualityDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of qualityResults || []) {
      humanQualityDistribution[row.human_quality_rating] = row.count;
    }

    return {
      totalWorks,
      sourceDistribution,
      typeDistribution,
      recognitionDistribution,
      humanQualityDistribution,
    };
  }

  private generateRecommendations(
    validation: ValidationSection,
    conflicts: ConflictsSection,
    dataset: DatasetSection
  ): string[] {
    const recommendations: string[] = [];

    // 冲突案例建议
    if (conflicts.popularButLowQuality > 0) {
      recommendations.push(`Found ${conflicts.popularButLowQuality} works with high popularity but low quality. Consider adjusting popularity weight or adding quality penalty.`);
    }

    if (conflicts.lowPopularityHighQuality > 0) {
      recommendations.push(`Found ${conflicts.lowPopularityHighQuality} hidden gems (low popularity, high quality). Current ranking may under-rank quality content.`);
    }

    if (conflicts.highRecognitionLowPopularity > 0) {
      recommendations.push(`Found ${conflicts.highRecognitionLowPopularity} works with strong festival recognition but low popularity. Recognition signals may need more weight.`);
    }

    // 验证指标建议
    if (validation.precisionAt10 < 0.6) {
      recommendations.push(`Precision@10 is ${(validation.precisionAt10 * 100).toFixed(1)}%, below target. Algorithm needs tuning.`);
    }

    if (validation.badWorkRateAt10 > 0.2) {
      recommendations.push(`Bad work rate@10 is ${(validation.badWorkRateAt10 * 100).toFixed(1)}%. Too many low-quality works in top 10.`);
    }

    if (validation.spearmanCorrelation !== 'insufficient' && validation.spearmanCorrelation < 0.3) {
      recommendations.push(`Spearman correlation is ${validation.spearmanCorrelation.toFixed(3)}, indicating weak alignment with human judgment.`);
    }

    if (validation.groundTruthImbalanced) {
      recommendations.push('Ground truth distribution is highly imbalanced. Need more diverse human quality ratings.');
    }

    // 数据集建议
    const totalQualityRated = Object.values(dataset.humanQualityDistribution).reduce((a, b) => a + b, 0);
    if (totalQualityRated < 30) {
      recommendations.push(`Only ${totalQualityRated} works have human quality ratings. Need more ground truth data for reliable validation.`);
    }

    if (dataset.totalWorks < 50) {
      recommendations.push(`Dataset has only ${dataset.totalWorks} works. Need at least 50 for stable ranking experiments.`);
    }

    return recommendations;
  }

  /**
   * 生成 Markdown 格式的完整 Laboratory Report
   */
  generateMarkdownReport(report: LaboratoryReport): string {
    const lines = [
      '# Ranking Laboratory Report',
      '',
      `Generated at: ${report.generatedAt}`,
      '',
      '---',
      '',
      '## 1. Dataset',
      '',
      `- Total Works: ${report.dataset.totalWorks}`,
      '',
      '### Source Distribution',
      ...Object.entries(report.dataset.sourceDistribution).map(([source, count]) => `- ${source}: ${count}`),
      '',
      '### Type Distribution',
      ...Object.entries(report.dataset.typeDistribution).map(([type, count]) => `- ${type}: ${count}`),
      '',
      '### Recognition Distribution',
      ...Object.entries(report.dataset.recognitionDistribution).map(([recog, count]) => `- ${recog}: ${count}`),
      '',
      '### Human Quality Distribution',
      ...Object.entries(report.dataset.humanQualityDistribution).map(([q, count]) => `- Quality ${q}: ${count}`),
      '',
      '---',
      '',
      '## 2. Rankings',
      '',
      '### Ranking A (Popularity Only)',
      ...report.rankings.rankingA.slice(0, 10).map(r => `${r.rank}. ${r.title} (score: ${r.score.toFixed(2)})`),
      '',
      '### Ranking B (Popularity + Audience)',
      ...report.rankings.rankingB.slice(0, 10).map(r => `${r.rank}. ${r.title} (score: ${r.score.toFixed(2)})`),
      '',
      '### Ranking C (Full Ranking)',
      ...report.rankings.rankingC.slice(0, 10).map(r => `${r.rank}. ${r.title} (score: ${r.score.toFixed(2)})`),
      '',
      '---',
      '',
      '## 3. Validation Metrics',
      '',
      `- Precision@5: ${(report.validation.precisionAt5 * 100).toFixed(1)}%`,
      `- Precision@10: ${(report.validation.precisionAt10 * 100).toFixed(1)}%`,
      `- Mean Human Quality@5: ${report.validation.meanQualityAt5 === 'insufficient' ? 'Insufficient sample size' : report.validation.meanQualityAt5.toFixed(2)}`,
      `- Mean Human Quality@10: ${report.validation.meanQualityAt10 === 'insufficient' ? 'Insufficient sample size' : report.validation.meanQualityAt10.toFixed(2)}`,
      `- Quality Precision@10 (>=4): ${(report.validation.qualityPrecisionAt10 * 100).toFixed(1)}%`,
      `- Bad Work Rate@10 (<4): ${(report.validation.badWorkRateAt10 * 100).toFixed(1)}%`,
      `- Spearman Correlation: ${report.validation.spearmanCorrelation === 'insufficient' ? 'Insufficient sample size' : report.validation.spearmanCorrelation.toFixed(3)}`,
      '',
      report.validation.groundTruthImbalanced ? '**Warning**: Ground truth distribution is highly imbalanced.' : '',
      '',
      '---',
      '',
      '## 4. Conflict Cases',
      '',
      `- Popular but Low Quality: ${report.conflicts.popularButLowQuality}`,
      `- Low Popularity but High Quality: ${report.conflicts.lowPopularityHighQuality}`,
      `- High Recognition but Low Popularity: ${report.conflicts.highRecognitionLowPopularity}`,
      `- High Momentum: ${report.conflicts.highMomentum}`,
      `- Small Rating Sample: ${report.conflicts.smallRatingSample}`,
      `- Total Conflicts: ${report.conflicts.totalConflicts}`,
      '',
      '---',
      '',
      '## 5. Import Audit',
      '',
      `- Total Submitted: ${report.importAudit.totalSubmitted}`,
      `- Imported: ${report.importAudit.imported}`,
      `- Rejected: ${report.importAudit.rejected}`,
      '',
      '### Rejection Breakdown',
      ...Object.entries(report.importAudit.rejectionBreakdown).map(([reason, count]) => `- ${reason}: ${count}`),
      '',
      '---',
      '',
      '## 6. Recommendations',
      '',
      ...report.recommendations.map(r => `- ${r}`),
      '',
      '---',
      '',
      '> Note: Do not automatically change ranking weights based on this report alone. Use this data for informed v0.3 algorithm design.',
    ];

    return lines.join('\n');
  }
}
