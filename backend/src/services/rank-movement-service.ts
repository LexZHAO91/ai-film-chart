/**
 * Rank Movement Service
 *
 * 分析不同 Ranking 之间的排名变化：
 * - 计算每个作品在不同 ranking 中的排名差异
 * - 分析变化原因（Recognition, Audience, Quality, Momentum）
 */

export interface RankEntry {
  workId: number;
  title: string;
  rank: number;
  score: number;
}

export interface RankMovement {
  workId: number;
  title: string;
  rankA: number;
  rankB: number;
  rankC: number;
  deltaAB: number;
  deltaAC: number;
  deltaBC: number;
  primaryReason: string;
  reasonDetails: string[];
}

export class RankMovementService {
  /**
   * 分析三个排名之间的变化
   */
  analyzeRankMovement(
    rankingA: RankEntry[],
    rankingB: RankEntry[],
    rankingC: RankEntry[]
  ): RankMovement[] {
    const allWorkIds = new Set([
      ...rankingA.map(r => r.workId),
      ...rankingB.map(r => r.workId),
      ...rankingC.map(r => r.workId),
    ]);

    const movements: RankMovement[] = [];

    for (const workId of allWorkIds) {
      const entryA = rankingA.find(r => r.workId === workId);
      const entryB = rankingB.find(r => r.workId === workId);
      const entryC = rankingC.find(r => r.workId === workId);

      // 只分析在三个排名中都存在的作品
      if (!entryA || !entryB || !entryC) continue;

      const deltaAB = entryA.rank - entryB.rank; // 正数表示 B 排名更高（数字更小）
      const deltaAC = entryA.rank - entryC.rank;
      const deltaBC = entryB.rank - entryC.rank;

      const reasons = this.analyzeReasons(entryA, entryB, entryC);

      movements.push({
        workId,
        title: entryA.title,
        rankA: entryA.rank,
        rankB: entryB.rank,
        rankC: entryC.rank,
        deltaAB,
        deltaAC,
        deltaBC,
        primaryReason: reasons.primary,
        reasonDetails: reasons.details,
      });
    }

    // 按变化幅度排序
    return movements.sort((a, b) => {
      const maxDeltaA = Math.max(Math.abs(a.deltaAB), Math.abs(a.deltaAC), Math.abs(a.deltaBC));
      const maxDeltaB = Math.max(Math.abs(b.deltaAB), Math.abs(b.deltaAC), Math.abs(b.deltaBC));
      return maxDeltaB - maxDeltaA;
    });
  }

  private analyzeReasons(
    entryA: RankEntry,
    entryB: RankEntry,
    entryC: RankEntry
  ): { primary: string; details: string[] } {
    const details: string[] = [];

    // A = Popularity Only
    // B = Popularity + Audience
    // C = Full Ranking

    const scoreDiffBC = entryB.score - entryC.score;

    if (entryC.rank < entryB.rank) {
      // C 排名更高，说明 Full Ranking 有额外加分
      details.push('Full Ranking gives higher score than Popularity+Audience');

      if (scoreDiffBC > 0.1) {
        details.push('Significant score increase suggests Recognition or Quality boost');
      }
    } else if (entryC.rank > entryB.rank) {
      details.push('Full Ranking gives lower score than Popularity+Audience');
    }

    if (entryB.rank < entryA.rank) {
      details.push('Audience signals help ranking vs pure popularity');
    }

    // 确定主要原因
    let primary = 'Multiple factors';

    const deltaAC = Math.abs(entryA.rank - entryC.rank);
    const deltaAB = Math.abs(entryA.rank - entryB.rank);

    if (deltaAC > deltaAB) {
      // C 和 A 差异大，说明 Recognition/Quality/Momentum 影响大
      if (entryC.rank < entryA.rank) {
        primary = 'Recognition/Quality boost in Full Ranking';
      } else {
        primary = 'Popularity-only overestimated this work';
      }
    } else if (deltaAB > 0) {
      primary = 'Audience signals significant';
    } else {
      primary = 'Consistent across rankings';
    }

    return { primary, details };
  }

  /**
   * 生成 Markdown 格式的 Movement Report
   */
  generateMarkdownReport(movements: RankMovement[], topN = 20): string {
    const lines = [
      '# Rank Movement Analysis',
      '',
      `## Top ${topN} Rank Movements`,
      '',
      '| Work | Popularity | Pop+Audience | Full | Δ(Pop→Full) | Primary Reason |',
      '|------|-----------|--------------|------|-------------|----------------|',
      ...movements.slice(0, topN).map(m =>
        `| ${m.title} | #${m.rankA} | #${m.rankB} | #${m.rankC} | ${m.deltaAC > 0 ? '+' : ''}${m.deltaAC} | ${m.primaryReason} |`
      ),
      '',
      '## Biggest Movers (Popularity → Full)',
      ...movements
        .filter(m => Math.abs(m.deltaAC) >= 5)
        .slice(0, 10)
        .map(m => `- **${m.title}**: #${m.rankA} → #${m.rankC} (Δ${m.deltaAC > 0 ? '+' : ''}${m.deltaAC}) — ${m.primaryReason}`),
    ];

    return lines.join('\n');
  }
}
