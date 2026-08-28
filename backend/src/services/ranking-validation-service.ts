/**
 * Ranking Validation Service
 *
 * 生成 Ranking Validation Report，包括：
 * - precision@10 / @20 / @50（基于 human_quality_rating >= 4 作为 ground truth）
 * - Top 10/20/50 平均 human quality
 * - Top 10/20/50 中低质量作品数量
 * - 排名异常检测
 * - 算法建议
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  PopularityOnlyEngine,
  PopularityAudienceEngine,
  FullRankingEngine,
  type ExperimentalRankingResult,
} from '../ranking';

export interface RankingValidationReport {
  generatedAt: string;
  seedPoolStats: {
    totalWorks: number;
    byType: Record<string, number>;
    bySource: Record<string, number>;
    recognitionDistribution: Record<string, number>;
    popularityDistribution: { min: number; max: number; avg: number };
    humanQualityDistribution: Record<string, number>;
  };
  rankings: {
    popularityOnly: ExperimentalRankingResult[];
    popularityAudience: ExperimentalRankingResult[];
    fullRanking: ExperimentalRankingResult[];
  };
  precision: {
    popularityOnly: { at10: number; at20: number; at50: number };
    popularityAudience: { at10: number; at20: number; at50: number };
    fullRanking: { at10: number; at20: number; at50: number };
  };
  humanQualityAnalysis: {
    top10Avg: number;
    top20Avg: number;
    top50Avg: number;
    badWorksInTop10: number;
    badWorksInTop20: number;
    badWorksInTop50: number;
  };
  comparison: {
    workId: number;
    title: string;
    popularityRank: number;
    audienceRank: number;
    fullRank: number;
    humanQuality: number | null;
    recognitionCount: number;
  }[];
  anomalies: {
    workId: number;
    title: string;
    issue: string;
    details: string;
  }[];
  recommendations: string[];
}

export class RankingValidationService {
  constructor(private db: D1Database) {}

  /**
   * 生成完整的 Ranking Validation Report
   */
  async generateReport(workIds: number[]): Promise<RankingValidationReport> {
    // 1. 运行三套实验排名
    const popularityEngine = new PopularityOnlyEngine();
    const audienceEngine = new PopularityAudienceEngine();
    const fullEngine = new FullRankingEngine(this.db);

    const popularityRanking = await popularityEngine.runRanking(this.db, workIds);
    const audienceRanking = await audienceEngine.runRanking(this.db, workIds);
    const fullRanking = await fullEngine.runRanking(this.db, workIds);

    // 2. 获取所有作品信息
    const works = await this.getWorksWithHumanQuality(workIds);

    // 3. 计算 precision
    const precision = {
      popularityOnly: this.calculatePrecision(popularityRanking, works),
      popularityAudience: this.calculatePrecision(audienceRanking, works),
      fullRanking: this.calculatePrecision(fullRanking, works),
    };

    // 4. 分析 human quality
    const humanQualityAnalysis = this.analyzeHumanQuality(fullRanking, works);

    // 5. 生成对比表
    const comparison = this.buildComparison(
      popularityRanking,
      audienceRanking,
      fullRanking,
      works
    );

    // 6. 检测异常
    const anomalies = this.detectAnomalies(fullRanking, works);

    // 7. 生成建议
    const recommendations = this.generateRecommendations(
      precision,
      humanQualityAnalysis,
      anomalies
    );

    // 8. Seed Pool 统计
    const seedPoolStats = await this.getSeedPoolStats(workIds);

    return {
      generatedAt: new Date().toISOString(),
      seedPoolStats,
      rankings: {
        popularityOnly: popularityRanking.slice(0, 100),
        popularityAudience: audienceRanking.slice(0, 100),
        fullRanking: fullRanking.slice(0, 100),
      },
      precision,
      humanQualityAnalysis,
      comparison: comparison.slice(0, 50),
      anomalies,
      recommendations,
    };
  }

  /**
   * 计算 precision@k
   * Ground Truth: human_quality_rating >= 4
   */
  private calculatePrecision(
    ranking: ExperimentalRankingResult[],
    works: Map<number, { humanQuality: number | null }>
  ): { at10: number; at20: number; at50: number } {
    const relevant = (workId: number) => {
      const quality = works.get(workId)?.humanQuality;
      return quality !== null && quality !== undefined && quality >= 4;
    };

    const computePrecision = (k: number) => {
      const topK = ranking.slice(0, k);
      const relevantCount = topK.filter(r => relevant(r.workId)).length;
      return topK.length > 0 ? relevantCount / topK.length : 0;
    };

    return {
      at10: computePrecision(10),
      at20: computePrecision(20),
      at50: computePrecision(50),
    };
  }

  /**
   * 分析 Top K 的 human quality
   */
  private analyzeHumanQuality(
    ranking: ExperimentalRankingResult[],
    works: Map<number, { humanQuality: number | null }>
  ): RankingValidationReport['humanQualityAnalysis'] {
    const getAvgQuality = (k: number) => {
      const topK = ranking.slice(0, k);
      const qualities = topK
        .map(r => works.get(r.workId)?.humanQuality)
        .filter((q): q is number => q !== null && q !== undefined);
      return qualities.length > 0
        ? qualities.reduce((a, b) => a + b, 0) / qualities.length
        : 0;
    };

    const countBadWorks = (k: number) => {
      const topK = ranking.slice(0, k);
      return topK.filter(r => {
        const q = works.get(r.workId)?.humanQuality;
        return q !== null && q !== undefined && q <= 3;
      }).length;
    };

    return {
      top10Avg: Math.round(getAvgQuality(10) * 100) / 100,
      top20Avg: Math.round(getAvgQuality(20) * 100) / 100,
      top50Avg: Math.round(getAvgQuality(50) * 100) / 100,
      badWorksInTop10: countBadWorks(10),
      badWorksInTop20: countBadWorks(20),
      badWorksInTop50: countBadWorks(50),
    };
  }

  /**
   * 构建三套排名的对比表
   */
  private buildComparison(
    popularity: ExperimentalRankingResult[],
    audience: ExperimentalRankingResult[],
    full: ExperimentalRankingResult[],
    works: Map<number, { title: string; humanQuality: number | null; recognitionCount: number }>
  ): RankingValidationReport['comparison'] {
    const popularityMap = new Map(popularity.map(r => [r.workId, r.rank]));
    const audienceMap = new Map(audience.map(r => [r.workId, r.rank]));
    const fullMap = new Map(full.map(r => [r.workId, r.rank]));

    const allWorkIds = new Set([
      ...popularity.map(r => r.workId),
      ...audience.map(r => r.workId),
      ...full.map(r => r.workId),
    ]);

    const comparison: RankingValidationReport['comparison'] = [];

    for (const workId of allWorkIds) {
      const work = works.get(workId);
      if (!work) continue;

      comparison.push({
        workId,
        title: work.title,
        popularityRank: popularityMap.get(workId) || 0,
        audienceRank: audienceMap.get(workId) || 0,
        fullRank: fullMap.get(workId) || 0,
        humanQuality: work.humanQuality,
        recognitionCount: work.recognitionCount,
      });
    }

    // 按 fullRank 排序
    comparison.sort((a, b) => a.fullRank - b.fullRank);

    return comparison;
  }

  /**
   * 检测排名异常
   */
  private detectAnomalies(
    ranking: ExperimentalRankingResult[],
    works: Map<number, { title: string; humanQuality: number | null; views: number; recognitionCount: number }>
  ): RankingValidationReport['anomalies'] {
    const anomalies: RankingValidationReport['anomalies'] = [];

    for (const item of ranking.slice(0, 50)) {
      const work = works.get(item.workId);
      if (!work) continue;

      // 异常1：高排名但低人工评分
      if (item.rank <= 20 && work.humanQuality !== null && work.humanQuality <= 2) {
        anomalies.push({
          workId: item.workId,
          title: work.title,
          issue: 'HIGH_RANK_LOW_QUALITY',
          details: `Rank #${item.rank} but human quality = ${work.humanQuality}`,
        });
      }

      // 异常2：高排名但零认可信号
      if (item.rank <= 10 && work.recognitionCount === 0 && work.views > 100000) {
        anomalies.push({
          workId: item.workId,
          title: work.title,
          issue: 'HIGH_POPULARITY_NO_RECOGNITION',
          details: `Rank #${item.rank}, ${work.views} views, but no recognition signals`,
        });
      }

      // 异常3：低排名但高人工评分
      if (item.rank > 30 && work.humanQuality !== null && work.humanQuality >= 5) {
        anomalies.push({
          workId: item.workId,
          title: work.title,
          issue: 'LOW_RANK_HIGH_QUALITY',
          details: `Rank #${item.rank} but human quality = ${work.humanQuality}`,
        });
      }
    }

    return anomalies;
  }

  /**
   * 生成算法建议
   */
  private generateRecommendations(
    precision: RankingValidationReport['precision'],
    qualityAnalysis: RankingValidationReport['humanQualityAnalysis'],
    anomalies: RankingValidationReport['anomalies']
  ): string[] {
    const recommendations: string[] = [];

    // 基于 precision
    if (precision.fullRanking.at10 < 0.6) {
      recommendations.push('Full Ranking precision@10 is low (< 60%). Consider increasing Quality or Recognition weight.');
    }
    if (precision.fullRanking.at10 > precision.popularityOnly.at10) {
      recommendations.push('Full Ranking outperforms Popularity-only at top-10. Multi-factor ranking is working.');
    }

    // 基于 quality analysis
    if (qualityAnalysis.badWorksInTop10 > 0) {
      recommendations.push(`${qualityAnalysis.badWorksInTop10} low-quality works in Top 10. Consider strengthening Quality signal or human review gate.`);
    }
    if (qualityAnalysis.top10Avg < 4.0) {
      recommendations.push(`Top 10 average human quality (${qualityAnalysis.top10Avg}) is below 4.0. Ranking may need tuning.`);
    }

    // 基于 anomalies
    const highPopNoRecog = anomalies.filter(a => a.issue === 'HIGH_POPULARITY_NO_RECOGNITION').length;
    if (highPopNoRecog > 3) {
      recommendations.push(`${highPopNoRecog} high-popularity works lack recognition. Verify if they are truly AI Cinema or viral non-cinema content.`);
    }

    const lowRankHighQuality = anomalies.filter(a => a.issue === 'LOW_RANK_HIGH_QUALITY').length;
    if (lowRankHighQuality > 3) {
      recommendations.push(`${lowRankHighQuality} high-quality works are ranked below #30. Consider boosting Quality or Recognition signal.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('No major anomalies detected. Current ranking algorithm appears well-balanced.');
    }

    return recommendations;
  }

  /**
   * 获取作品的人工评分信息
   */
  private async getWorksWithHumanQuality(workIds: number[]): Promise<
    Map<number, { title: string; humanQuality: number | null; views: number; recognitionCount: number }>
  > {
    const map = new Map<number, { title: string; humanQuality: number | null; views: number; recognitionCount: number }>();

    for (const workId of workIds) {
      const work = await this.db
        .prepare('SELECT canonical_title, human_quality_rating FROM works WHERE id = ?')
        .bind(workId)
        .first<{ canonical_title: string; human_quality_rating: number | null }>();

      const { results: metrics } = await this.db
        .prepare('SELECT views FROM work_metrics WHERE work_id = ? ORDER BY collected_at DESC')
        .bind(workId)
        .all<{ views: number }>();

      const { results: recognition } = await this.db
        .prepare('SELECT COUNT(*) as count FROM recognition_signals WHERE work_id = ?')
        .bind(workId)
        .all<{ count: number }>();

      if (work) {
        map.set(workId, {
          title: work.canonical_title,
          humanQuality: work.human_quality_rating,
          views: metrics?.[0]?.views || 0,
          recognitionCount: recognition?.[0]?.count || 0,
        });
      }
    }

    return map;
  }

  /**
   * 获取 Seed Pool 统计
   */
  private async getSeedPoolStats(workIds: number[]): Promise<RankingValidationReport['seedPoolStats']> {
    const { results: typeResults } = await this.db
      .prepare(`SELECT type, COUNT(*) as count FROM works WHERE id IN (${workIds.join(',')}) GROUP BY type`)
      .all<{ type: string; count: number }>();

    const { results: sourceResults } = await this.db
      .prepare(`SELECT source_type, COUNT(DISTINCT work_id) as count FROM work_sources WHERE work_id IN (${workIds.join(',')}) GROUP BY source_type`)
      .all<{ source_type: string; count: number }>();

    const { results: recogResults } = await this.db
      .prepare(`SELECT award_level, COUNT(*) as count FROM recognition_signals WHERE work_id IN (${workIds.join(',')}) GROUP BY award_level`)
      .all<{ award_level: string; count: number }>();

    const { results: qualityResults } = await this.db
      .prepare(`SELECT human_quality_rating, COUNT(*) as count FROM works WHERE id IN (${workIds.join(',')}) GROUP BY human_quality_rating`)
      .all<{ human_quality_rating: number; count: number }>();

    const { results: popResults } = await this.db
      .prepare(`SELECT MIN(views) as min_views, MAX(views) as max_views, AVG(views) as avg_views FROM work_metrics WHERE work_id IN (${workIds.join(',')})`)
      .all<{ min_views: number; max_views: number; avg_views: number }>();

    const byType: Record<string, number> = {};
    for (const row of typeResults || []) byType[row.type] = row.count;

    const bySource: Record<string, number> = {};
    for (const row of sourceResults || []) bySource[row.source_type] = row.count;

    const recognitionDistribution: Record<string, number> = {};
    for (const row of recogResults || []) recognitionDistribution[row.award_level] = row.count;

    const humanQualityDistribution: Record<string, number> = {};
    for (const row of qualityResults || []) {
      if (row.human_quality_rating !== null) {
        humanQualityDistribution[String(row.human_quality_rating)] = row.count;
      }
    }

    const popRow = popResults?.[0];

    return {
      totalWorks: workIds.length,
      byType,
      bySource,
      recognitionDistribution,
      popularityDistribution: {
        min: popRow?.min_views || 0,
        max: popRow?.max_views || 0,
        avg: Math.round((popRow?.avg_views || 0) * 100) / 100,
      },
      humanQualityDistribution,
    };
  }

  /**
   * 生成 Markdown 报告
   */
  generateMarkdownReport(report: RankingValidationReport): string {
    const lines = [
      '# AI Film Chart - Ranking Validation Report',
      '',
      `Generated: ${report.generatedAt}`,
      '',
      '## Seed Pool Stats',
      `- Total Works: ${report.seedPoolStats.totalWorks}`,
      `- By Type: ${JSON.stringify(report.seedPoolStats.byType)}`,
      `- By Source: ${JSON.stringify(report.seedPoolStats.bySource)}`,
      `- Recognition: ${JSON.stringify(report.seedPoolStats.recognitionDistribution)}`,
      `- Popularity: min=${report.seedPoolStats.popularityDistribution.min}, max=${report.seedPoolStats.popularityDistribution.max}, avg=${report.seedPoolStats.popularityDistribution.avg}`,
      `- Human Quality: ${JSON.stringify(report.seedPoolStats.humanQualityDistribution)}`,
      '',
      '## Precision Metrics',
      '### Popularity Only',
      `- precision@10: ${(report.precision.popularityOnly.at10 * 100).toFixed(1)}%`,
      `- precision@20: ${(report.precision.popularityOnly.at20 * 100).toFixed(1)}%`,
      `- precision@50: ${(report.precision.popularityOnly.at50 * 100).toFixed(1)}%`,
      '',
      '### Popularity + Audience',
      `- precision@10: ${(report.precision.popularityAudience.at10 * 100).toFixed(1)}%`,
      `- precision@20: ${(report.precision.popularityAudience.at20 * 100).toFixed(1)}%`,
      `- precision@50: ${(report.precision.popularityAudience.at50 * 100).toFixed(1)}%`,
      '',
      '### Full Ranking (v0.2)',
      `- precision@10: ${(report.precision.fullRanking.at10 * 100).toFixed(1)}%`,
      `- precision@20: ${(report.precision.fullRanking.at20 * 100).toFixed(1)}%`,
      `- precision@50: ${(report.precision.fullRanking.at50 * 100).toFixed(1)}%`,
      '',
      '## Human Quality Analysis',
      `- Top 10 Avg: ${report.humanQualityAnalysis.top10Avg}`,
      `- Top 20 Avg: ${report.humanQualityAnalysis.top20Avg}`,
      `- Top 50 Avg: ${report.humanQualityAnalysis.top50Avg}`,
      `- Bad Works in Top 10: ${report.humanQualityAnalysis.badWorksInTop10}`,
      `- Bad Works in Top 20: ${report.humanQualityAnalysis.badWorksInTop20}`,
      `- Bad Works in Top 50: ${report.humanQualityAnalysis.badWorksInTop50}`,
      '',
      '## Ranking Comparison (Top 20)',
      '| Title | Popularity | Audience | Full | Quality | Recognition |',
      '|-------|-----------|----------|------|---------|-------------|',
      ...report.comparison.slice(0, 20).map(c =>
        `| ${c.title} | #${c.popularityRank} | #${c.audienceRank} | #${c.fullRank} | ${c.humanQuality ?? '-'} | ${c.recognitionCount} |`
      ),
      '',
      '## Anomalies',
      ...report.anomalies.map(a => `- **${a.issue}**: ${a.title} - ${a.details}`),
      '',
      '## Recommendations',
      ...report.recommendations.map(r => `- ${r}`),
    ];

    return lines.join('\n');
  }
}
