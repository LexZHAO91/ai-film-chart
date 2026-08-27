import type { D1Database } from '@cloudflare/workers-types';
import { FilmModel } from '../models/film';
import { RankingModel } from '../models/ranking';
import { JobModel } from '../models/job';
import { RankingEngineV2 } from '../ranking/ranking-engine-v2';
import { MOCK_FILMS, generateMockMetrics, generateMockAIAnalysis } from '../utils/mock-data';
import { AdminAuditModel } from '../models/admin-audit';

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
        return await runDiscovery(env.DB, headers);
      }

      if (path === '/api/admin/run-ranking' && request.method === 'POST') {
        return await runRanking(env.DB, headers);
      }

      if (path === '/api/admin/seed-mock-data' && request.method === 'POST') {
        return await seedMockData(env.DB, headers);
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

async function runDiscovery(db: D1Database, headers: Record<string, string>): Promise<Response> {
  const jobModel = new JobModel(db);
  const jobId = `discovery_${Date.now()}`;

  await jobModel.create({
    job_id: jobId,
    type: 'discovery',
    status: 'pending',
    cursor: null,
    batch_size: 20,
    progress: 0,
    error_message: null,
  });

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
