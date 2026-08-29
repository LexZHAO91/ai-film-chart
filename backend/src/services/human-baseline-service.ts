/**
 * Human Baseline Service
 *
 * 管理人工基准排名：
 * - Blind Review 评分
 * - Human Baseline Ranking
 * - Reviewer Agreement 计算
 * - Human vs Algorithm Correlation
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface HumanReviewInput {
  workId: number;
  reviewerId: string;
  humanQualityRating: number;
  humanRank?: number;
  reviewMode: 'blind' | 'standard';
  reviewRound?: number;
  reviewNotes?: string;
}

export interface ReviewerAgreement {
  workId: number;
  reviewerA: string;
  reviewerB: string;
  ratingA: number;
  ratingB: number;
  difference: number;
  agreementLevel: 'PERFECT' | 'GOOD' | 'MODERATE' | 'POOR';
}

export class HumanBaselineService {
  constructor(private db: D1Database) {}

  /**
   * 提交人工评分
   */
  async submitReview(input: HumanReviewInput): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO human_baseline_rankings
        (reviewer_id, review_round, work_id, human_rank, human_quality_rating, review_mode, reviewed_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(
        input.reviewerId,
        input.reviewRound || 1,
        input.workId,
        input.humanRank || 0,
        input.humanQualityRating,
        input.reviewMode
      )
      .run();

    // Update work's human quality rating (mean of all reviews)
    await this.updateWorkQualityRating(input.workId);

    // Update review metadata
    await this.db
      .prepare(`
        UPDATE works
        SET review_mode = ?,
            reviewer_id = ?,
            review_round = ?,
            review_notes = ?,
            reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        input.reviewMode,
        input.reviewerId,
        input.reviewRound || 1,
        input.reviewNotes || null,
        input.workId
      )
      .run();
  }

  /**
   * 更新作品的平均质量评分
   */
  private async updateWorkQualityRating(workId: number): Promise<void> {
    const { results } = await this.db
      .prepare('SELECT AVG(human_quality_rating) as avg_rating FROM human_baseline_rankings WHERE work_id = ?')
      .bind(workId)
      .all<{ avg_rating: number }>();

    const avgRating = results?.[0]?.avg_rating;
    if (avgRating !== null && avgRating !== undefined) {
      await this.db
        .prepare('UPDATE works SET human_quality_rating = ? WHERE id = ?')
        .bind(Math.round(avgRating), workId)
        .run();
    }
  }

  /**
   * 计算 Reviewer Agreement
   */
  async calculateAgreement(workId: number): Promise<ReviewerAgreement[]> {
    const { results: reviews } = await this.db
      .prepare('SELECT reviewer_id, human_quality_rating FROM human_baseline_rankings WHERE work_id = ? ORDER BY reviewed_at DESC')
      .bind(workId)
      .all<{ reviewer_id: string; human_quality_rating: number }>();

    if (!reviews || reviews.length < 2) return [];

    const agreements: ReviewerAgreement[] = [];

    for (let i = 0; i < reviews.length; i++) {
      for (let j = i + 1; j < reviews.length; j++) {
        const ratingA = reviews[i].human_quality_rating;
        const ratingB = reviews[j].human_quality_rating;
        const diff = Math.abs(ratingA - ratingB);

        let agreementLevel: ReviewerAgreement['agreementLevel'];
        if (diff === 0) agreementLevel = 'PERFECT';
        else if (diff === 1) agreementLevel = 'GOOD';
        else if (diff === 2) agreementLevel = 'MODERATE';
        else agreementLevel = 'POOR';

        agreements.push({
          workId,
          reviewerA: reviews[i].reviewer_id,
          reviewerB: reviews[j].reviewer_id,
          ratingA,
          ratingB,
          difference: diff,
          agreementLevel,
        });
      }
    }

    // Save agreements
    for (const agreement of agreements) {
      await this.db
        .prepare(`
          INSERT INTO reviewer_agreements
          (work_id, reviewer_a_id, reviewer_b_id, rating_a, rating_b, difference, agreement_level)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          agreement.workId,
          agreement.reviewerA,
          agreement.reviewerB,
          agreement.ratingA,
          agreement.ratingB,
          agreement.difference,
          agreement.agreementLevel
        )
        .run();
    }

    return agreements;
  }

  /**
   * 获取作品的 Human Baseline Ranking
   */
  async getHumanBaselineRanking(reviewerId?: string): Promise<{ workId: number; title: string; humanRank: number; humanQuality: number }[]> {
    let query = `
      SELECT w.id, w.canonical_title as title,
             hbr.human_rank, hbr.human_quality_rating
      FROM works w
      JOIN human_baseline_rankings hbr ON w.id = hbr.work_id
      WHERE w.eligibility_status = 'approved'
    `;

    if (reviewerId) {
      query += ` AND hbr.reviewer_id = '${reviewerId}'`;
    } else {
      query += ` AND hbr.reviewed_at = (SELECT MAX(reviewed_at) FROM human_baseline_rankings WHERE work_id = w.id)`;
    }

    query += ` ORDER BY hbr.human_rank ASC`;

    const { results } = await this.db.prepare(query).all<{
      id: number;
      title: string;
      human_rank: number;
      human_quality_rating: number;
    }>();

    return (results || []).map(r => ({
      workId: r.id,
      title: r.title,
      humanRank: r.human_rank,
      humanQuality: r.human_quality_rating,
    }));
  }

  /**
   * 计算 Human vs Algorithm Top-K Overlap
   */
  calculateTopKOverlap(
    humanRanking: number[],
    algorithmRanking: number[],
    k: number
  ): { overlap: number; overlapPercentage: number; humanOnly: number[]; algorithmOnly: number[] } {
    const humanTopK = new Set(humanRanking.slice(0, k));
    const algorithmTopK = new Set(algorithmRanking.slice(0, k));

    const overlap: number[] = [];
    const humanOnly: number[] = [];
    const algorithmOnly: number[] = [];

    for (const id of humanTopK) {
      if (algorithmTopK.has(id)) {
        overlap.push(id);
      } else {
        humanOnly.push(id);
      }
    }

    for (const id of algorithmTopK) {
      if (!humanTopK.has(id)) {
        algorithmOnly.push(id);
      }
    }

    return {
      overlap: overlap.length,
      overlapPercentage: Math.round((overlap.length / k) * 100),
      humanOnly,
      algorithmOnly,
    };
  }

  /**
   * 计算 Human vs Algorithm Correlation (Spearman)
   */
  calculateHumanAlgorithmCorrelation(
    humanRanking: number[],
    algorithmRanking: number[]
  ): number | 'insufficient' {
    const commonWorks = humanRanking.filter(id => algorithmRanking.includes(id));

    if (commonWorks.length < 5) return 'insufficient';

    // Get ranks for common works
    const pairs = commonWorks.map(workId => ({
      workId,
      humanRank: humanRanking.indexOf(workId) + 1,
      algorithmRank: algorithmRanking.indexOf(workId) + 1,
    }));

    const n = pairs.length;
    let sumD2 = 0;

    for (const p of pairs) {
      const d = p.humanRank - p.algorithmRank;
      sumD2 += d * d;
    }

    const correlation = 1 - (6 * sumD2) / (n * (n * n - 1));
    return correlation;
  }

  /**
   * 获取 Reviewer 统计
   */
  async getReviewerStats(): Promise<{
    reviewerCount: number;
    totalReviews: number;
    averageAgreement: number | null;
  }> {
    const { results: reviewerResult } = await this.db
      .prepare('SELECT COUNT(DISTINCT reviewer_id) as count FROM human_baseline_rankings')
      .all<{ count: number }>();

    const { results: reviewResult } = await this.db
      .prepare('SELECT COUNT(*) as count FROM human_baseline_rankings')
      .all<{ count: number }>();

    const { results: agreementResult } = await this.db
      .prepare(`
        SELECT
          SUM(CASE WHEN agreement_level IN ('PERFECT', 'GOOD') THEN 1 ELSE 0 END) as good_count,
          COUNT(*) as total_count
        FROM reviewer_agreements
      `)
      .all<{ good_count: number; total_count: number }>();

    const reviewerCount = reviewerResult?.[0]?.count || 0;
    const totalReviews = reviewResult?.[0]?.count || 0;

    let averageAgreement: number | null = null;
    if (agreementResult && agreementResult[0] && agreementResult[0].total_count > 0) {
      averageAgreement = Math.round((agreementResult[0].good_count / agreementResult[0].total_count) * 100);
    }

    return { reviewerCount, totalReviews, averageAgreement };
  }
}
