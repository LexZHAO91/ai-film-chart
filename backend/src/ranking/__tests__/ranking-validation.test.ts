import { describe, it, expect } from 'vitest';
import { RankingEngineV2 } from '../ranking-engine-v2';
import type { RankingConfig, Film, FilmMetrics } from '../../types';

// Test configuration
const TEST_CONFIG: RankingConfig = {
  version: 'test-v0.1',
  popularity_weight: 0.35,
  momentum_weight: 0.25,
  engagement_weight: 0.15,
  audience_weight: 0.15,
  quality_weight: 0.10,
  minimum_rating_count: 5,
  created_at: new Date().toISOString(),
};

function createMockFilm(overrides: Partial<Film> = {}): Film {
  return {
    id: 1,
    source: 'youtube',
    source_video_id: 'test_001',
    canonical_url: 'https://youtube.com/watch?v=test_001',
    title: 'Test Film',
    description: 'Test description',
    thumbnail_url: '',
    channel_id: 'channel_test',
    channel_name: 'Test Channel',
    published_at: new Date().toISOString(),
    duration_seconds: 180,
    language: 'en',
    is_ai_film: true,
    is_story_content: true,
    content_type: 'short_film',
    genre_json: JSON.stringify(['sci_fi']),
    ai_generation_level: 0.9,
    ai_confidence: 0.95,
    status: 'approved',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createMockMetrics(views: number, likes: number, comments: number): FilmMetrics {
  return {
    id: 1,
    film_id: 1,
    collected_at: new Date().toISOString(),
    views,
    likes,
    comments,
  };
}

describe('Ranking Engine Validation', () => {
  const engine = new RankingEngineV2(TEST_CONFIG);

  // Helper to calculate score for a film profile
  function calculateFilmScore(profile: {
    views: number;
    likes: number;
    comments: number;
    storyCompleteness: number;
    aiGenerationLevel: number;
    growth24h?: number;
    absoluteGrowth24h?: number;
    growthAcceleration?: number;
    dataConfidence?: number;
  }) {
    const input = {
      film: createMockFilm(),
      metrics: [createMockMetrics(profile.views, profile.likes, profile.comments)],
      latestMetrics: createMockMetrics(profile.views, profile.likes, profile.comments),
      ratings: { rating: 0, count: 0 },
      aiAnalysis: {
        story_completeness: profile.storyCompleteness,
        ai_generation_level: profile.aiGenerationLevel,
      },
      growthMetrics: {
        growth24h: profile.growth24h || 0,
        growth7d: 0,
        growthAcceleration: profile.growthAcceleration || 0,
        absoluteGrowth24h: profile.absoluteGrowth24h || 0,
        dataConfidence: profile.dataConfidence || 0.8,
      },
    };

    return engine.calculateScores(input);
  }

  describe('Test Case 1: High Views + High Quality', () => {
    it('should score higher than average', () => {
      const score = calculateFilmScore({
        views: 2_500_000,
        likes: 125_000, // 5% like rate
        comments: 12_500, // 0.5% comment rate
        storyCompleteness: 0.92,
        aiGenerationLevel: 0.95,
        growth24h: 0.1,
        absoluteGrowth24h: 5000,
      });

      expect(score.popularity).toBeGreaterThan(0.7);
      expect(score.engagement).toBeGreaterThan(0.7);
      expect(score.quality).toBeGreaterThan(0.8);
      expect(score.final).toBeGreaterThan(0.5);
    });
  });

  describe('Test Case 2: High Views + Low Quality (Clickbait)', () => {
    it('should have lower quality score but still decent popularity', () => {
      const score = calculateFilmScore({
        views: 5_000_000,
        likes: 25_000, // 0.5% like rate - very low
        comments: 2_500, // 0.05% comment rate
        storyCompleteness: 0.25,
        aiGenerationLevel: 0.3,
        growth24h: 0.02,
        absoluteGrowth24h: 1000,
      });

      expect(score.popularity).toBeGreaterThan(0.8); // High views
      expect(score.engagement).toBeLessThan(0.3); // Very low engagement
      expect(score.quality).toBeLessThan(0.4); // Low quality
      expect(score.final).toBeLessThan(0.5); // Should not rank high overall
    });
  });

  describe('Test Case 3: Low Views + High Quality (Hidden Gem)', () => {
    it('should have high quality but low popularity', () => {
      const score = calculateFilmScore({
        views: 50_000,
        likes: 6_000, // 12% like rate - very high
        comments: 750, // 1.5% comment rate
        storyCompleteness: 0.95,
        aiGenerationLevel: 0.88,
        growth24h: 0.5,
        absoluteGrowth24h: 500,
      });

      expect(score.popularity).toBeLessThan(0.8); // Low views (but 50K is not tiny)
      expect(score.engagement).toBeGreaterThan(0.9); // Very high engagement
      expect(score.quality).toBeGreaterThan(0.8); // High quality
      expect(score.final).toBeGreaterThan(0.4); // Should still be decent
    });
  });

  describe('Test Case 4: New Film with Fast Growth', () => {
    it('should have high momentum', () => {
      const score = calculateFilmScore({
        views: 100_000,
        likes: 12_000, // 12% like rate
        comments: 1_500, // 1.5% comment rate
        storyCompleteness: 0.90,
        aiGenerationLevel: 0.97,
        growth24h: 2.0, // 200% growth
        absoluteGrowth24h: 15_000,
        growthAcceleration: 0.5,
      });

      expect(score.momentum).toBeGreaterThan(0.7); // High growth
      expect(score.engagement).toBeGreaterThan(0.9); // High engagement
      expect(score.final).toBeGreaterThan(0.5);
    });
  });

  describe('Test Case 5: Old Film with Stable Views', () => {
    it('should have moderate scores across the board', () => {
      const score = calculateFilmScore({
        views: 3_200_000,
        likes: 96_000, // 3% like rate
        comments: 6_400, // 0.2% comment rate
        storyCompleteness: 0.85,
        aiGenerationLevel: 0.75,
        growth24h: 0.05,
        absoluteGrowth24h: 2000,
        growthAcceleration: -0.02, // Slight deceleration
      });

      expect(score.popularity).toBeGreaterThan(0.8);
      expect(score.momentum).toBeLessThan(0.4); // Low growth
      expect(score.quality).toBeGreaterThan(0.7); // Still good quality
      expect(score.final).toBeGreaterThan(0.4);
    });
  });

  describe('Test Case 6: Very Few Ratings', () => {
    it('should use Bayesian average to prevent extreme scores', () => {
      const input = {
        film: createMockFilm(),
        metrics: [createMockMetrics(10000, 500, 50)],
        latestMetrics: createMockMetrics(10000, 500, 50),
        ratings: { rating: 10, count: 2 }, // Only 2 ratings, both 10/10
        aiAnalysis: { story_completeness: 0.9, ai_generation_level: 0.9 },
        growthMetrics: {
          growth24h: 0.1,
          growth7d: 0.5,
          growthAcceleration: 0.05,
          absoluteGrowth24h: 500,
          dataConfidence: 0.6,
        },
      };

      const score = engine.calculateScores(input);

      // Bayesian average should pull it toward 5.0, not let it be 10.0
      expect(score.audience).toBeLessThan(0.8);
      expect(score.audience).toBeGreaterThan(0.4);
    });
  });

  describe('Test Case 7: Abnormally High Like Rate', () => {
    it('should cap engagement score', () => {
      const score = calculateFilmScore({
        views: 100_000,
        likes: 20_000, // 20% like rate - abnormally high
        comments: 500,
        storyCompleteness: 0.87,
        aiGenerationLevel: 0.91,
        growth24h: 0.3,
        absoluteGrowth24h: 3000,
      });

      expect(score.engagement).toBeLessThanOrEqual(1.0); // Should be capped
      expect(score.engagement).toBeGreaterThan(0.75);
    });
  });

  describe('Test Case 8: Abnormally High Comment Rate', () => {
    it('should cap engagement score', () => {
      const score = calculateFilmScore({
        views: 100_000,
        likes: 3_000, // 3% like rate
        comments: 3_000, // 3% comment rate - abnormally high
        storyCompleteness: 0.86,
        aiGenerationLevel: 0.89,
        growth24h: 0.4,
        absoluteGrowth24h: 4000,
      });

      expect(score.engagement).toBeLessThanOrEqual(1.0); // Should be capped
      expect(score.engagement).toBeGreaterThan(0.7);
    });
  });

  describe('Test Case 9: High Views but Low Engagement (Bought Views)', () => {
    it('should have low engagement despite high views', () => {
      const score = calculateFilmScore({
        views: 10_000_000,
        likes: 20_000, // 0.2% like rate - suspiciously low
        comments: 1_000, // 0.01% comment rate
        storyCompleteness: 0.6,
        aiGenerationLevel: 0.7,
        growth24h: 0.05,
        absoluteGrowth24h: 5000,
      });

      expect(score.popularity).toBeGreaterThan(0.9); // Very high views
      expect(score.engagement).toBeLessThan(0.3); // Very low engagement
      expect(score.final).toBeLessThan(0.55); // Should not dominate
    });
  });

  describe('Test Case 10: Niche but High Quality', () => {
    it('should have decent overall score despite low popularity', () => {
      const score = calculateFilmScore({
        views: 5_000,
        likes: 750, // 15% like rate - extremely high
        comments: 100, // 2% comment rate
        storyCompleteness: 0.94,
        aiGenerationLevel: 0.96,
        growth24h: 0.8,
        absoluteGrowth24h: 200,
      });

      expect(score.popularity).toBeLessThan(0.7); // Very low views (5K is small but not zero)
      expect(score.engagement).toBeGreaterThan(0.9); // Extremely high engagement
      expect(score.quality).toBeGreaterThan(0.9); // Very high quality
      expect(score.final).toBeGreaterThan(0.35); // Should still be competitive
    });
  });

  describe('Ranking Relationship Tests', () => {
    it('high views + high quality should outrank high views + low quality', () => {
      const highQuality = calculateFilmScore({
        views: 2_500_000,
        likes: 125_000,
        comments: 12_500,
        storyCompleteness: 0.92,
        aiGenerationLevel: 0.95,
        growth24h: 0.1,
        absoluteGrowth24h: 5000,
      });

      const lowQuality = calculateFilmScore({
        views: 5_000_000,
        likes: 25_000,
        comments: 2_500,
        storyCompleteness: 0.25,
        aiGenerationLevel: 0.3,
        growth24h: 0.02,
        absoluteGrowth24h: 1000,
      });

      expect(highQuality.final).toBeGreaterThan(lowQuality.final);
    });

    it('high engagement should partially compensate for low views', () => {
      const nicheGem = calculateFilmScore({
        views: 50_000,
        likes: 6_000,
        comments: 750,
        storyCompleteness: 0.95,
        aiGenerationLevel: 0.88,
        growth24h: 0.5,
        absoluteGrowth24h: 500,
      });

      const mediocrePopular = calculateFilmScore({
        views: 500_000,
        likes: 10_000,
        comments: 1_000,
        storyCompleteness: 0.6,
        aiGenerationLevel: 0.6,
        growth24h: 0.05,
        absoluteGrowth24h: 1000,
      });

      // Niche gem should outrank or be close to mediocre popular
      expect(nicheGem.final).toBeGreaterThan(mediocrePopular.final * 0.8);
    });

    it('fast growing new film should have higher momentum than stable old film', () => {
      const newFastGrowing = calculateFilmScore({
        views: 100_000,
        likes: 12_000,
        comments: 1_500,
        storyCompleteness: 0.90,
        aiGenerationLevel: 0.97,
        growth24h: 2.0,
        absoluteGrowth24h: 15_000,
        growthAcceleration: 0.5,
      });

      const oldStable = calculateFilmScore({
        views: 3_200_000,
        likes: 96_000,
        comments: 6_400,
        storyCompleteness: 0.85,
        aiGenerationLevel: 0.75,
        growth24h: 0.05,
        absoluteGrowth24h: 2000,
        growthAcceleration: -0.02,
      });

      expect(newFastGrowing.momentum).toBeGreaterThan(oldStable.momentum);
    });
  });
});
