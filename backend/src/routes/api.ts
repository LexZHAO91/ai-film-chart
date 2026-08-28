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
import { WorkService } from '../works';
import { ContentEligibilityService } from '../eligibility';
import {
  PopularityOnlyEngine,
  PopularityAudienceEngine,
  FullRankingEngine,
} from '../ranking/experimental-ranking-engines';

export interface Env {
  DB: D1Database;
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

      // Phase 19-25: New Admin APIs
      if (path === '/api/admin/works' && request.method === 'GET') {
        return await getWorks(env.DB, url, headers);
      }

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

  return jsonResponse({
    film,
    metrics,
    aiAnalysis,
  }, 200, headers);
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
    const report = await validationService.generateReport(workIds);
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
