import type { D1Database } from '@cloudflare/workers-types';
import { FilmModel } from '../models/film';
import { RankingModel } from '../models/ranking';
import { JobModel } from '../models/job';
import { RankingEngineV2 } from '../ranking/ranking-engine-v2';
import { ShadowRankingEngine } from '../ranking/shadow-ranking-engine';
import { MOCK_FILMS, generateMockMetrics, generateMockAIAnalysis } from '../utils/mock-data';
import { AdminAuditModel } from '../models/admin-audit';
import { SeedImportService } from '../services/seed-import-service';
import { SourceManagementService } from '../services/source-management-service';
import { DataProvenanceService } from '../services/data-provenance-service';
import { RecognitionSignalService } from '../services/recognition-signal-service';
import { SeedPoolValidator } from '../services/seed-pool-validator';
import { RankingValidationService } from '../services/ranking-validation-service';
import { RankingConflictService } from '../services/ranking-conflict-service';
import { ImportAuditService } from '../services/import-audit-service';
import { RankMovementService } from '../services/rank-movement-service';
import { RankingLaboratoryReportService } from '../services/ranking-laboratory-report-service';
import { DataTrustAuditService } from '../services/data-trust-audit-service';
import { SourceAuthenticityService } from '../services/source-authenticity-service';
import { Phase28ReportService } from '../services/phase28-report-service';
import { Phase31DataEnrichmentService } from '../services/phase31-data-enrichment-service';
import { Phase32RealDataCompletionService } from '../services/phase32-real-data-completion-service';
import { Phase33HumanReviewService } from '../services/phase33-human-review-service';
import { Phase34ReviewCleanupService } from '../services/phase34-review-cleanup-service';
import { Phase35InitialPoolService } from '../services/phase35-initial-pool-service';
import { AdminCrudService } from '../services/admin-crud-service';
import { ThumbnailService } from '../services/thumbnail-service';
import { AIFilmCrawler } from '../services/ai-film-crawler';
import { GoldenDatasetService } from '../services/golden-dataset-service';
import { HumanBaselineService } from '../services/human-baseline-service';
import { WorkService } from '../works';
import { ContentEligibilityService } from '../eligibility';
import {
  PopularityOnlyEngine,
  PopularityAudienceEngine,
  FullRankingEngine,
} from '../ranking/experimental-ranking-engines';

export interface Env {
  DB: D1Database;
  AI: any;
  YOUTUBE_API_KEY?: string;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
  ADMIN_SECRET?: string;
}

