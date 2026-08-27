import type { Film, FilmMetrics, RankingConfig, RankingScores } from '../types';
import type { D1Database } from '@cloudflare/workers-types';
import { MetricHistoryService } from '../services/metric-history-service';

export interface RankingInputV2 {
  film: Film;
  metrics: FilmMetrics[];
  latestMetrics: FilmMetrics;
  ratings: { rating: number; count: number };
  aiAnalysis: { story_completeness: number; ai_generation_level: number } | null;
  growthMetrics: {
    growth24h: number;
    growth7d: number;
    growthAcceleration: number;
    absoluteGrowth24h: number;
    dataConfidence: number;
  } | null;
}

export interface ScoreBreakdownV2 {
  popularity: number;
  momentum: number;
  engagement: number;
  audience: number;
  quality: number;
  dataConfidence: number;
}

/**
 * Ranking Engine v0.1
 *
 * 核心设计原则：
 * 1. Quality 长期稳定，不因热度下降而大幅降低
 * 2. Popularity 长期影响
 * 3. Momentum 短期动态
 * 4. 所有参数从 ranking_configs 读取
 * 5. data_confidence 用于调试，不直接加入最终权重
 */
export class RankingEngineV2 {
  constructor(private config: RankingConfig) {}

  calculateScores(input: RankingInputV2): ScoreBreakdownV2 & { final: number } {
    const popularity = this.calculatePopularityScore(input.latestMetrics.views);
    const momentum = this.calculateMomentumScore(input.growthMetrics, input.latestMetrics.views);
    const engagement = this.calculateEngagementScore(input.latestMetrics);
    const audience = this.calculateAudienceScore(input.ratings);
    const quality = this.calculateQualityScore(input.aiAnalysis);

    // Data confidence: measures reliability of current data (for debugging, not weighting)
    const dataConfidence = input.growthMetrics?.dataConfidence || 0.5;

    const final =
      popularity * this.config.popularity_weight +
      momentum * this.config.momentum_weight +
      engagement * this.config.engagement_weight +
      audience * this.config.audience_weight +
      quality * this.config.quality_weight;

    return {
      popularity,
      momentum,
      engagement,
      audience,
      quality,
      dataConfidence,
      final,
    };
  }

  private calculatePopularityScore(views: number): number {
    if (views <= 0) return 0;
    const logViews = Math.log10(views);
    // Normalize: 1K views ≈ 0.5, 1M views ≈ 1.0
    const normalized = Math.min(logViews / 6, 1.0);
    return Math.max(0, normalized);
  }

  private calculateMomentumScore(
    growthMetrics: RankingInputV2['growthMetrics'],
    currentViews: number
  ): number {
    if (!growthMetrics) return 0.3; // neutral baseline

    // Small-sample protection: if current views < 500, dampen momentum
    const sampleDampening = Math.min(currentViews / 500, 1.0);

    // Combine relative growth and absolute growth
    const relativeGrowth = Math.min(growthMetrics.growth24h * 0.5, 1.0);
    const absoluteGrowth = Math.min(growthMetrics.absoluteGrowth24h / 10000, 1.0); // 10K/day = max
    const acceleration = Math.min(growthMetrics.growthAcceleration * 2, 1.0);

    const momentum = (relativeGrowth * 0.4 + absoluteGrowth * 0.35 + acceleration * 0.25) * sampleDampening;

    return Math.min(Math.max(momentum, 0), 1.0);
  }

  private calculateEngagementScore(metrics: FilmMetrics): number {
    const views = Math.max(metrics.views, 1);
    const likeRate = metrics.likes / views;
    const commentRate = metrics.comments / views;

    // Prevent small sample anomalies: require at least 100 views
    if (views < 100) {
      return 0.3; // neutral baseline for new videos
    }

    // Like rate: 5% is excellent, 1% is average
    const likeScore = Math.min(likeRate / 0.05, 1.0);
    // Comment rate: 1% is excellent, 0.1% is average
    const commentScore = Math.min(commentRate / 0.01, 1.0);

    return Math.min(likeScore * 0.6 + commentScore * 0.4, 1.0);
  }

