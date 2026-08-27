/**
 * DiscoveryScoreService
 *
 * 独立于 Ranking Engine 的候选筛选评分系统。
 * 用于判断一个新发现的视频是否值得进入 Candidate Pool。
 *
 * Discovery Score 只用于候选筛选，不与最终的 AI Cinema Score 混淆。
 */

export interface DiscoveryScoreInput {
  views: number;
  likes: number;
  comments: number;
  publishedAt: Date;
  channelSubscriberCount?: number;
  durationSeconds: number;
}

export interface DiscoveryScoreResult {
  score: number;
  passed: boolean;
  reasons: string[];
  details: {
    popularityScore: number;
    engagementScore: number;
    freshnessScore: number;
    growthScore: number;
  };
}

export class DiscoveryScoreService {
  // Minimum thresholds
  private readonly MIN_VIEWS = 100;
  private readonly MIN_DURATION = 30; // seconds
  private readonly MAX_DURATION = 1800; // 30 minutes
  private readonly PASS_THRESHOLD = 0.35;

  calculateScore(input: DiscoveryScoreInput): DiscoveryScoreResult {
    const reasons: string[] = [];

    // Basic validation
    if (input.views < this.MIN_VIEWS) {
      reasons.push(`Too few views: ${input.views} < ${this.MIN_VIEWS}`);
    }
    if (input.durationSeconds < this.MIN_DURATION) {
      reasons.push(`Too short: ${input.durationSeconds}s < ${this.MIN_DURATION}s`);
    }
    if (input.durationSeconds > this.MAX_DURATION) {
      reasons.push(`Too long: ${input.durationSeconds}s > ${this.MAX_DURATION}s`);
    }

    // Popularity score: log-normalized views
    const popularityScore = this.calculatePopularityScore(input.views);

    // Engagement score: likes/views + comments/views
    const engagementScore = this.calculateEngagementScore(input.views, input.likes, input.comments);

    // Freshness score: newer is better, but not too new
    const freshnessScore = this.calculateFreshnessScore(input.publishedAt);

    // Growth score: estimated from engagement relative to views
    const growthScore = this.calculateGrowthScore(input.views, input.likes, input.comments);

    // Combined discovery score
    const score =
      popularityScore * 0.30 +
      engagementScore * 0.35 +
      freshnessScore * 0.20 +
      growthScore * 0.15;

    const passed = score >= this.PASS_THRESHOLD && reasons.length === 0;

    if (!passed && reasons.length === 0) {
      reasons.push(`Score below threshold: ${score.toFixed(3)} < ${this.PASS_THRESHOLD}`);
    }

    return {
      score,
      passed,
      reasons,
      details: {
        popularityScore,
        engagementScore,
        freshnessScore,
        growthScore,
      },
    };
  }

  private calculatePopularityScore(views: number): number {
    if (views <= 0) return 0;
    const logViews = Math.log10(views);
    // 100 views = 0.2, 10K views = 0.4, 1M views = 0.6, 100M views = 0.8
    return Math.min(Math.max((logViews - 2) / 6, 0), 1.0);
  }

  private calculateEngagementScore(views: number, likes: number, comments: number): number {
    const viewsSafe = Math.max(views, 1);
    const likeRate = likes / viewsSafe;
    const commentRate = comments / viewsSafe;

    // Like rate: 1% = 0.2, 5% = 1.0
    const likeScore = Math.min(likeRate / 0.05, 1.0);
    // Comment rate: 0.1% = 0.2, 1% = 1.0
    const commentScore = Math.min(commentRate / 0.01, 1.0);

    return Math.min(likeScore * 0.7 + commentScore * 0.3, 1.0);
  }

  private calculateFreshnessScore(publishedAt: Date): number {
    const now = new Date();
    const ageDays = (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);

    // Very new (< 1 day): 0.6 (might be too fresh, less data)
    // 1-7 days: 1.0 (sweet spot)
    // 7-30 days: 0.8
    // 30-90 days: 0.6
    // 90-365 days: 0.4
    // > 365 days: 0.2
    if (ageDays < 1) return 0.6;
    if (ageDays <= 7) return 1.0;
    if (ageDays <= 30) return 0.8;
    if (ageDays <= 90) return 0.6;
    if (ageDays <= 365) return 0.4;
    return 0.2;
  }

  private calculateGrowthScore(views: number, likes: number, comments: number): number {
    // Simple heuristic: high engagement relative to views suggests viral potential
    const engagementScore = this.calculateEngagementScore(views, likes, comments);
    const viewScore = this.calculatePopularityScore(views);

    // A video with moderate views but high engagement has growth potential
    // A video with high views but low engagement is stagnant
    const growthPotential = engagementScore * 0.7 + (1 - viewScore) * 0.3;

    return Math.min(Math.max(growthPotential, 0), 1.0);
  }
}
