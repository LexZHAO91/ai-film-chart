/**
 * Algorithm Anomaly Detection Service
 *
 * 自动检测排名异常：
 * 1. 高播放低质量进入 Top 10
 * 2. 低播放高质量完全没有进入 Top 50
 * 3. Recognition 极高但质量一般
 * 4. 新作品因为 Momentum 异常冲榜
 * 5. 小样本 rating 异常
 * 6. 数据可信度低却排名过高
 * 7. 某一单一指标对排名产生过大影响
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface Anomaly {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  workId: number;
  title: string;
  rank: number;
  description: string;
  metrics: Record<string, number | string>;
}

export class AlgorithmAnomalyService {
  constructor(private db: D1Database) {}

  /**
   * 检测所有异常
   */
  async detectAnomalies(
    ranking: { workId: number; title: string; score: number; rank: number }[],
    workData: Map<number, {
      views: number;
      likes: number;
      comments: number;
      audienceRating: number;
      ratingCount: number;
      humanQuality: number | null;
      recognitionCount: number;
      dataTrustScore: number | null;
      momentumScore: number;
      isNew: boolean;
    }>
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // 1. 高播放低质量进入 Top 10
    anomalies.push(...this.detectHighPopLowQuality(ranking, workData));

    // 2. 低播放高质量未进入 Top 50
    anomalies.push(...this.detectLowPopHighQuality(ranking, workData));

    // 3. Recognition 极高但质量一般
    anomalies.push(...this.detectHighRecognitionLowQuality(ranking, workData));

    // 4. 新作品 Momentum 异常冲榜
    anomalies.push(...this.detectMomentumAnomaly(ranking, workData));

    // 5. 小样本 rating 异常
    anomalies.push(...this.detectSmallSampleAnomaly(ranking, workData));

    // 6. 数据可信度低却排名过高
    anomalies.push(...this.detectLowTrustHighRank(ranking, workData));

    // 7. 单一指标影响过大
    anomalies.push(...this.detectSingleFactorDominance(ranking, workData));

    return anomalies.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private detectHighPopLowQuality(
    ranking: { workId: number; rank: number }[],
    workData: Map<number, { views: number; humanQuality: number | null }>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const top10 = ranking.slice(0, 10);

    for (const item of top10) {
      const data = workData.get(item.workId);
      if (!data) continue;

      if (data.views > 100000 && data.humanQuality !== null && data.humanQuality <= 3) {
        anomalies.push({
          type: 'HIGH_POP_LOW_QUALITY_TOP10',
          severity: 'critical',
          workId: item.workId,
          title: ranking.find(r => r.workId === item.workId)?.title || '',
          rank: item.rank,
          description: `High popularity (${data.views} views) but low quality (${data.humanQuality}) in Top 10`,
          metrics: { views: data.views, humanQuality: data.humanQuality },
        });
      }
    }

    return anomalies;
  }

  private detectLowPopHighQuality(
    ranking: { workId: number; rank: number }[],
    workData: Map<number, { views: number; humanQuality: number | null }>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const top50Ids = new Set(ranking.slice(0, 50).map(r => r.workId));

    for (const [workId, data] of workData) {
      if (data.humanQuality !== null && data.humanQuality >= 4 && data.views < 20000 && !top50Ids.has(workId)) {
        anomalies.push({
          type: 'LOW_POP_HIGH_QUALITY_MISSING',
          severity: 'warning',
          workId,
          title: ranking.find(r => r.workId === workId)?.title || '',
          rank: 999,
          description: `High quality (${data.humanQuality}) but low popularity (${data.views} views) not in Top 50`,
          metrics: { views: data.views, humanQuality: data.humanQuality },
        });
      }
    }

    return anomalies;
  }

  private detectHighRecognitionLowQuality(
    ranking: { workId: number; rank: number }[],
    workData: Map<number, { recognitionCount: number; humanQuality: number | null }>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    for (const item of ranking.slice(0, 20)) {
      const data = workData.get(item.workId);
      if (!data) continue;

      if (data.recognitionCount >= 3 && data.humanQuality !== null && data.humanQuality <= 3) {
        anomalies.push({
          type: 'HIGH_RECOGNITION_LOW_QUALITY',
          severity: 'warning',
          workId: item.workId,
          title: item.title,
          rank: item.rank,
          description: `${data.recognitionCount} recognition signals but quality only ${data.humanQuality}`,
          metrics: { recognitionCount: data.recognitionCount, humanQuality: data.humanQuality },
        });
      }
    }

    return anomalies;
  }

  private detectMomentumAnomaly(
    ranking: { workId: number; rank: number }[],
    workData: Map<number, { momentumScore: number; isNew: boolean }>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    for (const item of ranking.slice(0, 20)) {
      const data = workData.get(item.workId);
      if (!data) continue;

      if (data.isNew && data.momentumScore > 0.8) {
        anomalies.push({
          type: 'MOMENTUM_ANOMALY_NEW_WORK',
          severity: 'info',
          workId: item.workId,
          title: item.title,
          rank: item.rank,
          description: `New work with extremely high momentum (${(data.momentumScore * 100).toFixed(1)}%)`,
          metrics: { momentumScore: data.momentumScore },
        });
      }
    }

    return anomalies;
  }

  private detectSmallSampleAnomaly(
    ranking: { workId: number; rank: number }[],
    workData: Map<number, { ratingCount: number; audienceRating: number }>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    for (const item of ranking.slice(0, 20)) {
      const data = workData.get(item.workId);
      if (!data) continue;

      if (data.ratingCount > 0 && data.ratingCount < 10 && data.audienceRating > 9) {
        anomalies.push({
          type: 'SMALL_SAMPLE_HIGH_RATING',
          severity: 'info',
          workId: item.workId,
          title: item.title,
          rank: item.rank,
          description: `High rating (${data.audienceRating}) but only ${data.ratingCount} ratings`,
          metrics: { ratingCount: data.ratingCount, audienceRating: data.audienceRating },
        });
      }
    }

    return anomalies;
  }

  private detectLowTrustHighRank(
    ranking: { workId: number; rank: number }[],
    workData: Map<number, { dataTrustScore: number | null }>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    for (const item of ranking.slice(0, 20)) {
      const data = workData.get(item.workId);
      if (!data) continue;

      if (data.dataTrustScore !== null && data.dataTrustScore < 50) {
        anomalies.push({
          type: 'LOW_TRUST_HIGH_RANK',
          severity: 'critical',
          workId: item.workId,
          title: item.title,
          rank: item.rank,
          description: `Low data trust (${data.dataTrustScore}) but ranked #${item.rank}`,
          metrics: { dataTrustScore: data.dataTrustScore },
        });
      }
    }

    return anomalies;
  }

  private detectSingleFactorDominance(
    ranking: { workId: number; rank: number; score: number }[],
    workData: Map<number, Record<string, number>>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    for (const item of ranking.slice(0, 20)) {
      const data = workData.get(item.workId);
      if (!data) continue;

      // Check if any single factor contributes > 60% of the score
      const factors = Object.entries(data).filter(([k]) => k !== 'score');
      const total = factors.reduce((sum, [, v]) => sum + (v as number), 0);

      if (total > 0) {
        for (const [factor, value] of factors) {
          const ratio = (value as number) / total;
          if (ratio > 0.6) {
            anomalies.push({
              type: 'SINGLE_FACTOR_DOMINANCE',
              severity: 'warning',
              workId: item.workId,
              title: item.title,
              rank: item.rank,
              description: `${factor} contributes ${(ratio * 100).toFixed(1)}% of total score`,
              metrics: { [factor]: value, ratio },
            });
          }
        }
      }
    }

    return anomalies;
  }

  /**
   * 生成异常报告
   */
  generateAnomalyReport(anomalies: Anomaly[]): string {
    const critical = anomalies.filter(a => a.severity === 'critical');
    const warnings = anomalies.filter(a => a.severity === 'warning');
    const infos = anomalies.filter(a => a.severity === 'info');

    const lines = [
      '# Algorithm Anomaly Report',
      '',
      `## Summary`,
      `- Critical: ${critical.length}`,
      `- Warnings: ${warnings.length}`,
      `- Info: ${infos.length}`,
      '',
      critical.length > 0 ? '## Critical Issues' : '',
      ...critical.map(a => `- **${a.title}** (Rank #${a.rank}): ${a.description}`),
      '',
      warnings.length > 0 ? '## Warnings' : '',
      ...warnings.map(a => `- **${a.title}** (Rank #${a.rank}): ${a.description}`),
      '',
      infos.length > 0 ? '## Info' : '',
      ...infos.map(a => `- **${a.title}** (Rank #${a.rank}): ${a.description}`),
    ];

    return lines.join('\n');
  }
}
