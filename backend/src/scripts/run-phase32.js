const http = require('http');
const fs = require('fs');

function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 8787,
      path,
      method,
      headers: {
        'Authorization': 'Bearer dev',
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Parse error: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== Phase 32: Real Data Completion ===\n');

  try {
    console.log('Running Phase 32 pipeline...');
    const result = await makeRequest('/api/admin/phase32/run-completion', 'POST');

    if (!result.success) {
      console.error('❌ Pipeline failed:', result.error);
      process.exit(1);
    }

    console.log('\n✅ Pipeline completed!\n');

    // Print summary
    console.log('--- Watch Source Fixes ---');
    console.log(`Total fixes: ${result.result.watchFixes.total}`);
    result.result.watchFixes.fixes.forEach(f => {
      console.log(`  - ${f.title}: ${f.oldRole} → ${f.newRole} (${f.reason})`);
    });

    console.log('\n--- Metadata Enrichment ---');
    console.log(`Fields enriched: ${result.result.metadataEnrichment.total}`);

    console.log('\n--- Trust Scores ---');
    console.log(`HIGH: ${result.result.trustScores.high}`);
    console.log(`MEDIUM: ${result.result.trustScores.medium}`);
    console.log(`LOW: ${result.result.trustScores.low}`);

    console.log('\n--- Golden Dataset ---');
    console.log(`Eligible: ${result.result.goldenDataset.eligible}`);
    console.log(`Ineligible: ${result.result.goldenDataset.ineligible}`);

    console.log('\n--- Ranking Readiness ---');
    console.log(`Ready: ${result.result.report.ranking.realRankingReady ? 'YES' : 'NO'}`);
    console.log(`Ready count: ${result.result.report.ranking.readyCount}`);

    // Save report
    fs.writeFileSync('phase32-real-data-report.md', result.markdownReport, 'utf-8');
    console.log('\n📄 Report saved to: phase32-real-data-report.md');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
