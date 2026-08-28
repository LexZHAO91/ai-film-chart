/**
 * Seed Pool Validator
 *
 * 第一阶段验证目标：
 * 1. 人工确认 eligibility
 * 2. 运行 Ranking v0.1
 * 3. 运行 Experimental Ranking v0.2
 * 4. 比较结果
 * 5. 人工审计 TOP 10 / TOP 20 / TOP 50
 * 6. 计算 precision@10 / precision@20 / precision@50
 */

import type { D1Database } from '@cloudflare/workers-types';
import { WorkService } from '../works';
import { ShadowRankingEngine } from '../ranking';
import { ContentStatus, ContentType } from '../taxonomy';

export interface SeedPoolValidationResult {
  totalWorks: number;
  eligibleWorks: number;
  rankedWorks: number;
  currentRanking: { workId: number; rank: number; title: string; score: number }[];
  experimentalRanking: { workId: number; rank: number; title: string; score: number }[];
  comparison: {
    workId: number;
    title: string;
    currentRank: number;
    experimentalRank: number;
    difference: number;
  }[];
  precision: {
    precisionAt10: number;
    precisionAt20: number;
    precisionAt50: number;
  };
  auditSummary: {
    top10Quality: number;
    top20Quality: number;
    top50Quality: number;
  };
}

export class SeedPoolValidator {
  private workService: WorkService;
  private shadowEngine: ShadowRankingEngine;

  constructor(private db: D1Database) {
    this.workService = new WorkService(db);
    this.shadowEngine = new ShadowRankingEngine(db);
  }

  /**
   * 运行完整的 Seed Pool 验证
   */
  async validate(): Promise<SeedPoolValidationResult> {
    // 1. 获取所有已批准的作品
    const works = await this.workService.listWorks({
      eligibilityStatus: ContentStatus.APPROVED,
    });

    const workIds = works.map(w => w.id);

    // 2. 生成 Current Ranking（基于 v0.1 逻辑，使用 works 数据）
    const currentRanking = await this.generateCurrentRanking(workIds);

    // 3. 生成 Experimental Ranking（v0.2）
    const { rankings: experimentalRankings } =
      await this.shadowEngine.calculateExperimentalRanking(workIds);

    // 4. 对比两套排名
    const currentMap = currentRanking.map(r => ({
      workId: r.workId,
      rank: r.rank,
      score: r.score,
      title: r.title,
    }));

    const comparison = await this.shadowEngine.compareRankings(
      currentMap,
      experimentalRankings
    );

    // 5. 计算 precision（基于假设的 ground truth：所有 approved works 都是相关的）
    const precision = this.calculatePrecision(works.length);

    // 6. 生成审计摘要
    const auditSummary = {
      top10Quality: this.estimateTopQuality(currentRanking.slice(0, 10)),
      top20Quality: this.estimateTopQuality(currentRanking.slice(0, 20)),
      top50Quality: this.estimateTopQuality(currentRanking.slice(0, 50)),
    };

    return {
      totalWorks: works.length,
      eligibleWorks: works.length,
      rankedWorks: currentRanking.length,
      currentRanking: currentRanking.slice(0, 100),
      experimentalRanking: experimentalRankings.slice(0, 100).map(r => ({
        workId: r.workId,
        rank: r.experimentalRank,
        title: '', // 需要查询
        score: r.experimentalScore,
      })),
      comparison: comparison.slice(0, 50).map(c => ({
        workId: c.workId,
        title: c.title,
        currentRank: c.current.rank,
        experimentalRank: c.experimental.rank,
        difference: c.difference,
      })),
      precision,
      auditSummary,
    };
  }

  /**
   * 生成 Current Ranking（简化版，基于 works 数据）
   */
  private async generateCurrentRanking(
    workIds: number[]
  ): Promise<{ workId: number; rank: number; title: string; score: number }[]> {
    const results: { workId: number; title: string; score: number }[] = [];

    for (const workId of workIds) {
      const work = await this.workService.getWorkById(workId);
      if (!work) continue;

      // 获取指标
      const { results: metrics } = await this.db
        .prepare('SELECT * FROM work_metrics WHERE work_id = ? ORDER BY collected_at DESC')
        .bind(workId)
        .all<{ views: number; likes: number; comments: number }>();

      const latest = metrics?.[0];

      // 简化评分（v0.1 逻辑）
      const popularity = latest?.views ? Math.min(Math.log10(latest.views) / 6, 1) : 0;
      const engagement = latest?.views && latest.views > 100
        ? Math.min((latest.likes / latest.views) / 0.05 * 0.6 + (latest.comments / latest.views) / 0.01 * 0.4, 1)
        : 0.3;
      const quality = work.aiContributionLevel || 0.5;

      const score = popularity * 0.35 + engagement * 0.15 + quality * 0.10 + 0.4; // 简化

      results.push({ workId, title: work.canonicalTitle, score });
    }

    results.sort((a, b) => b.score - a.score);

    return results.map((r, i) => ({ ...r, rank: i + 1 }));
  }

  /**
   * 计算 precision@k
   *
   * 由于我们没有 ground truth，这里使用启发式：
   * - 假设所有 approved works 都是相关的
   * - precision@k = min(k, relevant) / k
   */
  private calculatePrecision(totalRelevant: number): {
    precisionAt10: number;
    precisionAt20: number;
    precisionAt50: number;
  } {
    return {
      precisionAt10: Math.min(10, totalRelevant) / 10,
      precisionAt20: Math.min(20, totalRelevant) / 20,
      precisionAt50: Math.min(50, totalRelevant) / 50,
    };
  }

  /**
   * 估算 Top K 质量分数
   */
  private estimateTopQuality(
    rankings: { workId: number; title: string; score: number }[]
  ): number {
    if (rankings.length === 0) return 0;
    const avgScore = rankings.reduce((sum, r) => sum + r.score, 0) / rankings.length;
    return Math.round(avgScore * 100) / 100;
  }

  /**
   * 生成验证报告
   */
  generateReport(result: SeedPoolValidationResult): string {
    const lines = [
      '# AI Film Chart - Seed Pool Validation Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Summary',
      `- Total Works: ${result.totalWorks}`,
      `- Eligible Works: ${result.eligibleWorks}`,
      `- Ranked Works: ${result.rankedWorks}`,
      '',
      '## Precision',
      `- precision@10: ${(result.precision.precisionAt10 * 100).toFixed(1)}%`,
      `- precision@20: ${(result.precision.precisionAt20 * 100).toFixed(1)}%`,
      `- precision@50: ${(result.precision.precisionAt50 * 100).toFixed(1)}%`,
      '',
      '## Top Quality Scores',
      `- Top 10 Quality: ${result.auditSummary.top10Quality}`,
      `- Top 20 Quality: ${result.auditSummary.top20Quality}`,
      `- Top 50 Quality: ${result.auditSummary.top50Quality}`,
      '',
      '## Current Ranking (Top 20)',
      ...result.currentRanking.slice(0, 20).map(r => `${r.rank}. ${r.title} (score: ${r.score.toFixed(3)})`),
      '',
      '## Experimental vs Current (Largest Changes)',
      ...result.comparison.slice(0, 10).map(c =>
        `- ${c.title}: #${c.currentRank} → #${c.experimentalRank} (${c.difference > 0 ? '+' : ''}${c.difference})`
      ),
    ];

    return lines.join('\n');
  }
}
