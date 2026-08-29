# Phase 30: Real Seed Pool Deployment Guide

## Overview
Import 31 real, verifiable AI Cinema works from Reply AIFF 2026/2025, AI International Film Festival, and Runway AIFF 2025 into production.

## Pre-Deployment Checklist

1. **Database Schema Verified**
   - `authenticity_status` column exists on `works`
   - `watch_sources` table exists
   - `recognition_events` table exists
   - `data_trust_score` and `data_trust_level` columns exist

2. **Migration Status**
   ```bash
   npx wrangler d1 migrations list ai-film-chart-db --remote
   ```
   Ensure all migrations up to `0007_phase29_golden_dataset.sql` are applied.

## Deployment Steps

### Step 1: Deploy Worker
```bash
cd backend
npx wrangler deploy
```

### Step 2: Verify API Endpoints
```bash
# Test data gaps report (should return empty before import)
curl -H "Authorization: Bearer $ADMIN_SECRET" \
  https://ai-film-chart-api.your-subdomain.workers.dev/api/admin/seed-pool/data-gaps
```

### Step 3: Run Real Seed Import
```bash
curl -X POST -H "Authorization: Bearer $ADMIN_SECRET" \
  https://ai-film-chart-api.your-subdomain.workers.dev/api/admin/seed-pool/import-real-batch-1
```

Expected response:
```json
{
  "success": true,
  "result": {
    "total": 31,
    "imported": 31,
    "skipped": 0,
    "errors": 0,
    "trustAudit": {
      "audited": 31,
      "highTrust": 0,
      "mediumTrust": 15,
      "lowTrust": 16
    },
    "dataGaps": {
      "totalWorks": 31,
      "missingSynopsis": 31,
      "missingDuration": 15,
      "missingCountry": 31,
      "missingLanguage": 31,
      "missingGenre": 31,
      "missingReleaseYear": 19,
      "missingCreator": 0,
      "missingWatchSource": 0,
      "missingRecognition": 0,
      "gapsByWorkCount": 31
    }
  },
  "markdownReport": "# Phase 30: Real Seed Pool Import Report\n..."
}
```

### Step 4: Verify Import
```bash
# Check data gaps report after import
curl -H "Authorization: Bearer $ADMIN_SECRET" \
  https://ai-film-chart-api.your-subdomain.workers.dev/api/admin/seed-pool/data-gaps

# Check Golden Dataset report
curl -H "Authorization: Bearer $ADMIN_SECRET" \
  https://ai-film-chart-api.your-subdomain.workers.dev/api/admin/golden-dataset/report
```

### Step 5: Backfill Missing Metadata (Manual)
Use the Data Gaps report to identify works needing metadata enrichment:

| Field | Missing Count | Action |
|-------|--------------|--------|
| synopsis | 31 | Research festival pages, IMDB, creator sites |
| duration | 15 | Check festival screening info, Vimeo/YouTube |
| country | 31 | Research creator origin, production location |
| language | 31 | Check festival submissions, audio tracks |
| genre | 31 | Classify by synopsis and festival category |
| release_year | 19 | Check festival year, premiere date |

Update via Admin API:
```bash
curl -X PUT -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"synopsis": "...", "duration_seconds": 480, "country": "US", ...}' \
  https://ai-film-chart-api.your-subdomain.workers.dev/api/admin/works/{work_id}
```

### Step 6: Re-run Trust Audit After Backfill
After metadata enrichment, re-audit to upgrade trust levels:
```bash
curl -X POST -H "Authorization: Bearer $ADMIN_SECRET" \
  https://ai-film-chart-api.your-subdomain.workers.dev/api/admin/data-trust/audit-all
```

## Data Structure

### Works Created (31 entries)
- **Reply AIFF 2026**: 8 finalists
- **Reply AIFF 2025**: 4 winners/finalists
- **AI International Film Festival**: 14 award winners
- **Runway AIFF 2025**: 5 winners/selections

### Recognition Events Created
Each work has 1-2 recognition events with `verification_status = 'VERIFIED'`.

### Watch Sources Created
Each work has at least 1 verified watch source (festival screening page).

## Rollback Plan

If import needs to be rolled back:
```sql
-- Delete imported works and related data
DELETE FROM watch_sources WHERE work_id IN (
  SELECT w.id FROM works w
  JOIN data_provenance dp ON w.id = dp.work_id
  WHERE dp.data_value LIKE '%Phase 30 real seed import%'
);
DELETE FROM recognition_events WHERE work_id IN (...);
DELETE FROM recognition_signals WHERE work_id IN (...);
DELETE FROM data_provenance WHERE work_id IN (...);
DELETE FROM work_sources WHERE work_id IN (...);
DELETE FROM works WHERE id IN (...);
```

## Post-Deployment Monitoring

1. **Golden Dataset Eligibility**: Check how many imported works qualify
2. **Trust Score Distribution**: Monitor HIGH/MEDIUM/LOW ratios
3. **Data Gap Closure**: Track metadata enrichment progress
4. **Ranking Impact**: Verify new works appear correctly in rankings
