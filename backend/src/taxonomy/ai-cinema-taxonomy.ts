/**
 * AI Cinema Taxonomy
 *
 * 核心原则：
 * - AI Film Chart 不是 "AI 视频排行榜"
 * - 产品定位：The independent ranking of AI cinema
 * - We don't rank everything. We rank what matters.
 *
 * 内容类型定义：
 * - SHORT_FILM: AI 短电影/短片（当前最重要主分类）
 * - FEATURE_FILM: AI 长片/电影
 * - SERIES: AI 剧集/Web Series（以 Series 为排名实体）
 * - DOCUMENTARY: AI 纪录片
 * - EXPERIMENTAL: AI 实验电影（默认不进入主榜）
 *
 * 格式属性（format）：
 * - ANIMATION: 动画（作为 format，不独立为类型）
 * - LIVE_ACTION: 真人实拍
 * - MIXED: 混合
 */

export enum ContentType {
  SHORT_FILM = 'SHORT_FILM',
  FEATURE_FILM = 'FEATURE_FILM',
  SERIES = 'SERIES',
  DOCUMENTARY = 'DOCUMENTARY',
  EXPERIMENTAL = 'EXPERIMENTAL',
}

export enum ContentFormat {
  ANIMATION = 'ANIMATION',
  LIVE_ACTION = 'LIVE_ACTION',
  MIXED = 'MIXED',
  UNKNOWN = 'UNKNOWN',
}

export enum ContentStatus {
  PENDING = 'pending',
  ELIGIBLE = 'eligible',
  INELIGIBLE = 'ineligible',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXCLUDED = 'excluded',
}

/**
 * 明确排除的内容类型
 * 这些不是 AI Cinema，不应进入系统
 */
export const EXCLUDED_CONTENT_TYPES = [
  'AI_MEME',
  'AI_MEME_VIDEO',
  'AI_AVATAR_VIDEO',
  'AI_INFLUENCER_VIDEO',
  'AI_COMMERCIAL',
  'AI_ADVERTISEMENT',
  'PRODUCT_DEMO',
  'AI_TOOL_DEMO',
  'PROMPT_DEMO',
  'TUTORIAL',
  'HOW_TO',
  'NEWS',
  'COMMENTARY',
  'REVIEW',
  'BEHIND_THE_SCENES',
  'MAKING_OF',
  'PURE_MUSIC_VIDEO',
  'MUSIC_VISUALIZATION',
  'VISUAL_EXPERIMENT',
  'AI_SHORTS_NO_NARRATIVE',
  'AI_EFFECT_TEST',
  'MINIMAL_AI_EFFECT',
] as const;

export type ExcludedContentType = (typeof EXCLUDED_CONTENT_TYPES)[number];

/**
 * 主榜默认包含的内容类型
 */
export const MAIN_CHART_CONTENT_TYPES: ContentType[] = [
  ContentType.SHORT_FILM,
  ContentType.FEATURE_FILM,
  ContentType.SERIES,
];

/**
 * 默认排除主榜的内容类型
 */
export const EXCLUDED_FROM_MAIN_CHART: ContentType[] = [
  ContentType.EXPERIMENTAL,
];

/**
 * 内容类型元数据
 */
export interface ContentTypeMetadata {
  type: ContentType;
  label: string;
  description: string;
  eligibleForMainChart: boolean;
  requiresNarrative: boolean;
  minDurationSeconds: number;
  maxDurationSeconds: number;
}

export const CONTENT_TYPE_METADATA: Record<ContentType, ContentTypeMetadata> = {
  [ContentType.SHORT_FILM]: {
    type: ContentType.SHORT_FILM,
    label: 'Short Film',
    description: 'AI-generated narrative short film with director intent',
    eligibleForMainChart: true,
    requiresNarrative: true,
    minDurationSeconds: 60,
    maxDurationSeconds: 1800, // 30 minutes
  },
  [ContentType.FEATURE_FILM]: {
    type: ContentType.FEATURE_FILM,
    label: 'Feature Film',
    description: 'AI-generated feature-length film',
    eligibleForMainChart: true,
    requiresNarrative: true,
    minDurationSeconds: 1800, // 30 minutes
    maxDurationSeconds: 14400, // 4 hours
  },
  [ContentType.SERIES]: {
    type: ContentType.SERIES,
    label: 'Series',
    description: 'AI-generated web series or drama series',
    eligibleForMainChart: true,
    requiresNarrative: true,
    minDurationSeconds: 60,
    maxDurationSeconds: 14400,
  },
  [ContentType.DOCUMENTARY]: {
    type: ContentType.DOCUMENTARY,
    label: 'Documentary',
    description: 'AI-generated documentary film',
    eligibleForMainChart: false, // 暂时不进入主榜
    requiresNarrative: false,
    minDurationSeconds: 300,
    maxDurationSeconds: 14400,
  },
  [ContentType.EXPERIMENTAL]: {
    type: ContentType.EXPERIMENTAL,
    label: 'Experimental',
    description: 'AI experimental cinema',
    eligibleForMainChart: false,
    requiresNarrative: false,
    minDurationSeconds: 30,
    maxDurationSeconds: 14400,
  },
};

/**
 * 判断内容类型是否可进入主榜
 */
export function isEligibleForMainChart(contentType: ContentType): boolean {
  return MAIN_CHART_CONTENT_TYPES.includes(contentType);
}

/**
 * 获取内容类型的元数据
 */
export function getContentTypeMetadata(type: ContentType): ContentTypeMetadata {
  return CONTENT_TYPE_METADATA[type];
}

/**
 * 所有内容类型列表
 */
export function getAllContentTypes(): ContentTypeMetadata[] {
  return Object.values(CONTENT_TYPE_METADATA);
}

/**
 * 可进入主榜的内容类型
 */
export function getMainChartContentTypes(): ContentTypeMetadata[] {
  return getAllContentTypes().filter(t => t.eligibleForMainChart);
}
