/**
 * Seed Import Service
 *
 * 允许管理员通过 CSV / JSON / Admin Form 导入第一批高质量作品。
 *
 * 流程：
 * 1. 解析输入数据（CSV/JSON）
 * 2. 去重检查（基于标题 + 创作者）
 * 3. 运行 Eligibility Engine
 * 4. 创建 Work + WorkSource
 * 5. 记录 Data Provenance
 * 6. 记录 Recognition Signals（如果有）
 */

import type { D1Database } from '@cloudflare/workers-types';
import { ContentType, ContentFormat, ContentStatus } from '../taxonomy';
import { ContentEligibilityService } from '../eligibility';
import { WorkService } from '../works';
import type { ManualSeedEntry } from '../datasource';

export interface SeedImportResult {
  success: boolean;
  workId?: number;
  title: string;
  status: 'imported' | 'duplicate' | 'ineligible' | 'error';
  message: string;
  eligibility?: {
    eligible: boolean;
    contentType?: string;
    confidence: number;
    reason?: string;
    rejectReason?: string;
  };
}

export interface SeedImportBatchResult {
  total: number;
  imported: number;
  duplicates: number;
  ineligible: number;
  errors: number;
  details: SeedImportResult[];
}

export class SeedImportService {
  private workService: WorkService;
  private eligibilityService: ContentEligibilityService;

  constructor(private db: D1Database) {
    this.workService = new WorkService(db);
    this.eligibilityService = new ContentEligibilityService();
  }

