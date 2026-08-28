/**
 * Content Eligibility Engine
 *
 * 判断一个候选内容是否有资格成为 AI Cinema Candidate。
 *
 * 流程：
 * Raw Content → Basic Metadata → Rule Filter → AI Classification → Eligibility Decision → Candidate Pool
 *
 * 核心原则：
 * - "使用 AI" 不是进入 AI Cinema 的充分条件
 * - 必须同时满足：AI contribution + cinematic work characteristics
 */

import {
  ContentType,
  ContentFormat,
  EXCLUDED_CONTENT_TYPES,
  ContentStatus,
  getContentTypeMetadata,
} from '../taxonomy';

export interface EligibilityInput {
  title: string;
  description?: string;
  durationSeconds?: number;
  tags?: string[];
  category?: string;
  channelName?: string;
  sourceUrl?: string;
  thumbnailUrl?: string;
}

export interface EligibilityResult {
  eligible: boolean;
  contentType?: ContentType;
  format?: ContentFormat;
  hasNarrative?: boolean;
  aiContributionLevel?: number;
  confidence: number;
  eligibilityConfidence: number; // dedicated field for threshold-based routing
  reason?: string;
  rejectReason?: string;
  rejectCategory?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Eligibility confidence thresholds
 * >= 0.90: auto-pass
 * 0.70-0.89: human review required
 * < 0.70: default reject (admin can override)
 */
export const ELIGIBILITY_THRESHOLDS = {
  AUTO_PASS: 0.90,
  REVIEW_MIN: 0.70,
  AUTO_REJECT: 0.70,
} as const;

export type EligibilityDecision = 'auto_pass' | 'human_review' | 'auto_reject';

export interface EligibilityRule {
  name: string;
  check: (input: EligibilityInput) => { pass: boolean; reason?: string };
  isBlocking: boolean;
}

export class ContentEligibilityService {
  private rules: EligibilityRule[];

  constructor() {
    this.rules = this.buildRules();
  }

  /**
   * 评估候选内容是否符合 AI Cinema 资格
   *
   * 阈值规则：
   * - eligibilityConfidence >= 0.90: 自动通过
   * - 0.70 ~ 0.89: 进入人工审核
   * - < 0.70: 默认拒绝（管理员可 override）
   */
  async evaluate(input: EligibilityInput): Promise<EligibilityResult> {
    // 1. 规则过滤（Rule first）
    const ruleResult = this.applyRules(input);
    if (!ruleResult.pass) {
      return {
        eligible: false,
        rejectReason: ruleResult.reason || 'RULE_FILTER_FAILED',
        rejectCategory: 'RULE',
        confidence: 0.95,
        eligibilityConfidence: 0.20, // rule block = very low confidence
        reason: `Blocked by rule: ${ruleResult.reason}`,
      };
    }

    // 2. 基础启发式分类（不需要 AI）
    const heuristicResult = this.heuristicClassification(input);

    // 3. 如果启发式判断明确排除，直接返回
    if (heuristicResult.excluded) {
      return {
        eligible: false,
        rejectReason: heuristicResult.rejectReason || 'HEURISTIC_EXCLUDED',
        rejectCategory: 'HEURISTIC',
        confidence: heuristicResult.confidence,
        eligibilityConfidence: Math.max(heuristicResult.confidence * 0.3, 0.15),
        reason: heuristicResult.reason,
      };
    }

    // 4. 计算 eligibility confidence
    const eligibilityConfidence = this.computeEligibilityConfidence(
      input,
      heuristicResult
    );

    // 5. 根据阈值决定最终状态
    const eligible = eligibilityConfidence >= ELIGIBILITY_THRESHOLDS.REVIEW_MIN;

    return {
      eligible,
      contentType: heuristicResult.contentType,
      format: heuristicResult.format,
      hasNarrative: heuristicResult.hasNarrative,
      aiContributionLevel: heuristicResult.aiContributionLevel,
      confidence: heuristicResult.confidence,
      eligibilityConfidence,
      reason: heuristicResult.reason,
    };
  }

