/**
 * Ranking Validation Service
 *
 * 生成 Ranking Validation Report，包含：
 * - Precision@5, @10, @20, @50
 * - Mean Human Quality @5, @10
 * - Quality Precision@10 (Human Quality >= 4)
 * - Bad Work Rate@10 (Human Quality < 4)
 * - Spearman Rank Correlation
 * - Ground Truth Distribution
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface RankingValidationConfig {
  targetTopK: number;
  minimumQuality: number;
  targetMeanQuality: number;
  maximumBadRate: number;
}

export interface RankingValidationResult {
  precisionAt5: number;
  precisionAt10: number;
  precisionAt20: number;
  precisionAt50: number;
  meanQualityAt5: number | 'insufficient';
  meanQualityAt10: number | 'insufficient';
  qualityPrecisionAt10: number;
  badWorkRateAt10: number;
  spearmanCorrelation: number | 'insufficient';
  totalWorks: number;
  worksWithHumanQuality: number;
  qualityDistribution: Record<number, number>;
  groundTruthImbalanced: boolean;
  config: RankingValidationConfig;
}

export class RankingValidationService {
  private defaultConfig: RankingValidationConfig = {
    targetTopK: 10,
    minimumQuality: 4,
    targetMeanQuality: 4.0,
    maximumBadRate: 0.2,
  };

  constructor(private db: D1Database) {}

  /**
   * 验证指定排名列表
   */
  async validateRanking(
    rankedWorkIds: number[],
    config?: Partial<RankingValidationConfig>
  ): Promise<RankingValidationResult> {
    const mergedConfig = { ...this.defaultConfig, ...config };

    // 获取所有作品的人工质量评分
    const workQualityMap = await this.getWorkQualityMap(rankedWorkIds);
    const worksWithHumanQuality = Object.values(workQualityMap).filter(q => q !== null).length;

    // 计算 Precision@K
    const precisionAt5 = this.calculatePrecisionAtK(rankedWorkIds, workQualityMap, 5, mergedConfig.minimumQuality);
    const precisionAt10 = this.calculatePrecisionAtK(rankedWorkIds, workQualityMap, 10, mergedConfig.minimumQuality);
    const precisionAt20 = this.calculatePrecisionAtK(rankedWorkIds, workQualityMap, 20, mergedConfig.minimumQuality);
    const precisionAt50 = this.calculatePrecisionAtK(rankedWorkIds, workQualityMap, 50, mergedConfig.minimumQuality);

    // 计算 Mean Quality@K
    const meanQualityAt5 = this.calculateMeanQualityAtK(rankedWorkIds, workQualityMap, 5);
    const meanQualityAt10 = this.calculateMeanQualityAtK(rankedWorkIds, workQualityMap, 10);

    // 计算 Quality Precision@10 (Human Quality >= 4)
    const qualityPrecisionAt10 = this.calculateQualityPrecisionAtK(rankedWorkIds, workQualityMap, 10, 4);

    // 计算 Bad Work Rate@10 (Human Quality < 4)
    const badWorkRateAt10 = this.calculateBadWorkRateAtK(rankedWorkIds, workQualityMap, 10, 4);

    // 计算 Spearman Rank Correlation
    const spearmanCorrelation = this.calculateSpearmanCorrelation(rankedWorkIds, workQualityMap);

    // 质量分布
    const qualityDistribution = this.calculateQualityDistribution(workQualityMap);

    // 检查 Ground Truth 是否不平衡
    const groundTruthImbalanced = this.checkGroundTruthImbalanced(qualityDistribution);

    return {
      precisionAt5,
      precisionAt10,
      precisionAt20,
      precisionAt50,
      meanQualityAt5,
      meanQualityAt10,
      qualityPrecisionAt10,
      badWorkRateAt10,
      spearmanCorrelation,
      totalWorks: rankedWorkIds.length,
      worksWithHumanQuality,
      qualityDistribution,
      groundTruthImbalanced,
      config: mergedConfig,
    };
  }

  private async getWorkQualityMap(workIds: number[]): Promise<Record<number, number | null>> {
    const map: Record<number, number | null> = {};

    // Initialize all as null
    for (const id of workIds) {
      map[id] = null;
    }

    if (workIds.length === 0) return map;

    const placeholders = workIds.map(() => '?').join(',');
    const { results } = await this.db
      .prepare(`SELECT id, human_quality_rating FROM works WHERE id IN (${placeholders})`)
      .bind(...workIds)
      .all<{ id: number; human_quality_rating: number | null }>();

    for (const row of results || []) {
      map[row.id] = row.human_quality_rating;
    }

    return map;
  }

  private calculatePrecisionAtK(
    rankedWorkIds: number[],
    qualityMap: Record<number, number | null>,
    k: number,
    minimumQuality: number
  ): number {
    const topK = rankedWorkIds.slice(0, k);
    if (topK.length === 0) return 0;

    const relevant = topK.filter(id => {
      const quality = qualityMap[id];
      return quality !== null && quality >= minimumQuality;
    }).length;

    return relevant / topK.length;
  }

  private calculateMeanQualityAtK(
    rankedWorkIds: number[],
    qualityMap: Record<number, number | null>,
    k: number
  ): number | 'insufficient' {
    const topK = rankedWorkIds.slice(0, k);
    const qualities = topK.map(id => qualityMap[id]).filter(q => q !== null) as number[];

    if (qualities.length < 3) return 'insufficient';

    const sum = qualities.reduce((a, b) => a + b, 0);
    return sum / qualities.length;
  }

  private calculateQualityPrecisionAtK(
    rankedWorkIds: number[],
    qualityMap: Record<number, number | null>,
    k: number,
    threshold: number
  ): number {
    const topK = rankedWorkIds.slice(0, k);
    if (topK.length === 0) return 0;

    const highQuality = topK.filter(id => {
      const quality = qualityMap[id];
      return quality !== null && quality >= threshold;
    }).length;

    return highQuality / topK.length;
  }

  private calculateBadWorkRateAtK(
    rankedWorkIds: number[],
    qualityMap: Record<number, number | null>,
    k: number,
    threshold: number
  ): number {
    const topK = rankedWorkIds.slice(0, k);
    if (topK.length === 0) return 0;

    const bad = topK.filter(id => {
      const quality = qualityMap[id];
      return quality !== null && quality < threshold;
    }).length;

    return bad / topK.length;
  }

  private calculateSpearmanCorrelation(
    rankedWorkIds: number[],
    qualityMap: Record<number, number | null>
  ): number | 'insufficient' {
    // 过滤掉没有 human quality 的作品
    const pairs = rankedWorkIds
      .map((id, index) => ({ id, rank: index + 1, quality: qualityMap[id] }))
      .filter(p => p.quality !== null) as { id: number; rank: number; quality: number }[];

    if (pairs.length < 5) return 'insufficient';

    // 按 quality 排序，得到 quality rank
    const sortedByQuality = [...pairs].sort((a, b) => b.quality - a.quality);
    const qualityRanks = new Map<number, number>();
    sortedByQuality.forEach((p, i) => qualityRanks.set(p.id, i + 1));

    // 计算 Spearman correlation
    const n = pairs.length;
    let sumD2 = 0;

    for (const p of pairs) {
      const qualityRank = qualityRanks.get(p.id)!;
      const d = p.rank - qualityRank;
      sumD2 += d * d;
    }

    const correlation = 1 - (6 * sumD2) / (n * (n * n - 1));
    return correlation;
  }

  private calculateQualityDistribution(qualityMap: Record<number, number | null>): Record<number, number> {
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const quality of Object.values(qualityMap)) {
      if (quality !== null && quality >= 1 && quality <= 5) {
        distribution[quality] = (distribution[quality] || 0) + 1;
      }
    }

    return distribution;
  }

  private checkGroundTruthImbalanced(distribution: Record<number, number>): boolean {
    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    if (total === 0) return false;

    // 如果某个质量等级的作品超过 60%，认为不平衡
    for (const count of Object.values(distribution)) {
      if (count / total > 0.6) return true;
    }

    // 如果高质量（4-5）作品少于 20%，认为不平衡
    const highQuality = (distribution[4] || 0) + (distribution[5] || 0);
    if (highQuality / total < 0.2) return true;

    return false;
  }

  /**
   * 生成 Markdown 格式的 Validation Report
   */
  generateMarkdownReport(result: RankingValidationResult): string {
    const lines = [
      '# Ranking Validation Report',
      '',
      '## Configuration',
      `- Target Top K: ${result.config.targetTopK}`,
      `- Minimum Quality: ${result.config.minimumQuality}`,
      `- Target Mean Quality: ${result.config.targetMeanQuality}`,
      `- Maximum Bad Rate: ${(result.config.maximumBadRate * 100).toFixed(0)}%`,
      '',
      '## Dataset',
      `- Total Works: ${result.totalWorks}`,
      `- Works with Human Quality: ${result.worksWithHumanQuality}`,
      '',
      '## Precision',
      `- Precision@5: ${(result.precisionAt5 * 100).toFixed(1)}%`,
      `- Precision@10: ${(result.precisionAt10 * 100).toFixed(1)}%`,
      `- Precision@20: ${(result.precisionAt20 * 100).toFixed(1)}%`,
      `- Precision@50: ${(result.precisionAt50 * 100).toFixed(1)}%`,
      '',
      '## Quality Metrics',
      `- Mean Human Quality@5: ${result.meanQualityAt5 === 'insufficient' ? 'Insufficient sample size' : result.meanQualityAt5.toFixed(2)}`,
      `- Mean Human Quality@10: ${result.meanQualityAt10 === 'insufficient' ? 'Insufficient sample size' : result.meanQualityAt10.toFixed(2)}`,
      `- Quality Precision@10 (>=4): ${(result.qualityPrecisionAt10 * 100).toFixed(1)}%`,
      `- Bad Work Rate@10 (<4): ${(result.badWorkRateAt10 * 100).toFixed(1)}%`,
      '',
      '## Correlation',
      `- Spearman Rank Correlation: ${result.spearmanCorrelation === 'insufficient' ? 'Insufficient sample size' : result.spearmanCorrelation.toFixed(3)}`,
      '',
      '## Human Quality Distribution',
      ...Object.entries(result.qualityDistribution).map(([q, count]) => `- Quality ${q}: ${count}`),
      '',
      result.groundTruthImbalanced ? '**Warning**: Ground truth distribution is highly imbalanced.' : '',
    ];

    return lines.join('\n');
  }
}
