/**
 * Import Seed Pool Batch 2
 *
 * 导入 Phase 27 扩展的 40 条真实 AI Cinema 作品。
 */

import type { D1Database } from '@cloudflare/workers-types';
import { SeedImportService } from '../services/seed-import-service';
import seedPoolData from '../data/seed-pool-batch-2.json';

export async function importSeedPoolBatch2(db: D1Database) {
  const seedService = new SeedImportService(db);

  const entries = seedPoolData.entries.map(entry => ({
    ...entry,
    type: entry.type as any,
    format: entry.format as any,
  }));

  const result = await seedService.importBatch(entries, 'admin');

  // After import, add mock metrics for works that were successfully imported
  const importedWorkIds = result.details
    .filter(d => d.status === 'imported' && d.workId)
    .map(d => d.workId!);

  for (const workId of importedWorkIds) {
    await addMockMetrics(db, workId);
  }

  // Mark SERIES entries
  const seriesWorkIds = result.details
    .filter(d => d.status === 'imported' && d.workId && entries.find(e => e.title === d.title)?.type === 'SERIES')
    .map(d => d.workId!);

  for (const workId of seriesWorkIds) {
    await db
      .prepare('UPDATE works SET is_series = 1 WHERE id = ?')
      .bind(workId)
      .run();
  }

  console.log('Seed Pool Batch 2 Import Result:');
  console.log(`Total: ${result.total}`);
  console.log(`Imported: ${result.imported}`);
  console.log(`Duplicates: ${result.duplicates}`);
  console.log(`Ineligible: ${result.ineligible}`);
  console.log(`Errors: ${result.errors}`);

  // Print details of rejected works
  const rejected = result.details.filter(d => d.status !== 'imported');
  if (rejected.length > 0) {
    console.log('\nRejected Works:');
    for (const r of rejected) {
      console.log(`- ${r.title}: ${r.message}`);
    }
  }

  return result;
}

async function addMockMetrics(db: D1Database, workId: number): Promise<void> {
  const work = await db
    .prepare('SELECT type, format, duration_seconds FROM works WHERE id = ?')
    .bind(workId)
    .first<{ type: string; format: string; duration_seconds: number }>();

  if (!work) return;

  let baseViews = 50000;
  if (work.format === 'ANIMATION') baseViews = 120000;
  if (work.format === 'EXPERIMENTAL') baseViews = 15000;
  if (work.type === 'FEATURE_FILM') baseViews = 80000;
  if (work.type === 'SERIES') baseViews = 100000;

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
