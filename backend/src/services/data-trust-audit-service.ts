/**
 * Data Trust Audit Service
 *
 * 为每个 Work 计算 data_trust_score (0-100)：
 * - source verification
 * - provenance completeness
 * - metadata completeness
 * - recognition verification
 * - popularity verification
 *
 * 等级：
 * 90-100 = HIGH
 * 70-89 = MEDIUM
 * <70 = LOW
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface DataTrustScore {
  workId: number;
  title: string;
  totalScore: number;
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  breakdown: {
    sourceVerification: number;
    provenanceCompleteness: number;
    metadataCompleteness: number;
    recognitionVerification: number;
    popularityVerification: number;
  };
  details: string[];
}

export class DataTrustAuditService {
  constructor(private db: D1Database) {}

  /**
   * 审计单个作品的数据可信度
   */
  async auditWork(workId: number): Promise<DataTrustScore> {
    const work = await this.db
      .prepare('SELECT id, canonical_title, synopsis, duration_seconds, creator_name, release_year, country, type FROM works WHERE id = ?')
      .bind(workId)
      .first<{ id: number; canonical_title: string; synopsis: string; duration_seconds: number; creator_name: string; release_year: number; country: string; type: string }>();

    if (!work) {
      throw new Error(`Work ${workId} not found`);
    }

    const details: string[] = [];

    // 1. Source Verification (0-20)
    const sourceScore = await this.calculateSourceVerification(workId, details);

    // 2. Provenance Completeness (0-20)
    const provenanceScore = await this.calculateProvenanceCompleteness(workId, details);

    // 3. Metadata Completeness (0-20)
    const metadataScore = this.calculateMetadataCompleteness(work, details);

    // 4. Recognition Verification (0-20)
    const recognitionScore = await this.calculateRecognitionVerification(workId, details);

    // 5. Popularity Verification (0-20)
    const popularityScore = await this.calculatePopularityVerification(workId, details);

    const totalScore = Math.round(sourceScore + provenanceScore + metadataScore + recognitionScore + popularityScore);

    let level: 'HIGH' | 'MEDIUM' | 'LOW';
    if (totalScore >= 90) level = 'HIGH';
    else if (totalScore >= 70) level = 'MEDIUM';
    else level = 'LOW';

    return {
      workId: work.id,
      title: work.canonical_title,
      totalScore,
      level,
      breakdown: {
        sourceVerification: Math.round(sourceScore),
        provenanceCompleteness: Math.round(provenanceScore),
        metadataCompleteness: Math.round(metadataScore),
        recognitionVerification: Math.round(recognitionScore),
        popularityVerification: Math.round(popularityScore),
      },
      details,
    };
  }

  /**
   * 批量审计所有作品
   */
  async auditAllWorks(workIds?: number[]): Promise<DataTrustScore[]> {
    let ids = workIds;
    if (!ids) {
      const { results } = await this.db
        .prepare('SELECT id FROM works WHERE eligibility_status = ?')
        .bind('approved')
        .all<{ id: number }>();
      ids = (results || []).map(r => r.id);
    }

    const scores: DataTrustScore[] = [];
    for (const id of ids) {
      try {
        const score = await this.auditWork(id);
        scores.push(score);
      } catch (e) {
        // Skip failed audits
      }
    }

    return scores.sort((a, b) => b.totalScore - a.totalScore);
  }

  private async calculateSourceVerification(workId: number, details: string[]): Promise<number> {
    const { results: sources } = await this.db
      .prepare('SELECT source_type, canonical_url, verification_status FROM work_sources WHERE work_id = ?')
      .bind(workId)
      .all<{ source_type: string; canonical_url: string; verification_status: string }>();

    if (!sources || sources.length === 0) {
      details.push('No sources found');
      return 0;
    }

    let score = 0;
    const hasPrimary = sources.some(s => s.canonical_url && s.canonical_url.length > 10);
    const hasVerified = sources.some(s => s.verification_status === 'VERIFIED');
    const hasMultiple = sources.length >= 2;

    if (hasPrimary) score += 8;
    else details.push('No primary source URL');

    if (hasVerified) score += 7;
    else details.push('No verified source');

    if (hasMultiple) score += 5;
    else details.push('Only single source');

    return score;
  }

  private async calculateProvenanceCompleteness(workId: number, details: string[]): Promise<number> {
    const { results: provenance } = await this.db
      .prepare('SELECT COUNT(*) as count FROM data_provenance WHERE work_id = ?')
      .bind(workId)
      .all<{ count: number }>();

    const count = provenance?.[0]?.count || 0;

    if (count >= 3) return 20;
    if (count >= 2) return 15;
    if (count >= 1) return 10;

    details.push('No provenance records');
    return 0;
  }

  private calculateMetadataCompleteness(
    work: { synopsis: string; duration_seconds: number; creator_name: string; release_year: number; country: string; type: string },
    details: string[]
  ): number {
    let score = 0;

    if (work.synopsis && work.synopsis.length > 50) score += 5;
    else details.push('Synopsis missing or too short');

    if (work.duration_seconds && work.duration_seconds >= 30) score += 5;
    else details.push('Duration missing or invalid');

    if (work.creator_name && work.creator_name.length > 1) score += 5;
    else details.push('Creator name missing');

    if (work.release_year && work.release_year >= 2020) score += 3;
    else details.push('Release year missing or suspicious');

    if (work.country && work.country.length > 1) score += 2;
    else details.push('Country missing');

    return score;
  }

  private async calculateRecognitionVerification(workId: number, details: string[]): Promise<number> {
    const { results: signals } = await this.db
      .prepare('SELECT award_level, verification_status, source_url FROM recognition_events WHERE work_id = ?')
      .bind(workId)
      .all<{ award_level: string; verification_status: string; source_url: string }>();

    if (!signals || signals.length === 0) {
      // No recognition is not necessarily bad
      return 10;
    }

    let score = 10;
    const verifiedCount = signals.filter(s => s.verification_status === 'VERIFIED').length;
    const withSourceUrl = signals.filter(s => s.source_url && s.source_url.length > 10).length;

    if (verifiedCount > 0) score += 5;
    else details.push('Recognition signals not verified');

    if (withSourceUrl > 0) score += 3;
    else details.push('Recognition signals lack source URL');

    if (verifiedCount === signals.length) score += 2;

    return Math.min(score, 20);
  }

  private async calculatePopularityVerification(workId: number, details: string[]): Promise<number> {
    const { results: metrics } = await this.db
      .prepare('SELECT views, likes, comments, verification_status FROM work_metrics WHERE work_id = ? ORDER BY collected_at DESC')
      .bind(workId)
      .all<{ views: number; likes: number; comments: number; verification_status: string }>();

    if (!metrics || metrics.length === 0) {
      details.push('No popularity metrics');
      return 0;
    }

    const latest = metrics[0];
    let score = 0;

    if (latest.views > 0) score += 8;
    else details.push('No views data');

    if (latest.likes > 0) score += 4;
    else details.push('No likes data');

    if (latest.comments !== undefined) score += 3;
    else details.push('No comments data');

    if (latest.verification_status === 'VERIFIED') score += 5;
    else details.push('Popularity metrics not verified');

    return score;
  }

  /**
   * 保存 trust score 到数据库
   */
  async saveTrustScore(score: DataTrustScore): Promise<void> {
    await this.db
      .prepare(`
        UPDATE works
        SET data_trust_score = ?,
            data_trust_level = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(score.totalScore, score.level, score.workId)
      .run();
  }

  /**
   * 获取 trust score 分布
   */
  async getTrustDistribution(): Promise<{ high: number; medium: number; low: number; total: number }> {
    const { results } = await this.db
      .prepare(`
        SELECT
          SUM(CASE WHEN data_trust_score >= 90 THEN 1 ELSE 0 END) as high,
          SUM(CASE WHEN data_trust_score >= 70 AND data_trust_score < 90 THEN 1 ELSE 0 END) as medium,
          SUM(CASE WHEN data_trust_score < 70 OR data_trust_score IS NULL THEN 1 ELSE 0 END) as low,
          COUNT(*) as total
        FROM works
        WHERE eligibility_status = ?
      `)
      .bind('approved')
      .all<{ high: number; medium: number; low: number; total: number }>();

    return results?.[0] || { high: 0, medium: 0, low: 0, total: 0 };
  }
}
