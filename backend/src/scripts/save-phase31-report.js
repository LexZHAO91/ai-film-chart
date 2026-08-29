const fs = require('fs');
const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 8787,
  path: '/api/admin/phase31/run-enrichment',
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
        fs.writeFileSync('phase31-data-enrichment-report.md', json.markdownReport, 'utf-8');
        console.log('✅ Report saved to phase31-data-enrichment-report.md');
        console.log(`📊 Summary: ${json.result.completionReport.totalWorks} works, Trust: HIGH=${json.result.completionReport.trustDistribution.HIGH}, MEDIUM=${json.result.completionReport.trustDistribution.MEDIUM}, LOW=${json.result.completionReport.trustDistribution.LOW}`);
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
