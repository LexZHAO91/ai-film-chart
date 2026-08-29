/**
 * Ranking Stress Test Service
 *
 * 使用真实数据进行 Ranking Stress Test：
 * - Test A: 去掉 Recognition
 * - Test B: 去掉 Quality
 * - Test C: 降低 Momentum
 * - Test D: 提高 Audience
 * - Test E: 提高 Popularity
 *
 * 观察 Top 10 变化，不修改正式 ranking。
 */

export interface StressTestConfig {
  name: string;
  description: string;
  weightAdjustments: Record<string, number>;
}

export interface StressTestResult {
  config: StressTestConfig;
  ranking: { workId: number; title: string; score: number; rank: number }[];
  top10Changes: { workId: number; title: string; originalRank: number; newRank: number; delta: number }[];
}

export const DEFAULT_STRESS_TESTS: StressTestConfig[] = [
  {
    name: 'Test A: No Recognition',
    description: 'Remove recognition signals from ranking calculation',
    weightAdjustments: { recognition: 0 },
  },
  {
    name: 'Test B: No Quality',
    description: 'Remove quality signals from ranking calculation',
    weightAdjustments: { quality: 0 },
  },
  {
    name: 'Test C: Reduced Momentum',
    description: 'Reduce momentum weight by 50%',
    weightAdjustments: { momentum: 0.5 },
  },
  {
    name: 'Test D: Increased Audience',
    description: 'Double audience signal weight',
    weightAdjustments: { audience: 2.0 },
  },
  {
    name: 'Test E: Increased Popularity',
    description: 'Double popularity signal weight',
    weightAdjustments: { popularity: 2.0 },
  },
];

export class RankingStressTestService {
  /**
   * 运行单个 stress test
   */
  async runStressTest(
    config: StressTestConfig,
    originalRanking: { workId: number; title: string; score: number; rank: number }[],
    workScores: Map<number, Record<string, number>>
  ): Promise<StressTestResult> {
    // Apply weight adjustments to recalculate scores
    const adjustedRanking = originalRanking.map(item => {
      const scores = workScores.get(item.workId) || {};
      let adjustedScore = item.score;

      for (const [factor, multiplier] of Object.entries(config.weightAdjustments)) {
        if (scores[factor] !== undefined) {
          // Simple adjustment: reduce/increase the factor's contribution
          const originalContribution = scores[factor] * (this.getDefaultWeight(factor));
          const newContribution = scores[factor] * (this.getDefaultWeight(factor) * multiplier);
          adjustedScore = adjustedScore - originalContribution + newContribution;
        }
      }

      return {
        workId: item.workId,
        title: item.title,
        score: Math.max(0, adjustedScore),
        rank: 0, // Will be recalculated
      };
    });

    // Re-sort by adjusted score
    adjustedRanking.sort((a, b) => b.score - a.score);
    adjustedRanking.forEach((item, index) => {
      item.rank = index + 1;
    });

    // Calculate Top 10 changes
    const top10Changes: StressTestResult['top10Changes'] = [];
    const originalTop10 = new Map(originalRanking.slice(0, 10).map((item, i) => [item.workId, i + 1]));

    for (const item of adjustedRanking.slice(0, 10)) {
      const originalRank = originalTop10.get(item.workId) || 999;
      if (originalRank !== item.rank) {
        top10Changes.push({
          workId: item.workId,
          title: item.title,
          originalRank,
          newRank: item.rank,
          delta: originalRank - item.rank,
        });
      }
    }

    // Also check works that dropped out of top 10
    const newTop10Ids = new Set(adjustedRanking.slice(0, 10).map(i => i.workId));
    for (const [workId, originalRank] of originalTop10) {
      if (!newTop10Ids.has(workId)) {
        const work = originalRanking.find(r => r.workId === workId);
        top10Changes.push({
          workId,
          title: work?.title || `Work ${workId}`,
          originalRank,
          newRank: 999,
          delta: -999,
        });
      }
    }

    return {
      config,
      ranking: adjustedRanking,
      top10Changes: top10Changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    };
  }

  private getDefaultWeight(factor: string): number {
    const weights: Record<string, number> = {
      popularity: 0.30,
      momentum: 0.20,
      engagement: 0.15,
      audience: 0.15,
      quality: 0.10,
      recognition: 0.10,
    };
    return weights[factor] || 0;
  }

  /**
   * 运行所有 stress tests
   */
  async runAllStressTests(
    originalRanking: { workId: number; title: string; score: number; rank: number }[],
    workScores: Map<number, Record<string, number>>
  ): Promise<StressTestResult[]> {
    const results: StressTestResult[] = [];

    for (const config of DEFAULT_STRESS_TESTS) {
      const result = await this.runStressTest(config, originalRanking, workScores);
      results.push(result);
    }

    return results;
  }

  /**
   * 生成 stress test 报告
   */
  generateStressTestReport(results: StressTestResult[]): string {
    const lines = [
      '# Ranking Stress Test Report',
      '',
      ...results.flatMap(r => [
        `## ${r.config.name}`,
        r.config.description,
        '',
        '### Top 10 Changes',
        ...r.top10Changes.map(c =>
          `- **${c.title}**: #${c.originalRank} → #${c.newRank === 999 ? 'OUT' : c.newRank} (Δ${c.delta > 0 ? '+' : ''}${c.delta === -999 ? 'OUT' : c.delta})`
        ),
        r.top10Changes.length === 0 ? '- No changes in Top 10' : '',
        '',
      ]),
    ];

    return lines.join('\n');
  }
}