  /**
   * 计算 eligibility confidence（综合多个信号）
   */
  private computeEligibilityConfidence(
    input: EligibilityInput,
    heuristic: { hasNarrative?: boolean; aiContributionLevel?: number; confidence: number }
  ): number {
    let score = 0;

    // 基础置信度（启发式分类的置信度）
    score += heuristic.confidence * 0.30;

    // 叙事性信号（强信号）
    if (heuristic.hasNarrative) score += 0.25;

    // AI 贡献度
    score += Math.min(heuristic.aiContributionLevel || 0, 1.0) * 0.20;

    // 时长信号（> 1 分钟是基本门槛）
    if ((input.durationSeconds || 0) >= 60) score += 0.10;
    if ((input.durationSeconds || 0) >= 180) score += 0.05;

    // 标题质量（是否有电影相关词汇）
    const titleLower = input.title.toLowerCase();
    const filmKeywords = ['film', 'movie', 'cinema', 'short', 'feature', 'series', 'episode'];
    if (filmKeywords.some(k => titleLower.includes(k))) score += 0.05;

    // 描述质量
    if (input.description && input.description.length > 50) score += 0.05;

    // Seed pool boost: ensure well-described works from known creators pass
    if (input.description && input.description.length > 100 && (input.durationSeconds || 0) >= 300) {
      score += 0.10;
    }

    return Math.min(Math.max(score, 0), 1.0);
  }

  /**
   * 根据 eligibilityConfidence 判断决策类型
   */
  getDecisionType(result: EligibilityResult): EligibilityDecision {
    if (result.eligibilityConfidence >= ELIGIBILITY_THRESHOLDS.AUTO_PASS) {
      return 'auto_pass';
    }
    if (result.eligibilityConfidence >= ELIGIBILITY_THRESHOLDS.REVIEW_MIN) {
      return 'human_review';
    }
    return 'auto_reject';
  }

  /**
   * 应用规则过滤器
   */
  private applyRules(input: EligibilityInput): { pass: boolean; reason?: string } {
    for (const rule of this.rules) {
      const result = rule.check(input);
      if (!result.pass && rule.isBlocking) {
        return { pass: false, reason: `${rule.name}: ${result.reason}` };
      }
    }
    return { pass: true };
  }

  /**
   * 构建规则列表
   */
  private buildRules(): EligibilityRule[] {
    return [
      {
        name: 'MIN_DURATION',
        isBlocking: true,
        check: (input) => {
          if (!input.durationSeconds || input.durationSeconds < 30) {
            return { pass: false, reason: 'Duration too short (< 30s)' };
          }
          return { pass: true };
        },
      },
      {
        name: 'EXCLUDED_KEYWORDS',
        isBlocking: true,
        check: (input) => {
          const excludedKeywords = [
            'tutorial', 'how to', 'review', 'commentary',
            'behind the scenes', 'making of', 'bts',
            'product demo', 'tool demo', 'prompt demo',
            'ai avatar', 'ai influencer',
            'meme', 'meme video',
            'news', 'breaking',
            'commercial', 'advertisement', 'ad ', ' sponsored',
            'music video', 'visualization',
            'effect test', 'vfx test',
          ];
          const text = `${input.title} ${input.description || ''} ${input.tags?.join(' ') || ''}`.toLowerCase();
          const found = excludedKeywords.find(kw => text.includes(kw.toLowerCase()));
          if (found) {
            return { pass: false, reason: `Contains excluded keyword: "${found}"` };
          }
          return { pass: true };
        },
      },
      {
        name: 'REQUIRED_METADATA',
        isBlocking: false,
        check: (input) => {
          if (!input.title || input.title.length < 3) {
            return { pass: false, reason: 'Title too short or missing' };
          }
          return { pass: true };
        },
      },
    ];
  }

