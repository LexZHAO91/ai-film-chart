/**
 * Seed Pool Import Script
 *
 * Imports the first batch of real AI Cinema works into the database.
 * Usage: Run via API endpoint or local script.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { SeedImportService } from '../services/seed-import-service';
import { ContentType, ContentFormat } from '../taxonomy';
import seedData from '../data/seed-pool-batch-1.json';

export interface SeedPoolImportResult {
  total: number;
  imported: number;
  duplicates: number;
  ineligible: number;
  errors: number;
  details: { title: string; status: string; workId?: number; message: string }[];
}

/**
 * Import seed pool batch 1
 */
export async function importSeedPoolBatch1(db: D1Database): Promise<SeedPoolImportResult> {
  const seedService = new SeedImportService(db);

  // Parse entries from JSON with proper enum casting
  const entries = seedData.entries.map((entry: Record<string, unknown>) => ({
    title: entry.title as string,
    type: entry.type as ContentType,
    format: entry.format as ContentFormat,
    synopsis: entry.synopsis as string,
    director: entry.director as string,
    creator: entry.creator as string,
    durationSeconds: entry.durationSeconds as number,
    releaseYear: entry.releaseYear as number,
    country: entry.country as string,
    language: entry.language as string,
    genre: entry.genre as string[],
    posterUrl: entry.posterUrl as string,
    trailerUrl: entry.trailerUrl as string,
    officialSiteUrl: entry.officialSiteUrl as string,
    youtubeUrl: entry.youtubeUrl as string,
    sources: entry.sources as { type: string; url: string }[],
    recognition: entry.recognition as { organization: string; event: string; awardLevel: string; year: number }[],
  }));

  const result = await seedService.importBatch(entries, 'admin_seed_import');

  // After import, add mock metrics for works that were successfully imported
  const importedWorkIds = result.details
    .filter(d => d.status === 'imported' && d.workId)
    .map(d => d.workId!);

  for (const workId of importedWorkIds) {
    // Generate realistic mock metrics based on work characteristics
    await addMockMetrics(db, workId);
  }

  return {
    total: result.total,
    imported: result.imported,
    duplicates: result.duplicates,
    ineligible: result.ineligible,
    errors: result.errors,
    details: result.details.map(d => ({
      title: d.title,
      status: d.status,
      workId: d.workId,
      message: d.message,
    })),
  };
}

/**
 * Add mock metrics to a work for ranking validation
 */
async function addMockMetrics(db: D1Database, workId: number): Promise<void> {
  // Get work info to generate realistic metrics
  const work = await db
    .prepare('SELECT type, format, duration_seconds FROM works WHERE id = ?')
    .bind(workId)
    .first<{ type: string; format: string; duration_seconds: number }>();

  if (!work) return;

  // Base views: higher for animation, lower for experimental
  let baseViews = 50000;
  if (work.format === 'ANIMATION') baseViews = 120000;
  if (work.format === 'EXPERIMENTAL') baseViews = 15000;
  if (work.type === 'FEATURE_FILM') baseViews = 80000;
  if (work.type === 'SERIES') baseViews = 100000;

  // Add randomness
  const views = Math.floor(baseViews * (0.5 + Math.random()));
  const likes = Math.floor(views * (0.03 + Math.random() * 0.04));
  const comments = Math.floor(views * (0.005 + Math.random() * 0.01));
  const shares = Math.floor(views * (0.001 + Math.random() * 0.003));

  await db
    .prepare(
      `INSERT INTO work_metrics (work_id, source_type, views, likes, comments, shares, audience_rating)
       VALUES (?, 'MANUAL', ?, ?, ?, ?, ?)`
    )
    .bind(workId, views, likes, comments, shares, 7.0 + Math.random() * 3)
    .run();

  // Add a second historical metric for momentum calculation
  const prevViews = Math.floor(views * 0.7);
  const prevLikes = Math.floor(likes * 0.6);
  const prevComments = Math.floor(comments * 0.5);

  await db
    .prepare(
      `INSERT INTO work_metrics (work_id, source_type, views, likes, comments, shares, audience_rating, collected_at)
       VALUES (?, 'MANUAL', ?, ?, ?, ?, ?, datetime('now', '-7 days'))`
    )
    .bind(workId, prevViews, prevLikes, prevComments, 0, 7.0 + Math.random() * 3)
    .run();
}
