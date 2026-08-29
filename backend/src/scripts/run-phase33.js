/**
 * Phase 33: Human Review & Watch Source Completion
 * Run the full pipeline and save the report
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:8787';

function apiCall(method, endpoint) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${API_BASE}${endpoint}`,
      { method, headers: { 'Content-Type': 'application/json' } },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            reject(new Error(`Invalid JSON: ${data.substring(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('Phase 33: Running Human Review & Watch Source Completion Pipeline...');

  // Run the full pipeline
  console.log('\n1. Running Phase 33 pipeline...');
  const result = await apiCall('POST', '/api/admin/phase33/run-pipeline');

  if (!result.success) {
    console.error('Pipeline failed:', result.error);
    process.exit(1);
  }

  console.log('\n2. Pipeline Results:');
  console.log('  - Ratings Submitted:', result.result.ratingsSubmitted.submitted);
  console.log('  - Review Progress:', result.result.reviewProgress.reviewed, '/', result.result.reviewProgress.total);
  console.log('  - Mean Quality:', result.result.qualityDistribution.mean);
  console.log('  - Ranking Readiness:', result.result.rankingReadiness.status);
  console.log('  - Golden Dataset:', result.result.goldenDataset.eligible);
  console.log('  - Experimental Ranking Generated:', result.result.experimentalRanking.generated);

  // Save markdown report
  const reportPath = path.join(__dirname, '..', '..', 'phase33-human-review-report.md');
  fs.writeFileSync(reportPath, result.markdownReport);
  console.log('\n3. Report saved to:', reportPath);

  // Print dashboard
  console.log('\n4. Data Completion Dashboard:');
  const d = result.result.dashboard;
  console.log(`  Works:                  ${d.works}`);
  console.log(`  Metadata Complete:      ${d.metadataComplete}`);
  console.log(`  Trust High:             ${d.trustHigh}`);
  console.log(`  Trust Medium:           ${d.trustMedium}`);
  console.log(`  Watch Verified:         ${d.watchVerified}`);
  console.log(`  Watch Pending:          ${d.watchPending}`);
  console.log(`  Popularity Verified:    ${d.popularityVerified}`);
  console.log(`  Popularity Unknown:     ${d.popularityUnknown}`);
  console.log(`  Human Reviewed:         ${d.humanReviewed}`);
  console.log(`  Golden Dataset:         ${d.goldenDataset}`);
  console.log(`  Ranking Ready:          ${d.rankingReady ? 'YES' : 'NO'}`);

  // Print experimental ranking
  if (result.result.experimentalRanking.generated) {
    console.log('\n5. Experimental Ranking Preview (Top 10):');
    result.result.experimentalRanking.items.slice(0, 10).forEach(item => {
      console.log(`  #${item.rank} ${item.title} | Score: ${item.score} | Quality: ${item.humanQualityRating} | Popularity: ${item.popularityStatus}`);
    });
  }

  // Print human audit
  if (result.result.humanAudit) {
    console.log('\n6. Human Ranking Audit:');
    console.log(`  TOP 5 Mean Quality: ${result.result.humanAudit.top5.meanQuality ?? 'N/A'}`);
    console.log(`  TOP 10 Precision: ${result.result.humanAudit.top10.precision ?? 'N/A'}`);
    console.log(`  TOP 10 Bad Rate: ${result.result.humanAudit.top10.badRate ?? 'N/A'}`);
    console.log(`  TOP 20 NDCG: ${result.result.humanAudit.top20.ndcg ?? 'N/A'}`);
    console.log(`  Spearman: ${result.result.humanAudit.spearman}`);
  }

  console.log('\nPhase 33 complete!');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
