const fs = require('fs');
const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 8787,
  path: '/api/admin/phase32/run-completion',
  method: 'POST',
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
      const json = JSON.parse(data);
      if (json.success && json.markdownReport) {
        fs.writeFileSync('phase32-real-data-report.md', json.markdownReport, 'utf-8');
        console.log('✅ Report saved to phase32-real-data-report.md');
        console.log(`\n📊 Phase 32 Summary:`);
        console.log(`  Works: ${json.result.report.works.total}`);
        console.log(`  Synopsis: ${json.result.report.works.withSynopsis}/${json.result.report.works.total}`);
        console.log(`  Country: ${json.result.report.works.withCountry}/${json.result.report.works.total}`);
        console.log(`  Language: ${json.result.report.works.withLanguage}/${json.result.report.works.total}`);
        console.log(`  Duration: ${json.result.report.works.withDuration}/${json.result.report.works.total}`);
        console.log(`  Trust HIGH: ${json.result.trustScores.high}`);
        console.log(`  Trust MEDIUM: ${json.result.trustScores.medium}`);
        console.log(`  Watch VERIFIED: ${json.result.report.watch.verified}`);
        console.log(`  Watch METADATA: ${json.result.report.watch.metadataOnly}`);
        console.log(`  Human Reviewed: ${json.result.report.humanReview.reviewed}`);
        console.log(`  Golden Dataset: ${json.result.goldenDataset.eligible}`);
        console.log(`  Ranking Ready: ${json.result.report.ranking.realRankingReady ? 'YES' : 'NO'} (${json.result.report.ranking.readyCount})`);
      } else {
        console.error('❌ API error:', json.error || 'Unknown error');
        process.exit(1);
      }
    } catch (e) {
      console.error('❌ Parse error:', e.message);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
  process.exit(1);
});

req.end();
