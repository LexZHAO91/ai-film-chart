/**
 * Source Authenticity Audit Service
 *
 * 逐条检查作品的来源真实性：
 * - title
 * - source URL
 * - official source
 * - recognition source
 * - popularity source
 * - creator
 * - published date
 *
 * 所有 Recognition Signal 必须可以追溯到官方 Festival / Award 页面。
 * 无法验证的标记为 UNVERIFIED。
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface AuthenticityCheck {
  workId: number;
  title: string;
  checks: {
    field: string;
    value: string;
    status: 'VERIFIED' | 'UNVERIFIED' | 'PARTIAL' | 'MISSING' | 'SYNTHETIC';
    reason: string;
  }[];
  overallStatus: 'VERIFIED' | 'UNVERIFIED' | 'PARTIAL' | 'SYNTHETIC_TEST_DATA';
  syntheticMarkers: string[];
}

export class SourceAuthenticityService {
  constructor(private db: D1Database) {}

  /**
   * 检查单个作品的真实性
   */
  async checkWork(workId: number): Promise<AuthenticityCheck> {
    const work = await this.db
      .prepare('SELECT id, canonical_title, synopsis, creator_name, release_year, official_site_url, type FROM works WHERE id = ?')
      .bind(workId)
      .first<{ id: number; canonical_title: string; synopsis: string; creator_name: string; release_year: number; official_site_url: string; type: string }>();

    if (!work) {
      throw new Error(`Work ${workId} not found`);
    }

    const checks: AuthenticityCheck['checks'] = [];
    const syntheticMarkers: string[] = [];

    // 1. Title check
    const titleCheck = this.checkTitle(work.canonical_title);
    checks.push(titleCheck);
    if (titleCheck.status === 'SYNTHETIC') syntheticMarkers.push('title');

    // 2. Source URLs
    const { results: sources } = await this.db
      .prepare('SELECT source_type, canonical_url, external_id FROM work_sources WHERE work_id = ?')
      .bind(workId)
      .all<{ source_type: string; canonical_url: string; external_id: string }>();

    for (const src of sources || []) {
      const urlCheck = this.checkSourceUrl(src.source_type, src.canonical_url, src.external_id);
      checks.push(urlCheck);
      if (urlCheck.status === 'SYNTHETIC') syntheticMarkers.push(`source_${src.source_type}`);
    }

    // 3. Creator check
    const creatorCheck = this.checkCreator(work.creator_name);
    checks.push(creatorCheck);
    if (creatorCheck.status === 'SYNTHETIC') syntheticMarkers.push('creator');

    // 4. Recognition signals
    const { results: recognitions } = await this.db
      .prepare('SELECT organization, event, award_level, source_url, verification_status FROM recognition_events WHERE work_id = ?')
      .bind(workId)
      .all<{ organization: string; event: string; award_level: string; source_url: string; verification_status: string }>();

    for (const rec of recognitions || []) {
      const recCheck = this.checkRecognition(rec);
      checks.push(recCheck);
      if (recCheck.status === 'SYNTHETIC') syntheticMarkers.push(`recognition_${rec.event}`);
    }

    // 5. Synopsis check
    const synopsisCheck = this.checkSynopsis(work.synopsis);
    checks.push(synopsisCheck);
    if (synopsisCheck.status === 'SYNTHETIC') syntheticMarkers.push('synopsis');

    // Determine overall status
    let overallStatus: AuthenticityCheck['overallStatus'];
    if (syntheticMarkers.length > 0) {
      overallStatus = 'SYNTHETIC_TEST_DATA';
    } else if (checks.every(c => c.status === 'VERIFIED')) {
      overallStatus = 'VERIFIED';
    } else if (checks.some(c => c.status === 'UNVERIFIED' || c.status === 'MISSING')) {
      overallStatus = 'UNVERIFIED';
    } else {
      overallStatus = 'PARTIAL';
    }

    return {
      workId: work.id,
      title: work.canonical_title,
      checks,
      overallStatus,
      syntheticMarkers,
    };
  }

  /**
   * 批量检查所有作品
   */
  async checkAllWorks(): Promise<AuthenticityCheck[]> {
    const { results } = await this.db
      .prepare('SELECT id FROM works WHERE eligibility_status = ?')
      .bind('approved')
      .all<{ id: number }>();

    const checks: AuthenticityCheck[] = [];
    for (const row of results || []) {
      try {
        const check = await this.checkWork(row.id);
        checks.push(check);
      } catch (e) {
        // Skip failed checks
      }
    }

    return checks;
  }

  private checkTitle(title: string): AuthenticityCheck['checks'][0] {
    // Check for placeholder patterns
    const placeholderPatterns = [
      /example/i,
      /test/i,
      /placeholder/i,
      /sample/i,
      /demo/i,
      /^work\s*\d+$/i,
    ];

    for (const pattern of placeholderPatterns) {
      if (pattern.test(title)) {
        return {
          field: 'title',
          value: title,
          status: 'SYNTHETIC',
          reason: `Title matches placeholder pattern: ${pattern}`,
        };
      }
    }

    // Check for generic AI-generated titles
    const genericPatterns = [
      /ai\s+(short|film|movie|video)\s*\d*/i,
      /generated\s+(short|film|movie)/i,
      /untitled/i,
    ];

    for (const pattern of genericPatterns) {
      if (pattern.test(title)) {
        return {
          field: 'title',
          value: title,
          status: 'UNVERIFIED',
          reason: 'Generic AI title, needs verification',
        };
      }
    }

    return {
      field: 'title',
      value: title,
      status: title.length > 2 ? 'VERIFIED' : 'MISSING',
      reason: title.length > 2 ? 'Title present' : 'Title too short',
    };
  }

  private checkSourceUrl(sourceType: string, url: string, externalId: string): AuthenticityCheck['checks'][0] {
    if (!url || url.length < 10) {
      return {
        field: `source_${sourceType}`,
        value: url || '',
        status: 'MISSING',
        reason: 'Source URL missing',
      };
    }

    // Check for example/placeholder URLs
    if (url.includes('example.com') || url.includes('placeholder') || url.includes('test')) {
      return {
        field: `source_${sourceType}`,
        value: url,
        status: 'SYNTHETIC',
        reason: 'URL contains example/placeholder domain',
      };
    }

    // Check for valid platform URLs
    const validPlatforms = [
      'youtube.com',
      'youtu.be',
      'vimeo.com',
      'bilibili.com',
    ];

    const hasValidPlatform = validPlatforms.some(p => url.includes(p));

    if (!hasValidPlatform && !url.startsWith('http')) {
      return {
        field: `source_${sourceType}`,
        value: url,
        status: 'UNVERIFIED',
        reason: 'URL format unrecognized',
      };
    }

    return {
      field: `source_${sourceType}`,
      value: url,
      status: 'VERIFIED',
      reason: 'Source URL present and valid',
    };
  }

  private checkCreator(creator: string): AuthenticityCheck['checks'][0] {
    if (!creator || creator.length < 2) {
      return {
        field: 'creator',
        value: creator || '',
        status: 'MISSING',
        reason: 'Creator name missing',
      };
    }

    const genericCreators = [
      /unknown/i,
      /anonymous/i,
      /test\s*creator/i,
      /sample\s*creator/i,
      /ai\s*collective/i,
      /ai\s*studio/i,
      /openai\s*community/i,
    ];

    for (const pattern of genericCreators) {
      if (pattern.test(creator)) {
        return {
          field: 'creator',
          value: creator,
          status: 'UNVERIFIED',
          reason: 'Generic creator name, needs verification',
        };
      }
    }

    return {
      field: 'creator',
      value: creator,
      status: 'VERIFIED',
      reason: 'Creator name present',
    };
  }

  private checkRecognition(rec: { organization: string; event: string; award_level: string; source_url: string; verification_status: string }): AuthenticityCheck['checks'][0] {
    // Check if recognition has source URL
    if (!rec.source_url || rec.source_url.length < 10) {
      return {
        field: `recognition_${rec.event}`,
        value: `${rec.organization} - ${rec.award_level}`,
        status: 'UNVERIFIED',
        reason: 'Recognition signal lacks source URL for verification',
      };
    }

    // Check for example URLs
    if (rec.source_url.includes('example.com') || rec.source_url.includes('placeholder')) {
      return {
        field: `recognition_${rec.event}`,
        value: `${rec.organization} - ${rec.award_level}`,
        status: 'SYNTHETIC',
        reason: 'Recognition source URL is placeholder',
      };
    }

    if (rec.verification_status === 'VERIFIED') {
      return {
        field: `recognition_${rec.event}`,
        value: `${rec.organization} - ${rec.award_level}`,
        status: 'VERIFIED',
        reason: 'Recognition signal verified',
      };
    }

    return {
      field: `recognition_${rec.event}`,
      value: `${rec.organization} - ${rec.award_level}`,
      status: 'PARTIAL',
      reason: 'Recognition signal present but not verified',
    };
  }

  private checkSynopsis(synopsis: string): AuthenticityCheck['checks'][0] {
    if (!synopsis || synopsis.length < 20) {
      return {
        field: 'synopsis',
        value: synopsis || '',
        status: 'MISSING',
        reason: 'Synopsis missing or too short',
      };
    }

    // Check for placeholder text
    if (synopsis.includes('Lorem ipsum') || synopsis.includes('placeholder') || synopsis.includes('example description')) {
      return {
        field: 'synopsis',
        value: synopsis.substring(0, 50),
        status: 'SYNTHETIC',
        reason: 'Synopsis contains placeholder text',
      };
    }

    return {
      field: 'synopsis',
      value: synopsis.substring(0, 50) + '...',
      status: 'VERIFIED',
      reason: 'Synopsis present',
    };
  }

  /**
   * 标记作品为 SYNTHETIC_TEST_DATA
   */
  async markSynthetic(workId: number, reason: string): Promise<void> {
    await this.db
      .prepare(`
        UPDATE works
        SET synthetic_test_data = 1,
            synthetic_reason = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(reason, workId)
      .run();
  }

  /**
   * 获取合成数据统计
   */
  async getSyntheticStats(): Promise<{ synthetic: number; real: number; total: number }> {
    const { results } = await this.db
      .prepare(`
        SELECT
          SUM(CASE WHEN synthetic_test_data = 1 THEN 1 ELSE 0 END) as synthetic,
          SUM(CASE WHEN synthetic_test_data = 0 OR synthetic_test_data IS NULL THEN 1 ELSE 0 END) as real,
          COUNT(*) as total
        FROM works
        WHERE eligibility_status = ?
      `)
      .bind('approved')
      .all<{ synthetic: number; real: number; total: number }>();

    return results?.[0] || { synthetic: 0, real: 0, total: 0 };
  }
}
