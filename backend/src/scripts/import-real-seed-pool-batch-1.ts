/**
 * Real Seed Pool Import Script - Phase 30
 *
 * Imports the first batch of REAL, VERIFIABLE AI Cinema works into the database.
 * Key differences from synthetic seed import:
 * - Sets authenticity_status = 'VERIFIED' on works
 * - Creates watch_sources separate from work_sources
 * - Creates recognition_events (not just recognition_signals)
 * - Runs data trust audit immediately after import
 * - Generates detailed import report with data gaps
 * - Strict NULL handling for missing metadata
 *
 * Usage: POST /api/admin/seed-pool/import-real-batch-1
 */

import type { D1Database } from '@cloudflare/workers-types';
import { WorkService } from '../works';
import { DataTrustAuditService } from '../services/data-trust-audit-service';
import seedData from '../data/seed-pool-real-batch-1.json';

export interface RealSeedImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: number;
  details: RealSeedImportDetail[];
  trustAudit: {
    audited: number;
    highTrust: number;
    mediumTrust: number;
    lowTrust: number;
  };
  dataGaps: DataGapReport;
}

export interface RealSeedImportDetail {
  title: string;
  status: 'imported' | 'skipped' | 'error';
  workId?: number;
  message: string;
  recognitionCount: number;
  watchSourceCount: number;
}

export interface DataGapReport {
  totalWorks: number;
  missingSynopsis: number;
  missingDuration: number;
  missingCountry: number;
  missingLanguage: number;
  missingGenre: number;
  missingReleaseYear: number;
  missingCreator: number;
  missingWatchSource: number;
  missingRecognition: number;
  gapsByWork: { workId: number; title: string; missingFields: string[] }[];
}

interface SeedEntry {
  title: string;
  creator: string;
  type: string;
  format: string;
  synopsis: string | null;
  duration_seconds: number | null;
  release_year: number | null;
  country: string | null;
  language: string | null;
  genre: string | null;
  authenticity_status: string;
  verification_notes: string;
  sources: { source_type: string; url: string; verification_status: string }[];
  watch_sources: { source_type: string; url: string; verification_status: string; is_primary: boolean }[];
  recognition: {
    organization: string;
    event: string;
    award_level: string;
    year: number | null;
    category: string | null;
    source_url: string;
    verification_status: string;
  }[];
}

/**
 * Import real seed pool batch 1
 */
