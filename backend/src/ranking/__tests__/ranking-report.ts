/**
 * Ranking Engine Validation Report Generator
 *
 * 运行此脚本生成测试报告，验证 Ranking Engine 的业务逻辑是否正确。
 */

import { RankingEngineV2 } from '../ranking-engine-v2';
import type { RankingConfig, Film, FilmMetrics } from '../../types';

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

interface TestCase {
  name: string;
  description: string;
  film: {
    views: number;
    likes: number;
    comments: number;
    storyCompleteness: number;
    aiGenerationLevel: number;
    growth24h?: number;
    absoluteGrowth24h?: number;
    growthAcceleration?: number;
  };
  expectations: {
    popularity?: { min?: number; max?: number };
    engagement?: { min?: number; max?: number };
    quality?: { min?: number; max?: number };
    momentum?: { min?: number; max?: number };
    final?: { min?: number; max?: number };
  };
}

const TEST_CASES: TestCase[] = [
  {
    name: 'High Views + High Quality',
    description: 'Classic AI short film with strong metrics across the board',
    film: {
      views: 2_500_000,
      likes: 125_000,
      comments: 12_500,
      storyCompleteness: 0.92,
      aiGenerationLevel: 0.95,
      growth24h: 0.1,
      absoluteGrowth24h: 5000,
    },
    expectations: {
      popularity: { min: 0.7 },
      engagement: { min: 0.7 },
      quality: { min: 0.8 },
      final: { min: 0.5 },
    },
  },
  {
    name: 'High Views + Low Quality (Clickbait)',
    description: 'Viral but low engagement and quality - should not rank high',
    film: {
      views: 5_000_000,
      likes: 25_000,
      comments: 2_500,
      storyCompleteness: 0.25,
      aiGenerationLevel: 0.3,
      growth24h: 0.02,
      absoluteGrowth24h: 1000,
    },
    expectations: {
      popularity: { min: 0.8 },
      engagement: { max: 0.3 },
      quality: { max: 0.4 },
      final: { max: 0.5 },
    },
  },
  {
    name: 'Low Views + High Quality (Hidden Gem)',
    description: 'Niche film with exceptional engagement - should be competitive',
    film: {
      views: 50_000,
      likes: 6_000,
      comments: 750,
      storyCompleteness: 0.95,
      aiGenerationLevel: 0.88,
      growth24h: 0.5,
      absoluteGrowth24h: 500,
    },
    expectations: {
      popularity: { max: 0.8 },
      engagement: { min: 0.9 },
      quality: { min: 0.8 },
      final: { min: 0.4 },
    },
  },
  {
    name: 'New Film with Fast Growth',
    description: 'Recently published with explosive growth - high momentum',
    film: {
      views: 100_000,
      likes: 12_000,
      comments: 1_500,
      storyCompleteness: 0.90,
      aiGenerationLevel: 0.97,
      growth24h: 2.0,
      absoluteGrowth24h: 15_000,
      growthAcceleration: 0.5,
    },
    expectations: {
      momentum: { min: 0.7 },
      engagement: { min: 0.9 },
      final: { min: 0.5 },
    },
  },
  {
    name: 'Old Film with Stable Views',
    description: 'Established film with consistent metrics - quality should persist',
    film: {
      views: 3_200_000,
      likes: 96_000,
      comments: 6_400,
      storyCompleteness: 0.85,
      aiGenerationLevel: 0.75,
      growth24h: 0.05,
      absoluteGrowth24h: 2000,
      growthAcceleration: -0.02,
    },
    expectations: {
      popularity: { min: 0.8 },
      momentum: { max: 0.4 },
      quality: { min: 0.7 },
      final: { min: 0.4 },
    },
  },
  {
    name: 'Abnormally High Like Rate',
    description: 'Suspicious engagement pattern - should be capped',
    film: {
      views: 100_000,
      likes: 20_000,
      comments: 500,
      storyCompleteness: 0.87,
      aiGenerationLevel: 0.91,
      growth24h: 0.3,
      absoluteGrowth24h: 3000,
    },
    expectations: {
      engagement: { min: 0.75, max: 1.0 },
    },
  },
  {
    name: 'High Views but Low Engagement (Bought Views)',
    description: 'Likely manipulated metrics - engagement should reveal truth',
    film: {
      views: 10_000_000,
      likes: 20_000,
      comments: 1_000,
      storyCompleteness: 0.6,
      aiGenerationLevel: 0.7,
      growth24h: 0.05,
      absoluteGrowth24h: 5000,
    },
    expectations: {
      popularity: { min: 0.9 },
      engagement: { max: 0.3 },
      final: { max: 0.55 },
    },
  },
  {
    name: 'Niche but High Quality',
    description: 'Very small audience but exceptional content',
    film: {
      views: 5_000,
      likes: 750,
      comments: 100,
      storyCompleteness: 0.94,
      aiGenerationLevel: 0.96,
      growth24h: 0.8,
      absoluteGrowth24h: 200,
    },
    expectations: {
      popularity: { max: 0.7 },
      engagement: { min: 0.9 },
      quality: { min: 0.9 },
      final: { min: 0.35 },
    },
  },
];

