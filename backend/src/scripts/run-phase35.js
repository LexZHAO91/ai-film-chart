/**
 * Phase 35: Initial 100 Works & Global Discovery
 * Run: node src/scripts/run-phase35.js
 */
const http = require('http');
const fs = require('fs');

const API_BASE = 'http://localhost:8787';

function apiCall(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8787,
      path: path,
      method: method,
      headers: {
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
          resolve({ raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== Phase 35: Initial 100 Works & Global Discovery ===\n');

  // Step 1: Re-audit existing works
  console.log('Step 1: Re-auditing existing works...');
  const auditResult = await apiCall('POST', '/api/admin/phase35/reaudit');
  console.log('Audit results:', auditResult.success ? `${auditResult.results?.length} works audited` : `Error: ${auditResult.error}`);
  if (auditResult.results) {
    const keep = auditResult.results.filter(r => r.recommendation === 'KEEP').length;
    const review = auditResult.results.filter(r => r.recommendation === 'REVIEW').length;
    const reject = auditResult.results.filter(r => r.recommendation === 'REJECT').length;
    console.log(`  KEEP: ${keep}, REVIEW: ${review}, REJECT: ${reject}`);
  }

  // Step 2: Update Golden Dataset rules
  console.log('\nStep 2: Updating Golden Dataset rules (Watch Source no longer required)...');
  const goldenResult = await apiCall('POST', '/api/admin/phase35/update-golden-rules');
  console.log('Golden Dataset:', goldenResult.success
    ? `Eligible: ${goldenResult.result?.eligible}, Ineligible: ${goldenResult.result?.ineligible}`
    : `Error: ${goldenResult.error}`);

  // Step 3: Seed discovery candidates
  console.log('\nStep 3: Seeding discovery candidates...');
  const discoveryResult = await apiCall('POST', '/api/admin/phase35/seed-discovery');
  console.log('Discovery results:', discoveryResult.success
    ? `Found: ${discoveryResult.result?.totalFound}, Added: ${discoveryResult.result?.added}`
    : `Error: ${discoveryResult.error}`);
  if (discoveryResult.result?.bySource) {
    console.log('  By source:', discoveryResult.result.bySource);
  }

  // Step 4: Get pool status
  console.log('\nStep 4: Getting Initial Pool status...');
  const statusResult = await apiCall('GET', '/api/admin/phase35/pool-status');
  if (statusResult.success) {
    const s = statusResult.status;
    console.log(`Current Works: ${s.currentWorks} / Target: ${s.target}`);
    console.log(`Verified: ${s.verified}, Review Needed: ${s.reviewNeeded}, Rejected: ${s.rejected}`);
    console.log(`Watch Available: ${s.watchAvailable}, Unavailable: ${s.watchUnavailable}`);
    console.log(`Human Reviewed: ${s.humanReviewed}`);
    console.log('Work Types:', s.workTypes);
  } else {
    console.log('Error:', statusResult.error);
  }

  // Step 5: Generate report
  console.log('\nStep 5: Generating Phase 35 report...');
  const reportResult = await apiCall('GET', '/api/admin/phase35/report');
  if (reportResult.success && reportResult.markdown) {
    fs.writeFileSync('phase35-initial-100-discovery-report.md', reportResult.markdown);
    console.log('Report saved to phase35-initial-100-discovery-report.md');
  } else {
    console.log('Error:', reportResult.error);
  }

  console.log('\n=== Phase 35 Complete ===');
}

main().catch(console.error);
