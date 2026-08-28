/**
 * Data Provenance Service
 *
 * 核心原则：
 * - 所有重要数据必须知道"这个数据来自哪里"
 * - 不能出现"94分"但无法解释来源
 * - 为成为第三方权威榜单打下基础
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface ProvenanceRecord {
  id: number;
  workId: number;
  sourceType: string;
  sourceUrl?: string;
  dataField: string;
  dataValue?: string;
  confidence: number;
  extractionMethod: string;
  collectedAt: string;
}

export interface ProvenanceSummary {
  workId: number;
  totalRecords: number;
  fields: string[];
  sources: string[];
  confidence: {
    average: number;
    min: number;
    max: number;
  };
}

export class DataProvenanceService {
  constructor(private db: D1Database) {}

  /**
   * 记录数据来源
   */
  async record(input: {
    workId: number;
    sourceType: string;
    sourceUrl?: string;
    dataField: string;
    dataValue?: string;
    confidence?: number;
    extractionMethod: string;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO data_provenance (
          work_id, source_type, source_url, data_field, data_value, confidence, extraction_method
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        input.workId,
        input.sourceType,
        input.sourceUrl || null,
        input.dataField,
        input.dataValue || null,
        input.confidence ?? 1.0,
        input.extractionMethod
      )
      .run();
  }

  /**
   * 批量记录数据来源
   */
  async recordBatch(inputs: {
    workId: number;
    sourceType: string;
    sourceUrl?: string;
    dataField: string;
    dataValue?: string;
    confidence?: number;
    extractionMethod: string;
  }[]): Promise<void> {
    for (const input of inputs) {
      await this.record(input);
    }
  }

  /**
   * 获取作品的来源记录
   */
  async getByWork(workId: number): Promise<ProvenanceRecord[]> {
    const { results } = await this.db
      .prepare(
        `SELECT * FROM data_provenance
         WHERE work_id = ?
         ORDER BY collected_at DESC`
      )
      .bind(workId)
      .all();

    return (results || []).map(row => this.mapRow(row as Record<string, unknown>));
  }

  /**
   * 获取作品某个字段的来源
   */
  async getByField(workId: number, dataField: string): Promise<ProvenanceRecord[]> {
    const { results } = await this.db
      .prepare(
        `SELECT * FROM data_provenance
         WHERE work_id = ? AND data_field = ?
         ORDER BY collected_at DESC`
      )
      .bind(workId, dataField)
      .all();

    return (results || []).map(row => this.mapRow(row as Record<string, unknown>));
  }

  /**
   * 获取作品数据来源摘要
   */
  async getSummary(workId: number): Promise<ProvenanceSummary> {
    const records = await this.getByWork(workId);

    const fields = [...new Set(records.map(r => r.dataField))];
    const sources = [...new Set(records.map(r => r.sourceType))];
    const confidences = records.map(r => r.confidence);

    return {
      workId,
      totalRecords: records.length,
      fields,
      sources,
      confidence: {
        average: confidences.length > 0
          ? confidences.reduce((a, b) => a + b, 0) / confidences.length
          : 0,
        min: confidences.length > 0 ? Math.min(...confidences) : 0,
        max: confidences.length > 0 ? Math.max(...confidences) : 0,
      },
    };
  }

  /**
   * 获取所有作品的来源统计
   */
  async getGlobalStats(): Promise<{
    totalRecords: number;
    uniqueWorks: number;
    uniqueSources: string[];
    fieldDistribution: Record<string, number>;
  }> {
    const { results: totalResult } = await this.db
      .prepare('SELECT COUNT(*) as count FROM data_provenance')
      .all();

    const { results: worksResult } = await this.db
      .prepare('SELECT COUNT(DISTINCT work_id) as count FROM data_provenance')
      .all();

    const { results: sourcesResult } = await this.db
      .prepare('SELECT DISTINCT source_type FROM data_provenance')
      .all();

    const { results: fieldsResult } = await this.db
      .prepare('SELECT data_field, COUNT(*) as count FROM data_provenance GROUP BY data_field')
      .all();

    const fieldDistribution: Record<string, number> = {};
    for (const row of fieldsResult || []) {
      const r = row as Record<string, unknown>;
      fieldDistribution[r.data_field as string] = r.count as number;
    }

    return {
      totalRecords: (totalResult?.[0] as Record<string, unknown>)?.count as number || 0,
      uniqueWorks: (worksResult?.[0] as Record<string, unknown>)?.count as number || 0,
      uniqueSources: (sourcesResult || []).map(r => (r as Record<string, unknown>).source_type as string),
      fieldDistribution,
    };
  }

  private mapRow(row: unknown): ProvenanceRecord {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as number,
      workId: r.work_id as number,
      sourceType: r.source_type as string,
      sourceUrl: r.source_url as string | undefined,
      dataField: r.data_field as string,
      dataValue: r.data_value as string | undefined,
      confidence: (r.confidence as number) || 1.0,
      extractionMethod: r.extraction_method as string,
      collectedAt: r.collected_at as string,
    };
  }
}
