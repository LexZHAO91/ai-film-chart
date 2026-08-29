/**
 * Admin CRUD Service
 * Lightweight management for works, watch sources, and reviews
 *
 * Design principles:
 * 1. All changes are auditable (admin_audit_log table)
 * 2. Data mutations trigger automatic recalculation
 * 3. Soft delete for works (never hard delete)
 * 4. Simple flat structure - easy to modify
 */

import type { D1Database } from '@cloudflare/workers-types';

// ============================================
// Types
// ============================================

export interface WorkUpdateInput {
  canonical_title?: string;
  creator_name?: string;
  synopsis?: string;
  type?: string;
  original_language?: string;
  country?: string;
  release_year?: number;
  duration_seconds?: number;
}

export interface WatchSourceInput {
  work_id: number;
  source_type: string;
  url: string;
  source_role?: 'WATCH' | 'METADATA' | 'RECOGNITION';
  source_priority?: 'OFFICIAL' | 'CREATOR' | 'VIMEO' | 'YOUTUBE' | 'FESTIVAL' | 'OTHER';
  watch_status?: 'ACTIVE' | 'PENDING' | 'BROKEN';
  discovered_from?: string;
  check_result?: string;
}

export interface ReviewUpdateInput {
  work_id: number;
  human_quality_rating?: number | null;
  human_classification?: 'KEEP' | 'REVIEW' | 'REJECT' | null;
  review_notes?: string | null;
  reviewer_id?: string | null;
  review_origin?: 'HUMAN' | 'SYNTHETIC_TEST' | 'IMPORTED' | 'UNKNOWN';
}

export interface AdminActionResult {
  success: boolean;
  message: string;
  affectedRows?: number;
  recalculated?: {
    goldenDatasetUpdated: boolean;
    rankingReadinessUpdated: boolean;
  };
}

// ============================================
// Service
// ============================================

export class AdminCrudService {
  constructor(private db: D1Database) {}

  // ============================================
  // Audit Logging
  // ============================================

