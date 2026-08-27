import type { D1Database } from '@cloudflare/workers-types';
import type { Job } from '../types';

export class JobModel {
  constructor(private db: D1Database) {}

  async create(job: Omit<Job, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    await this.db.prepare(`
      INSERT INTO jobs (job_id, type, status, cursor, batch_size, progress, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      job.job_id, job.type, job.status, job.cursor, job.batch_size, job.progress, job.error_message
    ).run();
    return job.job_id;
  }

  async findByJobId(jobId: string): Promise<Job | null> {
    const result = await this.db
      .prepare('SELECT * FROM jobs WHERE job_id = ?')
      .bind(jobId)
      .first<Job>();
    return result || null;
  }

  async updateProgress(jobId: string, progress: number, cursor?: string): Promise<void> {
    await this.db.prepare(`
      UPDATE jobs SET progress = ?, cursor = ?, updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
    `).bind(progress, cursor || null, jobId).run();
  }

  async updateStatus(jobId: string, status: Job['status'], errorMessage?: string): Promise<void> {
    await this.db.prepare(`
      UPDATE jobs SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ?
    `).bind(status, errorMessage || null, jobId).run();
  }

  async getPendingJobs(type?: string): Promise<Job[]> {
    let sql = 'SELECT * FROM jobs WHERE status = ?';
    const params: unknown[] = ['pending'];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY created_at ASC';

    const { results } = await this.db.prepare(sql).bind(...params).all<Job>();
    return results || [];
  }

  async getRecentJobs(limit: number = 20): Promise<Job[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?')
      .bind(limit)
      .all<Job>();
    return results || [];
  }
}
