import type { D1Database } from '@cloudflare/workers-types';
import { FilmModel } from '../models/film';
import { JobModel } from '../models/job';
import { YouTubeAdapter } from '../discovery/youtube-adapter';
import { withRetry } from '../utils/retry';

const DISCOVERY_QUERIES = [
  'AI film short',
  'AI generated short film',
  'AI animation short',
  'AI cinematic video',
  'AI movie short',
  'Runway Gen-2 short film',
  'Sora AI video',
  'Pika Labs AI film',
  'Stable Diffusion animation',
  'Midjourney AI film',
];

interface DiscoveryJobConfig {
  maxCandidatesPerQuery: number;
  maxTotalCandidates: number;
  targetWeeklyCandidates: number;
}

export async function runDiscoveryJob(
  db: D1Database,
  youtubeApiKey: string,
  jobId: string,
  config: DiscoveryJobConfig = { maxCandidatesPerQuery: 30, maxTotalCandidates: 200, targetWeeklyCandidates: 30 }
): Promise<void> {
  const filmModel = new FilmModel(db);
  const jobModel = new JobModel(db);
  const youtube = new YouTubeAdapter(youtubeApiKey);

  await jobModel.updateStatus(jobId, 'processing');

  let totalDiscovered = 0;
  let totalAdded = 0;

  try {
    for (let i = 0; i < DISCOVERY_QUERIES.length; i++) {
      const query = DISCOVERY_QUERIES[i];
      const progress = Math.floor((i / DISCOVERY_QUERIES.length) * 100);
      await jobModel.updateProgress(jobId, progress, query);

      const result = await withRetry(
        () => youtube.searchCandidates(query, { maxResults: config.maxCandidatesPerQuery }),
        { maxRetries: 3, baseDelay: 2000 }
      );

      totalDiscovered += result.videos.length;

      for (const video of result.videos) {
        // Skip if already exists
        const existing = await filmModel.findBySourceVideoId(video.source_video_id);
        if (existing) continue;

        await filmModel.create({
          source: 'youtube',
          source_video_id: video.source_video_id,
          canonical_url: `https://youtube.com/watch?v=${video.source_video_id}`,
          title: video.title,
          description: video.description,
          thumbnail_url: video.thumbnail_url,
          channel_id: video.channel_id,
          channel_name: video.channel_name,
          published_at: video.published_at,
          duration_seconds: video.duration_seconds,
          language: 'en',
          is_ai_film: false,
          is_story_content: false,
          content_type: '',
          genre_json: '[]',
          ai_generation_level: 0,
          ai_confidence: 0,
          status: 'pending',
        });

        totalAdded++;

        if (totalAdded >= config.maxTotalCandidates) {
          break;
        }
      }

      if (totalAdded >= config.maxTotalCandidates) {
        break;
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
