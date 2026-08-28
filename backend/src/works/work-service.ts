/**
 * Work Service
 *
 * 核心概念：
 * - Work = 真正的影视作品实体（如 "The Last Human"）
 * - WorkSource = 作品在某个平台上的发布页面（如 YouTube Video, Vimeo Video, Festival Page）
 *
 * 一个 Work 可以绑定多个 Source。
 */

import type { D1Database } from '@cloudflare/workers-types';
import { ContentType, ContentFormat, ContentStatus } from '../taxonomy';

export interface Work {
  id: number;
  canonicalTitle: string;
  type: ContentType;
  format: ContentFormat;
  synopsis?: string;
  originalLanguage?: string;
  country?: string;
  releaseYear?: number;
  durationSeconds?: number;
  aiContributionLevel: number;
  eligibilityStatus: ContentStatus;
  qualityStatus: string;
  creatorName?: string;
  creatorUrl?: string;
  genreJson: string;
  tagsJson: string;
  posterUrl?: string;
  trailerUrl?: string;
  officialSiteUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkSource {
  id: number;
  workId: number;
  sourceType: string;
  externalId?: string;
  canonicalUrl: string;
  titleOnSource?: string;
  sourceChannel?: string;
  sourcePublishedAt?: string;
  sourceMetadataJson: string;
  isPrimarySource: boolean;
  discoveredAt: string;
  updatedAt: string;
}

export interface CreateWorkInput {
  canonicalTitle: string;
  type: ContentType;
  format?: ContentFormat;
  synopsis?: string;
  originalLanguage?: string;
  country?: string;
  releaseYear?: number;
  durationSeconds?: number;
  aiContributionLevel?: number;
  creatorName?: string;
  creatorUrl?: string;
  genres?: string[];
  tags?: string[];
  posterUrl?: string;
  trailerUrl?: string;
  officialSiteUrl?: string;
}

export interface CreateWorkSourceInput {
  workId: number;
  sourceType: string;
  externalId?: string;
  canonicalUrl: string;
  titleOnSource?: string;
  sourceChannel?: string;
  sourcePublishedAt?: string;
  sourceMetadata?: Record<string, unknown>;
  isPrimarySource?: boolean;
}

export class WorkService {
  constructor(private db: D1Database) {}

  /**
   * 创建新作品
   */
  async createWork(input: CreateWorkInput): Promise<Work> {
    const result = await this.db
      .prepare(
        `INSERT INTO works (
          canonical_title, type, format, synopsis, original_language, country,
          release_year, duration_seconds, ai_contribution_level, creator_name,
          creator_url, genre_json, tags_json, poster_url, trailer_url, official_site_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *`
      )
      .bind(
        input.canonicalTitle,
        input.type,
        input.format || ContentFormat.UNKNOWN,
        input.synopsis || null,
        input.originalLanguage || null,
        input.country || null,
        input.releaseYear || null,
        input.durationSeconds || null,
        input.aiContributionLevel || 0,
        input.creatorName || null,
        input.creatorUrl || null,
        JSON.stringify(input.genres || []),
        JSON.stringify(input.tags || []),
        input.posterUrl || null,
        input.trailerUrl || null,
        input.officialSiteUrl || null
      )
      .first();

    return this.mapWorkRow(result);
  }

  /**
   * 通过 ID 获取作品
   */
  async getWorkById(id: number): Promise<Work | null> {
    const row = await this.db
      .prepare('SELECT * FROM works WHERE id = ?')
      .bind(id)
      .first();

    return row ? this.mapWorkRow(row) : null;
  }