export async function importRealSeedPoolBatch1(db: D1Database): Promise<RealSeedImportResult> {
  const workService = new WorkService(db);
  const trustService = new DataTrustAuditService(db);

  const entries = seedData.entries as SeedEntry[];
  const details: RealSeedImportDetail[] = [];
  const importedWorkIds: number[] = [];
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  const gapsByWork: { workId: number; title: string; missingFields: string[] }[] = [];
  let missingSynopsis = 0;
  let missingDuration = 0;
  let missingCountry = 0;
  let missingLanguage = 0;
  let missingGenre = 0;
  let missingReleaseYear = 0;
  let missingCreator = 0;
  let missingWatchSource = 0;
  let missingRecognition = 0;

  for (const entry of entries) {
    try {
      // 1. Check for duplicates
      const duplicates = await workService.findPotentialDuplicates(entry.title, entry.creator);
      if (duplicates.length > 0) {
        details.push({
          title: entry.title,
          status: 'skipped',
          message: `Duplicate found: work #${duplicates[0].id}`,
          recognitionCount: 0,
          watchSourceCount: 0,
        });
        skipped++;
        continue;
      }

      // 2. Create Work with strict NULL handling
      const work = await workService.createWork({
        canonicalTitle: entry.title,
        type: entry.type as any,
        format: entry.format as any,
        synopsis: entry.synopsis || undefined,
        originalLanguage: entry.language || undefined,
        country: entry.country || undefined,
        releaseYear: entry.release_year || undefined,
        durationSeconds: entry.duration_seconds || undefined,
        creatorName: entry.creator || undefined,
      });

      // 3. Set authenticity_status and verification notes
      await db
        .prepare(`
          UPDATE works
          SET authenticity_status = ?,
              verification_notes = ?,
              eligibility_status = 'approved',
              quality_status = 'reviewed'
          WHERE id = ?
        `)
        .bind(
          entry.authenticity_status || 'UNVERIFIED',
          entry.verification_notes || null,
          work.id
        )
        .run();

      // 4. Create work_sources (verification sources)
      for (let i = 0; i < entry.sources.length; i++) {
        const src = entry.sources[i];
        await workService.addWorkSource({
          workId: work.id,
          sourceType: src.source_type,
          canonicalUrl: src.url,
          isPrimarySource: i === 0,
          sourceMetadata: { verification_status: src.verification_status },
        });

        // Update verification_status on work_sources
        await db
          .prepare(`
            UPDATE work_sources
            SET verification_status = ?
            WHERE work_id = ? AND canonical_url = ?
          `)
          .bind(src.verification_status || 'UNVERIFIED', work.id, src.url)
          .run();
      }

      // 5. Create watch_sources (viewing entry points)
      let watchSourceCount = 0;
      if (entry.watch_sources && entry.watch_sources.length > 0) {
        for (const ws of entry.watch_sources) {
          await db
            .prepare(`
              INSERT INTO watch_sources
              (work_id, source_type, url, is_primary, verification_status)
              VALUES (?, ?, ?, ?, ?)
            `)
            .bind(
              work.id,
              ws.source_type,
              ws.url,
              ws.is_primary ? 1 : 0,
              ws.verification_status || 'UNVERIFIED'
            )
            .run();
          watchSourceCount++;
        }
      }

      // 6. Create recognition_events (detailed, per-event records)
      let recognitionCount = 0;
      if (entry.recognition && entry.recognition.length > 0) {
        for (const rec of entry.recognition) {
          await db
            .prepare(`
              INSERT INTO recognition_events
              (work_id, organization, event_name, year, category, award_level, source_url, verification_status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              work.id,
              rec.organization,
              rec.event,
              rec.year || null,
              rec.category || null,
              rec.award_level,
              rec.source_url || null,
              rec.verification_status || 'UNVERIFIED'
            )
            .run();
          recognitionCount++;
        }

        // Also create recognition_signals for backward compatibility
        for (const rec of entry.recognition) {
          await db
            .prepare(`
              INSERT INTO recognition_signals
              (work_id, organization, event, category, award_level, year, source_url, verified)
              VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            `)
            .bind(
              work.id,
              rec.organization,
              rec.event,
              rec.category || null,
              rec.award_level,
              rec.year || null,
              rec.source_url || null
            )
            .run();
        }
      }

      // 7. Record data provenance
      await db
        .prepare(`
          INSERT INTO data_provenance
          (work_id, source_type, data_field, data_value, extraction_method, confidence)
          VALUES (?, 'MANUAL', 'real_seed_import', ?, 'MANUAL_ENTRY', 1.0)
        `)
        .bind(work.id, `Phase 30 real seed import: ${seedData.batch}`)
        .run();

      // 8. Track data gaps
      const missingFields: string[] = [];
      if (!entry.synopsis) { missingFields.push('synopsis'); missingSynopsis++; }
      if (!entry.duration_seconds) { missingFields.push('duration'); missingDuration++; }
      if (!entry.country) { missingFields.push('country'); missingCountry++; }
      if (!entry.language) { missingFields.push('language'); missingLanguage++; }
      if (!entry.genre) { missingFields.push('genre'); missingGenre++; }
      if (!entry.release_year) { missingFields.push('release_year'); missingReleaseYear++; }
      if (!entry.creator) { missingFields.push('creator'); missingCreator++; }
      if (!entry.watch_sources || entry.watch_sources.length === 0) { missingFields.push('watch_source'); missingWatchSource++; }
      if (!entry.recognition || entry.recognition.length === 0) { missingFields.push('recognition'); missingRecognition++; }

      if (missingFields.length > 0) {
        gapsByWork.push({ workId: work.id, title: entry.title, missingFields });
      }

      importedWorkIds.push(work.id);
      imported++;

      details.push({
        title: entry.title,
        status: 'imported',
        workId: work.id,
        message: `Imported as work #${work.id}`,
        recognitionCount,
        watchSourceCount,
      });
    } catch (error) {
      errors++;
      details.push({
        title: entry.title,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        recognitionCount: 0,
        watchSourceCount: 0,
      });
    }
  }

  // 9. Run data trust audit on all imported works
  let highTrust = 0;
  let mediumTrust = 0;
  let lowTrust = 0;

  for (const workId of importedWorkIds) {
    try {
      const score = await trustService.auditWork(workId);
      await trustService.saveTrustScore(score);

      if (score.level === 'HIGH') highTrust++;
      else if (score.level === 'MEDIUM') mediumTrust++;
      else lowTrust++;
    } catch (e) {
      // Audit failure is non-fatal
    }
  }

  // 10. Update batch metadata (use first imported work_id or skip if none)
  if (importedWorkIds.length > 0) {
    await db
      .prepare(`
        INSERT INTO data_provenance
        (work_id, source_type, data_field, data_value, extraction_method, confidence)
        VALUES (?, 'ADMIN', 'batch_import_complete', ?, 'MANUAL_ENTRY', 1.0)
      `)
      .bind(
        importedWorkIds[0],
        JSON.stringify({
          batch: seedData.batch,
          total: entries.length,
          imported,
          skipped,
          errors,
          imported_at: new Date().toISOString(),
        })
      )
      .run();
  }

  const dataGaps: DataGapReport = {
    totalWorks: imported,
    missingSynopsis,
    missingDuration,
    missingCountry,
    missingLanguage,
    missingGenre,
    missingReleaseYear,
    missingCreator,
    missingWatchSource,
    missingRecognition,
    gapsByWork,
  };

  return {
    total: entries.length,
    imported,
    skipped,
    errors,
    details,
    trustAudit: {
      audited: importedWorkIds.length,
      highTrust,
      mediumTrust,
      lowTrust,
    },
    dataGaps,
  };
}

/**
 * Generate Phase 30 import report as Markdown
 */
export function generateImportReport(result: RealSeedImportResult): string {
  const lines = [
    '# Phase 30: Real Seed Pool Import Report',
    '',
    `Generated at: ${new Date().toISOString()}`,
    `Batch: ${seedData.batch}`,
    '',
    '---',
    '',
    '## Import Summary',
    '',
    `- Total entries: ${result.total}`,
    `- Successfully imported: ${result.imported}`,
    `- Skipped (duplicates): ${result.skipped}`,
    `- Errors: ${result.errors}`,
    '',
    '## Data Trust Audit',
    '',
    `- Audited: ${result.trustAudit.audited}`,
    `- HIGH trust: ${result.trustAudit.highTrust}`,
    `- MEDIUM trust: ${result.trustAudit.mediumTrust}`,
    `- LOW trust: ${result.trustAudit.lowTrust}`,
    '',
    '## Data Gaps',
    '',
    `- Total works with gaps: ${result.dataGaps.gapsByWork.length} / ${result.dataGaps.totalWorks}`,
    `- Missing synopsis: ${result.dataGaps.missingSynopsis}`,
    `- Missing duration: ${result.dataGaps.missingDuration}`,
    `- Missing country: ${result.dataGaps.missingCountry}`,
    `- Missing language: ${result.dataGaps.missingLanguage}`,
    `- Missing genre: ${result.dataGaps.missingGenre}`,
    `- Missing release year: ${result.dataGaps.missingReleaseYear}`,
    `- Missing creator: ${result.dataGaps.missingCreator}`,
    `- Missing watch source: ${result.dataGaps.missingWatchSource}`,
    `- Missing recognition: ${result.dataGaps.missingRecognition}`,
    '',
    '## Imported Works',
    '',
    ...result.details
      .filter(d => d.status === 'imported')
      .map(d => `- **${d.title}** (work #${d.workId}) — ${d.recognitionCount} recognition(s), ${d.watchSourceCount} watch source(s)`),
    '',
    '## Works with Data Gaps (Top 10)',
    '',
    ...result.dataGaps.gapsByWork.slice(0, 10).map(g =>
      `- **${g.title}** (work #${g.workId}): missing ${g.missingFields.join(', ')}`
    ),
    ...(result.dataGaps.gapsByWork.length > 10
      ? [`\n... and ${result.dataGaps.gapsByWork.length - 10} more`]
      : []),
    '',
    '---',
    '',
    '*This report was auto-generated by the Phase 30 Real Seed Pool Import system.*',
  ];

  return lines.join('\n');
}
