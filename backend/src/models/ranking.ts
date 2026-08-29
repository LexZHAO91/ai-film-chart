import type { D1Database } from '@cloudflare/workers-types';
import type { RankingScores, RankingSnapshot, RankingSnapshotItem, RankingConfig } from '../types';

export class RankingModel {
  constructor(private db: D1Database) {}

  async getLatestConfig(): Promise<RankingConfig | null> {
    const result = await this.db
      .prepare('SELECT * FROM ranking_configs ORDER BY created_at DESC LIMIT 1')
      .first<RankingConfig>();
    return result || null;
  }

  async getConfigByVersion(version: string): Promise<RankingConfig | null> {
    const result = await this.db
      .prepare('SELECT * FROM ranking_configs WHERE version = ?')
      .bind(version)
      .first<RankingConfig>();
    return result || null;
  }

  async saveScores(scores: Omit<RankingScores, 'id' | 'calculated_at'>[]): Promise<void> {
    const statements = scores.map(s =>
      this.db.prepare(`
        INSERT INTO ranking_scores (
          film_id, popularity_score, momentum_score, engagement_score,
          audience_score, quality_score, final_score, rank, previous_rank, ranking_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        s.film_id, s.popularity_score, s.momentum_score, s.engagement_score,
        s.audience_score, s.quality_score, s.final_score, s.rank, s.previous_rank, s.ranking_version
      )
    );
    await this.db.batch(statements);
  }

  async getLatestScores(version: string, limit: number = 100): Promise<RankingScores[]> {
    const { results } = await this.db.prepare(`
      SELECT rs.* FROM ranking_scores rs
      INNER JOIN (
        SELECT film_id, MAX(calculated_at) as max_at
        FROM ranking_scores
        WHERE ranking_version = ?
        GROUP BY film_id
      ) latest ON rs.film_id = latest.film_id AND rs.calculated_at = latest.max_at
      ORDER BY rs.rank ASC
      LIMIT ?
    `).bind(version, limit).all<RankingScores>();
    return results || [];
  }

  async createSnapshot(
    rankingType: string,
    version: string,
    periodStart: string,
    periodEnd: string
  ): Promise<number> {
    const result = await this.db.prepare(`
      INSERT INTO ranking_snapshots (ranking_type, ranking_version, period_start, period_end)
      VALUES (?, ?, ?, ?)
    `).bind(rankingType, version, periodStart, periodEnd).run();
    return result.meta?.last_row_id as number;
  }

  async addSnapshotItems(items: Omit<RankingSnapshotItem, 'id'>[]): Promise<void> {
    const statements = items.map(item =>
      this.db.prepare(`
        INSERT INTO ranking_snapshot_items (snapshot_id, film_id, rank, previous_rank, score, rank_change, is_new)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(item.snapshot_id, item.film_id, item.rank, item.previous_rank, item.score, item.rank_change, item.is_new ? 1 : 0)
    );
    await this.db.batch(statements);
  }

  async getLatestSnapshot(rankingType: string): Promise<RankingSnapshot | null> {
    const result = await this.db
      .prepare('SELECT * FROM ranking_snapshots WHERE ranking_type = ? ORDER BY published_at DESC LIMIT 1')
      .bind(rankingType)
      .first<RankingSnapshot>();
    return result || null;
  }

  async getSnapshotWithItems(snapshotId: number): Promise<{ snapshot: RankingSnapshot; items: (RankingSnapshotItem & { film_title?: string; thumbnail_url?: string })[] } | null> {
    const snapshot = await this.db
      .prepare('SELECT * FROM ranking_snapshots WHERE id = ?')
      .bind(snapshotId)
      .first<RankingSnapshot>();

    if (!snapshot) return null;

    const { results } = await this.db.prepare(`
      SELECT
        rsi.*,
        w.canonical_title as film_title,
        w.poster_url as thumbnail_url,
        w.creator_name,
        w.duration_seconds,
        w.original_language as language,
        w.country,
        w.genre_json,
        rs2.final_score as ranking_final_score,
        rs2.audience_score as ranking_audience_score,
        (SELECT AVG(rating) FROM ratings WHERE film_id = w.id) as avg_rating,
        (SELECT COUNT(*) FROM ratings WHERE film_id = w.id) as rating_count,
        wm.views,
        wm.likes
      FROM ranking_snapshot_items rsi
      JOIN works w ON rsi.film_id = w.id
      LEFT JOIN ranking_scores rs2 ON rs2.film_id = w.id
        AND rs2.calculated_at = (SELECT MAX(calculated_at) FROM ranking_scores WHERE film_id = w.id)
      LEFT JOIN work_metrics wm ON wm.work_id = w.id
        AND wm.collected_at = (SELECT MAX(collected_at) FROM work_metrics WHERE work_id = w.id)
      WHERE rsi.snapshot_id = ?
      ORDER BY rsi.rank ASC
    `).bind(snapshotId).all<RankingSnapshotItem & {
      film_title?: string;
      thumbnail_url?: string;
      creator_name?: string;
      duration_seconds?: number;
      language?: string;
      country?: string;
      genre_json?: string;
      ranking_final_score?: number;
      ranking_audience_score?: number;
      avg_rating?: number;
      rating_count?: number;
      views?: number;
      likes?: number;
    }>();

    return { snapshot, items: results || [] };
  }

  async getPreviousRank(filmId: number, rankingType: string): Promise<number | null> {
    const result = await this.db.prepare(`
      SELECT rsi.rank FROM ranking_snapshot_items rsi
      JOIN ranking_snapshots rs ON rsi.snapshot_id = rs.id
      WHERE rsi.film_id = ? AND rs.ranking_type = ?
      ORDER BY rs.published_at DESC
      LIMIT 1 OFFSET 1
    `).bind(filmId, rankingType).first<{ rank: number }>();
    return result?.rank || null;
  }
}