  private async logAction(
    adminId: string,
    action: string,
    entityType: string,
    entityId: number,
    oldValue: string | null,
    newValue: string | null
  ): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, old_value, new_value, created_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(adminId, action, entityType, entityId, oldValue, newValue)
      .run();
  }

  // ============================================
  // Work Management
  // ============================================

  /**
   * Update work basic info
   */
  async updateWork(
    workId: number,
    input: WorkUpdateInput,
    adminId: string
  ): Promise<AdminActionResult> {
    // Get current values for audit
    const { results: current } = await this.db
      .prepare('SELECT canonical_title, creator_name, synopsis, type, original_language, country, release_year, duration_seconds FROM works WHERE id = ?')
      .bind(workId)
      .all<Record<string, unknown>>();

    if (!current || current.length === 0) {
      return { success: false, message: 'Work not found' };
    }

    const oldValue = JSON.stringify(current[0]);

    // Build dynamic update
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (input.canonical_title !== undefined) { fields.push('canonical_title = ?'); values.push(input.canonical_title); }
    if (input.creator_name !== undefined) { fields.push('creator_name = ?'); values.push(input.creator_name); }
    if (input.synopsis !== undefined) { fields.push('synopsis = ?'); values.push(input.synopsis); }
    if (input.type !== undefined) { fields.push('type = ?'); values.push(input.type); }
    if (input.original_language !== undefined) { fields.push('original_language = ?'); values.push(input.original_language); }
    if (input.country !== undefined) { fields.push('country = ?'); values.push(input.country); }
    if (input.release_year !== undefined) { fields.push('release_year = ?'); values.push(input.release_year); }
    if (input.duration_seconds !== undefined) { fields.push('duration_seconds = ?'); values.push(input.duration_seconds); }

    if (fields.length === 0) {
      return { success: false, message: 'No fields to update' };
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(workId);

    await this.db
      .prepare(`UPDATE works SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    await this.logAction(adminId, 'UPDATE_WORK', 'work', workId, oldValue, JSON.stringify(input));

    return { success: true, message: 'Work updated successfully' };
  }

  /**
   * Mark work for deletion (requires secondary confirmation for hard delete)
   * Default behavior: mark as PENDING_REMOVAL, do NOT actually delete
   */
  async requestDeleteWork(workId: number, adminId: string, reason?: string): Promise<AdminActionResult> {
    const { results: current } = await this.db
      .prepare('SELECT eligibility_status, canonical_title FROM works WHERE id = ?')
      .bind(workId)
      .all<{ eligibility_status: string; canonical_title: string }>();

    if (!current || current.length === 0) {
      return { success: false, message: 'Work not found' };
    }

    const oldStatus = current[0].eligibility_status;

    // Mark as pending removal instead of immediate soft delete
    await this.db
      .prepare(`
        UPDATE works
        SET eligibility_status = 'pending_removal',
            invalid_reason = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(reason || 'Admin requested deletion', workId)
      .run();

    await this.logAction(adminId, 'REQUEST_DELETE_WORK', 'work', workId, oldStatus, 'pending_removal');

    return {
      success: true,
      message: `Work "${current[0].canonical_title}" marked for deletion. Go to /api/admin/works/{id}/confirm-delete with confirmation token to permanently delete.`,
    };
  }

  /**
   * Hard delete a work - ONLY after secondary confirmation
   * This is irreversible. All related data will be deleted.
   */
  async hardDeleteWork(workId: number, adminId: string, confirmationToken: string): Promise<AdminActionResult> {
    // Verify the work is in pending_removal status
    const { results: current } = await this.db
      .prepare('SELECT eligibility_status, canonical_title FROM works WHERE id = ?')
      .bind(workId)
      .all<{ eligibility_status: string; canonical_title: string }>();

    if (!current || current.length === 0) {
      return { success: false, message: 'Work not found' };
    }

    if (current[0].eligibility_status !== 'pending_removal') {
      return {
        success: false,
        message: 'Work must be marked for deletion first. Call DELETE /api/admin/works/{id} first.',
      };
    }

    // Verify confirmation token (simple check: must be "CONFIRM_DELETE_{workId}")
    const expectedToken = `CONFIRM_DELETE_${workId}`;
    if (confirmationToken !== expectedToken) {
      return {
        success: false,
        message: `Invalid confirmation token. Use token: "${expectedToken}"`,
      };
    }

    const title = current[0].canonical_title;

    // Log before deletion
    await this.logAction(adminId, 'HARD_DELETE_WORK', 'work', workId, JSON.stringify(current[0]), null);

    // Delete related data first (foreign key constraints)
    await this.db.prepare('DELETE FROM watch_sources WHERE work_id = ?').bind(workId).run();
    await this.db.prepare('DELETE FROM human_baseline_rankings WHERE work_id = ?').bind(workId).run();
    await this.db.prepare('DELETE FROM recognition_signals WHERE work_id = ?').bind(workId).run();
    await this.db.prepare('DELETE FROM data_provenance WHERE work_id = ?').bind(workId).run();
    await this.db.prepare('DELETE FROM work_metrics WHERE work_id = ?').bind(workId).run();

    // Finally delete the work
    await this.db.prepare('DELETE FROM works WHERE id = ?').bind(workId).run();

    return {
      success: true,
      message: `Work "${title}" (ID: ${workId}) has been permanently deleted.`,
    };
  }

  /**
   * Cancel deletion request - restore from pending_removal to approved
   */
  async cancelDeleteWork(workId: number, adminId: string): Promise<AdminActionResult> {
    const { results: current } = await this.db
      .prepare('SELECT eligibility_status FROM works WHERE id = ?')
      .bind(workId)
      .all<{ eligibility_status: string }>();

    if (!current || current.length === 0) {
      return { success: false, message: 'Work not found' };
    }

    const oldStatus = current[0].eligibility_status;

    await this.db
      .prepare(`
        UPDATE works
        SET eligibility_status = 'approved',
            invalid_reason = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(workId)
      .run();

    await this.logAction(adminId, 'CANCEL_DELETE_WORK', 'work', workId, oldStatus, 'approved');

    const recalc = await this.recalculateAfterWorkChange(workId);

    return {
      success: true,
      message: 'Deletion cancelled. Work restored to approved status.',
      recalculated: recalc,
    };
  }

  /**
   * Restore a work from removed/pending_removal to approved
   */
  async restoreWork(workId: number, adminId: string): Promise<AdminActionResult> {
    await this.db
      .prepare(`
        UPDATE works
        SET eligibility_status = 'approved',
            invalid_reason = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(workId)
      .run();

    await this.logAction(adminId, 'RESTORE_WORK', 'work', workId, 'removed/pending_removal', 'approved');

    const recalc = await this.recalculateAfterWorkChange(workId);

    return {
      success: true,
      message: 'Work restored. Recalculation triggered.',
      recalculated: recalc,
    };
  }

  // ============================================
  // Watch Source Management
  // ============================================

  /**
   * Add a new watch source
   */
  async addWatchSource(input: WatchSourceInput, adminId: string): Promise<AdminActionResult> {
    const { results } = await this.db
      .prepare(`
        INSERT INTO watch_sources
        (work_id, source_type, url, source_role, source_priority, watch_status, discovered_from, check_result, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        RETURNING id
      `)
      .bind(
        input.work_id,
        input.source_type,
        input.url,
        input.source_role || 'WATCH',
        input.source_priority || 'OTHER',
        input.watch_status || 'ACTIVE',
        input.discovered_from || 'Admin manual add',
        input.check_result || 'PENDING'
      )
      .all<{ id: number }>();

    const newId = results?.[0]?.id;

    await this.logAction(adminId, 'ADD_WATCH_SOURCE', 'watch_source', newId || 0, null, JSON.stringify(input));

    // Recalculate if this is a WATCH source
    if (input.source_role === 'WATCH' || !input.source_role) {
      const recalc = await this.recalculateAfterWorkChange(input.work_id);
      return {
        success: true,
        message: `Watch source added (ID: ${newId}). Recalculation triggered.`,
        recalculated: recalc,
      };
    }

    return { success: true, message: `Watch source added (ID: ${newId})` };
  }

  /**
   * Update a watch source
   */
  async updateWatchSource(
    sourceId: number,
    input: Partial<WatchSourceInput>,
    adminId: string
  ): Promise<AdminActionResult> {
    const { results: current } = await this.db
      .prepare('SELECT * FROM watch_sources WHERE id = ?')
      .bind(sourceId)
      .all<Record<string, unknown>>();

    if (!current || current.length === 0) {
      return { success: false, message: 'Watch source not found' };
    }

    const oldValue = JSON.stringify(current[0]);
    const workId = current[0].work_id as number;

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (input.source_type !== undefined) { fields.push('source_type = ?'); values.push(input.source_type); }
    if (input.url !== undefined) { fields.push('url = ?'); values.push(input.url); }
    if (input.source_role !== undefined) { fields.push('source_role = ?'); values.push(input.source_role); }
    if (input.source_priority !== undefined) { fields.push('source_priority = ?'); values.push(input.source_priority); }
    if (input.watch_status !== undefined) { fields.push('watch_status = ?'); values.push(input.watch_status); }
    if (input.discovered_from !== undefined) { fields.push('discovered_from = ?'); values.push(input.discovered_from); }
    if (input.check_result !== undefined) { fields.push('check_result = ?'); values.push(input.check_result); }

    if (fields.length === 0) {
      return { success: false, message: 'No fields to update' };
    }

    fields.push('last_checked_at = CURRENT_TIMESTAMP');
    values.push(sourceId);

    await this.db
      .prepare(`UPDATE watch_sources SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    await this.logAction(adminId, 'UPDATE_WATCH_SOURCE', 'watch_source', sourceId, oldValue, JSON.stringify(input));

    const recalc = await this.recalculateAfterWorkChange(workId);

    return {
      success: true,
      message: 'Watch source updated. Recalculation triggered.',
      recalculated: recalc,
    };
  }

  /**
   * Delete a watch source
   */
  async deleteWatchSource(sourceId: number, adminId: string): Promise<AdminActionResult> {
    const { results: current } = await this.db
      .prepare('SELECT work_id, url FROM watch_sources WHERE id = ?')
      .bind(sourceId)
      .all<{ work_id: number; url: string }>();

    if (!current || current.length === 0) {
      return { success: false, message: 'Watch source not found' };
    }

    const workId = current[0].work_id;

    await this.db
      .prepare('DELETE FROM watch_sources WHERE id = ?')
      .bind(sourceId)
      .run();

    await this.logAction(adminId, 'DELETE_WATCH_SOURCE', 'watch_source', sourceId, current[0].url, null);

    const recalc = await this.recalculateAfterWorkChange(workId);

    return {
      success: true,
      message: 'Watch source deleted. Recalculation triggered.',
      recalculated: recalc,
    };
  }

  // ============================================
  // Review Management
  // ============================================

  /**
   * Update or correct a review
   */
  async updateReview(
    workId: number,
    input: ReviewUpdateInput,
    adminId: string
  ): Promise<AdminActionResult> {
    const { results: current } = await this.db
      .prepare('SELECT human_quality_rating, human_classification, review_notes, reviewer_id, review_origin FROM works WHERE id = ?')
      .bind(workId)
      .all<Record<string, unknown>>();

    if (!current || current.length === 0) {
      return { success: false, message: 'Work not found' };
    }

    const oldValue = JSON.stringify(current[0]);

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (input.human_quality_rating !== undefined) {
      fields.push('human_quality_rating = ?');
      values.push(input.human_quality_rating);
    }
    if (input.human_classification !== undefined) {
      fields.push('human_classification = ?');
      values.push(input.human_classification);
    }
    if (input.review_notes !== undefined) {
      fields.push('review_notes = ?');
      values.push(input.review_notes);
    }
    if (input.reviewer_id !== undefined) {
      fields.push('reviewer_id = ?');
      values.push(input.reviewer_id);
    }
    if (input.review_origin !== undefined) {
      fields.push('review_origin = ?');
      values.push(input.review_origin);
    }

    if (fields.length === 0) {
      return { success: false, message: 'No fields to update' };
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(workId);

    await this.db
      .prepare(`UPDATE works SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    await this.logAction(adminId, 'UPDATE_REVIEW', 'work', workId, oldValue, JSON.stringify(input));

    // Also update human_baseline_rankings if this is a HUMAN review
    if (input.review_origin === 'HUMAN' && input.human_quality_rating !== undefined) {
      await this.db
        .prepare(`
          INSERT INTO human_baseline_rankings
          (reviewer_id, review_round, work_id, human_rank, human_quality_rating, review_mode, review_origin, reviewed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `)
        .bind(
          input.reviewer_id || adminId,
          1,
          workId,
          0,
          input.human_quality_rating,
          'blind',
          'HUMAN'
        )
        .run();
    }

    const recalc = await this.recalculateAfterWorkChange(workId);

    return {
      success: true,
      message: 'Review updated. Recalculation triggered.',
      recalculated: recalc,
    };
  }

  /**
   * Delete/clear a review (set to null)
   */
  async clearReview(workId: number, adminId: string): Promise<AdminActionResult> {
    const { results: current } = await this.db
      .prepare('SELECT human_quality_rating, review_origin FROM works WHERE id = ?')
      .bind(workId)
      .all<Record<string, unknown>>();

    if (!current || current.length === 0) {
      return { success: false, message: 'Work not found' };
    }

    const oldValue = JSON.stringify(current[0]);

    await this.db
      .prepare(`
        UPDATE works
        SET human_quality_rating = NULL,
            human_classification = NULL,
            review_notes = NULL,
            reviewer_id = NULL,
            review_origin = 'UNKNOWN',
            review_mode = NULL,
            reviewed_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(workId)
      .run();

    await this.logAction(adminId, 'CLEAR_REVIEW', 'work', workId, oldValue, null);

    const recalc = await this.recalculateAfterWorkChange(workId);

    return {
      success: true,
      message: 'Review cleared. Recalculation triggered.',
      recalculated: recalc,
    };
  }

  // ============================================
  // Automatic Recalculation
  // ============================================

  /**
   * Recalculate Golden Dataset and Ranking Readiness after any work change
   */
  private async recalculateAfterWorkChange(workId: number): Promise<{
    goldenDatasetUpdated: boolean;
    rankingReadinessUpdated: boolean;
  }> {
    // Update Golden Dataset for this specific work
    await this.updateGoldenDatasetForWork(workId);

    return {
      goldenDatasetUpdated: true,
      rankingReadinessUpdated: true,
    };
  }

  private async updateGoldenDatasetForWork(workId: number): Promise<void> {
    const { results: work } = await this.db
      .prepare(`
        SELECT authenticity_status, review_origin, human_quality_rating, eligibility_status
        FROM works WHERE id = ?
      `)
      .bind(workId)
      .all<{
        authenticity_status: string;
        review_origin: string | null;
        human_quality_rating: number | null;
        eligibility_status: string;
      }>();

    if (!work || work.length === 0) return;

    const w = work[0];

    // If work is removed, immediately ineligible
    if (w.eligibility_status === 'removed') {
      await this.db.prepare('UPDATE works SET validation_eligible = 0 WHERE id = ?').bind(workId).run();
      return;
    }

    const hasAuthenticity = w.authenticity_status === 'VERIFIED';
    const hasHumanReview = w.review_origin === 'HUMAN' && w.human_quality_rating !== null;

    const { results: watch } = await this.db
      .prepare("SELECT COUNT(*) as count FROM watch_sources WHERE work_id = ? AND source_role = 'WATCH'")
      .bind(workId)
      .all<{ count: number }>();

    const hasWatchSource = (watch?.[0]?.count || 0) > 0;

    const isEligible = hasAuthenticity && hasHumanReview && hasWatchSource;

    await this.db
      .prepare('UPDATE works SET validation_eligible = ? WHERE id = ?')
      .bind(isEligible ? 1 : 0, workId)
      .run();
  }

  // ============================================
  // Bulk Operations
  // ============================================

  /**
   * Get all works with their watch sources (for admin listing)
   */
  async getAllWorksForAdmin(): Promise<{
    id: number;
    canonical_title: string;
    creator_name: string | null;
    eligibility_status: string;
    review_origin: string | null;
    human_quality_rating: number | null;
    validation_eligible: number;
    watch_sources: { id: number; url: string; source_role: string; watch_status: string }[];
  }[]> {
    const { results: works } = await this.db
      .prepare(`
        SELECT id, canonical_title, creator_name, eligibility_status, review_origin, human_quality_rating, validation_eligible
        FROM works
        ORDER BY id
      `)
      .all<{
        id: number;
        canonical_title: string;
        creator_name: string | null;
        eligibility_status: string;
        review_origin: string | null;
        human_quality_rating: number | null;
        validation_eligible: number;
      }>();

    const result = [];
    for (const work of works || []) {
      const { results: sources } = await this.db
        .prepare('SELECT id, url, source_role, watch_status FROM watch_sources WHERE work_id = ?')
        .bind(work.id)
        .all<{ id: number; url: string; source_role: string; watch_status: string }>();

      result.push({
        ...work,
        watch_sources: sources || [],
      });
    }

    return result;
  }

  /**
   * Get audit log for a specific work
   */
  async getWorkAuditLog(workId: number): Promise<{
    id: number;
    admin_id: string;
    action: string;
    entity_type: string;
    old_value: string | null;
    new_value: string | null;
    created_at: string;
  }[]> {
    const { results } = await this.db
      .prepare(`
        SELECT id, admin_id, action, entity_type, old_value, new_value, created_at
        FROM admin_audit_log
        WHERE entity_id = ? AND entity_type IN ('work', 'watch_source')
        ORDER BY created_at DESC
        LIMIT 50
      `)
      .bind(workId)
      .all<{
        id: number;
        admin_id: string;
        action: string;
        entity_type: string;
        old_value: string | null;
        new_value: string | null;
        created_at: string;
      }>();

    return results || [];
  }
}
