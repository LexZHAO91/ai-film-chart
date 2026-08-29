/**
 * Import Audit Service
 *
 * 诊断 Seed Import 结果：
 * - 统计 submitted / imported / duplicated / invalid / eligibility_rejected / missing_metadata / other_rejected
 * - 输出每条未导入作品的详细原因
 * - 分析 eligibility_confidence 分布
 */

import type { D1Database } from '@cloudflare/workers-types';
import { ContentEligibilityService } from '../eligibility';
import { WorkService } from '../works';
import type { ManualSeedEntry } from '../datasource';

export interface ImportAuditResult {
  totalSubmitted: number;
  imported: number;
  duplicated: number;
  invalid: number;
  eligibilityRejected: number;
  missingMetadata: number;
  otherRejected: number;
  details: ImportAuditDetail[];
  eligibilityConfidenceDistribution: Record<string, number>;
  rejectReasonDistribution: Record<string, number>;
}

export interface ImportAuditDetail {
  title: string;
  status: 'imported' | 'duplicate' | 'ineligible' | 'invalid' | 'other';
  reason: string;
  eligibilityConfidence?: number;
  rejectReason?: string;
  rejectCategory?: string;
  metadata?: {
    hasTitle: boolean;
    hasSynopsis: boolean;
    hasDuration: boolean;
    hasSource: boolean;
    hasRecognition: boolean;
  };
}

export class ImportAuditService {
  private eligibilityService: ContentEligibilityService;
  private workService: WorkService;

  constructor(private db: D1Database) {
    this.eligibilityService = new ContentEligibilityService();
    this.workService = new WorkService(db);
  }

  /**
   * 对一批种子条目进行完整 Import Audit（不实际导入）
   */
  async auditEntries(entries: ManualSeedEntry[]): Promise<ImportAuditResult> {
    const details: ImportAuditDetail[] = [];
    let imported = 0;
    let duplicated = 0;
    let invalid = 0;
    let eligibilityRejected = 0;
    let missingMetadata = 0;
    let otherRejected = 0;

    const eligibilityConfidenceDistribution: Record<string, number> = {};
    const rejectReasonDistribution: Record<string, number> = {};

    for (const entry of entries) {
      const audit = await this.auditSingleEntry(entry);
      details.push(audit);

      // 统计分类
      switch (audit.status) {
        case 'imported':
          imported++;
          break;
        case 'duplicate':
          duplicated++;
          break;
        case 'ineligible':
          eligibilityRejected++;
          break;
        case 'invalid':
          invalid++;
          break;
        case 'other':
          otherRejected++;
          break;
      }

      // 统计 eligibility confidence 分布
      if (audit.eligibilityConfidence !== undefined) {
        const bucket = this.getConfidenceBucket(audit.eligibilityConfidence);
        eligibilityConfidenceDistribution[bucket] = (eligibilityConfidenceDistribution[bucket] || 0) + 1;
      }

      // 统计 reject reason 分布
      if (audit.rejectReason) {
        rejectReasonDistribution[audit.rejectReason] = (rejectReasonDistribution[audit.rejectReason] || 0) + 1;
      }

      // 检查是否缺少关键元数据
      if (audit.metadata && (!audit.metadata.hasTitle || !audit.metadata.hasSynopsis || !audit.metadata.hasDuration)) {
        missingMetadata++;
      }
    }

    return {
      totalSubmitted: entries.length,
      imported,
      duplicated,
      invalid,
      eligibilityRejected,
      missingMetadata,
      otherRejected,
      details,
      eligibilityConfidenceDistribution,
      rejectReasonDistribution,
    };
  }

