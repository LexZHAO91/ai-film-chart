/**
 * Manual Seed Adapter
 *
 * 角色：DISCOVERY + METADATA
 *
 * 允许管理员通过配置导入第一批高质量作品。
 * 这是 MVP 非常重要的功能：
 * > 验证 Ranking，而不是证明爬虫能爬遍全网。
 */

import {
  BaseDataSourceAdapter,
  SourceRole,
  SourceAdapterType,
  type DiscoveryInput,
  type DiscoveryResult,
  type WorkMetadata,
} from './datasource-adapter-v2';
import { ContentType, ContentFormat } from '../taxonomy';

export interface ManualSeedEntry {
  title: string;
  type: ContentType;
  format?: ContentFormat;
  synopsis?: string;
  director?: string;
  creator?: string;
  durationSeconds?: number;
  releaseYear?: number;
  country?: string;
  language?: string;
  genre?: string[];
  posterUrl?: string;
  trailerUrl?: string;
  officialSiteUrl?: string;
  youtubeUrl?: string;
  vimeoUrl?: string;
  sources?: {
    type: string;
    url: string;
    externalId?: string;
  }[];
  recognition?: {
    organization: string;
    event: string;
    awardLevel: string;
    year?: number;
  }[];
}

export class ManualSeedAdapter extends BaseDataSourceAdapter {
  readonly adapterType = SourceAdapterType.MANUAL;
  readonly supportedRoles = [SourceRole.DISCOVERY, SourceRole.METADATA];
  readonly sourceId = 'manual_seed';
  readonly sourceName = 'Manual Seed Import';

  private entries: ManualSeedEntry[] = [];

  constructor(entries?: ManualSeedEntry[]) {
    super();
    if (entries) {
      this.entries = entries;
    }
  }

  /**
   * 加载种子数据
   */
  loadEntries(entries: ManualSeedEntry[]): void {
    this.entries = entries;
  }

  /**
   * 添加单条种子
   */
  addEntry(entry: ManualSeedEntry): void {
    this.entries.push(entry);
  }

  async isAvailable(): Promise<boolean> {
    return this.entries.length > 0;
  }

  /**
   * 发现候选作品（返回所有种子）
   */
  async discoverCandidates(input: DiscoveryInput): Promise<DiscoveryResult> {
    const candidates = this.entries.map((entry, index) => ({
      externalId: `manual_${index}_${entry.title}`,
      sourceUrl: entry.officialSiteUrl || entry.youtubeUrl || entry.vimeoUrl || '',
      title: entry.title,
      description: entry.synopsis,
      thumbnailUrl: entry.posterUrl,
      channelName: entry.creator || entry.director,
      durationSeconds: entry.durationSeconds,
      rawMetadata: {
        type: entry.type,
        format: entry.format,
        genre: entry.genre,
        country: entry.country,
        language: entry.language,
        releaseYear: entry.releaseYear,
        sources: entry.sources,
        recognition: entry.recognition,
      },
    }));

    return {
      candidates,
      totalFound: candidates.length,
    };
  }

  /**
   * 获取作品元数据
   */
  async getWorkMetadata(externalId: string): Promise<WorkMetadata | null> {
    const index = this.parseIndex(externalId);
    if (index === null || index < 0 || index >= this.entries.length) {
      return null;
    }

    const entry = this.entries[index];
    return {
      title: entry.title,
      synopsis: entry.synopsis,
      director: entry.director,
      creator: entry.creator,
      durationSeconds: entry.durationSeconds,
      releaseYear: entry.releaseYear,
      country: entry.country,
      language: entry.language,
      genre: entry.genre,
      format: entry.format,
      contentType: entry.type,
      posterUrl: entry.posterUrl,
      trailerUrl: entry.trailerUrl,
      officialSiteUrl: entry.officialSiteUrl,
    };
  }

  getAllEntries(): ManualSeedEntry[] {
    return this.entries;
  }

  private parseIndex(externalId: string): number | null {
    const match = externalId.match(/^manual_(\d+)_/);
    return match ? parseInt(match[1], 10) : null;
  }
}
