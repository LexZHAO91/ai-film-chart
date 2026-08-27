/// <reference types="@cloudflare/workers-types" />
import { handleApiRequest, type Env } from './routes/api';
import { JobModel } from './models/job';
import { runDiscoveryJob, runAIClassificationJob, runMetricsRefreshJob, runRankingJob } from './jobs';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // API routes
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env);
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', version: '0.1.0' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default: return API info
    return new Response(JSON.stringify({
      name: 'AI Film Chart API',
      version: '0.1.0',
      endpoints: [
        'GET /api/rankings/top100',
        'GET /api/rankings/rising50',
        'GET /api/rankings/new50',
        'GET /api/films',
        'GET /api/films/:id',
        'GET /api/admin/dashboard',
        'GET /api/admin/candidates',
        'POST /api/admin/candidates/:id/approve',
        'POST /api/admin/candidates/:id/reject',
        'POST /api/admin/candidates/:id/exclude',
        'POST /api/admin/candidates/:id/restore',
        'GET /api/admin/audit-logs',
        'GET /api/admin/jobs',
        'POST /api/admin/run-discovery',
        'POST /api/admin/run-ranking',
        'POST /api/admin/seed-mock-data',
      ],
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Scheduled event triggered:', controller.cron);

    const jobModel = new JobModel(env.DB);

    // Create and run a full pipeline job
    const pipelineJobId = `pipeline_${Date.now()}`;
    await jobModel.create({
      job_id: pipelineJobId,
      type: 'pipeline',
      status: 'processing',
      cursor: null,
      batch_size: 50,
      progress: 0,
      error_message: null,
    });

    try {
      // Step 1: Discovery (if API key available)
      if (env.YOUTUBE_API_KEY) {
        await jobModel.updateProgress(pipelineJobId, 10, 'discovery');
        const discoveryJobId = `discovery_${Date.now()}`;
        await jobModel.create({
          job_id: discoveryJobId,
          type: 'discovery',
          status: 'pending',
          cursor: null,
          batch_size: 20,
          progress: 0,
          error_message: null,
        });
        await runDiscoveryJob(env.DB, env.YOUTUBE_API_KEY, discoveryJobId);
      }

      // Step 2: AI Classification (if credentials available)
      if (env.CF_ACCOUNT_ID && env.CF_API_TOKEN) {
        await jobModel.updateProgress(pipelineJobId, 40, 'classification');
        const classificationJobId = `classification_${Date.now()}`;
        await jobModel.create({
          job_id: classificationJobId,
          type: 'classification',
          status: 'pending',
          cursor: null,
          batch_size: 20,
          progress: 0,
          error_message: null,
        });
        await runAIClassificationJob(env.DB, env.CF_ACCOUNT_ID, env.CF_API_TOKEN, classificationJobId);
      }

      // Step 3: Metrics Refresh (if API key available)
      if (env.YOUTUBE_API_KEY) {
        await jobModel.updateProgress(pipelineJobId, 70, 'metrics');
        const metricsJobId = `metrics_${Date.now()}`;
        await jobModel.create({
          job_id: metricsJobId,
          type: 'metrics',
          status: 'pending',
          cursor: null,
          batch_size: 50,
          progress: 0,
          error_message: null,
        });
        await runMetricsRefreshJob(env.DB, env.YOUTUBE_API_KEY, metricsJobId);
      }

      // Step 4: Ranking
      await jobModel.updateProgress(pipelineJobId, 90, 'ranking');
      const rankingJobId = `ranking_${Date.now()}`;
      await jobModel.create({
        job_id: rankingJobId,
        type: 'ranking',
        status: 'pending',
        cursor: null,
        batch_size: 100,
        progress: 0,
        error_message: null,
      });
      await runRankingJob(env.DB, rankingJobId);

    await jobModel.updateStatus(pipelineJobId, 'completed');
    await jobModel.updateProgress(pipelineJobId, 100, undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Pipeline failed';
      await jobModel.updateStatus(pipelineJobId, 'failed', errorMessage);
      console.error('Pipeline failed:', error);
    }
  },
} satisfies ExportedHandler<Env>;
