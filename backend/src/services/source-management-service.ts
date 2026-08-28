/**
 * Source Management Service
 *
 * 管理数据源的启用/禁用、运行状态、统计信息。
 * Admin 可以在 /admin/sources 查看和管理所有数据源。
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface DataSourceRecord {
  id: number;
  sourceId: string;
  name: string;
  sourceType: string;
  adapterType: string;
  configJson: string;
  status: 'active' | 'paused' | 'disabled' | 'error';
  lastRunAt?: string;
  lastError?: string;
  candidateCount: number;
  successfulImports: number;
  errorCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SourceStats {
  sourceId: string;
  name: string;
  status: string;
  lastRunAt?: string;
  candidateCount: number;
  successfulImports: number;
  errorCount: number;
  importRate: number;
}

export class SourceManagementService {
  constructor(private db: D1Database) {}

  /**
   * 获取所有数据源
   */
  async getAllSources(): Promise<DataSourceRecord[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM data_sources ORDER BY created_at DESC')
      .all();

    return (results || []).map(row => this.mapRow(row as Record<string, unknown>));
  }

  /**
   * 获取单个数据源
   */
  async getSource(sourceId: string): Promise<DataSourceRecord | null> {
    const row = await this.db
      .prepare('SELECT * FROM data_sources WHERE source_id = ?')
      .bind(sourceId)
      .first();

    return row ? this.mapRow(row as Record<string, unknown>) : null;
  }

  /**
   * 创建数据源
   */
  async createSource(input: {
    sourceId: string;
    name: string;
    sourceType: string;
    adapterType: string;
    config?: Record<string, unknown>;
  }): Promise<DataSourceRecord> {
    const result = await this.db
      .prepare(
        `INSERT INTO data_sources (source_id, name, source_type, adapter_type, config_json, status)
         VALUES (?, ?, ?, ?, ?, 'active')
         RETURNING *`
      )
      .bind(
        input.sourceId,
        input.name,
        input.sourceType,
        input.adapterType,
        JSON.stringify(input.config || {})
      )
      .first();

    return this.mapRow(result);
  }

  /**
   * 更新数据源状态
   */
  async updateStatus(
    sourceId: string,
    status: 'active' | 'paused' | 'disabled' | 'error',
    errorMessage?: string
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE data_sources
         SET status = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP
         WHERE source_id = ?`
      )
      .bind(status, errorMessage || null, sourceId)
      .run();
  }

  /**
   * 记录数据源运行
   */
  async recordRun(
    sourceId: string,
    stats: {
      candidatesFound: number;
      successfulImports: number;
      errors: number;
    }
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE data_sources
         SET last_run_at = CURRENT_TIMESTAMP,
             candidate_count = candidate_count + ?,
             successful_imports = successful_imports + ?,
             error_count = error_count + ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE source_id = ?`
      )
      .bind(
        stats.candidatesFound,
        stats.successfulImports,
        stats.errors,
        sourceId
      )
      .run();
  }

  /**
   * 获取数据源统计
   */
  async getStats(): Promise<SourceStats[]> {
    const sources = await this.getAllSources();

    return sources.map(s => {
      const total = s.successfulImports + s.errorCount;
      return {
        sourceId: s.sourceId,
        name: s.name,
        status: s.status,
        lastRunAt: s.lastRunAt,
        candidateCount: s.candidateCount,
        successfulImports: s.successfulImports,
        errorCount: s.errorCount,
        importRate: total > 0 ? s.successfulImports / total : 0,
      };
    });
  }

  /**
   * 获取数据源审计日志
   *
   * 输出每个周期的数据流：
   * Total candidates discovered → Unique works → Eligible works → Rejected works
   * → AI classified → Recognition matched → Popularity matched → Ranked works
   */
  async getSourceAudit(sourceId: string): Promise<{
    sourceId: string;
    totalCandidates: number;
    uniqueWorks: number;
    eligibleWorks: number;
    rejectedWorks: number;
    aiClassified: number;
    recognitionMatched: number;
    popularityMatched: number;
    rankedWorks: number;
  } | null> {
    // 从 data_sources 表获取基础统计
    const source = await this.getSource(sourceId);
    if (!source) return null;

    // 从 data_provenance 获取更详细的统计
    const { results: provenanceStats } = await this.db
      .prepare(
        `SELECT data_field, COUNT(*) as count
         FROM data_provenance
         WHERE source_type = ?
         GROUP BY data_field`
      )
      .bind(sourceId)
      .all();

    const fieldCounts: Record<string, number> = {};
    for (const row of provenanceStats || []) {
      const r = row as Record<string, unknown>;
      fieldCounts[r.data_field as string] = r.count as number;
    }

    return {
      sourceId,
      totalCandidates: source.candidateCount,
      uniqueWorks: fieldCounts['seed_import'] || 0,
      eligibleWorks: fieldCounts['eligibility_status'] || 0,
      rejectedWorks: 0, // 需要额外查询
      aiClassified: fieldCounts['ai_classification'] || 0,
      recognitionMatched: fieldCounts['recognition'] || 0,
      popularityMatched: fieldCounts['popularity'] || 0,
      rankedWorks: fieldCounts['ranking'] || 0,
    };
  }

  private mapRow(row: unknown): DataSourceRecord {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as number,
      sourceId: r.source_id as string,
      name: r.name as string,
      sourceType: r.source_type as string,
      adapterType: r.adapter_type as string,
      configJson: (r.config_json as string) || '{}',
      status: r.status as DataSourceRecord['status'],
      lastRunAt: r.last_run_at as string | undefined,
      lastError: r.last_error as string | undefined,
      candidateCount: (r.candidate_count as number) || 0,
      successfulImports: (r.successful_imports as number) || 0,
      errorCount: (r.error_count as number) || 0,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    };
  }
}
