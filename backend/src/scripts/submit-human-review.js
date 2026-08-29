/**
 * Submit a real human review for a work
 * Usage: node submit-human-review.js <workId> <rating> [reviewerId]
 * Example: node submit-human-review.js 57 4 admin
 */

const http = require('http');

const API_BASE = 'http://localhost:8787';

function apiCall(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const req = http.request(
      `${API_BASE}${endpoint}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
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
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  const workId = parseInt(process.argv[2], 10);
  const rating = parseInt(process.argv[3], 10);
  const reviewerId = process.argv[4] || 'admin';

  if (!workId || !rating || rating < 1 || rating > 5) {
    console.log('Usage: node submit-human-review.js <workId> <rating 1-5> [reviewerId]');
    console.log('Example: node submit-human-review.js 57 4 admin');
    process.exit(1);
  }

  // Get work info first
  const queueRes = await apiCall('GET', '/api/admin/phase34/review-queue');
  const work = queueRes.success ? queueRes.queue.find(w => w.workId === workId) : null;

  if (!work) {
    console.log(`Work ${workId} not found in review queue. It may already have a human review or lack a verified watch source.`);
    process.exit(1);
  }

  console.log(`Submitting review for:`);
  console.log(`  Title: ${work.title}`);
  console.log(`  Creator: ${work.creator}`);
  console.log(`  Watch URL: ${work.watchUrl}`);
  console.log(`  Rating: ${rating}/5`);
  console.log(`  Reviewer: ${reviewerId}`);
  console.log();

  const result = await apiCall('POST', '/api/admin/phase34/submit-review', {
    workId,
    reviewerId,
    humanQualityRating: rating,
    humanClassification: 'KEEP',
    reviewNotes: `Real human review: watched full work and rated ${rating}/5`,
    reviewMode: 'blind',
  });

  if (result.success) {
    console.log('✅ Review submitted successfully!');
    console.log(`   Review Origin: ${result.result.reviewOrigin}`);
    console.log(`   Message: ${result.result.message}`);
  } else {
    console.log('❌ Failed:', result.error);
  }

  // Show updated dashboard
  console.log('\n--- Updated Dashboard ---');
  const dashRes = await apiCall('GET', '/api/admin/phase34/dashboard');
  if (dashRes.success) {
    const d = dashRes.dashboard;
    console.log(`Human Reviewed: ${d.humanReviewed}`);
    console.log(`Synthetic Reviewed: ${d.syntheticReviewed}`);
    console.log(`Golden Dataset (Human): ${d.goldenDatasetHuman}`);
    console.log(`Ranking Readiness: ${d.rankingReadiness}`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
