/**
 * Ranking Stability Service
 *
 * 计算 Ranking Stability Score：
 * - 同一 Seed Pool 在不同条件下排名变化程度
 * - 支持改变 ranking version / 数据时间窗口 / Recognition 开关
 * - 输出 rank_stability_score
 */

export interface StabilityConfig {
  topK: number;
  variation: 'version' | 'time_window' | 'recognition' | 'all';
}

export interface StabilityResult {
  topK: number;
  stabilityScore: number; // 0-100, higher = more stable
  originalRanking: number[];
  variantRankings: { name: string; ranking: number[] }[];
  changes: { workId: number; originalRank: number; maxDelta: number }[];
}

export class RankingStabilityService {
  /**
   * 计算排名稳定性
   */
  calculateStability(
    originalRanking: number[],
    variantRankings: { name: string; ranking: number[] }[],
    topK: number = 10
  ): StabilityResult {
    const originalTopK = originalRanking.slice(0, topK);

    const changes: { workId: number; originalRank: number; maxDelta: number }[] = [];

    for (const workId of originalTopK) {
      const originalRank = originalRanking.indexOf(workId) + 1;
      let maxDelta = 0;

      for (const variant of variantRankings) {
        const variantRank = variant.ranking.indexOf(workId);
        if (variantRank >= 0) {
          const delta = Math.abs(originalRank - (variantRank + 1));
          maxDelta = Math.max(maxDelta, delta);
        } else {
          // Work dropped out of ranking
          maxDelta = Math.max(maxDelta, topK);
        }
      }

      changes.push({ workId, originalRank, maxDelta });
    }

    // Calculate stability score: 100 - average max delta normalized
    const avgMaxDelta = changes.reduce((sum, c) => sum + c.maxDelta, 0) / changes.length;
    const stabilityScore = Math.max(0, Math.round(100 - (avgMaxDelta / topK) * 100));

    return {
      topK,
      stabilityScore,
      originalRanking,
      variantRankings,
      changes: changes.sort((a, b) => b.maxDelta - a.maxDelta),
    };
  }

  /**
   * 生成稳定性报告
   */
  generateStabilityReport(results: StabilityResult[]): string {
    const lines = [
      '# Ranking Stability Report',
      '',
      ...results.map(r => [
        `## Top ${r.topK} Stability`,
        `- Stability Score: ${r.stabilityScore}/100`,
        `- Most Unstable Works:`,
        ...r.changes.slice(0, 5).map(c => `  - Work ${c.workId}: Rank ${c.originalRank} → max delta ${c.maxDelta}`),
        '',
      ].join('\n')),
    ];

    return lines.join('\n');
  }
}
