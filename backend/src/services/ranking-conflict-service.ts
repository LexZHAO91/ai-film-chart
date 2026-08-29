/**
 * Ranking Conflict Service
 *
 * 自动标记 Ranking Conflict Cases：
 * - Popular but Low Quality
 * - Low Popularity but High Quality
 * - High Recognition but Low Popularity
 * - High Momentum
 * - Small Rating Sample
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface ConflictCase {
  workId: number;
  title: string;
  conflictType: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  metrics: Record<string, number | string>;
}

export interface ConflictDataset {
  popularButLowQuality: ConflictCase[];
  lowPopularityHighQuality: ConflictCase[];
  highRecognitionLowPopularity: ConflictCase[];
  highMomentum: ConflictCase[];
  smallRatingSample: ConflictCase[];
  totalConflicts: number;
}

export class RankingConflictService {
  constructor(private db: D1Database) {}

  /**
   * 分析所有已批准作品，生成 Conflict Dataset
   */
  async analyzeConflicts(workIds: number[]): Promise<ConflictDataset> {
    const popularButLowQuality: ConflictCase[] = [];
    const lowPopularityHighQuality: ConflictCase[] = [];
    const highRecognitionLowPopularity: ConflictCase[] = [];
    const highMomentum: ConflictCase[] = [];
    const smallRatingSample: ConflictCase[] = [];

    for (const workId of workIds) {
      const work = await this.getWorkData(workId);
      if (!work) continue;

      // Conflict 1: Popular but Low Quality
      if (work.views > work.avgViews * 1.5 && work.humanQuality !== null && work.humanQuality <= 3) {
        popularButLowQuality.push({
          workId,
          title: work.title,
          conflictType: 'POPULAR_BUT_LOW_QUALITY',
          severity: 'high',
          description: `High popularity (${work.views} views) but low human quality (${work.humanQuality})`,
          metrics: { views: work.views, humanQuality: work.humanQuality, avgViews: work.avgViews },
        });
      }

      // Conflict 2: Low Popularity but High Quality
      if (work.views < work.avgViews * 0.5 && work.humanQuality !== null && work.humanQuality >= 4) {
        lowPopularityHighQuality.push({
          workId,
          title: work.title,
          conflictType: 'LOW_POPULARITY_HIGH_QUALITY',
          severity: 'medium',
          description: `Low popularity (${work.views} views) but high human quality (${work.humanQuality})`,
          metrics: { views: work.views, humanQuality: work.humanQuality, avgViews: work.avgViews },
        });
      }

      // Conflict 3: High Recognition but Low Popularity
      if (work.recognitionCount >= 2 && work.views < work.avgViews * 0.7) {
        highRecognitionLowPopularity.push({
          workId,
          title: work.title,
          conflictType: 'HIGH_RECOGNITION_LOW_POPULARITY',
          severity: 'medium',
          description: `${work.recognitionCount} recognition signals but only ${work.views} views`,
          metrics: { recognitionCount: work.recognitionCount, views: work.views, avgViews: work.avgViews },
        });
      }

      // Conflict 4: High Momentum
      if (work.momentumScore > 0.7) {
        highMomentum.push({
          workId,
          title: work.title,
          conflictType: 'HIGH_MOMENTUM',
          severity: 'low',
          description: `High momentum score (${(work.momentumScore * 100).toFixed(1)}%)`,
          metrics: { momentumScore: work.momentumScore, views: work.views, prevViews: work.prevViews },
        });
      }

      // Conflict 5: Small Rating Sample
      if (work.ratingCount > 0 && work.ratingCount < 10 && work.audienceRating > 8) {
        smallRatingSample.push({
          workId,
          title: work.title,
          conflictType: 'SMALL_RATING_SAMPLE',
          severity: 'low',
          description: `High rating (${work.audienceRating}) but only ${work.ratingCount} ratings`,
          metrics: { audienceRating: work.audienceRating, ratingCount: work.ratingCount },
        });
      }
    }

    return {
      popularButLowQuality,
      lowPopularityHighQuality,
      highRecognitionLowPopularity,
      highMomentum,
      smallRatingSample,
      totalConflicts:
        popularButLowQuality.length +
        lowPopularityHighQuality.length +
        highRecognitionLowPopularity.length +
        highMomentum.length +
        smallRatingSample.length,
    };
  }

  private async getWorkData(workId: number) {
    const work = await this.db
      .prepare('SELECT id, canonical_title, human_quality_rating FROM works WHERE id = ?')
      .bind(workId)
      .first<{ id: number; canonical_title: string; human_quality_rating: number | null }>();

    if (!work) return null;

    // Get latest metrics
    const { results: metrics } = await this.db
      .prepare('SELECT views, likes, comments, audience_rating FROM work_metrics WHERE work_id = ? ORDER BY collected_at DESC')
      .bind(workId)
      .all<{ views: number; likes: number; comments: number; audience_rating: number }>();

    const latest = metrics?.[0];
    const previous = metrics?.[1];

    // Get recognition count
    const { results: recog } = await this.db
      .prepare('SELECT COUNT(*) as count FROM recognition_signals WHERE work_id = ?')
      .bind(workId)
      .all<{ count: number }>();

    // Get average views across all works for comparison
    const { results: avgResult } = await this.db
      .prepare('SELECT AVG(views) as avg_views FROM work_metrics WHERE collected_at = (SELECT MAX(collected_at) FROM work_metrics)')
      .all<{ avg_views: number }>();

    const avgViews = avgResult?.[0]?.avg_views || 50000;

    // Calculate momentum
    let momentumScore = 0.3;
    if (latest && previous && previous.views > 0) {
      const growth = (latest.views - previous.views) / previous.views;
      momentumScore = Math.min(Math.max(growth * 0.5, 0), 1);
    }

    return {
      id: work.id,
      title: work.canonical_title,
      humanQuality: work.human_quality_rating,
      views: latest?.views || 0,
      likes: latest?.likes || 0,
      comments: latest?.comments || 0,
      audienceRating: latest?.audience_rating || 0,
      ratingCount: 0, // TODO: from ratings table
      recognitionCount: recog?.[0]?.count || 0,
      avgViews,
      momentumScore,
      prevViews: previous?.views || 0,
    };
  }
}