  /**
   * 导入单条种子作品
   */
  async importSeed(entry: ManualSeedEntry, operator: string = 'admin'): Promise<SeedImportResult> {
    try {
      // 1. 去重检查
      const duplicates = await this.workService.findPotentialDuplicates(
        entry.title,
        entry.creator || entry.director
      );

      if (duplicates.length > 0) {
        return {
          success: false,
          title: entry.title,
          status: 'duplicate',
          message: `Potential duplicate found: work #${duplicates[0].id}`,
        };
      }

      // 2. 运行 Eligibility Engine
      const eligibilityInput = {
        title: entry.title,
        description: entry.synopsis || '',
        durationSeconds: entry.durationSeconds,
        tags: entry.genre || [],
      };

      const eligibility = await this.eligibilityService.evaluate(eligibilityInput);

      if (!eligibility.eligible) {
        return {
          success: false,
          title: entry.title,
          status: 'ineligible',
          message: eligibility.rejectReason || 'Not eligible for AI Cinema',
          eligibility: {
            eligible: false,
            confidence: eligibility.confidence,
            rejectReason: eligibility.rejectReason,
            reason: eligibility.reason,
          },
        };
      }

      // 3. 创建 Work
      const work = await this.workService.createWork({
        canonicalTitle: entry.title,
        type: entry.type || (eligibility.contentType as ContentType) || ContentType.SHORT_FILM,
        format: entry.format || (eligibility.format as ContentFormat) || ContentFormat.UNKNOWN,
        synopsis: entry.synopsis,
        originalLanguage: entry.language,
        country: entry.country,
        releaseYear: entry.releaseYear,
        durationSeconds: entry.durationSeconds,
        aiContributionLevel: eligibility.aiContributionLevel || 0.5,
        creatorName: entry.creator || entry.director,
        genres: entry.genre,
        posterUrl: entry.posterUrl,
        trailerUrl: entry.trailerUrl,
        officialSiteUrl: entry.officialSiteUrl,
      });

      // 4. 添加 Work Sources
      if (entry.sources && entry.sources.length > 0) {
        for (let i = 0; i < entry.sources.length; i++) {
          const src = entry.sources[i];
          await this.workService.addWorkSource({
            workId: work.id,
            sourceType: src.type,
            externalId: src.externalId,
            canonicalUrl: src.url,
            isPrimarySource: i === 0,
          });
        }
      } else if (entry.youtubeUrl) {
        await this.workService.addWorkSource({
          workId: work.id,
          sourceType: 'YOUTUBE',
          canonicalUrl: entry.youtubeUrl,
          isPrimarySource: true,
        });
      } else if (entry.vimeoUrl) {
        await this.workService.addWorkSource({
          workId: work.id,
          sourceType: 'VIMEO',
          canonicalUrl: entry.vimeoUrl,
          isPrimarySource: true,
        });
      } else if (entry.officialSiteUrl) {
        await this.workService.addWorkSource({
          workId: work.id,
          sourceType: 'OFFICIAL_SITE',
          canonicalUrl: entry.officialSiteUrl,
          isPrimarySource: true,
        });
      }

      // 5. 添加 Recognition Signals
      if (entry.recognition && entry.recognition.length > 0) {
        for (const rec of entry.recognition) {
          await this.db
            .prepare(
              `INSERT INTO recognition_signals (
                work_id, organization, event, award_level, year, source_url, verified
              ) VALUES (?, ?, ?, ?, ?, ?, 1)`
            )
            .bind(
              work.id,
              rec.organization,
              rec.event,
              rec.awardLevel,
              rec.year || null,
              entry.officialSiteUrl || null
            )
            .run();
        }
      }

      // 6. 记录 Data Provenance
      await this.db
        .prepare(
          `INSERT INTO data_provenance (
            work_id, source_type, data_field, data_value, extraction_method, confidence
          ) VALUES (?, 'MANUAL', 'seed_import', ?, 'MANUAL_ENTRY', 1.0)`
        )
        .bind(work.id, `Imported by ${operator}`)
        .run();

      // 7. 更新 eligibility status
      await this.workService.updateEligibilityStatus(work.id, ContentStatus.APPROVED, 'Manual seed import');

      return {
        success: true,
        workId: work.id,
        title: entry.title,
        status: 'imported',
        message: `Successfully imported as work #${work.id}`,
        eligibility: {
          eligible: true,
          contentType: work.type,
          confidence: eligibility.confidence,
          reason: eligibility.reason,
        },
      };
    } catch (error) {
      return {
        success: false,
        title: entry.title,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 批量导入种子作品
   */
  async importBatch(
    entries: ManualSeedEntry[],
    operator: string = 'admin'
  ): Promise<SeedImportBatchResult> {
    const details: SeedImportResult[] = [];
    let imported = 0;
    let duplicates = 0;
    let ineligible = 0;
    let errors = 0;

    for (const entry of entries) {
      const result = await this.importSeed(entry, operator);
      details.push(result);

      switch (result.status) {
        case 'imported':
          imported++;
          break;
        case 'duplicate':
          duplicates++;
          break;
        case 'ineligible':
          ineligible++;
          break;
        case 'error':
          errors++;
          break;
      }
    }

    return {
      total: entries.length,
      imported,
      duplicates,
      ineligible,
      errors,
      details,
    };
  }

  /**
   * 解析 CSV 数据为 ManualSeedEntry
   *
   * 期望 CSV 列：
   * title, type, format, synopsis, director, creator, duration_seconds, release_year, country, language, genre, poster_url, trailer_url, official_site_url, youtube_url, vimeo_url
   */
  parseCSV(csvText: string): ManualSeedEntry[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const entries: ManualSeedEntry[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length < headers.length) continue;

      const get = (name: string): string | undefined => {
        const idx = headers.indexOf(name);
        return idx >= 0 ? values[idx]?.trim() || undefined : undefined;
      };

      const entry: ManualSeedEntry = {
        title: get('title') || '',
        type: (get('type') as ContentType) || ContentType.SHORT_FILM,
        format: (get('format') as ContentFormat) || ContentFormat.UNKNOWN,
        synopsis: get('synopsis'),
        director: get('director'),
        creator: get('creator') || get('director'),
        durationSeconds: get('duration_seconds') ? parseInt(get('duration_seconds')!, 10) : undefined,
        releaseYear: get('release_year') ? parseInt(get('release_year')!, 10) : undefined,
        country: get('country'),
        language: get('language'),
        genre: get('genre') ? get('genre')!.split(';').map(g => g.trim()) : undefined,
        posterUrl: get('poster_url'),
        trailerUrl: get('trailer_url'),
        officialSiteUrl: get('official_site_url'),
        youtubeUrl: get('youtube_url'),
        vimeoUrl: get('vimeo_url'),
      };

      if (entry.title) {
        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * 解析单行 CSV（处理引号）
   */
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    return values;
  }

  /**
   * 解析 JSON 数据
   */
  parseJSON(jsonText: string): ManualSeedEntry[] {
    const data = JSON.parse(jsonText);
    if (Array.isArray(data)) {
      return data as ManualSeedEntry[];
    }
    if (data.entries && Array.isArray(data.entries)) {
      return data.entries as ManualSeedEntry[];
    }
    return [];
  }
}
