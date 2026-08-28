/**
 * Recognition Signal Service
 *
 * 作用：
 * - 管理作品的赛事/奖项/认可信号
 * - 计算 Recognition Score（不直接决定 Final Ranking）
 * - 保留原始来源信息
 *
 * 不同 recognition 的权重：
 * - WINNER: 1.0
 * - JURY_AWARD: 0.9
 * - AUDIENCE_AWARD: 0.8
 * - OFFICIAL_SELECTION: 0.5
 * - NOMINEE: 0.4
 * - HONORABLE_MENTION: 0.3
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface RecognitionSignalRecord {
  id: number;
  workId: number;
  organization: string;
  event: string;
  category?: string;
  awardLevel: string;
  year?: number;
  sourceUrl?: string;
  verified: boolean;
  verifiedAt?: string;
  createdAt: string;
}

export interface RecognitionScore {
  workId: number;
  totalScore: number;
  signalCount: number;
  signals: RecognitionSignalRecord[];
  breakdown: {
    level: string;
    count: number;
    weight: number;
    subtotal: number;
  }[];
}

export const AWARD_LEVEL_WEIGHTS: Record<string, number> = {
  WINNER: 1.0,
  JURY_AWARD: 0.9,
  AUDIENCE_AWARD: 0.8,
  OFFICIAL_SELECTION: 0.5,
  NOMINEE: 0.4,
  HONORABLE_MENTION: 0.3,
};

export class RecognitionSignalService {
  constructor(private db: D1Database) {}

  /**
   * 添加认可信号
   */
  async addSignal(input: {
    workId: number;
    organization: string;
    event: string;
    category?: string;
    awardLevel: string;
    year?: number;
    sourceUrl?: string;
  }): Promise<RecognitionSignalRecord> {
    const result = await this.db
      .prepare(
        `INSERT INTO recognition_signals (
          work_id, organization, event, category, award_level, year, source_url, verified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        RETURNING *`
      )
      .bind(
        input.workId,
        input.organization,
        input.event,
        input.category || null,
        input.awardLevel,
        input.year || null,
        input.sourceUrl || null
      )
      .first();

    return this.mapRow(result);
  }

  /**
   * 获取作品的所有认可信号
   */
  async getSignalsByWork(workId: number): Promise<RecognitionSignalRecord[]> {
    const { results } = await this.db
      .prepare(
        `SELECT * FROM recognition_signals
         WHERE work_id = ?
         ORDER BY year DESC, created_at DESC`
      )
      .bind(workId)
      .all();

    return (results || []).map(row => this.mapRow(row as Record<string, unknown>));
  }

  /**
   * 计算作品的 Recognition Score
   */
  async calculateScore(workId: number): Promise<RecognitionScore> {
    const signals = await this.getSignalsByWork(workId);

    const breakdown: RecognitionScore['breakdown'] = [];
    let totalScore = 0;

    // 按 awardLevel 分组统计
    const levelGroups = new Map<string, number>();
    for (const signal of signals) {
      const count = levelGroups.get(signal.awardLevel) || 0;
      levelGroups.set(signal.awardLevel, count + 1);
    }

    for (const [level, count] of levelGroups) {
      const weight = AWARD_LEVEL_WEIGHTS[level] || 0.1;
      // 同级别的多个奖项递减：第一个满分，第二个 0.7，第三个 0.5...
      let subtotal = 0;
      for (let i = 0; i < count; i++) {
        subtotal += weight * Math.pow(0.7, i);
      }
      totalScore += subtotal;
      breakdown.push({ level, count, weight, subtotal });
    }

    // 归一化到 0-1 范围（假设最高可能得分为 5）
    const normalizedScore = Math.min(totalScore / 5, 1);

    return {
      workId,
      totalScore: normalizedScore,
      signalCount: signals.length,
      signals,
      breakdown,
    };
  }

  /**
   * 批量计算多个作品的 Recognition Score
   */
  async calculateScores(workIds: number[]): Promise<Map<number, RecognitionScore>> {
    const scores = new Map<number, RecognitionScore>();
    for (const workId of workIds) {
      const score = await this.calculateScore(workId);
      scores.set(workId, score);
    }
    return scores;
  }

  /**
   * 获取所有有认可信号的作品 ID
   */
  async getWorkIdsWithSignals(): Promise<number[]> {
    const { results } = await this.db
      .prepare('SELECT DISTINCT work_id FROM recognition_signals')
      .all();

    return (results || []).map(row => (row as Record<string, unknown>).work_id as number);
  }

  private mapRow(row: unknown): RecognitionSignalRecord {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as number,
      workId: r.work_id as number,
      organization: r.organization as string,
      event: r.event as string,
      category: r.category as string | undefined,
      awardLevel: r.award_level as string,
      year: r.year as number | undefined,
      sourceUrl: r.source_url as string | undefined,
      verified: (r.verified as number) === 1,
      verifiedAt: r.verified_at as string | undefined,
      createdAt: r.created_at as string,
    };
  }
}
