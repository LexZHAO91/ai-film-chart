/**
 * Phase 31: Local Enrichment Runner
 *
 * Directly executes the Phase 31 enrichment pipeline against the local D1 SQLite database.
 * Usage: npx tsx src/scripts/run-phase31-enrichment.ts
 */

import { Database } from 'better-sqlite3';
import { Phase31DataEnrichmentService } from '../services/phase31-data-enrichment-service';

// Path to local D1 SQLite database
const DB_PATH = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/a45db0f263b9439e899c99ca74293d6edc0149dd70bf3fc44abc6618083917f2.sqlite';

// Minimal D1Database wrapper for better-sqlite3
function createD1Wrapper(db: Database): any {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...params: any[]) {
          return {
            async all<T = any>(): Promise<{ results?: T[] }> {
              try {
                const results = stmt.all(...params) as T[];
                return { results };
              } catch (e) {
                // For non-SELECT statements
                stmt.run(...params);
                return { results: [] };
              }
            },
            async first<T = any>(): Promise<T | null> {
              const result = stmt.get(...params) as T | undefined;
              return result || null;
            },
            async run(): Promise<{ success: boolean }> {
              stmt.run(...params);
              return { success: true };
            },
          };
        },
        async all<T = any>(): Promise<{ results?: T[] }> {
          try {
            const results = stmt.all() as T[];
            return { results };
          } catch (e) {
            stmt.run();
            return { results: [] };
          }
        },
        async first<T = any>(): Promise<T | null> {
          const result = stmt.get() as T | undefined;
          return result || null;
        },
        async run(): Promise<{ success: boolean }> {
          stmt.run();
          return { success: true };
        },
      };
    },
    async batch(statements: any[]): Promise<any[]> {
      const results: any[] = [];
      for (const s of statements) {
        const stmt = db.prepare(s.sql);
        const res = s.params ? stmt.all(...s.params) : stmt.all();
        results.push({ results: res });
      }
      return results;
    },
  };
}

async function main() {
  console.log('=== Phase 31: Data Enrichment & Source Correction ===\n');

  let db: Database | null = null;
  try {
    // Dynamically import better-sqlite3
    const { default: DatabaseCtor } = await import('better-sqlite3');
    db = new DatabaseCtor(DB_PATH);

    const d1Wrapper = createD1Wrapper(db);
    const service = new Phase31DataEnrichmentService(d1Wrapper);

    console.log('Running full enrichment pipeline...\n');

    const result = await service.runFullEnrichmentPipeline();

    console.log('✅ Pipeline completed!\n');

    // Print summary
    console.log('--- Source Audit ---');
    console.log(`Total works audited: ${result.sourceAudit.length}`);
    console.log(`Reclassified to RECOGNITION: ${result.sourceAudit.reduce((s, r) => s + r.reclassifiedToRecognition, 0)}`);
    console.log(`Reclassified to METADATA: ${result.sourceAudit.reduce((s, r) => s + r.reclassifiedToMetadata, 0)}`);
    console.log(`Pending watch sources: ${result.sourceAudit.reduce((s, r) => s + r.pendingWatchSources, 0)}`);

    console.log('\n--- Metadata Enrichment ---');
    const enriched = result.metadataEnrichment.filter(m => m.fieldsUpdated.length > 0);
    console.log(`Works enriched: ${enriched.length} / ${result.metadataEnrichment.length}`);
    enriched.forEach(m => {
      console.log(`  - ${m.title}: ${m.fieldsUpdated.join(', ')}`);
    });

    console.log('\n--- Popularity Status ---');
    console.log(`VERIFIED: ${result.popularityStatus.verified}`);
    console.log(`PARTIAL: ${result.popularityStatus.partial}`);
    console.log(`UNKNOWN: ${result.popularityStatus.unknown}`);

    console.log('\n--- Split Trust Scores ---');
    console.log(`HIGH: ${result.trustScores.filter(s => s.level === 'HIGH').length}`);
    console.log(`MEDIUM: ${result.trustScores.filter(s => s.level === 'MEDIUM').length}`);
    console.log(`LOW: ${result.trustScores.filter(s => s.level === 'LOW').length}`);

    console.log('\n--- Golden Dataset Eligibility ---');
    console.log(`Eligible: ${result.goldenDataset.eligible}`);
    console.log(`Ineligible: ${result.goldenDataset.ineligible}`);
    console.log(`Total: ${result.goldenDataset.total}`);

    console.log('\n--- Data Completion ---');
    const r = result.completionReport;
    console.log(`Synopsis: ${r.synopsis}/${r.totalWorks} (${((r.synopsis / r.totalWorks) * 100).toFixed(1)}%)`);
    console.log(`Genre: ${r.genre}/${r.totalWorks} (${((r.genre / r.totalWorks) * 100).toFixed(1)}%)`);
    console.log(`Language: ${r.language}/${r.totalWorks} (${((r.language / r.totalWorks) * 100).toFixed(1)}%)`);
    console.log(`Country: ${r.country}/${r.totalWorks} (${((r.country / r.totalWorks) * 100).toFixed(1)}%)`);
    console.log(`Duration: ${r.duration}/${r.totalWorks} (${((r.duration / r.totalWorks) * 100).toFixed(1)}%)`);
    console.log(`Release Year: ${r.releaseYear}/${r.totalWorks} (${((r.releaseYear / r.totalWorks) * 100).toFixed(1)}%)`);
    console.log(`Creator: ${r.creator}/${r.totalWorks} (${((r.creator / r.totalWorks) * 100).toFixed(1)}%)`);
    console.log(`Verified Watch Source: ${r.verifiedWatchSource}/${r.totalWorks}`);
    console.log(`Pending Watch Source: ${r.pendingWatchSource}/${r.totalWorks}`);

    // Generate and save markdown report
    const markdownReport = service.generateMarkdownReport(result);
    const fs = await import('fs');
    const reportPath = 'phase31-data-enrichment-report.md';
    fs.writeFileSync(reportPath, markdownReport, 'utf-8');
    console.log(`\n📄 Report saved to: ${reportPath}`);

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    db?.close();
  }
}

main();