export async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    // Public API routes
    if (path === '/api/rankings/top100' && request.method === 'GET') {
      return await getRanking(env.DB, 'top100', headers);
    }

    if (path === '/api/rankings/rising50' && request.method === 'GET') {
      return await getRanking(env.DB, 'rising50', headers);
    }

    if (path === '/api/rankings/new50' && request.method === 'GET') {
      return await getRanking(env.DB, 'new50', headers);
    }

    if (path.startsWith('/api/films/') && request.method === 'GET') {
      const filmId = parseInt(path.split('/').pop() || '', 10);
      if (!isNaN(filmId)) {
        return await getFilmDetail(env.DB, filmId, headers);
      }
    }

    if (path === '/api/films' && request.method === 'GET') {
      return await getFilms(env.DB, url, headers);
    }

    // Public rating API (no auth required for visitors)
    if (path.startsWith('/api/films/') && path.endsWith('/rate') && request.method === 'POST') {
      const filmId = parseInt(path.split('/')[3] || '', 10);
      if (!isNaN(filmId)) {
        return await submitRating(env.DB, request, filmId, headers);
      }
    }

    // Admin API routes
    if (path.startsWith('/api/admin/')) {
      const authHeader = request.headers.get('Authorization');
      if (!isAdminAuthorized(authHeader, env.ADMIN_SECRET)) {
        return jsonResponse({ error: 'Unauthorized' }, 401, headers);
      }

      if (path === '/api/admin/dashboard' && request.method === 'GET') {
        return await getAdminDashboard(env.DB, headers);
      }

      if (path === '/api/admin/candidates' && request.method === 'GET') {
        return await getCandidates(env.DB, url, headers);
      }

      if (path === '/api/admin/candidates/:id/approve' && request.method === 'POST') {
        const id = parseInt(path.split('/')[4], 10);
        return await updateCandidateStatus(env.DB, id, 'approved', headers, request);
      }

      if (path === '/api/admin/candidates/:id/reject' && request.method === 'POST') {
        const id = parseInt(path.split('/')[4], 10);
        return await updateCandidateStatus(env.DB, id, 'rejected', headers, request);
      }

      if (path === '/api/admin/candidates/:id/exclude' && request.method === 'POST') {
        const id = parseInt(path.split('/')[4], 10);
        return await updateCandidateStatus(env.DB, id, 'excluded', headers, request);
      }

      if (path === '/api/admin/candidates/:id/restore' && request.method === 'POST') {
        const id = parseInt(path.split('/')[4], 10);
        return await updateCandidateStatus(env.DB, id, 'pending', headers, request);
      }

      if (path === '/api/admin/audit-logs' && request.method === 'GET') {
        return await getAdminAuditLogs(env.DB, headers);
      }

      if (path === '/api/admin/jobs' && request.method === 'GET') {
        return await getJobs(env.DB, headers);
      }

      if (path === '/api/admin/run-discovery' && request.method === 'POST') {
        return await runDiscovery(env.DB, headers, env);
      }

      if (path === '/api/admin/run-ranking' && request.method === 'POST') {
        return await runRanking(env.DB, headers);
      }

      if (path === '/api/admin/seed-mock-data' && request.method === 'POST') {
        return await seedMockData(env.DB, headers);
      }

      // Phase 19-25: New Admin APIs (legacy - use Admin CRUD below instead)
      // NOTE: /api/admin/works GET is now handled by getAdminWorksList in the Admin CRUD section below

      if (path === '/api/admin/works' && request.method === 'POST') {
        return await createWork(env.DB, request, headers);
      }

      if (path === '/api/admin/works/import' && request.method === 'POST') {
        return await importSeedWorks(env.DB, request, headers);
      }

      if (path.startsWith('/api/admin/works/') && path.endsWith('/sources') && request.method === 'GET') {
        const id = parseInt(path.split('/')[4], 10);
        return await getWorkSources(env.DB, id, headers);
      }

      if (path.startsWith('/api/admin/works/') && path.endsWith('/merge') && request.method === 'POST') {
        const id = parseInt(path.split('/')[4], 10);
        return await mergeWork(env.DB, id, request, headers);
      }

      if (path.startsWith('/api/admin/works/') && path.endsWith('/review') && request.method === 'POST') {
        const id = parseInt(path.split('/')[4], 10);
        return await updateWorkReview(env.DB, id, request, headers);
      }

      if (path === '/api/admin/sources' && request.method === 'GET') {
        return await getDataSources(env.DB, headers);
      }

      if (path === '/api/admin/sources/:id/toggle' && request.method === 'POST') {
        const sourceId = path.split('/')[4];
        return await toggleDataSource(env.DB, sourceId, headers);
      }

      if (path === '/api/admin/ranking/shadow' && request.method === 'GET') {
        return await getShadowRanking(env.DB, headers);
      }

      if (path === '/api/admin/ranking/compare' && request.method === 'GET') {
        return await compareRankings(env.DB, headers);
      }

      if (path === '/api/admin/validation/seed-pool' && request.method === 'GET') {
        return await validateSeedPool(env.DB, headers);
      }

      if (path === '/api/admin/recognition' && request.method === 'POST') {
        return await addRecognitionSignal(env.DB, request, headers);
      }

      if (path === '/api/admin/provenance/:workId' && request.method === 'GET') {
        const workId = parseInt(path.split('/')[4], 10);
        return await getProvenance(env.DB, workId, headers);
      }

      // Phase 26: Seed Review & Experimental Rankings
      if (path === '/api/admin/seed-review' && request.method === 'GET') {
        return await getSeedReview(env.DB, url, headers);
      }

      if (path === '/api/admin/ranking/experimental' && request.method === 'GET') {
        return await getExperimentalRankings(env.DB, url, headers);
      }

      if (path === '/api/admin/ranking/validation' && request.method === 'GET') {
        return await getRankingValidation(env.DB, headers);
      }

      if (path === '/api/admin/seed-pool/import-batch-1' && request.method === 'POST') {
        return await importSeedPoolBatch1Handler(env.DB, headers);
      }

      if (path === '/api/admin/seed-pool/import-batch-2' && request.method === 'POST') {
        return await importSeedPoolBatch2Handler(env.DB, headers);
      }

      // Phase 30: Real Seed Pool Import
      if (path === '/api/admin/seed-pool/import-real-batch-1' && request.method === 'POST') {
        return await importRealSeedPoolBatch1Handler(env.DB, headers);
      }

      if (path === '/api/admin/seed-pool/data-gaps' && request.method === 'GET') {
        return await getDataGapsReport(env.DB, headers);
      }

      // Phase 31: Data Enrichment & Source Correction
      if (path === '/api/admin/phase31/run-enrichment' && request.method === 'POST') {
        return await runPhase31Enrichment(env.DB, headers);
      }

      if (path === '/api/admin/phase31/report' && request.method === 'GET') {
        return await getPhase31Report(env.DB, headers);
      }

      // Phase 32: Real Data Completion
      if (path === '/api/admin/phase32/run-completion' && request.method === 'POST') {
        return await runPhase32Completion(env.DB, headers);
      }

      if (path === '/api/admin/phase32/report' && request.method === 'GET') {
        return await getPhase32Report(env.DB, headers);
      }

      // Phase 33: Human Review & Watch Source Completion
      if (path === '/api/admin/phase33/run-pipeline' && request.method === 'POST') {
        return await runPhase33Pipeline(env.DB, headers);
      }

      if (path === '/api/admin/phase33/report' && request.method === 'GET') {
        return await getPhase33Report(env.DB, headers);
      }

      if (path === '/api/admin/phase33/review-progress' && request.method === 'GET') {
        return await getPhase33ReviewProgress(env.DB, headers);
      }

      if (path === '/api/admin/phase33/quality-distribution' && request.method === 'GET') {
        return await getPhase33QualityDistribution(env.DB, headers);
      }

      if (path === '/api/admin/phase33/ranking-readiness' && request.method === 'GET') {
        return await getPhase33RankingReadiness(env.DB, headers);
      }

      if (path === '/api/admin/phase33/dashboard' && request.method === 'GET') {
        return await getPhase33Dashboard(env.DB, headers);
      }

      if (path === '/api/admin/phase33/experimental-ranking' && request.method === 'GET') {
        return await getPhase33ExperimentalRanking(env.DB, headers);
      }

      if (path === '/api/admin/phase33/human-audit' && request.method === 'GET') {
        return await getPhase33HumanAudit(env.DB, headers);
      }

      // Phase 34: Synthetic Review Cleanup & Real Review Preparation
      if (path === '/api/admin/phase34/run-cleanup' && request.method === 'POST') {
        return await runPhase34Cleanup(env.DB, headers);
      }

      if (path === '/api/admin/phase34/report' && request.method === 'GET') {
        return await getPhase34Report(env.DB, headers);
      }

      if (path === '/api/admin/phase34/review-queue' && request.method === 'GET') {
        return await getPhase34ReviewQueue(env.DB, headers);
      }

      if (path === '/api/admin/phase34/submit-review' && request.method === 'POST') {
        return await submitPhase34Review(request, env.DB, headers);
      }

      if (path === '/api/admin/phase34/dashboard' && request.method === 'GET') {
        return await getPhase34Dashboard(env.DB, headers);
      }

if (path === '/api/admin/phase34/ranking-readiness' && request.method === 'GET') {
return await getPhase34RankingReadiness(env.DB, headers);
}

// Phase 35: Initial 100 Works & Global Discovery
if (path === '/api/admin/phase35/run-pipeline' && request.method === 'POST') {
return await runPhase35Pipeline(env.DB, headers);
}

if (path === '/api/admin/phase35/report' && request.method === 'GET') {
return await getPhase35Report(env.DB, headers);
}

if (path === '/api/admin/phase35/pool-status' && request.method === 'GET') {
return await getPhase35PoolStatus(env.DB, headers);
}

if (path === '/api/admin/phase35/reaudit' && request.method === 'POST') {
return await reauditExistingWorks(env.DB, headers);
}

if (path === '/api/admin/phase35/update-golden-rules' && request.method === 'POST') {
return await updateGoldenDatasetRules(env.DB, headers);
}

if (path === '/api/admin/phase35/seed-discovery' && request.method === 'POST') {
return await seedDiscoveryCandidates(env.DB, headers);
}

      // Admin CRUD APIs
      if (path === '/api/admin/works' && request.method === 'GET') {
        return await getAdminWorksList(env.DB, headers);
      }

      if (path.startsWith('/api/admin/works/') && request.method === 'PUT') {
        const workId = parseInt(path.split('/')[4], 10);
        return await updateAdminWork(request, env.DB, headers, workId);
      }

      if (path.startsWith('/api/admin/works/') && request.method === 'DELETE' && !path.endsWith('/review')) {
        const workId = parseInt(path.split('/')[4], 10);
        return await requestDeleteAdminWork(request, env.DB, headers, workId);
      }

      if (path.startsWith('/api/admin/works/') && request.method === 'POST' && path.endsWith('/confirm-delete')) {
        const workId = parseInt(path.split('/')[4], 10);
        return await confirmDeleteAdminWork(request, env.DB, headers, workId);
      }

      if (path.startsWith('/api/admin/works/') && request.method === 'POST' && path.endsWith('/cancel-delete')) {
        const workId = parseInt(path.split('/')[4], 10);
        return await cancelDeleteAdminWork(request, env.DB, headers, workId);
      }

      if (path.startsWith('/api/admin/works/') && request.method === 'POST' && path.endsWith('/restore')) {
        const workId = parseInt(path.split('/')[4], 10);
        return await restoreAdminWork(request, env.DB, headers, workId);
      }

      if (path === '/api/admin/watch-sources' && request.method === 'POST') {
        return await addAdminWatchSource(request, env.DB, headers);
      }

      if (path.startsWith('/api/admin/watch-sources/') && request.method === 'PUT') {
        const sourceId = parseInt(path.split('/')[4], 10);
        return await updateAdminWatchSource(request, env.DB, headers, sourceId);
      }

      if (path.startsWith('/api/admin/watch-sources/') && request.method === 'DELETE') {
        const sourceId = parseInt(path.split('/')[4], 10);
        return await deleteAdminWatchSource(request, env.DB, headers, sourceId);
      }

      if (path.startsWith('/api/admin/works/') && request.method === 'PUT' && path.endsWith('/review')) {
        const workId = parseInt(path.split('/')[4], 10);
        return await updateAdminReview(request, env.DB, headers, workId);
      }

      if (path.startsWith('/api/admin/works/') && request.method === 'DELETE' && path.endsWith('/review')) {
        const workId = parseInt(path.split('/')[4], 10);
        return await clearAdminReview(request, env.DB, headers, workId);
      }

      if (path.startsWith('/api/admin/works/') && request.method === 'GET' && path.endsWith('/audit-log')) {
        const workId = parseInt(path.split('/')[4], 10);
        return await getAdminWorkAuditLog(env.DB, headers, workId);
      }

      // Thumbnail generation APIs
      if (path === '/api/admin/thumbnails/generate-all' && request.method === 'POST') {
        return await generateAllThumbnails(env, headers);
      }

      if (path.startsWith('/api/admin/works/') && request.method === 'POST' && path.endsWith('/generate-thumbnail')) {
        const workId = parseInt(path.split('/')[4], 10);
        return await generateWorkThumbnail(env, headers, workId);
      }

      if (path.startsWith('/api/admin/works/') && request.method === 'PUT' && path.endsWith('/poster')) {
        const workId = parseInt(path.split('/')[4], 10);
        return await updateWorkPoster(request, env.DB, headers, workId);
      }

      // AI Film Crawler APIs
      if (path === '/api/admin/crawler/run' && request.method === 'POST') {
        return await runCrawler(env, headers);
      }

      if (path === '/api/admin/crawler/status' && request.method === 'GET') {
        return await getCrawlerStatus(env.DB, headers);
      }

      // Phase 27: Ranking Laboratory APIs
      if (path === '/api/admin/import-audit' && request.method === 'POST') {
        return await runImportAudit(env.DB, request, headers);
      }

      if (path === '/api/admin/ranking/conflicts' && request.method === 'GET') {
        return await getRankingConflicts(env.DB, headers);
      }

      if (path === '/api/admin/ranking/movement' && request.method === 'GET') {
        return await getRankMovement(env.DB, headers);
      }

      if (path === '/api/admin/ranking/laboratory-report' && request.method === 'GET') {
        return await getLaboratoryReport(env.DB, headers);
      }

      if (path === '/api/admin/quality-distribution' && request.method === 'GET') {
        return await getQualityDistribution(env.DB, headers);
      }

      if (path === '/api/admin/source-diversity' && request.method === 'GET') {
        return await getSourceDiversityReport(env.DB, headers);
      }

      // Phase 28: Data Trust & Audit APIs
      if (path === '/api/admin/data-trust/audit' && request.method === 'POST') {
        return await runDataTrustAudit(env.DB, request, headers);
      }

      if (path === '/api/admin/data-trust/distribution' && request.method === 'GET') {
        return await getDataTrustDistribution(env.DB, headers);
      }

      if (path === '/api/admin/authenticity/check' && request.method === 'POST') {
        return await runAuthenticityCheck(env.DB, request, headers);
      }

      if (path === '/api/admin/authenticity/synthetic' && request.method === 'GET') {
        return await getSyntheticStats(env.DB, headers);
      }

      if (path.startsWith('/api/admin/works/') && path.endsWith('/blind-review') && request.method === 'GET') {
        const id = parseInt(path.split('/')[4], 10);
        return await getBlindReview(env.DB, id, headers);
      }

      if (path === '/api/admin/phase28-report' && request.method === 'GET') {
        return await getPhase28Report(env.DB, headers);
      }

      // Phase 29: Golden Dataset APIs
      if (path === '/api/admin/golden-dataset/evaluate' && request.method === 'POST') {
        return await evaluateGoldenDataset(env.DB, request, headers);
      }

      if (path === '/api/admin/golden-dataset/report' && request.method === 'GET') {
        return await getGoldenDatasetReport(env.DB, headers);
      }

      if (path === '/api/admin/golden-dataset/update' && request.method === 'POST') {
        return await updateGoldenDataset(env.DB, headers);
      }

      if (path === '/api/admin/human-baseline/submit' && request.method === 'POST') {
        return await submitHumanBaseline(env.DB, request, headers);
      }

      if (path === '/api/admin/human-baseline/ranking' && request.method === 'GET') {
        return await getHumanBaselineRanking(env.DB, url, headers);
      }

      if (path === '/api/admin/human-baseline/agreement' && request.method === 'GET') {
        return await getReviewerAgreement(env.DB, url, headers);
      }

      if (path === '/api/admin/human-baseline/correlation' && request.method === 'GET') {
        return await getHumanAlgorithmCorrelation(env.DB, url, headers);
      }

      if (path === '/api/admin/watch-sources' && request.method === 'POST') {
        return await addWatchSource(env.DB, request, headers);
      }

      if (path.startsWith('/api/admin/works/') && path.endsWith('/watch-sources') && request.method === 'GET') {
        const id = parseInt(path.split('/')[4], 10);
        return await getWorkWatchSources(env.DB, id, headers);
      }
    }

    return jsonResponse({ error: 'Not found' }, 404, headers);
  } catch (error) {
    console.error('API Error:', error);
    return jsonResponse(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      500,
      headers
    );
  }
}