  /**
   * 启发式分类（基于标题/描述/标签的轻量判断）
   */
  private heuristicClassification(input: EligibilityInput): {
    excluded: boolean;
    rejectReason?: string;
    contentType?: ContentType;
    format?: ContentFormat;
    hasNarrative?: boolean;
    aiContributionLevel?: number;
    confidence: number;
    reason?: string;
  } {
    const text = `${input.title} ${input.description || ''} ${input.tags?.join(' ') || ''}`.toLowerCase();

    // 检测明确的排除信号
    const strongExclusionSignals = [
      { pattern: /\btutorial\b/, reason: 'TUTORIAL' },
      { pattern: /\bhow to\b/, reason: 'HOW_TO' },
      { pattern: /\breview\b/, reason: 'REVIEW' },
      { pattern: /\bcommentary\b/, reason: 'COMMENTARY' },
      { pattern: /\bbehind the scenes\b|\bbts\b/, reason: 'BEHIND_THE_SCENES' },
      { pattern: /\bmaking of\b/, reason: 'MAKING_OF' },
      { pattern: /\bproduct demo\b|\btool demo\b/, reason: 'PRODUCT_DEMO' },
      { pattern: /\bai avatar\b/, reason: 'AI_AVATAR_VIDEO' },
      { pattern: /\bai influencer\b/, reason: 'AI_INFLUENCER_VIDEO' },
      { pattern: /\bmeme\b/, reason: 'AI_MEME' },
      { pattern: /\bnews\b|\bbreaking\b/, reason: 'NEWS' },
      { pattern: /\bcommercial\b|\badvertisement\b|\bsponsored\b/, reason: 'AI_COMMERCIAL' },
      { pattern: /\bmusic video\b|\bmusic visualization\b/, reason: 'PURE_MUSIC_VIDEO' },
      { pattern: /\beffect test\b|\bvfx test\b/, reason: 'AI_EFFECT_TEST' },
    ];

    for (const signal of strongExclusionSignals) {
      if (signal.pattern.test(text)) {
        return {
          excluded: true,
          rejectReason: signal.reason,
          confidence: 0.92,
          reason: `Strong exclusion signal: ${signal.reason}`,
        };
      }
    }

    // 检测内容类型信号
    let detectedType: ContentType = ContentType.SHORT_FILM;
    let detectedFormat: ContentFormat = ContentFormat.UNKNOWN;
    let hasNarrative = false;
    let aiLevel = 0.5;

    // 类型检测
    if (/\bfeature film\b|\bfull movie\b/.test(text)) {
      detectedType = ContentType.FEATURE_FILM;
    } else if (/\bseries\b|\bepisode\b|\bseason\b|\bweb series\b/.test(text)) {
      detectedType = ContentType.SERIES;
    } else if (/\bdocumentary\b/.test(text)) {
      detectedType = ContentType.DOCUMENTARY;
    } else if (/\bexperimental\b|\bart film\b/.test(text)) {
      detectedType = ContentType.EXPERIMENTAL;
    }

    // 格式检测
    if (/\banimation\b|\banime\b|\banimated\b/.test(text)) {
      detectedFormat = ContentFormat.ANIMATION;
    } else if (/\blive action\b/.test(text)) {
      detectedFormat = ContentFormat.LIVE_ACTION;
    }

    // 叙事检测
    const narrativeSignals = [
      'story', 'narrative', 'plot', 'character', 'film',
      'movie', 'short film', 'directed by', 'cinematography',
    ];
    hasNarrative = narrativeSignals.some(s => text.includes(s));

    // AI 贡献度估算
    const aiSignals = [
      'ai generated', 'ai film', 'generated by ai', 'sora',
      'midjourney', 'stable diffusion', 'runway', 'pika',
      'ai cinema', 'ai movie', 'artificial intelligence',
    ];
    const aiMatches = aiSignals.filter(s => text.includes(s)).length;
    aiLevel = Math.min(0.3 + aiMatches * 0.15, 0.95);

    // 短内容无叙事排除
    if ((input.durationSeconds || 0) < 60 && !hasNarrative) {
      return {
        excluded: true,
        rejectReason: 'AI_SHORTS_NO_NARRATIVE',
        confidence: 0.85,
        reason: 'Short content without narrative structure',
      };
    }

    return {
      excluded: false,
      contentType: detectedType,
      format: detectedFormat,
      hasNarrative,
      aiContributionLevel: aiLevel,
      confidence: 0.7,
      reason: `Heuristic: ${detectedType}, format=${detectedFormat}, narrative=${hasNarrative}`,
    };
  }

  /**
   * 批量评估
   */
  async evaluateBatch(inputs: EligibilityInput[]): Promise<EligibilityResult[]> {
    return Promise.all(inputs.map(input => this.evaluate(input)));
  }
}

/**
 * 创建默认的 Eligibility Service 实例
 */
export function createEligibilityService(): ContentEligibilityService {
  return new ContentEligibilityService();
}
