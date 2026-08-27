import type { Film, FilmMetrics, RankingConfig, RankingScores } from '../types';
import type { D1Database } from '@cloudflare/workers-types';

export interface RankingInput {
  film: Film;
  metrics: FilmMetrics[];
  latestMetrics: FilmMetrics;
  ratings: { rating: number; count: number };
  aiAnalysis: { story_completeness: number; ai_generation_level: number } | null;
}

export interface ScoreBreakdown {
  popularity: number;
  momentum: number;
  engagement: number;
  audience: number;
  quality: number;
}

export class RankingEngine {
  constructor(private config: RankingConfig) {}

  calculateScores(input: RankingInput): ScoreBreakdown & { final: number } {
    const popularity = this.calculatePopularityScore(input.latestMetrics.views);
    const momentum = this.calculateMomentumScore(input.metrics);
    const engagement = this.calculateEngagementScore(input.latestMetrics);
    const audience = this.calculateAudienceScore(input.ratings);
    const quality = this.calculateQualityScore(input.aiAnalysis);

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
      final,
    };
  }

  private calculatePopularityScore(views: number): number {
    if (views <= 0) return 0;
    const logViews = Math.log10(views);
    // Normalize: assume 1M views = 1.0, 1K views = 0.3
    const normalized = Math.min(logViews / 6, 1.0);
    return Math.max(0, normalized);
  }

  private calculateMomentumScore(metrics: FilmMetrics[]): number {
    if (metrics.length < 2) return 0.5;

    const sorted = [...metrics].sort((a, b) =>
      new Date(a.collected_at).getTime() - new Date(b.collected_at).getTime()
    );

    const latest = sorted[sorted.length - 1];
    const dayAgo = this.findClosestMetric(sorted, 1);
    const twoDaysAgo = this.findClosestMetric(sorted, 2);
    const weekAgo = this.findClosestMetric(sorted, 7);

    const growth24h = dayAgo ? (latest.views - dayAgo.views) / Math.max(dayAgo.views, 1) : 0;
    const growth48h = twoDaysAgo ? (latest.views - twoDaysAgo.views) / Math.max(twoDaysAgo.views, 1) : 0;
    const growth7d = weekAgo ? (latest.views - weekAgo.views) / Math.max(weekAgo.views, 1) : 0;

    // Acceleration: is growth accelerating?
    const acceleration = growth24h - (growth48h / 2);

    // Combine: weight recent growth more heavily
    const momentum =
      Math.min(growth24h * 0.5, 1.0) +
      Math.min(growth48h * 0.25, 0.5) +
      Math.min(growth7d * 0.15, 0.3) +
      Math.min(acceleration * 0.1, 0.2);

    return Math.min(Math.max(momentum, 0), 1.0);
  }

  private findClosestMetric(sortedMetrics: FilmMetrics[], daysAgo: number): FilmMetrics | null {
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

    return closest;
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

    return Math.min((likeScore * 0.6 + commentScore * 0.4), 1.0);
  }

  private calculateAudienceScore(ratings: { rating: number; count: number }): number {
    if (ratings.count === 0) return 0.5; // neutral if no ratings

    // Bayesian average: assume prior of 5 ratings at 5.0
    const priorCount = 5;
    const priorMean = 5.0;
    const bayesianAverage = (ratings.rating * ratings.count + priorMean * priorCount) / (ratings.count + priorCount);

    // Normalize 0-10 to 0-1
    return Math.min(Math.max(bayesianAverage / 10, 0), 1.0);
  }

  private calculateQualityScore(aiAnalysis: { story_completeness: number; ai_generation_level: number } | null): number {
    if (!aiAnalysis) return 0.5;

    // Quality is based on story completeness and AI generation level
    // But weight it lower as per requirements
    const storyScore = aiAnalysis.story_completeness;
    const aiLevelScore = aiAnalysis.ai_generation_level;

    return (storyScore * 0.7 + aiLevelScore * 0.3);
  }

  async runRanking(
    db: D1Database,
    films: Film[],
    version: string
  ): Promise<RankingScores[]> {
    const inputs: { film: Film; scores: ScoreBreakdown & { final: number } }[] = [];

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
        .prepare('SELECT story_completeness, ai_generation_level FROM film_ai_analysis WHERE film_id = ? ORDER BY analyzed_at DESC LIMIT 1')
        .bind(film.id)
        .all<{ story_completeness: number; ai_generation_level: number }>();

      const aiAnalysis = aiResults?.[0] || null;

      const input: RankingInput = {
        film,
        metrics,
        latestMetrics,
        ratings,
        aiAnalysis,
      };

      const scores = this.calculateScores(input);
      inputs.push({ film, scores });
    }

    // Sort by final score descending
    inputs.sort((a, b) => b.scores.final - a.scores.final);

    // Assign ranks
    const results: RankingScores[] = inputs.map((item, index) => ({
      id: 0, // will be auto-generated
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
