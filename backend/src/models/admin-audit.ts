import type { D1Database } from '@cloudflare/workers-types';

export interface AdminAuditLog {
  id: number;
  film_id: number;
  action: 'exclude' | 'restore' | 'reject' | 'approve';
  previous_status: string;
  new_status: string;
  reason: string;
  operator: string;
  created_at: string;
}

/**
 * Admin Audit Log Model
 *
 * Phase 10: Admin Override
 * - exclude: 管理员排除作品（不删除数据）
 * - restore: 恢复被排除的作品
 * - reject: 拒绝候选作品
 * - approve: 批准候选作品
 *
 * 所有操作记录：reason, operator, timestamp
 */
export class AdminAuditModel {
  constructor(private db: D1Database) {}

  async create(log: Omit<AdminAuditLog, 'id' | 'created_at'>): Promise<number> {
    const result = await this.db
      .prepare(`
        INSERT INTO admin_audit_logs (film_id, action, previous_status, new_status, reason, operator, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `)
      .bind(
        log.film_id,
        log.action,
        log.previous_status,
        log.new_status,
        log.reason,
        log.operator
      )
      .run();

    return result.meta.last_row_id;
  }

  async getLogsForFilm(filmId: number): Promise<AdminAuditLog[]> {
    const { results } = await this.db
      .prepare(`
        SELECT * FROM admin_audit_logs
        WHERE film_id = ?
        ORDER BY created_at DESC
      `)
      .bind(filmId)
      .all<AdminAuditLog>();

    return results || [];
  }

  async getRecentLogs(limit: number = 50): Promise<AdminAuditLog[]> {
    const { results } = await this.db
      .prepare(`
        SELECT * FROM admin_audit_logs
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .bind(limit)
      .all<AdminAuditLog>();

    return results || [];
  }
}
