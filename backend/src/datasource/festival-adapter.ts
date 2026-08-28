/**
 * Festival Adapter
 *
 * 角色：DISCOVERY + METADATA + RECOGNITION
 *
 * 第一版实现：
 * - 手工配置 source
 * - 半自动导入
 * - 标准化数据
 *
 * 重点：建立 RECOGNITION SOURCE 抽象
 */

import {
  BaseDataSourceAdapter,
  SourceRole,
  SourceAdapterType,
  type DiscoveryInput,
  type DiscoveryResult,
  type WorkMetadata,
  type RecognitionSignal,
} from './datasource-adapter-v2';

export interface FestivalConfig {
  festivalName: string;
  organization: string;
  year: number;
  officialUrl: string;
  winners?: FestivalEntry[];
  nominees?: FestivalEntry[];
  officialSelections?: FestivalEntry[];
}

export interface FestivalEntry {
  title: string;
  director?: string;
  category?: string;
  awardLevel: 'WINNER' | 'NOMINEE' | 'OFFICIAL_SELECTION' | 'AUDIENCE_AWARD' | 'JURY_AWARD' | 'HONORABLE_MENTION';
  sourceUrl?: string;
  durationMinutes?: number;
  country?: string;
  year?: number;
  synopsis?: string;
  youtubeUrl?: string;
  vimeoUrl?: string;
  officialSiteUrl?: string;
}

export class FestivalAdapter extends BaseDataSourceAdapter {
  readonly adapterType = SourceAdapterType.FESTIVAL;
  readonly supportedRoles = [SourceRole.DISCOVERY, SourceRole.METADATA, SourceRole.RECOGNITION];
  readonly sourceId: string;
  readonly sourceName: string;

  private config: FestivalConfig;

  constructor(config: FestivalConfig) {
    super();
    this.config = config;
    this.sourceId = `festival_${config.organization}_${config.year}`;
    this.sourceName = `${config.festivalName} ${config.year}`;
  }

  async isAvailable(): Promise<boolean> {
    return true; // Festival data is statically configured
  }

  /**
   * 从 festival entries 中发现候选作品
   */
  async discoverCandidates(input: DiscoveryInput): Promise<DiscoveryResult> {
    const allEntries = [
      ...(this.config.winners || []).map(e => ({ ...e, awardLevel: e.awardLevel })),
      ...(this.config.nominees || []).map(e => ({ ...e, awardLevel: e.awardLevel })),
      ...(this.config.officialSelections || []).map(e => ({ ...e, awardLevel: e.awardLevel })),
    ];

    const candidates = allEntries.map(entry => ({
      externalId: `${this.config.organization}_${this.config.year}_${entry.title}`,
      sourceUrl: entry.sourceUrl || entry.youtubeUrl || entry.vimeoUrl || entry.officialSiteUrl || this.config.officialUrl,
      title: entry.title,
      description: entry.synopsis,
      channelName: entry.director,
      durationSeconds: entry.durationMinutes ? entry.durationMinutes * 60 : undefined,
      rawMetadata: {
        festival: this.config.festivalName,
        year: this.config.year,
        category: entry.category,
        awardLevel: entry.awardLevel,
        country: entry.country,
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
    const entry = this.findEntryByExternalId(externalId);
    if (!entry) return null;

    return {
      title: entry.title,
      synopsis: entry.synopsis,
      director: entry.director,
      creator: entry.director,
      durationSeconds: entry.durationMinutes ? entry.durationMinutes * 60 : undefined,
      releaseYear: entry.year || this.config.year,
      country: entry.country,
      officialSiteUrl: entry.officialSiteUrl,
    };
  }

  /**
   * 获取认可信号
   */
  async getRecognitionSignals(externalId: string): Promise<RecognitionSignal[]> {
    const entry = this.findEntryByExternalId(externalId);
    if (!entry) return [];

    return [{
      organization: this.config.organization,
      event: this.config.festivalName,
      category: entry.category,
      awardLevel: entry.awardLevel,
      year: this.config.year,
      sourceUrl: entry.sourceUrl || this.config.officialUrl,
    }];
  }

  /**
   * 获取所有 entries（供批量导入使用）
   */
  getAllEntries(): FestivalEntry[] {
    return [
      ...(this.config.winners || []),
      ...(this.config.nominees || []),
      ...(this.config.officialSelections || []),
    ];
  }

  private findEntryByExternalId(externalId: string): FestivalEntry | undefined {
    const prefix = `${this.config.organization}_${this.config.year}_`;
    if (!externalId.startsWith(prefix)) return undefined;

    const title = externalId.slice(prefix.length);
    return this.getAllEntries().find(e => e.title === title);
  }
}