  /**
   * 审计单条条目
   */
  private async auditSingleEntry(entry: ManualSeedEntry): Promise<ImportAuditDetail> {
    // 1. 基础有效性检查
    if (!entry.title || entry.title.length < 2) {
      return {
        title: entry.title || '(untitled)',
        status: 'invalid',
        reason: 'Missing or invalid title',
        metadata: this.extractMetadata(entry),
      };
    }

    // 2. 去重检查
    const duplicates = await this.workService.findPotentialDuplicates(
      entry.title,
      entry.creator || entry.director
    );

    if (duplicates.length > 0) {
      return {
        title: entry.title,
        status: 'duplicate',
        reason: `Already exists as work #${duplicates[0].id}`,
        metadata: this.extractMetadata(entry),
      };
    }

    // 3. Eligibility 检查
    const eligibility = await this.eligibilityService.evaluate({
      title: entry.title,
      description: entry.synopsis || '',
      durationSeconds: entry.durationSeconds,
      tags: entry.genre || [],
    });

    if (eligibility.eligibilityConfidence < 0.50) {
      return {
        title: entry.title,
        status: 'ineligible',
        reason: eligibility.reason || eligibility.rejectReason || 'Failed eligibility check',
        eligibilityConfidence: eligibility.eligibilityConfidence,
        rejectReason: eligibility.rejectReason,
        rejectCategory: eligibility.rejectCategory,
        metadata: this.extractMetadata(entry),
      };
    }

    // 4. 通过所有检查
    return {
      title: entry.title,
      status: 'imported',
      reason: `Eligible (confidence: ${(eligibility.eligibilityConfidence * 100).toFixed(1)}%)`,
      eligibilityConfidence: eligibility.eligibilityConfidence,
      metadata: this.extractMetadata(entry),
    };
  }

  private extractMetadata(entry: ManualSeedEntry): ImportAuditDetail['metadata'] {
    return {
      hasTitle: !!entry.title && entry.title.length >= 2,
      hasSynopsis: !!entry.synopsis && entry.synopsis.length > 20,
      hasDuration: !!entry.durationSeconds && entry.durationSeconds >= 30,
      hasSource: !!(entry.youtubeUrl || entry.vimeoUrl || entry.officialSiteUrl || (entry.sources && entry.sources.length > 0)),
      hasRecognition: !!(entry.recognition && entry.recognition.length > 0),
    };
  }

  private getConfidenceBucket(confidence: number): string {
    if (confidence >= 0.90) return '0.90-1.00 (Auto Pass)';
    if (confidence >= 0.70) return '0.70-0.89 (Human Review)';
    if (confidence >= 0.50) return '0.50-0.69 (Marginal)';
    if (confidence >= 0.30) return '0.30-0.49 (Weak)';
    return '0.00-0.29 (Auto Reject)';
  }

  /**
   * 生成 Markdown 格式的 Audit Report
   */
  generateMarkdownReport(audit: ImportAuditResult): string {
    const lines = [
      '# Seed Pool Import Audit Report',
      '',
      '## Summary',
      `- Total Submitted: ${audit.totalSubmitted}`,
      `- Imported: ${audit.imported}`,
      `- Duplicated: ${audit.duplicated}`,
      `- Invalid: ${audit.invalid}`,
      `- Eligibility Rejected: ${audit.eligibilityRejected}`,
      `- Missing Metadata: ${audit.missingMetadata}`,
      `- Other Rejected: ${audit.otherRejected}`,
      `- Import Rate: ${((audit.imported / audit.totalSubmitted) * 100).toFixed(1)}%`,
      '',
      '## Eligibility Confidence Distribution',
      ...Object.entries(audit.eligibilityConfidenceDistribution).map(([bucket, count]) => `- ${bucket}: ${count}`),
      '',
      '## Reject Reason Distribution',
      ...Object.entries(audit.rejectReasonDistribution).map(([reason, count]) => `- ${reason}: ${count}`),
      '',
      '## Rejected Works Details',
      ...audit.details
        .filter(d => d.status !== 'imported')
        .map(d => `- **${d.title}** (${d.status}): ${d.reason}${d.eligibilityConfidence !== undefined ? ` [confidence: ${(d.eligibilityConfidence * 100).toFixed(1)}%]` : ''}`),
      '',
      '## Imported Works',
      ...audit.details
        .filter(d => d.status === 'imported')
        .map(d => `- **${d.title}**: ${d.reason}`),
    ];

    return lines.join('\n');
  }
}
