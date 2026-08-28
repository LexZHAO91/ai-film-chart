/**
 * DataSourceAdapter v2
 *
 * 核心升级：
 * - 每个来源必须明确自己的角色（DISCOVERY / POPULARITY / RECOGNITION / AUDIENCE / METADATA）
 * - YouTube = Discovery + Popularity，不再是 AI Cinema 的定义标准
 * - Festival = Discovery + Recognition + Metadata
 * - Manual = Discovery + Metadata
 *
 * 不是所有 adapter 都必须实现所有方法。
 */

import { ContentType, ContentFormat } from '../taxonomy';

// ==================== Source Role Enums ====================

export enum SourceRole {
  DISCOVERY = 'DISCOVERY',
  POPULARITY = 'POPULARITY',
  RECOGNITION = 'RECOGNITION',
  AUDIENCE = 'AUDIENCE',
  METADATA = 'METADATA',
}

export enum SourceAdapterType {
  YOUTUBE = 'YOUTUBE',
  VIMEO = 'VIMEO',
  FESTIVAL = 'FESTIVAL',
  OFFICIAL_SITE = 'OFFICIAL_SITE',
  MANUAL = 'MANUAL',
  OTHER = 'OTHER',
}

// ==================== Discovery Interfaces ====================

export interface DiscoveryInput {
  query?: string;
  contentTypes?: ContentType[];
  maxResults?: number;
  cursor?: string;
  filters?: Record<string, unknown>;
}

export interface DiscoveredCandidate {
  externalId: string;
  sourceUrl: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  channelName?: string;
  publishedAt?: string;
  durationSeconds?: number;
  tags?: string[];
  rawMetadata?: Record<string, unknown>;
}

export interface DiscoveryResult {
  candidates: DiscoveredCandidate[];
  nextCursor?: string;
  totalFound?: number;
}

// ==================== Metadata Interfaces ====================

export interface WorkMetadata {
  title: string;
  synopsis?: string;
  director?: string;
  creator?: string;
  durationSeconds?: number;
  releaseYear?: number;
  country?: string;
  language?: string;
  genre?: string[];
  format?: ContentFormat;
  contentType?: ContentType;
  posterUrl?: string;
  trailerUrl?: string;
  officialSiteUrl?: string;
}

// ==================== Popularity Interfaces ====================

export interface PopularityMetrics {
  views: number;
  likes: number;
  comments: number;
  shares?: number;
  collectedAt: string;
}

// ==================== Recognition Interfaces ====================

export interface RecognitionSignal {
  organization: string;
  event: string;
  category?: string;
  awardLevel: 'WINNER' | 'NOMINEE' | 'OFFICIAL_SELECTION' | 'AUDIENCE_AWARD' | 'JURY_AWARD' | 'HONORABLE_MENTION';
  year?: number;
  sourceUrl?: string;
}

// ==================== Core Adapter Interface ====================

export interface DataSourceAdapterV2 {
  /** 适配器类型 */
  readonly adapterType: SourceAdapterType;

  /** 该来源支持的角色 */
  readonly supportedRoles: SourceRole[];

  /** 来源唯一标识 */
  readonly sourceId: string;

  /** 来源显示名称 */
  readonly sourceName: string;

  /** 是否可用 */
  isAvailable(): Promise<boolean>;

  /** 发现候选作品（DISCOVERY 角色） */
  discoverCandidates?(input: DiscoveryInput): Promise<DiscoveryResult>;

  /** 获取作品元数据（METADATA 角色） */
  getWorkMetadata?(externalId: string): Promise<WorkMetadata | null>;

  /** 获取流行度指标（POPULARITY 角色） */
  getPopularityMetrics?(externalId: string): Promise<PopularityMetrics | null>;

  /** 获取认可信号（RECOGNITION 角色） */
  getRecognitionSignals?(externalId: string): Promise<RecognitionSignal[]>;
}

// ==================== Adapter Base Class ====================

export abstract class BaseDataSourceAdapter implements DataSourceAdapterV2 {
  abstract readonly adapterType: SourceAdapterType;
  abstract readonly supportedRoles: SourceRole[];
  abstract readonly sourceId: string;
  abstract readonly sourceName: string;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async discoverCandidates?(input: DiscoveryInput): Promise<DiscoveryResult> {
    throw new Error(`discoverCandidates not implemented for ${this.sourceId}`);
  }

  async getWorkMetadata?(externalId: string): Promise<WorkMetadata | null> {
    throw new Error(`getWorkMetadata not implemented for ${this.sourceId}`);
  }

  async getPopularityMetrics?(externalId: string): Promise<PopularityMetrics | null> {
    throw new Error(`getPopularityMetrics not implemented for ${this.sourceId}`);
  }

  async getRecognitionSignals?(externalId: string): Promise<RecognitionSignal[]> {
    throw new Error(`getRecognitionSignals not implemented for ${this.sourceId}`);
  }

  /**
   * 检查该 adapter 是否支持指定角色
   */
  supportsRole(role: SourceRole): boolean {
    return this.supportedRoles.includes(role);
  }
}

// ==================== Adapter Registry ====================

export class DataSourceAdapterRegistry {
  private adapters: Map<string, DataSourceAdapterV2> = new Map();

  register(adapter: DataSourceAdapterV2): void {
    this.adapters.set(adapter.sourceId, adapter);
  }

  get(sourceId: string): DataSourceAdapterV2 | undefined {
    return this.adapters.get(sourceId);
  }

  getAll(): DataSourceAdapterV2[] {
    return Array.from(this.adapters.values());
  }

  getByRole(role: SourceRole): DataSourceAdapterV2[] {
    return this.getAll().filter(a => {
      // Check if adapter has supportsRole method (BaseDataSourceAdapter does)
      if ('supportsRole' in a && typeof (a as unknown as { supportsRole: (r: SourceRole) => boolean }).supportsRole === 'function') {
        return (a as unknown as { supportsRole: (r: SourceRole) => boolean }).supportsRole(role);
      }
      // Fallback: check supportedRoles array directly
      return a.supportedRoles.includes(role);
    });
  }

  getByType(type: SourceAdapterType): DataSourceAdapterV2[] {
    return this.getAll().filter(a => a.adapterType === type);
  }
}

// ==================== Factory ====================

export function createAdapterRegistry(): DataSourceAdapterRegistry {
  return new DataSourceAdapterRegistry();
}