  /**
   * 获取作品列表（支持筛选）
   */
  async listWorks(options: {
    type?: ContentType;
    eligibilityStatus?: ContentStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<Work[]> {
    let sql = 'SELECT * FROM works WHERE 1=1';
    const params: (string | number)[] = [];

    if (options.type) {
      sql += ' AND type = ?';
      params.push(options.type);
    }
    if (options.eligibilityStatus) {
      sql += ' AND eligibility_status = ?';
      params.push(options.eligibilityStatus);
    }

    sql += ' ORDER BY created_at DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    if (options.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const { results } = await this.db.prepare(sql).bind(...params).all();
    return (results || []).map(row => this.mapWorkRow(row as Record<string, unknown>));
  }

  /**
   * 为作品添加来源
   */
  async addWorkSource(input: CreateWorkSourceInput): Promise<WorkSource> {
    const result = await this.db
      .prepare(
        `INSERT INTO work_sources (
          work_id, source_type, external_id, canonical_url, title_on_source,
          source_channel, source_published_at, source_metadata_json, is_primary_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *`
      )
      .bind(
        input.workId,
        input.sourceType,
        input.externalId || null,
        input.canonicalUrl,
        input.titleOnSource || null,
        input.sourceChannel || null,
        input.sourcePublishedAt || null,
        JSON.stringify(input.sourceMetadata || {}),
        input.isPrimarySource ? 1 : 0
      )
      .first();

    return this.mapWorkSourceRow(result);
  }

  /**
   * 获取作品的所有来源
   */
  async getWorkSources(workId: number): Promise<WorkSource[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM work_sources WHERE work_id = ? ORDER BY is_primary_source DESC, discovered_at DESC')
      .bind(workId)
      .all();

    return (results || []).map(row => this.mapWorkSourceRow(row as Record<string, unknown>));
  }

  /**
   * 更新作品资格状态
   */
  async updateEligibilityStatus(
    workId: number,
    status: ContentStatus,
    reason?: string
  ): Promise<void> {
    await this.db
      .prepare('UPDATE works SET eligibility_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(status, workId)
      .run();

    // 记录 provenance
    await this.db
      .prepare(
        `INSERT INTO data_provenance (work_id, source_type, data_field, data_value, extraction_method)
         VALUES (?, 'ADMIN', 'eligibility_status', ?, 'MANUAL_ENTRY')`
      )
      .bind(workId, `${status}${reason ? ': ' + reason : ''}`)
      .run();
  }

  /**
   * 查找可能重复的作品（基于标题相似度）
   */
  async findPotentialDuplicates(title: string, creatorName?: string): Promise<Work[]> {
    const normalizedTitle = title.toLowerCase().trim();
    const { results } = await this.db
      .prepare('SELECT * FROM works WHERE LOWER(canonical_title) LIKE ?')
      .bind(`%${normalizedTitle}%`)
      .all();

    return (results || []).map(row => this.mapWorkRow(row as Record<string, unknown>));
  }

  /**
   * 合并两个作品（将 source 合并到 target）
   */
  async mergeWorks(targetWorkId: number, sourceWorkId: number, reason: string): Promise<void> {
    // 将所有 source 指向 target
    await this.db
      .prepare('UPDATE work_sources SET work_id = ? WHERE work_id = ?')
      .bind(targetWorkId, sourceWorkId)
      .run();

    // 标记 source work 为已合并
    await this.db
      .prepare(
        `UPDATE works SET eligibility_status = 'excluded', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      )
      .bind(sourceWorkId)
      .run();

    // 记录 provenance
    await this.db
      .prepare(
        `INSERT INTO data_provenance (work_id, source_type, data_field, data_value, extraction_method)
         VALUES (?, 'ADMIN', 'merge', ?, 'MANUAL_ENTRY')`
      )
      .bind(targetWorkId, `Merged work ${sourceWorkId} into ${targetWorkId}: ${reason}`)
      .run();
  }

  // ==================== Row Mappers ====================

  private mapWorkRow(row: unknown): Work {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as number,
      canonicalTitle: r.canonical_title as string,
      type: r.type as ContentType,
      format: (r.format as ContentFormat) || ContentFormat.UNKNOWN,
      synopsis: r.synopsis as string | undefined,
      originalLanguage: r.original_language as string | undefined,
      country: r.country as string | undefined,
      releaseYear: r.release_year as number | undefined,
      durationSeconds: r.duration_seconds as number | undefined,
      aiContributionLevel: (r.ai_contribution_level as number) || 0,
      eligibilityStatus: (r.eligibility_status as ContentStatus) || ContentStatus.PENDING,
      qualityStatus: (r.quality_status as string) || 'pending',
      creatorName: r.creator_name as string | undefined,
      creatorUrl: r.creator_url as string | undefined,
      genreJson: (r.genre_json as string) || '[]',
      tagsJson: (r.tags_json as string) || '[]',
      posterUrl: r.poster_url as string | undefined,
      trailerUrl: r.trailer_url as string | undefined,
      officialSiteUrl: r.official_site_url as string | undefined,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    };
  }

  private mapWorkSourceRow(row: unknown): WorkSource {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as number,
      workId: r.work_id as number,
      sourceType: r.source_type as string,
      externalId: r.external_id as string | undefined,
      canonicalUrl: r.canonical_url as string,
      titleOnSource: r.title_on_source as string | undefined,
      sourceChannel: r.source_channel as string | undefined,
      sourcePublishedAt: r.source_published_at as string | undefined,
      sourceMetadataJson: (r.source_metadata_json as string) || '{}',
      isPrimarySource: (r.is_primary_source as number) === 1,
      discoveredAt: r.discovered_at as string,
      updatedAt: r.updated_at as string,
    };
  }
}
