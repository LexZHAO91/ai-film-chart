/**
 * Three Experimental Ranking Engines
 *
 * Ranking A — Popularity Only
 * Ranking B — Popularity + Audience (no Quality, no Recognition)
 * Ranking C — Full Ranking (v0.2 with Recognition)
 *
 * All three run as shadow rankings. The official ranking remains v0.1.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { RecognitionSignalService } from '../services/recognition-signal-service';

export interface ExperimentalRankingInput {
  workId: number;
  title: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  audienceRating: number;
  aiContributionLevel: number;
}

export interface ExperimentalRankingResult {
  workId: number;
  title: string;
  rank: number;
  score: number;
  breakdown: Record<string, number>;
}

// ==================== Ranking A: Popularity Only ====================

export class PopularityOnlyEngine {
  calculate(input: ExperimentalRankingInput): number {
    if (input.views <= 0) return 0;
    const logViews = Math.log10(input.views);
    return Math.min(logViews / 6, 1.0);
  }

  async runRanking(db: D1Database, workIds: number[]): Promise<ExperimentalRankingResult[]> {
    const results: ExperimentalRankingResult[] = [];

    for (const workId of workIds) {
      const work = await this.getWorkWithMetrics(db, workId);
      if (!work) continue;

      const score = this.calculate(work);
      results.push({
        workId,
        title: work.title,
        rank: 0,
        score,
        breakdown: { popularity: score },
      });
    }

    results.sort((a, b) => b.score - a.score);
    results.forEach((r, i) => { r.rank = i + 1; });

    return results;
  }

  private async getWorkWithMetrics(db: D1Database, workId: number) {
    const work = await db
      .prepare('SELECT id, canonical_title, ai_contribution_level FROM works WHERE id = ?')
      .bind(workId)
      .first<{ id: number; canonical_title: string; ai_contribution_level: number }>();

    if (!work) return null;

    const { results: metrics } = await db
      .prepare('SELECT views, likes, comments, shares, audience_rating FROM work_metrics WHERE work_id = ? ORDER BY collected_at DESC')
      .bind(workId)
      .all<{ views: number; likes: number; comments: number; shares: number; audience_rating: number }>();

    const latest = metrics?.[0];

    return {
      workId: work.id,
      title: work.canonical_title,
      views: latest?.views || 0,
      likes: latest?.likes || 0,
      comments: latest?.comments || 0,
      shares: latest?.shares || 0,
      audienceRating: latest?.audience_rating || 0,
      aiContributionLevel: work.ai_contribution_level || 0,
    };
  }
}

// ==================== Ranking B: Popularity + Audience ====================

export class PopularityAudienceEngine {
  calculate(input: ExperimentalRankingInput): { score: number; breakdown: Record<string, number> } {
    const popularity = this.calculatePopularity(input.views);
    const momentum = this.calculateMomentum(input.views, input.likes, input.comments);
    const engagement = this.calculateEngagement(input.views, input.likes, input.comments);
    const audience = this.calculateAudience(input.audienceRating);

    const score =
      popularity * 0.35 +
      momentum * 0.25 +
      engagement * 0.20 +
      audience * 0.20;

    return {
      score,
      breakdown: { popularity, momentum, engagement, audience },
    };
  }

  async runRanking(db: D1Database, workIds: number[]): Promise<ExperimentalRankingResult[]> {
    const results: ExperimentalRankingResult[] = [];

    for (const workId of workIds) {
      const work = await this.getWorkWithMetrics(db, workId);
      if (!work) continue;

      const { score, breakdown } = this.calculate(work);
      results.push({
        workId,
        title: work.title,
        rank: 0,
        score,
        breakdown,
      });
    }

    results.sort((a, b) => b.score - a.score);
    results.forEach((r, i) => { r.rank = i + 1; });

    return results;
  }

  private calculatePopularity(views: number): number {
    if (views <= 0) return 0;
    return Math.min(Math.log10(views) / 6, 1.0);
  }

  private calculateMomentum(views: number, likes: number, comments: number): number {
    if (views < 100) return 0.3;
    const engagementRate = (likes + comments) / views;
    return Math.min(engagementRate * 10, 1.0);
  }

  private calculateEngagement(views: number, likes: number, comments: number): number {
    if (views < 100) return 0.3;
    const likeRate = likes / views;
    const commentRate = comments / views;
    return Math.min(likeRate / 0.05 * 0.6 + commentRate / 0.01 * 0.4, 1.0);
  }

  private calculateAudience(rating: number): number {
    if (rating <= 0) return 0.5;
    return Math.min(rating / 10, 1.0);
  }

  private async getWorkWithMetrics(db: D1Database, workId: number) {
    const work = await db
      .prepare('SELECT id, canonical_title, ai_contribution_level FROM works WHERE id = ?')
      .bind(workId)
      .first<{ id: number; canonical_title: string; ai_contribution_level: number }>();

    if (!work) return null;

    const { results: metrics } = await db
      .prepare('SELECT views, likes, comments, shares, audience_rating FROM work_metrics WHERE work_id = ? ORDER BY collected_at DESC')
      .bind(workId)
      .all<{ views: number; likes: number; comments: number; shares: number; audience_rating: number }>();

    const latest = metrics?.[0];

    return {
      workId: work.id,
      title: work.canonical_title,
      views: latest?.views || 0,
      likes: latest?.likes || 0,
      comments: latest?.comments || 0,
      shares: latest?.shares || 0,
      audienceRating: latest?.audience_rating || 0,
      aiContributionLevel: work.ai_contribution_level || 0,
    };
  }
}

// ==================== Ranking C: Full Ranking (v0.2) ====================

export class FullRankingEngine {
  private recognitionService: RecognitionSignalService;

  constructor(private db: D1Database) {
    this.recognitionService = new RecognitionSignalService(db);
  }

  calculate(
    input: ExperimentalRankingInput,
    recognitionScore: number
  ): { score: number; breakdown: Record<string, number> } {
    const popularity = this.calculatePopularity(input.views);
    const momentum = this.calculateMomentum(input.views, input.likes, input.comments);
    const engagement = this.calculateEngagement(input.views, input.likes, input.comments);
    const audience = this.calculateAudience(input.audienceRating);
    const quality = this.calculateQuality(input.aiContributionLevel);

    const score =
      popularity * 0.30 +
      momentum * 0.20 +
      engagement * 0.15 +
      audience * 0.15 +
      quality * 0.10 +
      recognitionScore * 0.10;

    return {
      score,
      breakdown: { popularity, momentum, engagement, audience, quality, recognition: recognitionScore },
    };
  }

  async runRanking(db: D1Database, workIds: number[]): Promise<ExperimentalRankingResult[]> {
    const recognitionScores = await this.recognitionService.calculateScores(workIds);
    const results: ExperimentalRankingResult[] = [];

    for (const workId of workIds) {
      const work = await this.getWorkWithMetrics(db, workId);
      if (!work) continue;

      const recScore = recognitionScores.get(workId)?.totalScore || 0;
      const { score, breakdown } = this.calculate(work, recScore);

      results.push({
        workId,
        title: work.title,
        rank: 0,
        score,
        breakdown,
      });
    }

    results.sort((a, b) => b.score - a.score);
    results.forEach((r, i) => { r.rank = i + 1; });

    return results;
  }

  private calculatePopularity(views: number): number {
    if (views <= 0) return 0;
    return Math.min(Math.log10(views) / 6, 1.0);
  }

  private calculateMomentum(views: number, likes: number, comments: number): number {
    if (views < 100) return 0.3;
    const engagementRate = (likes + comments) / views;
    return Math.min(engagementRate * 10, 1.0);
  }

  private calculateEngagement(views: number, likes: number, comments: number): number {
    if (views < 100) return 0.3;
    const likeRate = likes / views;
    const commentRate = comments / views;
    return Math.min(likeRate / 0.05 * 0.6 + commentRate / 0.01 * 0.4, 1.0);
  }

  private calculateAudience(rating: number): number {
    if (rating <= 0) return 0.5;
    return Math.min(rating / 10, 1.0);
  }

  private calculateQuality(aiContributionLevel: number): number {
    return Math.min(Math.max(aiContributionLevel, 0), 1.0);
  }

  private async getWorkWithMetrics(db: D1Database, workId: number) {
    const work = await db
      .prepare('SELECT id, canonical_title, ai_contribution_level FROM works WHERE id = ?')
      .bind(workId)
      .first<{ id: number; canonical_title: string; ai_contribution_level: number }>();

    if (!work) return null;

    const { results: metrics } = await db
      .prepare('SELECT views, likes, comments, shares, audience_rating FROM work_metrics WHERE work_id = ? ORDER BY collected_at DESC')
      .bind(workId)
      .all<{ views: number; likes: number; comments: number; shares: number; audience_rating: number }>();

    const latest = metrics?.[0];

    return {
      workId: work.id,
      title: work.canonical_title,
      views: latest?.views || 0,
      likes: latest?.likes || 0,
      comments: latest?.comments || 0,
      shares: latest?.shares || 0,
      audienceRating: latest?.audience_rating || 0,
      aiContributionLevel: work.ai_contribution_level || 0,
    };
  }
}