  private calculateAudienceScore(ratings: { rating: number; count: number }): number {
    if (ratings.count === 0) return 0.5; // neutral if no ratings

    // Bayesian average: assume prior of 5 ratings at 5.0
    const priorCount = 5;
    const priorMean = 5.0;
    const bayesianAverage =
      (ratings.rating * ratings.count + priorMean * priorCount) / (ratings.count + priorCount);

    // Normalize 0-10 to 0-1
    return Math.min(Math.max(bayesianAverage / 10, 0), 1.0);
  }

  private calculateQualityScore(
    aiAnalysis: { story_completeness: number; ai_generation_level: number } | null
  ): number {
    if (!aiAnalysis) return 0.5;

    // Quality is based on story completeness and AI generation level
    const storyScore = aiAnalysis.story_completeness;
    const aiLevelScore = aiAnalysis.ai_generation_level;

    return storyScore * 0.7 + aiLevelScore * 0.3;
  }

  async runRanking(
    db: D1Database,
    films: Film[],
    version: string
  ): Promise<RankingScores[]> {
    const metricService = new MetricHistoryService(db);
    const inputs: { film: Film; scores: ScoreBreakdownV2 & { final: number } }[] = [];

    for (const film of films) {
      // Get latest metrics
      const { results: metricsResults } = await db
        .prepare('SELECT * FROM film_metrics WHERE film_id = ? ORDER BY collected_at DESC')
        .bind(film.id)
        .all<FilmMetrics>();

      const metrics = metricsResults || [];
      if (metrics.length === 0) continue;

      const latestMetrics = metrics[0];

      // Get ratings
      const { results: ratingResults } = await db
        .prepare('SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM ratings WHERE film_id = ?')
        .bind(film.id)
        .all<{ avg_rating: number; count: number }>();

      const ratingData = ratingResults?.[0];
      const ratings = {
        rating: ratingData?.avg_rating || 0,
        count: ratingData?.count || 0,
      };

      // Get AI analysis
      const { results: aiResults } = await db
        .prepare(
          'SELECT story_completeness, ai_generation_level FROM film_ai_analysis WHERE film_id = ? ORDER BY analyzed_at DESC LIMIT 1'
        )
        .bind(film.id)
        .all<{ story_completeness: number; ai_generation_level: number }>();

      const aiAnalysis = aiResults?.[0] || null;

      // Get growth metrics
      const growthMetrics = await metricService.getGrowthMetrics(film.id);

      const input: RankingInputV2 = {
        film,
        metrics,
        latestMetrics,
        ratings,
        aiAnalysis,
        growthMetrics: growthMetrics
          ? {
              growth24h: growthMetrics.growth24h,
              growth7d: growthMetrics.growth7d,
              growthAcceleration: growthMetrics.growthAcceleration,
              absoluteGrowth24h: growthMetrics.absoluteGrowth24h,
              dataConfidence: growthMetrics.dataConfidence,
            }
          : null,
      };

      const scores = this.calculateScores(input);
      inputs.push({ film, scores });
    }

    // Sort by final score descending
    inputs.sort((a, b) => b.scores.final - a.scores.final);

    // Assign ranks
    const results: RankingScores[] = inputs.map((item, index) => ({
      id: 0,
      film_id: item.film.id,
      calculated_at: new Date().toISOString(),
      popularity_score: item.scores.popularity,
      momentum_score: item.scores.momentum,
      engagement_score: item.scores.engagement,
      audience_score: item.scores.audience,
      quality_score: item.scores.quality,
      final_score: item.scores.final,
      rank: index + 1,
      previous_rank: null,
      ranking_version: version,
    }));

    return results;
  }
}
