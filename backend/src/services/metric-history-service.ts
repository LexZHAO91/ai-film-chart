import type { D1Database } from '@cloudflare/workers-types';
import type { FilmMetrics } from '../types';

export interface GrowthMetrics {
  growth24h: number;
  growth48h: number;
  growth7d: number;
  growth14d: number;
  absoluteGrowth24h: number;
  absoluteGrowth7d: number;
  growthRate24h: number;
  growthRate7d: number;
  growthAcceleration: number;
  dataConfidence: number;
}

/**
 * MetricHistoryService
 *
 * 计算基于历史 metrics 的各种增长指标。
 * 关键原则：
 * 1. 不覆盖旧数据
 * 2. 小样本保护（避免极少数据的异常增长率冲榜）
 * 3. 同时考虑相对增长率和绝对增长量
 */
export class MetricHistoryService {
  constructor(private db: D1Database) {}

  async getGrowthMetrics(filmId: number): Promise<GrowthMetrics | null> {
    const { results } = await this.db
      .prepare(`
        SELECT * FROM film_metrics
        WHERE film_id = ?
        ORDER BY collected_at DESC
        LIMIT 30
      `)
      .bind(filmId)
      .all<FilmMetrics>();

    const metrics = results || [];
    if (metrics.length < 2) return null;

    const sorted = [...metrics].sort(
      (a, b) => new Date(a.collected_at).getTime() - new Date(b.collected_at).getTime()
    );

    const latest = sorted[sorted.length - 1];

    // Find metrics at specific time points
    const dayAgo = this.findMetricAtDaysAgo(sorted, 1);
    const twoDaysAgo = this.findMetricAtDaysAgo(sorted, 2);
    const sevenDaysAgo = this.findMetricAtDaysAgo(sorted, 7);
    const fourteenDaysAgo = this.findMetricAtDaysAgo(sorted, 14);

    // Calculate growths with small-sample protection
    const growth24h = this.calculateProtectedGrowth(latest, dayAgo);
    const growth48h = this.calculateProtectedGrowth(latest, twoDaysAgo);
    const growth7d = this.calculateProtectedGrowth(latest, sevenDaysAgo);
    const growth14d = this.calculateProtectedGrowth(latest, fourteenDaysAgo);

    // Absolute growth
    const absoluteGrowth24h = dayAgo ? latest.views - dayAgo.views : 0;
    const absoluteGrowth7d = sevenDaysAgo ? latest.views - sevenDaysAgo.views : 0;

    // Growth rates (per day)
    const growthRate24h = dayAgo ? (latest.views - dayAgo.views) / Math.max(dayAgo.views, 1) : 0;
    const growthRate7d = sevenDaysAgo
      ? (latest.views - sevenDaysAgo.views) / Math.max(sevenDaysAgo.views, 1) / 7
      : 0;

    // Acceleration: is growth speeding up or slowing down?
    const growthAcceleration = growthRate24h - growthRate7d;

    // Data confidence: based on sample size and data freshness
    const dataConfidence = this.calculateDataConfidence(sorted, latest);

    return {
      growth24h,
      growth48h,
      growth7d,
      growth14d,
      absoluteGrowth24h,
      absoluteGrowth7d,
      growthRate24h,
      growthRate7d,
      growthAcceleration,
      dataConfidence,
    };
  }

  private findMetricAtDaysAgo(sortedMetrics: FilmMetrics[], daysAgo: number): FilmMetrics | null {
    const target = new Date();
    target.setDate(target.getDate() - daysAgo);

    let closest: FilmMetrics | null = null;
    let closestDiff = Infinity;

    for (const m of sortedMetrics) {
      const diff = Math.abs(new Date(m.collected_at).getTime() - target.getTime());
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = m;
      }
    }

    // Only return if within reasonable time window (±12 hours)
    if (closest && closestDiff <= 12 * 60 * 60 * 1000) {
      return closest;
    }

    return null;
  }

  /**
   * Small-sample protection:
   * If base views are very low, cap the growth rate to avoid anomalies.
   * A video with 10 views going to 100 views has 900% growth,
   * but that's less meaningful than 10K to 100K.
   */
  private calculateProtectedGrowth(latest: FilmMetrics, previous: FilmMetrics | null): number {
    if (!previous || previous.views === 0) return 0;

    const baseViews = previous.views;
    const rawGrowth = (latest.views - baseViews) / baseViews;

    // Small sample protection
    if (baseViews < 100) {
      // Cap growth for very small samples
      return Math.min(rawGrowth, 2.0); // Max 200% growth for < 100 views
    }
    if (baseViews < 1000) {
      return Math.min(rawGrowth, 5.0); // Max 500% growth for < 1K views
    }

    return rawGrowth;
  }

  /**
   * Data confidence measures how reliable the metrics are:
   * - More data points = higher confidence
   * - Recent data = higher confidence
   * - Larger view counts = higher confidence (less volatile)
   */
  private calculateDataConfidence(sortedMetrics: FilmMetrics[], latest: FilmMetrics): number {
    const dataPointScore = Math.min(sortedMetrics.length / 10, 1.0); // 10+ points = full score
    const recencyScore = this.calculateRecencyScore(latest.collected_at);
    const volumeScore = Math.min(Math.log10(Math.max(latest.views, 1)) / 6, 1.0);

    return dataPointScore * 0.4 + recencyScore * 0.3 + volumeScore * 0.3;
  }

  private calculateRecencyScore(lastCollectedAt: string): number {
    const hoursSinceLastCollection =
      (Date.now() - new Date(lastCollectedAt).getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastCollection <= 6) return 1.0;
    if (hoursSinceLastCollection <= 24) return 0.9;
    if (hoursSinceLastCollection <= 48) return 0.7;
    if (hoursSinceLastCollection <= 72) return 0.5;
    return 0.3;
  }
}
