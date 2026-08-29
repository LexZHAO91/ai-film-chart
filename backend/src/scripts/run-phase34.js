/**
 * Phase 34: Synthetic Review Cleanup & Real Review Preparation
 * Run the cleanup pipeline and save the report
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
  console.log('Phase 34: Synthetic Review Cleanup & Real Review Preparation');

  // Run cleanup pipeline
  console.log('\n1. Running Phase 34 cleanup pipeline...');
  const result = await apiCall('POST', '/api/admin/phase34/run-cleanup');

  if (!result.success) {
    console.error('Cleanup failed:', result.error);
    process.exit(1);
  }

  console.log('\n2. Cleanup Results:');
  console.log('  - Synthetic Reviews Marked:', result.result.cleanup.syntheticMarked);
  console.log('  - Golden Dataset (Human):', result.result.cleanup.goldenDatasetUpdated.eligibleHuman);
  console.log('  - Golden Dataset (Synthetic - EXCLUDED):', result.result.cleanup.goldenDatasetUpdated.eligibleSynthetic);
  console.log('  - Ineligible:', result.result.cleanup.goldenDatasetUpdated.ineligible);

  // Save report
  const reportPath = path.join(__dirname, '..', '..', 'phase34-review-preparation-report.md');
  fs.writeFileSync(reportPath, result.markdownReport);
  console.log('\n3. Report saved to:', reportPath);

  // Get dashboard
  console.log('\n4. Phase 34 Dashboard:');
  const dashboardRes = await apiCall('GET', '/api/admin/phase34/dashboard');
  if (dashboardRes.success) {
    const d = dashboardRes.dashboard;
    console.log(`  Total Works:           ${d.totalWorks}`);
    console.log(`  Human Reviewed:        ${d.humanReviewed}`);
    console.log(`  Synthetic Reviewed:    ${d.syntheticReviewed}`);
    console.log(`  Unreviewed:            ${d.unreviewed}`);
    console.log(`  Verified Watch Sources: ${d.verifiedWatchSources}`);
    console.log(`  Review Ready:          ${d.reviewReady}`);
    console.log(`  Golden Dataset (Human): ${d.goldenDatasetHuman}`);
    console.log(`  Golden Dataset (Synthetic): ${d.goldenDatasetSynthetic}`);
    console.log(`  Ranking Readiness:     ${d.rankingReadiness}`);
  }

  // Get review queue
  console.log('\n5. Real Review Queue:');
  const queueRes = await apiCall('GET', '/api/admin/phase34/review-queue');
  if (queueRes.success) {
    console.log(`  ${queueRes.queue.length} works ready for real human review:`);
    queueRes.queue.forEach(item => {
      console.log(`    - [${item.workId}] ${item.title} by ${item.creator || 'Unknown'} | ${item.watchUrl}`);
    });
  }

  // Get ranking readiness
  console.log('\n6. Ranking Readiness:');
  const readinessRes = await apiCall('GET', '/api/admin/phase34/ranking-readiness');
  if (readinessRes.success) {
    const r = readinessRes.readiness;
    console.log(`  Status: ${r.status}`);
    console.log(`  Human Reviewed: ${r.humanReviewed}`);
    console.log(`  Message: ${r.message}`);
    console.log(`  Thresholds: Early Preview=${r.thresholds.earlyPreview}, Early Experiment=${r.thresholds.earlyExperiment}, Seed Validation=${r.thresholds.seedValidation}, Stable Evaluation=${r.thresholds.stableEvaluation}`);
  }

  console.log('\nPhase 34 complete!');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