function isAdminAuthorized(authHeader: string | null, adminSecret: string | undefined): boolean {
  if (!adminSecret) return true; // Allow if no secret configured (dev mode)
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '');
  return token === adminSecret;
}

function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

async function getRanking(db: D1Database, type: string, headers: Record<string, string>): Promise<Response> {
  const rankingModel = new RankingModel(db);
  const snapshot = await rankingModel.getLatestSnapshot(type);

  if (!snapshot) {
    return jsonResponse({ error: 'No snapshot available' }, 404, headers);
  }

  const data = await rankingModel.getSnapshotWithItems(snapshot.id);
  return jsonResponse({
    snapshot: data?.snapshot,
    items: data?.items || [],
  }, 200, headers);
}

async function getFilmDetail(db: D1Database, filmId: number, headers: Record<string, string>): Promise<Response> {
  const filmModel = new FilmModel(db);
  const film = await filmModel.findById(filmId);

  if (!film) {
    return jsonResponse({ error: 'Film not found' }, 404, headers);
  }

  const metrics = await filmModel.getLatestMetrics(filmId);
  const aiAnalysis = await filmModel.getLatestAIAnalysis(filmId);

  // Get latest ranking score for this film
  const { results: scoreResults } = await db
    .prepare(`
      SELECT final_score, popularity_score, momentum_score, engagement_score, audience_score, quality_score
      FROM ranking_scores
      WHERE film_id = ?
      ORDER BY calculated_at DESC
      LIMIT 1
    `)
    .bind(filmId)
    .all<{ final_score: number; popularity_score: number; momentum_score: number; engagement_score: number; audience_score: number; quality_score: number }>();
  const score = scoreResults?.[0] || null;

  // Get average user rating
  const { results: ratingResults } = await db
    .prepare('SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM ratings WHERE film_id = ?')
    .bind(filmId)
    .all<{ avg_rating: number; count: number }>();
  const userRating = ratingResults?.[0] || null;

  return jsonResponse({
    film,
    metrics,
    aiAnalysis,
    score,
    userRating: userRating ? { average: userRating.avg_rating || 0, count: userRating.count } : null,
  }, 200, headers);
}

