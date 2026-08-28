/**
 * Shadow Ranking Engine (v0.2 Experimental)
 *
 * 核心功能：
 * - 同时计算 Current Ranking (v0.1) 和 Experimental Ranking (v0.2)
 * - v0.2 新增 Recognition Score 维度
 * - Admin 页面显示两套结果的差异
 * - 前端仍然显示当前正式榜单
 *
 * v0.2 权重（实验性）：
 * - Popularity: 30% (↓5%)
 * - Momentum: 20% (↓5%)
 * - Engagement: 15% (-)
 * - Audience: 15% (-)
 * - Quality: 10% (-)
 * - Recognition: 10% (新增)
 */

import type { D1Database } from '@cloudflare/workers-types';
import { RankingEngineV2, type RankingInputV2, type ScoreBreakdownV2 } from './ranking-engine-v2';
import { RecognitionSignalService } from '../services/recognition-signal-service';

export interface ShadowScoreBreakdown extends ScoreBreakdownV2 {
  recognition: number;
}

export interface ShadowRankingResult {
  workId: number;
  currentRank: number;
  experimentalRank: number;
  rankChange: number; // positive = moved up in experimental
  currentScore: number;
  experimentalScore: number;
  scoreBreakdown: ShadowScoreBreakdown;
  recognitionSignals: number;
}

export interface RankingComparison {
  workId: number;
  title: string;
  current: {
    rank: number;
    score: number;
  };
  experimental: {
    rank: number;
    score: number;
  };
  difference: number; // experimental rank - current rank (negative = improved)
}

export const V0_2_CONFIG = {
  version: 'v0.2',
  popularity_weight: 0.30,
  momentum_weight: 0.20,
  engagement_weight: 0.15,
  audience_weight: 0.15,
  quality_weight: 0.10,
  recognition_weight: 0.10,
  minimum_rating_count: 5,
};

export class ShadowRankingEngine {
  private recognitionService: RecognitionSignalService;

  constructor(private db: D1Database) {
    this.recognitionService = new RecognitionSignalService(db);
  }

  /**
   * 计算实验性排名（v0.2）
   *
   * 输入：基于 works 表的候选作品
   */
  async calculateExperimentalRanking(workIds: number[]): Promise<{
    rankings: ShadowRankingResult[];
    comparison: RankingComparison[];
  }> {
    const rankings: ShadowRankingResult[] = [];

    // 批量获取 recognition scores
    const recognitionScores = await this.recognitionService.calculateScores(workIds);

    for (const workId of workIds) {
      // 获取 work 的指标（从 work_metrics）
      const { results: metricsResults } = await this.db
        .prepare('SELECT * FROM work_metrics WHERE work_id = ? ORDER BY collected_at DESC')
        .bind(workId)
        .all<{
          views: number;
          likes: number;
          comments: number;
          shares: number;
          audience_rating: number;
        }>();

      const metrics = metricsResults || [];
      const latest = metrics[0];

      // 获取 work 基本信息
      const work = await this.db
        .prepare('SELECT id, canonical_title, ai_contribution_level FROM works WHERE id = ?')
        .bind(workId)
        .first<{ id: number; canonical_title: string; ai_contribution_level: number }>();

      if (!work) continue;

      // 计算各项指标
      const popularity = this.calculatePopularity(latest?.views || 0);
      const momentum = this.calculateMomentum(metrics);
      const engagement = this.calculateEngagement(latest);
      const audience = this.calculateAudience(latest?.audience_rating || 0);
      const quality = this.calculateQuality(work.ai_contribution_level || 0);
      const recognition = recognitionScores.get(workId)?.totalScore || 0;

      const experimentalScore =
        popularity * V0_2_CONFIG.popularity_weight +
        momentum * V0_2_CONFIG.momentum_weight +
        engagement * V0_2_CONFIG.engagement_weight +
        audience * V0_2_CONFIG.audience_weight +
        quality * V0_2_CONFIG.quality_weight +
        recognition * V0_2_CONFIG.recognition_weight;

      rankings.push({
        workId,
        currentRank: 0, // 会在后续填充
        experimentalRank: 0,
        rankChange: 0,
        currentScore: 0, // 需要与 v0.1 对比时填充
        experimentalScore,
        scoreBreakdown: {
          popularity,
          momentum,
          engagement,
          audience,
          quality,
          recognition,
          dataConfidence: 0.8,
        },
        recognitionSignals: recognitionScores.get(workId)?.signalCount || 0,
      });
    }

    // 按实验分数排序
    rankings.sort((a, b) => b.experimentalScore - a.experimentalScore);
    rankings.forEach((r, i) => {
      r.experimentalRank = i + 1;
    });

    // 生成对比（需要 current ranking 数据，这里先返回结构）
    const comparison: RankingComparison[] = rankings.map(r => ({
      workId: r.workId,
      title: '', // 需要查询
      current: { rank: r.currentRank, score: r.currentScore },
      experimental: { rank: r.experimentalRank, score: r.experimentalScore },
      difference: r.currentRank - r.experimentalRank,
    }));

    return { rankings, comparison };
  }

  /**
   * 对比两套排名结果
   */
  async compareRankings(
    currentRankings: { workId: number; rank: number; score: number; title: string }[],
    experimentalRankings: ShadowRankingResult[]
  ): Promise<RankingComparison[]> {
    const currentMap = new Map(currentRankings.map(r => [r.workId, r]));
    const experimentalMap = new Map(experimentalRankings.map(r => [r.workId, r]));

    const allWorkIds = new Set([
      ...currentRankings.map(r => r.workId),
      ...experimentalRankings.map(r => r.workId),
    ]);

    const comparisons: RankingComparison[] = [];

    for (const workId of allWorkIds) {
      const current = currentMap.get(workId);
      const experimental = experimentalMap.get(workId);

      if (!current || !experimental) continue;

      comparisons.push({
        workId,
        title: current.title,
        current: { rank: current.rank, score: current.score },
        experimental: { rank: experimental.experimentalRank, score: experimental.experimentalScore },
        difference: current.rank - experimental.experimentalRank,
      });
    }

    // 按差异绝对值排序（变化最大的在前）
    comparisons.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

    return comparisons;
  }

  // ==================== Score Calculations ====================

  private calculatePopularity(views: number): number {
    if (views <= 0) return 0;
    const logViews = Math.log10(views);
    return Math.min(logViews / 6, 1.0);
  }

  private calculateMomentum(metrics: { views: number; collected_at?: string }[]): number {
    if (metrics.length < 2) return 0.3;

    const latest = metrics[0];
    const previous = metrics[1];
    const growth = (latest.views - previous.views) / Math.max(previous.views, 1);

    return Math.min(growth * 0.5, 1.0);
  }

  private calculateEngagement(latest: { views: number; likes: number; comments: number } | undefined): number {
    if (!latest || latest.views < 100) return 0.3;

    const likeRate = latest.likes / latest.views;
    const commentRate = latest.comments / latest.views;

    return Math.min(likeRate / 0.05 * 0.6 + commentRate / 0.01 * 0.4, 1.0);
  }

  private calculateAudience(rating: number): number {
    if (rating <= 0) return 0.5;
    return Math.min(rating / 10, 1.0);
  }

  private calculateQuality(aiContributionLevel: number): number {
    return Math.min(Math.max(aiContributionLevel, 0), 1.0);
  }
}
