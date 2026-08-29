import type { D1Database } from '@cloudflare/workers-types';
import type { Film, FilmMetrics, FilmAIAnalysis } from '../types';

// Works-to-Film field mapping for backward compatibility
// The new 'works' table is the source of truth. We map its columns to the old Film interface.
const WORKS_TO_FILM_SELECT = `
  w.id,
  'YOUTUBE' as source,
  ws.external_id as source_video_id,
  ws.canonical_url,
  w.canonical_title as title,
  w.synopsis as description,
  w.poster_url as thumbnail_url,
  '' as channel_id,
  w.creator_name as channel_name,
  ws.source_published_at as published_at,
  w.duration_seconds,
  w.original_language as language,
  1 as is_ai_film,
  1 as is_story_content,
  w.type as content_type,
  w.genre_json,
  w.ai_contribution_level as ai_generation_level,
  1.0 as ai_confidence,
  w.eligibility_status as status,
  w.created_at,
  w.updated_at
`;

export class FilmModel {
  constructor(private db: D1Database) {}

  async findById(id: number): Promise<Film | null> {
    const result = await this.db
      .prepare(`
        SELECT ${WORKS_TO_FILM_SELECT}
        FROM works w
        LEFT JOIN work_sources ws ON ws.work_id = w.id AND ws.is_primary_source = 1
        WHERE w.id = ?
        LIMIT 1
      `)
      .bind(id)
      .first<Film>();
    return result || null;
  }

  async findBySourceVideoId(sourceVideoId: string): Promise<Film | null> {
    const result = await this.db
      .prepare(`
        SELECT ${WORKS_TO_FILM_SELECT}
        FROM works w
        JOIN work_sources ws ON ws.work_id = w.id
        WHERE ws.external_id = ?
        LIMIT 1
      `)
      .bind(sourceVideoId)
      .first<Film>();
    return result || null;
  }

  async findAll(options: { status?: string; limit?: number; offset?: number } = {}): Promise<Film[]> {
    let sql = `
      SELECT ${WORKS_TO_FILM_SELECT}
      FROM works w
      LEFT JOIN work_sources ws ON ws.work_id = w.id AND ws.is_primary_source = 1
    `;
    const params: unknown[] = [];

    if (options.status) {
      sql += ' WHERE w.eligibility_status = ?';
      params.push(options.status);
    }

    sql += ' ORDER BY w.created_at DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const { results } = await this.db.prepare(sql).bind(...params).all<Film>();
    return results || [];
  }

  async create(film: Omit<Film, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const result = await this.db.prepare(`
      INSERT INTO films (
        source, source_video_id, canonical_url, title, description,
        thumbnail_url, channel_id, channel_name, published_at, duration_seconds,
        language, is_ai_film, is_story_content, content_type, genre_json,
        ai_generation_level, ai_confidence, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      film.source, film.source_video_id, film.canonical_url, film.title, film.description,
      film.thumbnail_url, film.channel_id, film.channel_name, film.published_at, film.duration_seconds,
      film.language, film.is_ai_film ? 1 : 0, film.is_story_content ? 1 : 0, film.content_type, film.genre_json,
      film.ai_generation_level, film.ai_confidence, film.status
    ).run();

    return result.meta?.last_row_id as number;
  }

  async update(id: number, updates: Partial<Film>): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'id') continue;
      fields.push(`${key} = ?`);
      values.push(value);
    }

    if (fields.length === 0) return;

    values.push(id);
    await this.db.prepare(`UPDATE films SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(...values)
      .run();
  }

  async updateStatus(id: number, status: string): Promise<void> {
    await this.db.prepare('UPDATE works SET eligibility_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(status, id)
      .run();
  }

  async getFilmStatus(id: number): Promise<string | null> {
    const result = await this.db
      .prepare('SELECT eligibility_status as status FROM works WHERE id = ?')
      .bind(id)
      .first<{ status: string }>();
    return result?.status || null;
  }

  async getLatestMetrics(filmId: number): Promise<FilmMetrics | null> {
    const result = await this.db
      .prepare('SELECT * FROM work_metrics WHERE work_id = ? ORDER BY collected_at DESC LIMIT 1')
      .bind(filmId)
      .first<FilmMetrics>();
    return result || null;
  }

  async getMetricsHistory(filmId: number, days: number = 30): Promise<FilmMetrics[]> {
    const { results } = await this.db
      .prepare(`
        SELECT * FROM work_metrics
        WHERE work_id = ? AND collected_at >= datetime('now', '-${days} days')
        ORDER BY collected_at DESC
      `)
      .bind(filmId)
      .all<FilmMetrics>();
    return results || [];
  }

  async addMetrics(filmId: number, metrics: { views: number; likes: number; comments: number }): Promise<void> {
    await this.db.prepare(`
      INSERT INTO work_metrics (work_id, views, likes, comments)
      VALUES (?, ?, ?, ?)
    `).bind(filmId, metrics.views, metrics.likes, metrics.comments).run();
  }

  async getLatestAIAnalysis(filmId: number): Promise<FilmAIAnalysis | null> {
    const result = await this.db
      .prepare('SELECT * FROM film_ai_analysis WHERE film_id = ? ORDER BY analyzed_at DESC LIMIT 1')
      .bind(filmId)
      .first<FilmAIAnalysis>();
    return result || null;
  }

  async addAIAnalysis(analysis: Omit<FilmAIAnalysis, 'id' | 'analyzed_at'>): Promise<void> {
    await this.db.prepare(`
      INSERT INTO film_ai_analysis (
        film_id, model_name, model_version, prompt_version,
        is_ai_film, is_story_content, content_type, genres_json,
        language, ai_generation_level, story_completeness, summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      analysis.film_id, analysis.model_name, analysis.model_version, analysis.prompt_version,
      analysis.is_ai_film ? 1 : 0, analysis.is_story_content ? 1 : 0, analysis.content_type, analysis.genres_json,
      analysis.language, analysis.ai_generation_level, analysis.story_completeness, analysis.summary
    ).run();
  }

  async getFilmsNeedingMetricsUpdate(limit: number = 50): Promise<Film[]> {
    const { results } = await this.db.prepare(`
      SELECT ${WORKS_TO_FILM_SELECT}
      FROM works w
      LEFT JOIN work_sources ws ON ws.work_id = w.id AND ws.is_primary_source = 1
      LEFT JOIN work_metrics wm ON w.id = wm.work_id
      WHERE w.eligibility_status = 'approved'
      GROUP BY w.id
      HAVING wm.collected_at IS NULL OR MAX(wm.collected_at) < datetime('now', '-1 days')
      LIMIT ?
    `).bind(limit).all<Film>();
    return results || [];
  }

  async getFilmsNeedingAIAnalysis(limit: number = 50): Promise<Film[]> {
    const { results } = await this.db.prepare(`
      SELECT ${WORKS_TO_FILM_SELECT}
      FROM works w
      LEFT JOIN work_sources ws ON ws.work_id = w.id AND ws.is_primary_source = 1
      LEFT JOIN film_ai_analysis fa ON w.id = fa.film_id
      WHERE w.eligibility_status = 'pending' AND fa.id IS NULL
      LIMIT ?
    `).bind(limit).all<Film>();
    return results || [];
  }
}