async function submitRating(db: D1Database, request: Request, filmId: number, headers: Record<string, string>): Promise<Response> {
  try {
    const body = await request.json() as { rating: number; userId?: string };
    const rating = body.rating;

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return jsonResponse({ error: 'Rating must be between 1 and 5' }, 400, headers);
    }

    // Convert 1-5 rating to 0-10 scale for storage
    const normalizedRating = rating * 2;

    // Use IP-based anonymous user id if no userId provided
    const userIdentifier = body.userId || `anon_${request.headers.get('CF-Connecting-IP') || 'unknown'}_${filmId}`;

    // Insert or replace rating (allow re-rating)
    await db.prepare(`
      INSERT INTO ratings (user_id, film_id, rating, review)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, film_id) DO UPDATE SET
        rating = excluded.rating,
        updated_at = CURRENT_TIMESTAMP
    `).bind(userIdentifier, filmId, normalizedRating, '').run();

    // Get updated average
    const { results } = await db
      .prepare('SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM ratings WHERE film_id = ?')
      .bind(filmId)
      .all<{ avg_rating: number; count: number }>();

    const avg = results?.[0];
    return jsonResponse({
      success: true,
      rating,
      average: avg ? (avg.avg_rating / 2).toFixed(1) : null,
      count: avg?.count || 0,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({ error: 'Failed to submit rating' }, 500, headers);
  }
}

async function getFilms(db: D1Database, url: URL, headers: Record<string, string>): Promise<Response> {
  const filmModel = new FilmModel(db);
  const status = url.searchParams.get('status') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const films = await filmModel.findAll({ status, limit, offset });
  return jsonResponse({ films }, 200, headers);
}

async function getAdminDashboard(db: D1Database, headers: Record<string, string>): Promise<Response> {
  const filmModel = new FilmModel(db);
  const jobModel = new JobModel(db);

  const allFilms = await filmModel.findAll();
  const pendingCount = allFilms.filter(f => f.status === 'pending').length;
  const approvedCount = allFilms.filter(f => f.status === 'approved').length;
  const rejectedCount = allFilms.filter(f => f.status === 'rejected').length;

  const recentJobs = await jobModel.getRecentJobs(10);

  return jsonResponse({
    stats: {
      totalFilms: allFilms.length,
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
    },
    recentJobs,
  }, 200, headers);
}

async function getCandidates(db: D1Database, url: URL, headers: Record<string, string>): Promise<Response> {
  const filmModel = new FilmModel(db);
  const status = url.searchParams.get('status') || 'pending';
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  const films = await filmModel.findAll({ status, limit });
  return jsonResponse({ candidates: films }, 200, headers);
}

async function updateCandidateStatus(db: D1Database, id: number, status: string, headers: Record<string, string>, request: Request): Promise<Response> {
  const filmModel = new FilmModel(db);
  const auditModel = new AdminAuditModel(db);

  const previousStatus = await filmModel.getFilmStatus(id);
  if (!previousStatus) {
    return jsonResponse({ error: 'Film not found' }, 404, headers);
  }

  await filmModel.updateStatus(id, status);

  // Parse reason from request body if provided
  let reason = 'Admin action';
  try {
    const body = await request.clone().json() as { reason?: string };
    if (body.reason) reason = body.reason;
  } catch {
    // No body or invalid JSON, use default reason
  }

  // Log the action
  await auditModel.create({
    film_id: id,
    action: status as 'exclude' | 'restore' | 'reject' | 'approve',
    previous_status: previousStatus,
    new_status: status,
    reason,
    operator: 'admin', // In production, extract from auth token
  });

  return jsonResponse({ success: true, id, status, previousStatus }, 200, headers);
}

async function getAdminAuditLogs(db: D1Database, headers: Record<string, string>): Promise<Response> {
  const auditModel = new AdminAuditModel(db);
  const logs = await auditModel.getRecentLogs(50);
  return jsonResponse({ logs }, 200, headers);
}

async function getJobs(db: D1Database, headers: Record<string, string>): Promise<Response> {
  const jobModel = new JobModel(db);
  const jobs = await jobModel.getRecentJobs(50);
  return jsonResponse({ jobs }, 200, headers);
}

async function runDiscovery(db: D1Database, headers: Record<string, string>, env: Env): Promise<Response> {
  const jobModel = new JobModel(db);
  const jobId = `discovery_${Date.now()}`;

  await jobModel.create({
    job_id: jobId,
    type: 'discovery',
    status: 'processing',
    cursor: null,
    batch_size: 20,
    progress: 0,
    error_message: null,
  });

  // Execute discovery job immediately (non-blocking)
  if (env.YOUTUBE_API_KEY) {
    // Use waitUntil to run job in background
    // Note: In Cloudflare Workers, we can't use waitUntil in fetch handler
    // So we run it synchronously but with a timeout
    try {
      const { runDiscoveryJob } = await import('../jobs/discovery-job');
      await runDiscoveryJob(db, env.YOUTUBE_API_KEY, jobId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Discovery failed';
      await jobModel.updateStatus(jobId, 'failed', errorMessage);
      return jsonResponse({ success: false, jobId, error: errorMessage }, 500, headers);
    }
  } else {
    await jobModel.updateStatus(jobId, 'failed', 'YOUTUBE_API_KEY not configured');
    return jsonResponse({ success: false, jobId, error: 'YOUTUBE_API_KEY not configured' }, 500, headers);
  }

  return jsonResponse({ success: true, jobId }, 200, headers);
}

async function runRanking(db: D1Database, headers: Record<string, string>): Promise<Response> {
  const rankingModel = new RankingModel(db);
  const filmModel = new FilmModel(db);
  const jobModel = new JobModel(db);

  const jobId = `ranking_${Date.now()}`;
  await jobModel.create({
    job_id: jobId,
    type: 'ranking',
    status: 'processing',
    cursor: null,
    batch_size: 100,
    progress: 0,
    error_message: null,
  });

  try {
    const config = await rankingModel.getLatestConfig();
    if (!config) {
      await jobModel.updateStatus(jobId, 'failed', 'No ranking config found');
      return jsonResponse({ error: 'No ranking config found' }, 500, headers);
    }

    await jobModel.updateProgress(jobId, 10, 'loading_films');

    const films = await filmModel.findAll({ status: 'approved' });

    if (films.length === 0) {
      await jobModel.updateStatus(jobId, 'failed', 'No approved films to rank');
      return jsonResponse({ error: 'No approved films to rank' }, 400, headers);
    }

    await jobModel.updateProgress(jobId, 30, 'calculating');

    const engine = new RankingEngineV2(config);
    const scores = await engine.runRanking(db, films, config.version);

    await jobModel.updateProgress(jobId, 60, 'saving_scores');

    // Save scores
    await rankingModel.saveScores(scores);

    await jobModel.updateProgress(jobId, 70, 'creating_snapshots');

    const now = new Date();
    const periodStart = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // TOP 100 snapshot
    const top100Scores = scores.slice(0, 100);
    const top100SnapshotId = await rankingModel.createSnapshot(
      'top100',
      config.version,
      periodStart.toISOString(),
      now.toISOString()
    );

    const top100Items = await Promise.all(
      top100Scores.map(async (score, index) => {
        const previousRank = await rankingModel.getPreviousRank(score.film_id, 'top100');
        return {
          snapshot_id: top100SnapshotId,
          film_id: score.film_id,
          rank: index + 1,
          previous_rank: previousRank,
          score: score.final_score,
          rank_change: previousRank ? previousRank - (index + 1) : 0,
          is_new: previousRank === null,
        };
      })
    );

    await rankingModel.addSnapshotItems(top100Items);

    // RISING 50 snapshot (sort by momentum)
    const risingScores = [...scores].sort((a, b) => b.momentum_score - a.momentum_score).slice(0, 50);
    const risingSnapshotId = await rankingModel.createSnapshot(
      'rising50',
      config.version,
      periodStart.toISOString(),
      now.toISOString()
    );

    const risingItems = await Promise.all(
      risingScores.map(async (score, index) => {
        const previousRank = await rankingModel.getPreviousRank(score.film_id, 'rising50');
        return {
          snapshot_id: risingSnapshotId,
          film_id: score.film_id,
          rank: index + 1,
          previous_rank: previousRank,
          score: score.momentum_score,
          rank_change: previousRank ? previousRank - (index + 1) : 0,
          is_new: previousRank === null,
        };
      })
    );

    await rankingModel.addSnapshotItems(risingItems);

    // NEW 50 snapshot (most recently added approved films)
    const newFilms = films
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);

    const newSnapshotId = await rankingModel.createSnapshot(
      'new50',
      config.version,
      periodStart.toISOString(),
      now.toISOString()
    );

    const newItems = await Promise.all(
      newFilms.map(async (film, index) => {
        const score = scores.find(s => s.film_id === film.id);
        const previousRank = await rankingModel.getPreviousRank(film.id, 'new50');
        return {
          snapshot_id: newSnapshotId,
          film_id: film.id,
          rank: index + 1,
          previous_rank: previousRank,
          score: score?.final_score || 0,
          rank_change: previousRank ? previousRank - (index + 1) : 0,
          is_new: previousRank === null,
        };
      })
    );

    await rankingModel.addSnapshotItems(newItems);

    await jobModel.updateStatus(jobId, 'completed');
    await jobModel.updateProgress(jobId, 100, undefined);

    return jsonResponse({
      success: true,
      filmsRanked: scores.length,
      top100SnapshotId,
      risingSnapshotId,
      newSnapshotId,
      jobId,
    }, 200, headers);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Ranking failed';
    await jobModel.updateStatus(jobId, 'failed', errorMessage);
    return jsonResponse({ error: 'Ranking failed', message: errorMessage }, 500, headers);
  }
}

async function seedMockData(db: D1Database, headers: Record<string, string>): Promise<Response> {
  const filmModel = new FilmModel(db);
  const results = [];

  for (const mockFilm of MOCK_FILMS) {
    try {
      const existing = await filmModel.findBySourceVideoId(mockFilm.source_video_id);
      if (existing) {
        results.push({ source_video_id: mockFilm.source_video_id, status: 'skipped' });
        continue;
      }

      const filmId = await filmModel.create(mockFilm);

      // Add metrics
      const metrics = generateMockMetrics(filmId, mockFilm.source_video_id);
      for (const metric of metrics) {
        await filmModel.addMetrics(filmId, {
          views: metric.views,
          likes: metric.likes,
          comments: metric.comments,
        });
      }

      // Add AI analysis
      const analysis = generateMockAIAnalysis(filmId, mockFilm.source_video_id);
      if (analysis) {
        await filmModel.addAIAnalysis(analysis);
      }

      results.push({ source_video_id: mockFilm.source_video_id, status: 'created', filmId });
    } catch (error) {
      results.push({
        source_video_id: mockFilm.source_video_id,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return jsonResponse({ success: true, results }, 200, headers);
}

// ==================== Phase 19-25: New Admin Handlers ====================

async function getWorks(db: D1Database, url: URL, headers: Record<string, string>): Promise<Response> {
  const workService = new WorkService(db);
  const type = url.searchParams.get('type') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const works = await workService.listWorks({ type: type as any, limit, offset });
  return jsonResponse({ works }, 200, headers);
}

async function createWork(db: D1Database, request: Request, headers: Record<string, string>): Promise<Response> {
  const workService = new WorkService(db);
  const eligibilityService = new ContentEligibilityService();

  try {
    const body = await request.json() as {
      title: string;
      type: string;
      synopsis?: string;
      director?: string;
      durationSeconds?: number;
      releaseYear?: number;
      country?: string;
      sources?: { type: string; url: string }[];
    };

    // Run eligibility check
    const eligibility = await eligibilityService.evaluate({
      title: body.title,
      description: body.synopsis || '',
      durationSeconds: body.durationSeconds,
    });

    if (!eligibility.eligible) {
      return jsonResponse({
        success: false,
        eligible: false,
        rejectReason: eligibility.rejectReason,
        confidence: eligibility.confidence,
      }, 400, headers);
    }

    const work = await workService.createWork({
      canonicalTitle: body.title,
      type: body.type as any,
      synopsis: body.synopsis,
      creatorName: body.director,
      durationSeconds: body.durationSeconds,
      releaseYear: body.releaseYear,
      country: body.country,
    });

    // Add sources
    if (body.sources) {
      for (const source of body.sources) {
        await workService.addWorkSource({
          workId: work.id,
          sourceType: source.type,
          canonicalUrl: source.url,
        });
      }
    }

    return jsonResponse({ success: true, work, eligibility }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function importSeedWorks(db: D1Database, request: Request, headers: Record<string, string>): Promise<Response> {
  const seedService = new SeedImportService(db);

  try {
    const body = await request.json() as {
      format: 'csv' | 'json';
      data: string;
    };

    let entries;
    if (body.format === 'csv') {
      entries = seedService.parseCSV(body.data);
    } else {
      entries = seedService.parseJSON(body.data);
    }

    const result = await seedService.importBatch(entries, 'admin');

    return jsonResponse({ success: true, result }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getWorkSources(db: D1Database, workId: number, headers: Record<string, string>): Promise<Response> {
  const workService = new WorkService(db);
  const sources = await workService.getWorkSources(workId);
  return jsonResponse({ workId, sources }, 200, headers);
}

async function mergeWork(db: D1Database, targetWorkId: number, request: Request, headers: Record<string, string>): Promise<Response> {
  const workService = new WorkService(db);

  try {
    const body = await request.json() as { sourceWorkId: number; reason: string };
    await workService.mergeWorks(targetWorkId, body.sourceWorkId, body.reason);

    return jsonResponse({
      success: true,
      message: `Merged work ${body.sourceWorkId} into ${targetWorkId}`,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getDataSources(db: D1Database, headers: Record<string, string>): Promise<Response> {
  const sourceService = new SourceManagementService(db);
  const sources = await sourceService.getAllSources();
  const stats = await sourceService.getStats();

  return jsonResponse({ sources, stats }, 200, headers);
}

async function toggleDataSource(db: D1Database, sourceId: string, headers: Record<string, string>): Promise<Response> {
  const sourceService = new SourceManagementService(db);
  const source = await sourceService.getSource(sourceId);

  if (!source) {
    return jsonResponse({ error: 'Source not found' }, 404, headers);
  }

  const newStatus = source.status === 'active' ? 'paused' : 'active';
  await sourceService.updateStatus(sourceId, newStatus);

  return jsonResponse({ success: true, sourceId, newStatus }, 200, headers);
}

async function getShadowRanking(db: D1Database, headers: Record<string, string>): Promise<Response> {
  const engine = new ShadowRankingEngine(db);

  // Get all approved works
  const workService = new WorkService(db);
  const works = await workService.listWorks({ eligibilityStatus: 'approved' as any });
  const workIds = works.map(w => w.id);

  if (workIds.length === 0) {
    return jsonResponse({ error: 'No approved works found' }, 400, headers);
  }

  const { rankings } = await engine.calculateExperimentalRanking(workIds);

  return jsonResponse({
    version: 'v0.2',
    totalWorks: workIds.length,
    rankings: rankings.slice(0, 100),
  }, 200, headers);
}

async function compareRankings(db: D1Database, headers: Record<string, string>): Promise<Response> {
  const engine = new ShadowRankingEngine(db);
  const workService = new WorkService(db);

  const works = await workService.listWorks({ eligibilityStatus: 'approved' as any });
  const workIds = works.map(w => w.id);

  if (workIds.length === 0) {
    return jsonResponse({ error: 'No approved works found' }, 400, headers);
  }

  // Get experimental rankings
  const { rankings: experimentalRankings } = await engine.calculateExperimentalRanking(workIds);

  // Build current rankings (simplified from work_metrics)
  const currentRankings = [];
  for (let i = 0; i < works.length; i++) {
    const work = works[i];
    const { results: metrics } = await db
      .prepare('SELECT views FROM work_metrics WHERE work_id = ? ORDER BY collected_at DESC')
      .bind(work.id)
      .all<{ views: number }>();

    const views = metrics?.[0]?.views || 0;
    currentRankings.push({
      workId: work.id,
      rank: 0, // Will be sorted
      score: views,
      title: work.canonicalTitle,
    });
  }

  currentRankings.sort((a, b) => b.score - a.score);
  currentRankings.forEach((r, i) => { r.rank = i + 1; });

  const comparison = await engine.compareRankings(currentRankings, experimentalRankings);

  return jsonResponse({
    currentVersion: 'v0.1',
    experimentalVersion: 'v0.2',
    totalWorks: works.length,
    comparison: comparison.slice(0, 50),
  }, 200, headers);
}

async function validateSeedPool(db: D1Database, headers: Record<string, string>): Promise<Response> {
  const validator = new SeedPoolValidator(db);

  try {
    const result = await validator.validate();
    const report = validator.generateReport(result);

    return jsonResponse({
      success: true,
      result,
      report,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function addRecognitionSignal(db: D1Database, request: Request, headers: Record<string, string>): Promise<Response> {
  const service = new RecognitionSignalService(db);

  try {
    const body = await request.json() as {
      workId: number;
      organization: string;
      event: string;
      category?: string;
      awardLevel: string;
      year?: number;
      sourceUrl?: string;
    };

    const signal = await service.addSignal(body);

    return jsonResponse({ success: true, signal }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getProvenance(db: D1Database, workId: number, headers: Record<string, string>): Promise<Response> {
  const service = new DataProvenanceService(db);

  const records = await service.getByWork(workId);
  const summary = await service.getSummary(workId);

  return jsonResponse({ workId, records, summary }, 200, headers);
}

// ==================== Phase 26: Seed Review & Experimental Ranking Handlers ====================

async function getSeedReview(db: D1Database, url: URL, headers: Record<string, string>): Promise<Response> {
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const { results } = await db
    .prepare(`
      SELECT
        w.id,
        w.canonical_title as title,
        w.type,
        w.format,
        w.duration_seconds,
        w.human_quality_rating,
        w.human_classification,
        w.eligibility_confidence,
        w.ai_contribution_level,
        (SELECT canonical_url FROM work_sources WHERE work_id = w.id AND is_primary_source = 1 LIMIT 1) as primary_source_url,
        (SELECT source_type FROM work_sources WHERE work_id = w.id AND is_primary_source = 1 LIMIT 1) as primary_source_type,
        (SELECT COUNT(*) FROM recognition_signals WHERE work_id = w.id) as recognition_count,
        (SELECT views FROM work_metrics WHERE work_id = w.id ORDER BY collected_at DESC LIMIT 1) as views,
        (SELECT likes FROM work_metrics WHERE work_id = w.id ORDER BY collected_at DESC LIMIT 1) as likes,
        (SELECT comments FROM work_metrics WHERE work_id = w.id ORDER BY collected_at DESC LIMIT 1) as comments
      FROM works w
      ORDER BY w.created_at DESC
      LIMIT ? OFFSET ?
    `)
    .bind(limit, offset)
    .all();

  return jsonResponse({ works: results || [] }, 200, headers);
}

async function updateWorkReview(db: D1Database, workId: number, request: Request, headers: Record<string, string>): Promise<Response> {
  try {
    const body = await request.json() as {
      humanQualityRating?: number;
      humanClassification?: 'keep' | 'reject' | 'review';
      reviewNotes?: string;
      reviewedBy?: string;
    };

    await db
      .prepare(`
        UPDATE works
        SET human_quality_rating = ?,
            human_classification = ?,
            review_notes = ?,
            reviewed_by = ?,
            reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        body.humanQualityRating ?? null,
        body.humanClassification ?? null,
        body.reviewNotes ?? null,
        body.reviewedBy ?? 'admin',
        workId
      )
      .run();

    return jsonResponse({ success: true, workId }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getExperimentalRankings(db: D1Database, url: URL, headers: Record<string, string>): Promise<Response> {
  const type = url.searchParams.get('type') || 'all'; // popularity_only, popularity_audience, full, all

  const workService = new WorkService(db);
  const works = await workService.listWorks({ eligibilityStatus: 'approved' as any });
  const workIds = works.map(w => w.id);

  if (workIds.length === 0) {
    return jsonResponse({ error: 'No approved works found' }, 400, headers);
  }

  const result: Record<string, unknown> = { totalWorks: workIds.length };

  if (type === 'all' || type === 'popularity_only') {
    const engine = new PopularityOnlyEngine();
    result.popularityOnly = await engine.runRanking(db, workIds);
  }

  if (type === 'all' || type === 'popularity_audience') {
    const engine = new PopularityAudienceEngine();
    result.popularityAudience = await engine.runRanking(db, workIds);
  }

  if (type === 'all' || type === 'full') {
    const engine = new FullRankingEngine(db);
    result.fullRanking = await engine.runRanking(db, workIds);
  }

  return jsonResponse(result, 200, headers);
}

async function getRankingValidation(db: D1Database, headers: Record<string, string>): Promise<Response> {
  const workService = new WorkService(db);
  const works = await workService.listWorks({ eligibilityStatus: 'approved' as any });
  const workIds = works.map(w => w.id);

  if (workIds.length === 0) {
    return jsonResponse({ error: 'No approved works found. Import seed data first.' }, 400, headers);
  }

  const validationService = new RankingValidationService(db);

  try {
    const report = await validationService.validateRanking(workIds);
    const markdownReport = validationService.generateMarkdownReport(report);

    return jsonResponse({
      success: true,
      report,
      markdownReport,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function importSeedPoolBatch1Handler(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const { importSeedPoolBatch1 } = await import('../scripts/import-seed-pool');
    const result = await importSeedPoolBatch1(db);

    return jsonResponse({
      success: true,
      result,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function importSeedPoolBatch2Handler(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const { importSeedPoolBatch2 } = await import('../scripts/import-seed-pool-batch-2');
    const result = await importSeedPoolBatch2(db);

    return jsonResponse({
      success: true,
      result,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

// ==================== Phase 30: Real Seed Pool Handlers ====================

async function importRealSeedPoolBatch1Handler(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const { importRealSeedPoolBatch1, generateImportReport } = await import('../scripts/import-real-seed-pool-batch-1');
    const result = await importRealSeedPoolBatch1(db);
    const markdownReport = generateImportReport(result);

    return jsonResponse({
      success: true,
      result: {
        total: result.total,
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors,
        trustAudit: result.trustAudit,
        dataGaps: {
          totalWorks: result.dataGaps.totalWorks,
          missingSynopsis: result.dataGaps.missingSynopsis,
          missingDuration: result.dataGaps.missingDuration,
          missingCountry: result.dataGaps.missingCountry,
          missingLanguage: result.dataGaps.missingLanguage,
          missingGenre: result.dataGaps.missingGenre,
          missingReleaseYear: result.dataGaps.missingReleaseYear,
          missingCreator: result.dataGaps.missingCreator,
          missingWatchSource: result.dataGaps.missingWatchSource,
          missingRecognition: result.dataGaps.missingRecognition,
          gapsByWorkCount: result.dataGaps.gapsByWork.length,
        },
      },
      markdownReport,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getDataGapsReport(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    // Get all real-batch-1 imported works
    const { results: works } = await db
      .prepare(`
        SELECT w.id, w.canonical_title, w.synopsis, w.duration_seconds, w.country,
               w.original_language, w.genre_json, w.release_year, w.creator_name,
               w.authenticity_status, w.data_trust_score, w.data_trust_level
        FROM works w
        JOIN data_provenance dp ON w.id = dp.work_id
        WHERE dp.data_value LIKE '%Phase 30 real seed import%'
        ORDER BY w.id
      `)
      .all<{
        id: number;
        canonical_title: string;
        synopsis: string;
        duration_seconds: number;
        country: string;
        original_language: string;
        genre_json: string;
        release_year: number;
        creator_name: string;
        authenticity_status: string;
        data_trust_score: number;
        data_trust_level: string;
      }>();

    const gapsByWork: { workId: number; title: string; missingFields: string[]; trustScore: number | null; trustLevel: string | null }[] = [];
    let missingSynopsis = 0;
    let missingDuration = 0;
    let missingCountry = 0;
    let missingLanguage = 0;
    let missingGenre = 0;
    let missingReleaseYear = 0;
    let missingCreator = 0;

    for (const w of works || []) {
      const missingFields: string[] = [];
      if (!w.synopsis) { missingFields.push('synopsis'); missingSynopsis++; }
      if (!w.duration_seconds) { missingFields.push('duration'); missingDuration++; }
      if (!w.country) { missingFields.push('country'); missingCountry++; }
      if (!w.original_language) { missingFields.push('language'); missingLanguage++; }
      if (!w.genre_json || w.genre_json === '[]') { missingFields.push('genre'); missingGenre++; }
      if (!w.release_year) { missingFields.push('release_year'); missingReleaseYear++; }
      if (!w.creator_name) { missingFields.push('creator'); missingCreator++; }

      if (missingFields.length > 0) {
        gapsByWork.push({
          workId: w.id,
          title: w.canonical_title,
          missingFields,
          trustScore: w.data_trust_score,
          trustLevel: w.data_trust_level,
        });
      }
    }

    return jsonResponse({
      success: true,
      report: {
        totalWorks: (works || []).length,
        worksWithGaps: gapsByWork.length,
        missingSynopsis,
        missingDuration,
        missingCountry,
        missingLanguage,
        missingGenre,
        missingReleaseYear,
        missingCreator,
        gapsByWork: gapsByWork.slice(0, 50), // Limit response size
      },
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

// ==================== Phase 27: Ranking Laboratory Handlers ====================

async function runImportAudit(db: D1Database, request: Request, headers: Record<string, string>): Promise<Response> {
  try {
    const body = await request.json() as { entries: unknown[] };
    const auditService = new ImportAuditService(db);

    // Cast entries to ManualSeedEntry[] (basic validation)
    const entries = body.entries as any[];

    const result = await auditService.auditEntries(entries);
    const markdownReport = auditService.generateMarkdownReport(result);

    return jsonResponse({
      success: true,
      result,
      markdownReport,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getRankingConflicts(db: D1Database, headers: Record<string, string>): Promise<Response> {
  const workService = new WorkService(db);
  const works = await workService.listWorks({ eligibilityStatus: 'approved' as any });
  const workIds = works.map(w => w.id);

  if (workIds.length === 0) {
    return jsonResponse({ error: 'No approved works found' }, 400, headers);
  }

  const conflictService = new RankingConflictService(db);
  const conflicts = await conflictService.analyzeConflicts(workIds);

  return jsonResponse({
    success: true,
    conflicts,
  }, 200, headers);
}

async function getRankMovement(db: D1Database, headers: Record<string, string>): Promise<Response> {
  const workService = new WorkService(db);
  const works = await workService.listWorks({ eligibilityStatus: 'approved' as any });
  const workIds = works.map(w => w.id);

  if (workIds.length === 0) {
    return jsonResponse({ error: 'No approved works found' }, 400, headers);
  }

  // Generate all three rankings
  const engineA = new PopularityOnlyEngine();
  const engineB = new PopularityAudienceEngine();
  const engineC = new FullRankingEngine(db);

  const rankingA = await engineA.runRanking(db, workIds);
  const rankingB = await engineB.runRanking(db, workIds);
  const rankingC = await engineC.runRanking(db, workIds);

  // Convert to RankEntry format
  const toRankEntry = (r: { workId: number; title: string; score: number }[], rankOffset = 0) =>
    r.map((item, i) => ({ workId: item.workId, title: item.title, rank: i + 1 + rankOffset, score: item.score }));

  const movementService = new RankMovementService();
  const movements = movementService.analyzeRankMovement(
    toRankEntry(rankingA),
    toRankEntry(rankingB),
    toRankEntry(rankingC)
  );

  const markdownReport = movementService.generateMarkdownReport(movements);

  return jsonResponse({
    success: true,
    movements: movements.slice(0, 50),
    markdownReport,
  }, 200, headers);
}

async function getLaboratoryReport(db: D1Database, headers: Record<string, string>): Promise<Response> {
  const workService = new WorkService(db);
  const works = await workService.listWorks({ eligibilityStatus: 'approved' as any });
  const workIds = works.map(w => w.id);

  if (workIds.length === 0) {
    return jsonResponse({ error: 'No approved works found' }, 400, headers);
  }

  // Generate all three rankings
  const engineA = new PopularityOnlyEngine();
  const engineB = new PopularityAudienceEngine();
  const engineC = new FullRankingEngine(db);

  const rankingA = await engineA.runRanking(db, workIds);
  const rankingB = await engineB.runRanking(db, workIds);
  const rankingC = await engineC.runRanking(db, workIds);

  const reportService = new RankingLaboratoryReportService(db);
  const report = await reportService.generateReport(rankingA, rankingB, rankingC);
  const markdownReport = reportService.generateMarkdownReport(report);

  return jsonResponse({
    success: true,
    report,
    markdownReport,
  }, 200, headers);
}

async function getQualityDistribution(db: D1Database, headers: Record<string, string>): Promise<Response> {
  const { results } = await db
    .prepare(`
      SELECT human_quality_rating, COUNT(*) as count
      FROM works
      WHERE eligibility_status = ? AND human_quality_rating IS NOT NULL
      GROUP BY human_quality_rating
      ORDER BY human_quality_rating
    `)
    .bind('approved')
    .all<{ human_quality_rating: number; count: number }>();

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of results || []) {
    distribution[row.human_quality_rating] = row.count;
  }

  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  const highQuality = (distribution[4] || 0) + (distribution[5] || 0);
  const imbalanced = total > 0 && (highQuality / total < 0.2 || Math.max(...Object.values(distribution)) / total > 0.6);

  return jsonResponse({
    success: true,
    distribution,
    total,
    imbalanced,
    warning: imbalanced ? 'Ground truth distribution is highly imbalanced.' : null,
  }, 200, headers);
}

async function getSourceDiversityReport(db: D1Database, headers: Record<string, string>): Promise<Response> {
  // By Source
  const { results: sourceResults } = await db
    .prepare('SELECT source_type, COUNT(*) as count FROM work_sources GROUP BY source_type')
    .all<{ source_type: string; count: number }>();

  // By Recognition
  const { results: recogResults } = await db
    .prepare(`
      SELECT award_level, COUNT(*) as count
      FROM recognition_events
      GROUP BY award_level
    `)
    .all<{ award_level: string; count: number }>();

  // By Type
  const { results: typeResults } = await db
    .prepare('SELECT type as content_type, COUNT(*) as count FROM works WHERE eligibility_status = ? GROUP BY type')
    .bind('approved')
    .all<{ content_type: string; count: number }>();

  return jsonResponse({
    success: true,
    bySource: sourceResults || [],
    byRecognition: recogResults || [],
    byType: typeResults || [],
  }, 200, headers);
}

// ==================== Phase 28: Data Trust & Audit Handlers ====================

async function runDataTrustAudit(db: D1Database, request: Request, headers: Record<string, string>): Promise<Response> {
  try {
    const body = await request.json() as { workIds?: number[] };
    const auditService = new DataTrustAuditService(db);

    const scores = await auditService.auditAllWorks(body.workIds);

    // Save scores to database
    for (const score of scores) {
      await auditService.saveTrustScore(score);
    }

    return jsonResponse({
      success: true,
      scores,
      totalAudited: scores.length,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getDataTrustDistribution(db: D1Database, headers: Record<string, string>): Promise<Response> {
  const auditService = new DataTrustAuditService(db);
  const distribution = await auditService.getTrustDistribution();

  return jsonResponse({
    success: true,
    distribution,
  }, 200, headers);
}

async function runAuthenticityCheck(db: D1Database, request: Request, headers: Record<string, string>): Promise<Response> {
  try {
    const body = await request.json() as { workId?: number };
    const authenticityService = new SourceAuthenticityService(db);

    let checks;
    if (body.workId) {
      checks = [await authenticityService.checkWork(body.workId)];
    } else {
      checks = await authenticityService.checkAllWorks();
    }

    // Mark synthetic data
    for (const check of checks) {
      if (check.overallStatus === 'SYNTHETIC_TEST_DATA') {
        await authenticityService.markSynthetic(check.workId, check.syntheticMarkers.join(', '));
      }
    }

    return jsonResponse({
      success: true,
      checks,
      syntheticCount: checks.filter(c => c.overallStatus === 'SYNTHETIC_TEST_DATA').length,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getSyntheticStats(db: D1Database, headers: Record<string, string>): Promise<Response> {
  const authenticityService = new SourceAuthenticityService(db);
  const stats = await authenticityService.getSyntheticStats();

  return jsonResponse({
    success: true,
    stats,
  }, 200, headers);
}

async function getBlindReview(db: D1Database, workId: number, headers: Record<string, string>): Promise<Response> {
  const work = await db
    .prepare('SELECT id, canonical_title, synopsis, type, format, duration_seconds, creator_name, release_year, country, genre_json FROM works WHERE id = ?')
    .bind(workId)
    .first();

  if (!work) {
    return jsonResponse({ error: 'Work not found' }, 404, headers);
  }

  // Return only basic metadata, no ranking/popularity data
  return jsonResponse({
    success: true,
    work: {
      id: (work as any).id,
      title: (work as any).canonical_title,
      synopsis: (work as any).synopsis,
      type: (work as any).type,
      format: (work as any).format,
      durationSeconds: (work as any).duration_seconds,
      creator: (work as any).creator_name,
      releaseYear: (work as any).release_year,
      country: (work as any).country,
      genres: (work as any).genre_json,
    },
    reviewMode: 'blind',
    instructions: 'Rate this work based solely on its artistic and narrative merit. Hidden: rank, popularity, recognition, views.',
  }, 200, headers);
}

async function getPhase28Report(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const workService = new WorkService(db);
    const works = await workService.listWorks({ eligibilityStatus: 'approved' as any });
    const workIds = works.map(w => w.id);

    if (workIds.length === 0) {
      return jsonResponse({ error: 'No approved works found' }, 400, headers);
    }

    // Generate rankings
    const engineA = new PopularityOnlyEngine();
    const engineB = new PopularityAudienceEngine();
    const engineC = new FullRankingEngine(db);

    const rankingA = await engineA.runRanking(db, workIds);
    const rankingB = await engineB.runRanking(db, workIds);
    const rankingC = await engineC.runRanking(db, workIds);

    const reportService = new Phase28ReportService(db);
    const report = await reportService.generateReport(rankingA, rankingB, rankingC);
    const markdownReport = reportService.generateMarkdownReport(report);

    return jsonResponse({
      success: true,
      report,
      markdownReport,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

// ==================== Phase 29: Golden Dataset & Human Baseline Handlers ====================

async function evaluateGoldenDataset(db: D1Database, request: Request, headers: Record<string, string>): Promise<Response> {
  try {
    const body = await request.json() as { workId?: number; criteria?: { minDataTrustScore?: number } };
    const service = new GoldenDatasetService(db);

    if (body.workId) {
      const result = await service.evaluateWorkEligibility(body.workId, body.criteria);
      return jsonResponse({ success: true, ...result }, 200, headers);
    }

    return jsonResponse({ error: 'workId required' }, 400, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getGoldenDatasetReport(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new GoldenDatasetService(db);
    const report = await service.generateReport('current');
    const markdownReport = service.generateMarkdownReport(report);

    return jsonResponse({
      success: true,
      report,
      markdownReport,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function updateGoldenDataset(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new GoldenDatasetService(db);
    const result = await service.updateGoldenDataset();

    return jsonResponse({
      success: true,
      result,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function submitHumanBaseline(db: D1Database, request: Request, headers: Record<string, string>): Promise<Response> {
  try {
    const body = await request.json() as {
      workId: number;
      reviewerId: string;
      humanQualityRating: number;
      humanRank?: number;
      reviewMode?: 'blind' | 'standard';
      reviewRound?: number;
      reviewNotes?: string;
    };

    const service = new HumanBaselineService(db);
    await service.submitReview({
      workId: body.workId,
      reviewerId: body.reviewerId,
      humanQualityRating: body.humanQualityRating,
      humanRank: body.humanRank,
      reviewMode: body.reviewMode || 'blind',
      reviewRound: body.reviewRound,
      reviewNotes: body.reviewNotes,
    });

    return jsonResponse({ success: true, workId: body.workId }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getHumanBaselineRanking(db: D1Database, url: URL, headers: Record<string, string>): Promise<Response> {
  const reviewerId = url.searchParams.get('reviewerId') || undefined;
  const service = new HumanBaselineService(db);
  const ranking = await service.getHumanBaselineRanking(reviewerId);

  return jsonResponse({
    success: true,
    ranking,
  }, 200, headers);
}

async function getReviewerAgreement(db: D1Database, url: URL, headers: Record<string, string>): Promise<Response> {
  const workId = parseInt(url.searchParams.get('workId') || '', 10);
  if (isNaN(workId)) {
    return jsonResponse({ error: 'workId required' }, 400, headers);
  }

  const service = new HumanBaselineService(db);
  const agreements = await service.calculateAgreement(workId);
  const stats = await service.getReviewerStats();

  return jsonResponse({
    success: true,
    agreements,
    stats,
  }, 200, headers);
}

async function getHumanAlgorithmCorrelation(db: D1Database, url: URL, headers: Record<string, string>): Promise<Response> {
  const service = new HumanBaselineService(db);
  const workService = new WorkService(db);

  // Get human baseline ranking
  const humanRanking = await service.getHumanBaselineRanking();
  const humanWorkIds = humanRanking.map(r => r.workId);

  if (humanWorkIds.length < 5) {
    return jsonResponse({ error: 'Insufficient human baseline data' }, 400, headers);
  }

  // Get algorithm ranking
  const works = await workService.listWorks({ eligibilityStatus: 'approved' as any });
  const workIds = works.map(w => w.id);

  const engineC = new FullRankingEngine(db);
  const algorithmRanking = await engineC.runRanking(db, workIds);
  const algorithmWorkIds = algorithmRanking.map(r => r.workId);

  // Calculate correlation
  const correlation = service.calculateHumanAlgorithmCorrelation(humanWorkIds, algorithmWorkIds);

  // Calculate Top-K overlaps
  const top5Overlap = service.calculateTopKOverlap(humanWorkIds, algorithmWorkIds, 5);
  const top10Overlap = service.calculateTopKOverlap(humanWorkIds, algorithmWorkIds, 10);
  const top20Overlap = service.calculateTopKOverlap(humanWorkIds, algorithmWorkIds, 20);

  return jsonResponse({
    success: true,
    correlation,
    overlaps: {
      top5: top5Overlap,
      top10: top10Overlap,
      top20: top20Overlap,
    },
  }, 200, headers);
}

async function addWatchSource(db: D1Database, request: Request, headers: Record<string, string>): Promise<Response> {
  try {
    const body = await request.json() as {
      workId: number;
      sourceType: string;
      url: string;
      isPrimary?: boolean;
      verificationStatus?: string;
    };

    await db
      .prepare(`
        INSERT INTO watch_sources (work_id, source_type, url, is_primary, verification_status)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(
        body.workId,
        body.sourceType,
        body.url,
        body.isPrimary ? 1 : 0,
        body.verificationStatus || 'UNVERIFIED'
      )
      .run();

    return jsonResponse({ success: true, workId: body.workId }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getWorkWatchSources(db: D1Database, workId: number, headers: Record<string, string>): Promise<Response> {
  const { results } = await db
    .prepare('SELECT * FROM watch_sources WHERE work_id = ?')
    .bind(workId)
    .all();

  return jsonResponse({
    success: true,
    workId,
    sources: results || [],
  }, 200, headers);
}

// ==================== Phase 31: Data Enrichment & Source Correction Handlers ====================

async function runPhase31Enrichment(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase31DataEnrichmentService(db);

    // Run the full pipeline
    const result = await service.runFullEnrichmentPipeline();

    // Generate markdown report
    const markdownReport = service.generateMarkdownReport(result);

    return jsonResponse({
      success: true,
      result: {
        sourceAudit: {
          totalWorks: result.sourceAudit.length,
          reclassifiedToRecognition: result.sourceAudit.reduce((sum, s) => sum + s.reclassifiedToRecognition, 0),
          reclassifiedToMetadata: result.sourceAudit.reduce((sum, s) => sum + s.reclassifiedToMetadata, 0),
          pendingWatchSources: result.sourceAudit.reduce((sum, s) => sum + s.pendingWatchSources, 0),
        },
        metadataEnrichment: {
          totalWorks: result.metadataEnrichment.length,
          enriched: result.metadataEnrichment.filter(m => m.fieldsUpdated.length > 0).length,
        },
        popularityStatus: result.popularityStatus,
        trustScores: {
          total: result.trustScores.length,
          high: result.trustScores.filter(s => s.level === 'HIGH').length,
          medium: result.trustScores.filter(s => s.level === 'MEDIUM').length,
          low: result.trustScores.filter(s => s.level === 'LOW').length,
        },
        goldenDataset: result.goldenDataset,
        completionReport: {
          totalWorks: result.completionReport.totalWorks,
          synopsis: result.completionReport.synopsis,
          genre: result.completionReport.genre,
          language: result.completionReport.language,
          country: result.completionReport.country,
          duration: result.completionReport.duration,
          releaseYear: result.completionReport.releaseYear,
          creator: result.completionReport.creator,
          verifiedWatchSource: result.completionReport.verifiedWatchSource,
          pendingWatchSource: result.completionReport.pendingWatchSource,
          popularityData: result.completionReport.popularityData,
          popularityStatus: result.completionReport.popularityStatus,
          trustDistribution: result.completionReport.trustDistribution,
        },
      },
      markdownReport,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getPhase31Report(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase31DataEnrichmentService(db);

    // Generate completion report only (read-only)
    const completionReport = await service.generateDataCompletionReport();

    return jsonResponse({
      success: true,
      report: completionReport,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

// ==================== Phase 32: Real Data Completion Handlers ====================

async function runPhase32Completion(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase32RealDataCompletionService(db);
    const result = await service.runFullPipeline();

    return jsonResponse({
      success: true,
      result: {
        watchFixes: {
          total: result.watchFixes.length,
          fixes: result.watchFixes,
        },
        metadataEnrichment: {
          total: result.metadataEnrichment.length,
          fields: result.metadataEnrichment.map(e => ({ title: e.title, field: e.field, newValue: e.newValue })),
        },
        prioritiesUpdated: result.prioritiesUpdated,
        trustScores: result.trustScores,
        goldenDataset: result.goldenDataset,
        report: {
          works: result.report.works,
          watch: result.report.watch,
          popularity: result.report.popularity,
          humanReview: result.report.humanReview,
          goldenDataset: result.report.goldenDataset,
          dataTrust: result.report.dataTrust,
          ranking: result.report.ranking,
        },
      },
      markdownReport: result.markdownReport,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getPhase32Report(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase32RealDataCompletionService(db);
    const report = await service.generateReport();
    const markdownReport = service.generateMarkdownReport(report);

    return jsonResponse({
      success: true,
      report,
      markdownReport,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

// ==================== Phase 33: Human Review & Watch Source Completion Handlers ====================

async function runPhase33Pipeline(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase33HumanReviewService(db);
    const result = await service.runFullPipeline();

    return jsonResponse({
      success: true,
      result: {
        ratingsSubmitted: result.ratingsSubmitted,
        reviewProgress: result.report.reviewProgress,
        qualityDistribution: result.report.qualityDistribution,
        rankingReadiness: result.report.rankingReadiness,
        dashboard: result.report.dashboard,
        goldenDataset: result.report.goldenDataset,
        watchSourceCompletion: result.report.watchSourceCompletion,
        experimentalRanking: result.report.experimentalRanking,
        humanAudit: result.report.humanAudit,
      },
      markdownReport: result.markdownReport,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getPhase33Report(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase33HumanReviewService(db);
    const report = await service.generateReport();
    const markdownReport = service.generateMarkdownReport(report);

    return jsonResponse({
      success: true,
      report,
      markdownReport,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getPhase33ReviewProgress(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase33HumanReviewService(db);
    const progress = await service.getReviewProgress();

    return jsonResponse({ success: true, progress }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getPhase33QualityDistribution(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase33HumanReviewService(db);
    const distribution = await service.getQualityDistribution();

    return jsonResponse({ success: true, distribution }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getPhase33RankingReadiness(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase33HumanReviewService(db);
    const readiness = await service.getRankingReadiness();

    return jsonResponse({ success: true, readiness }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getPhase33Dashboard(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase33HumanReviewService(db);
    const dashboard = await service.getDashboard();

    return jsonResponse({ success: true, dashboard }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getPhase33ExperimentalRanking(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase33HumanReviewService(db);
    const ranking = await service.generateExperimentalRanking();

    return jsonResponse({ success: true, ranking }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getPhase33HumanAudit(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase33HumanReviewService(db);
    const audit = await service.runHumanRankingAudit();

    return jsonResponse({ success: true, audit }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

// ==================== Phase 34: Synthetic Review Cleanup & Real Review Preparation Handlers ====================

async function runPhase34Cleanup(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase34ReviewCleanupService(db);
    const result = await service.runFullPipeline();

    return jsonResponse({
      success: true,
      result: {
        cleanup: result.cleanup,
        dashboard: result.report.dashboard,
        rankingReadiness: result.report.rankingReadiness,
        reviewQueueCount: result.report.reviewQueue.length,
      },
      markdownReport: result.markdownReport,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getPhase34Report(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase34ReviewCleanupService(db);
    const report = await service.generateReport();
    const markdownReport = service.generateMarkdownReport(report);

    return jsonResponse({
      success: true,
      report,
      markdownReport,
    }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getPhase34ReviewQueue(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase34ReviewCleanupService(db);
    const queue = await service.getReviewQueue();

    return jsonResponse({ success: true, queue }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function submitPhase34Review(request: Request, db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const body = await request.json() as {
      workId: number;
      reviewerId: string;
      humanQualityRating: number;
      humanClassification: 'KEEP' | 'REVIEW' | 'REJECT';
      reviewNotes?: string;
      reviewMode?: 'blind' | 'open';
    };

    const service = new Phase34ReviewCleanupService(db);
    const result = await service.submitRealReview({
      workId: body.workId,
      reviewerId: body.reviewerId,
      humanQualityRating: body.humanQualityRating,
      humanClassification: body.humanClassification,
      reviewNotes: body.reviewNotes || '',
      reviewMode: body.reviewMode || 'blind',
    });

    return jsonResponse({ success: result.success, result }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getPhase34Dashboard(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase34ReviewCleanupService(db);
    const dashboard = await service.getDashboard();

    return jsonResponse({ success: true, dashboard }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

async function getPhase34RankingReadiness(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase34ReviewCleanupService(db);
    const readiness = await service.getRankingReadiness();

    return jsonResponse({ success: true, readiness }, 200, headers);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, headers);
  }
}

// ==================== Admin CRUD Handlers ====================

async function getAdminWorksList(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new AdminCrudService(db);
    const works = await service.getAllWorksForAdmin();
    return jsonResponse({ success: true, works }, 200, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

async function updateAdminWork(request: Request, db: D1Database, headers: Record<string, string>, workId: number): Promise<Response> {
  try {
    const body = await request.json() as {
      canonical_title?: string;
      creator_name?: string;
      synopsis?: string;
      type?: string;
      original_language?: string;
      country?: string;
      release_year?: number;
      duration_seconds?: number;
      admin_id?: string;
    };
    const service = new AdminCrudService(db);
    const result = await service.updateWork(workId, body, body.admin_id || 'admin');
    return jsonResponse(result, result.success ? 200 : 400, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

async function requestDeleteAdminWork(request: Request, db: D1Database, headers: Record<string, string>, workId: number): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({})) as { admin_id?: string; reason?: string };
    const service = new AdminCrudService(db);
    const result = await service.requestDeleteWork(workId, body.admin_id || 'admin', body.reason);
    return jsonResponse(result, result.success ? 200 : 400, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

async function confirmDeleteAdminWork(request: Request, db: D1Database, headers: Record<string, string>, workId: number): Promise<Response> {
  try {
    const body = await request.json() as { confirmation_token: string; admin_id?: string };
    const service = new AdminCrudService(db);
    const result = await service.hardDeleteWork(workId, body.admin_id || 'admin', body.confirmation_token);
    return jsonResponse(result, result.success ? 200 : 400, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

async function cancelDeleteAdminWork(request: Request, db: D1Database, headers: Record<string, string>, workId: number): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({})) as { admin_id?: string };
    const service = new AdminCrudService(db);
    const result = await service.cancelDeleteWork(workId, body.admin_id || 'admin');
    return jsonResponse(result, result.success ? 200 : 400, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

async function restoreAdminWork(request: Request, db: D1Database, headers: Record<string, string>, workId: number): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({})) as { admin_id?: string };
    const service = new AdminCrudService(db);
    const result = await service.restoreWork(workId, body.admin_id || 'admin');
    return jsonResponse(result, result.success ? 200 : 400, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

async function addAdminWatchSource(request: Request, db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const body = await request.json() as {
      work_id: number;
      source_type: string;
      url: string;
      source_role?: 'WATCH' | 'METADATA' | 'RECOGNITION';
      source_priority?: string;
      watch_status?: string;
      discovered_from?: string;
      check_result?: string;
      admin_id?: string;
    };
    const service = new AdminCrudService(db);
    const result = await service.addWatchSource(body, body.admin_id || 'admin');
    return jsonResponse(result, result.success ? 200 : 400, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

async function updateAdminWatchSource(request: Request, db: D1Database, headers: Record<string, string>, sourceId: number): Promise<Response> {
  try {
    const body = await request.json() as {
      source_type?: string;
      url?: string;
      source_role?: 'WATCH' | 'METADATA' | 'RECOGNITION';
      source_priority?: string;
      watch_status?: string;
      discovered_from?: string;
      check_result?: string;
      admin_id?: string;
    };
    const service = new AdminCrudService(db);
    const result = await service.updateWatchSource(sourceId, body, body.admin_id || 'admin');
    return jsonResponse(result, result.success ? 200 : 400, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

async function deleteAdminWatchSource(request: Request, db: D1Database, headers: Record<string, string>, sourceId: number): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({})) as { admin_id?: string };
    const service = new AdminCrudService(db);
    const result = await service.deleteWatchSource(sourceId, body.admin_id || 'admin');
    return jsonResponse(result, result.success ? 200 : 400, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

async function updateAdminReview(request: Request, db: D1Database, headers: Record<string, string>, workId: number): Promise<Response> {
  try {
    const body = await request.json() as {
      human_quality_rating?: number;
      human_classification?: 'KEEP' | 'REVIEW' | 'REJECT';
      review_notes?: string;
      reviewer_id?: string;
      review_origin?: 'HUMAN' | 'SYNTHETIC_TEST' | 'IMPORTED' | 'UNKNOWN';
      admin_id?: string;
    };
    const service = new AdminCrudService(db);
    const result = await service.updateReview(workId, body, body.admin_id || 'admin');
    return jsonResponse(result, result.success ? 200 : 400, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

async function clearAdminReview(request: Request, db: D1Database, headers: Record<string, string>, workId: number): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({})) as { admin_id?: string };
    const service = new AdminCrudService(db);
    const result = await service.clearReview(workId, body.admin_id || 'admin');
    return jsonResponse(result, result.success ? 200 : 400, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

async function getAdminWorkAuditLog(db: D1Database, headers: Record<string, string>, workId: number): Promise<Response> {
  try {
    const service = new AdminCrudService(db);
    const logs = await service.getWorkAuditLog(workId);
    return jsonResponse({ success: true, logs }, 200, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

// ============================================
// AI Film Crawler APIs
// ============================================

async function runCrawler(env: Env, headers: Record<string, string>): Promise<Response> {
  try {
    const crawler = new AIFilmCrawler(env.DB);
    const result = await crawler.crawlAll();
    const report = crawler.generateReport(result);
    return jsonResponse({ success: true, result, report }, 200, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

async function getCrawlerStatus(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const { results: count } = await db
      .prepare('SELECT COUNT(*) as total FROM works')
      .all<{ total: number }>();
    
    const { results: recent } = await db
      .prepare('SELECT canonical_title, creator_name, poster_url, release_year FROM works ORDER BY id DESC LIMIT 10')
      .all<{ canonical_title: string; creator_name: string; poster_url: string; release_year: number }>();

    return jsonResponse({
      success: true,
      total_works: count?.[0]?.total ?? 0,
      recent_works: recent ?? [],
    }, 200, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

// ============================================
// Thumbnail Generation APIs
// ============================================

async function generateWorkThumbnail(env: Env, headers: Record<string, string>, workId: number): Promise<Response> {
  try {
    const service = new ThumbnailService(env.DB, env.AI);
    const result = await service.generateThumbnailForWork(workId);
    return jsonResponse(result, result.success ? 200 : 500, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

async function generateAllThumbnails(env: Env, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new ThumbnailService(env.DB, env.AI);
    const result = await service.generateAllMissingThumbnails(3);
    return jsonResponse({ success: true, result }, 200, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

async function updateWorkPoster(request: Request, db: D1Database, headers: Record<string, string>, workId: number): Promise<Response> {
  try {
    const body = await request.json() as { poster_url: string; admin_id?: string };
    const service = new ThumbnailService(db, null as any);
    const success = await service.setCustomPoster(workId, body.poster_url);
    return jsonResponse({ success, message: success ? 'Poster updated' : 'Failed to update poster' }, success ? 200 : 400, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

// ============================================
// Phase 35: Initial 100 Works & Global Discovery
// ============================================

async function runPhase35Pipeline(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase35InitialPoolService(db);
    const result = await service.runFullPipeline();
    return jsonResponse({ success: true, result }, 200, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

async function getPhase35Report(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase35InitialPoolService(db);
    const report = await service.generateReport();
    const markdown = service.generateMarkdownReport(report);
    return jsonResponse({ success: true, report, markdown }, 200, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

async function getPhase35PoolStatus(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase35InitialPoolService(db);
    const status = await service.getInitialPoolStatus();
    return jsonResponse({ success: true, status }, 200, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

async function reauditExistingWorks(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase35InitialPoolService(db);
    const results = await service.reauditExistingWorks();
    return jsonResponse({ success: true, results }, 200, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

async function updateGoldenDatasetRules(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase35InitialPoolService(db);
    const result = await service.updateGoldenDatasetRules();
    return jsonResponse({ success: true, result }, 200, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}

async function seedDiscoveryCandidates(db: D1Database, headers: Record<string, string>): Promise<Response> {
  try {
    const service = new Phase35InitialPoolService(db);
    const result = await service.seedDiscoveryCandidates();
    return jsonResponse({ success: true, result }, 200, headers);
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500, headers);
  }
}