interface TestResult {
  name: string;
  description: string;
  scores: {
    popularity: number;
    momentum: number;
    engagement: number;
    audience: number;
    quality: number;
    dataConfidence: number;
    final: number;
  };
  passed: boolean;
  failures: string[];
}

function runTests(): TestResult[] {
  const engine = new RankingEngineV2(TEST_CONFIG);

  return TEST_CASES.map(testCase => {
    const input = {
      film: createMockFilm(),
      metrics: [createMockMetrics(testCase.film.views, testCase.film.likes, testCase.film.comments)],
      latestMetrics: createMockMetrics(testCase.film.views, testCase.film.likes, testCase.film.comments),
      ratings: { rating: 0, count: 0 },
      aiAnalysis: {
        story_completeness: testCase.film.storyCompleteness,
        ai_generation_level: testCase.film.aiGenerationLevel,
      },
      growthMetrics: {
        growth24h: testCase.film.growth24h || 0,
        growth7d: 0,
        growthAcceleration: testCase.film.growthAcceleration || 0,
        absoluteGrowth24h: testCase.film.absoluteGrowth24h || 0,
        dataConfidence: 0.8,
      },
    };

    const scores = engine.calculateScores(input);
    const failures: string[] = [];

    for (const [metric, bounds] of Object.entries(testCase.expectations)) {
      const value = scores[metric as keyof typeof scores] as number;
      if (bounds.min !== undefined && value < bounds.min) {
        failures.push(`${metric}: ${value.toFixed(3)} < expected min ${bounds.min}`);
      }
      if (bounds.max !== undefined && value > bounds.max) {
        failures.push(`${metric}: ${value.toFixed(3)} > expected max ${bounds.max}`);
      }
    }

    return {
      name: testCase.name,
      description: testCase.description,
      scores: {
        popularity: scores.popularity,
        momentum: scores.momentum,
        engagement: scores.engagement,
        audience: scores.audience,
        quality: scores.quality,
        dataConfidence: scores.dataConfidence,
        final: scores.final,
      },
      passed: failures.length === 0,
      failures,
    };
  });
}

function generateReport(results: TestResult[]): string {
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  let report = '\n' + '='.repeat(80) + '\n';
  report += 'RANKING ENGINE VALIDATION REPORT\n';
  report += '='.repeat(80) + '\n\n';
  report += `Total Tests: ${total}\n`;
  report += `Passed: ${passed} ✅\n`;
  report += `Failed: ${failed} ❌\n`;
  report += `Success Rate: ${((passed / total) * 100).toFixed(1)}%\n\n`;
  report += '-'.repeat(80) + '\n\n';

  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    report += `[${status}] ${result.name}\n`;
    report += `  Description: ${result.description}\n`;
    report += `  Scores:\n`;
    report += `    Popularity:      ${result.scores.popularity.toFixed(3)}\n`;
    report += `    Momentum:        ${result.scores.momentum.toFixed(3)}\n`;
    report += `    Engagement:      ${result.scores.engagement.toFixed(3)}\n`;
    report += `    Audience:        ${result.scores.audience.toFixed(3)}\n`;
    report += `    Quality:         ${result.scores.quality.toFixed(3)}\n`;
    report += `    Data Confidence: ${result.scores.dataConfidence.toFixed(3)}\n`;
    report += `    FINAL:           ${result.scores.final.toFixed(3)}\n`;

    if (result.failures.length > 0) {
      report += `  Failures:\n`;
      for (const failure of result.failures) {
        report += `    - ${failure}\n`;
      }
    }

    report += '\n';
  }

  report += '-'.repeat(80) + '\n\n';

  // Ranking relationship tests
  report += 'RANKING RELATIONSHIP TESTS\n\n';

  const highQuality = results.find(r => r.name === 'High Views + High Quality')!;
  const lowQuality = results.find(r => r.name === 'High Views + Low Quality (Clickbait)')!;
  const nicheGem = results.find(r => r.name === 'Low Views + High Quality (Hidden Gem)')!;
  const fastGrowing = results.find(r => r.name === 'New Film with Fast Growth')!;
  const oldStable = results.find(r => r.name === 'Old Film with Stable Views')!;

  const relationships = [
    {
      name: 'High Quality > Low Quality (same high views)',
      expected: highQuality.scores.final > lowQuality.scores.final,
      explanation: 'Quality should differentiate films with similar popularity',
    },
    {
      name: 'Fast Growing > Old Stable (momentum)',
      expected: fastGrowing.scores.momentum > oldStable.scores.momentum,
      explanation: 'New films with growth should have higher momentum',
    },
    {
      name: 'Niche Gem competitive despite low views',
      expected: nicheGem.scores.final > 0.35,
      explanation: 'High engagement should partially compensate for low popularity',
    },
    {
      name: 'Quality persistence (old film)',
      expected: oldStable.scores.quality > 0.7,
      explanation: 'Quality should not degrade just because a film is old',
    },
  ];

  for (const rel of relationships) {
    const status = rel.expected ? '✅ PASS' : '❌ FAIL';
    report += `[${status}] ${rel.name}\n`;
    report += `  ${rel.explanation}\n\n`;
  }

  report += '='.repeat(80) + '\n';

  return report;
}

// Run and print report
const results = runTests();
console.log(generateReport(results));

// Export for potential programmatic use
export { runTests, generateReport };
