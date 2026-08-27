import type { D1Database } from '@cloudflare/workers-types';
import { FilmModel } from '../models/film';
import { JobModel } from '../models/job';
import { YouTubeAdapter } from '../discovery/youtube-adapter';
import { withRetry } from '../utils/retry';

interface MetricsRefreshJobConfig {
  batchSize: number;
  maxFilms: number;
}

export async function runMetricsRefreshJob(
  db: D1Database,
  youtubeApiKey: string,
  jobId: string,
  config: MetricsRefreshJobConfig = { batchSize: 50, maxFilms: 500 }
): Promise<void> {
  const filmModel = new FilmModel(db);
  const jobModel = new JobModel(db);
  const youtube = new YouTubeAdapter(youtubeApiKey);

  await jobModel.updateStatus(jobId, 'processing');

  try {
    const films = await filmModel.getFilmsNeedingMetricsUpdate(config.maxFilms);

    if (films.length === 0) {
      await jobModel.updateStatus(jobId, 'completed');
      await jobModel.updateProgress(jobId, 100, undefined);
      return;
    }

    for (let i = 0; i < films.length; i += config.batchSize) {
      const batch = films.slice(i, i + config.batchSize);
      const progress = Math.floor((i / films.length) * 100);
      await jobModel.updateProgress(jobId, progress, String(i));

      // Fetch video details in batch
      const videoIds = batch.map(f => f.source_video_id);

      try {
        const params = new URLSearchParams({
          part: 'statistics',
          id: videoIds.join(','),
          key: youtubeApiKey,
        });

        const response = await withRetry(
          () => fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`),
          { maxRetries: 3, baseDelay: 2000 }
        );

        if (!response.ok) {
          console.error(`YouTube API error: ${response.status}`);
          continue;
        }

        const data = await response.json() as {
          items: {
            id: string;
            statistics: {
              viewCount: string;
              likeCount: string;
              commentCount: string;
            };
          }[];
        };

        for (const item of data.items) {
          const film = batch.find(f => f.source_video_id === item.id);
          if (!film) continue;

          const stats = item.statistics;
          await filmModel.addMetrics(film.id, {
            views: parseInt(stats.viewCount || '0', 10),
            likes: parseInt(stats.likeCount || '0', 10),
            comments: parseInt(stats.commentCount || '0', 10),
          });
        }
      } catch (error) {
        console.error('Batch metrics refresh failed:', error);
      }

      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await jobModel.updateStatus(jobId, 'completed');
    await jobModel.updateProgress(jobId, 100, undefined);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await jobModel.updateStatus(jobId, 'failed', errorMessage);
    throw error;
  }
}
