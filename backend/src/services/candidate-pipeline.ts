import type { D1Database } from '@cloudflare/workers-types';
import type { CandidateVideo } from '../types';
import { FilmModel } from '../models/film';
import { JobModel } from '../models/job';
import { DiscoveryScoreService } from './discovery-score-service';

export interface PipelineResult {
  processed: number;
  accepted: number;
  rejected: number;
  errors: number;
  details: PipelineItemResult[];
}

export interface PipelineItemResult {
  source_video_id: string;
  status: 'accepted' | 'rejected' | 'error' | 'duplicate';
  reason?: string;
  discoveryScore?: number;
}

/**
 * Candidate Pipeline
 *
 * Phase 4 完整实现：
 * YouTube Search
 * ↓
 * Candidate Collection
 * ↓
 * Deduplication
 * ↓
 * Discovery Score
 * ↓
 * Rule Filter
 * ↓
 * AI Classification
 * ↓
 * Candidate Pool
 *
 * 要求：
 * - 支持 batch
 * - 支持 cursor
 * - 支持 retry
 * - 单条失败不能阻塞 batch
 * - source_video_id 唯一
 * - 记录 reject_reason
 */
export class CandidatePipeline {
  private discoveryService = new DiscoveryScoreService();

  constructor(private db: D1Database) {}

  async processBatch(
    videos: CandidateVideo[],
    jobId: string,
    options: {
      skipDiscoveryScore?: boolean;
      skipRuleFilter?: boolean;
    } = {}
  ): Promise<PipelineResult> {
    const filmModel = new FilmModel(this.db);
    const jobModel = new JobModel(this.db);

    const result: PipelineResult = {
      processed: 0,
      accepted: 0,
      rejected: 0,
      errors: 0,
      details: [],
    };

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];

      // Update progress periodically
      if (i % 5 === 0) {
        await jobModel.updateProgress(jobId, Math.floor((i / videos.length) * 100), 'processing');
      }

      try {
        // Step 1: Deduplication
        const existing = await filmModel.findBySourceVideoId(video.source_video_id);
        if (existing) {
          result.details.push({
            source_video_id: video.source_video_id,
            status: 'duplicate',
            reason: 'Already exists in database',
          });
          result.rejected++;
          continue;
        }

        // Step 2: Discovery Score (unless skipped)
        if (!options.skipDiscoveryScore) {
          const discoveryResult = this.discoveryService.calculateScore({
            views: 0, // Will be updated after metrics collection
            likes: 0,
            comments: 0,
            publishedAt: new Date(video.published_at),
            durationSeconds: video.duration_seconds,
          });

          if (!discoveryResult.passed) {
            result.details.push({
              source_video_id: video.source_video_id,
              status: 'rejected',
              reason: `Discovery score too low: ${discoveryResult.score.toFixed(3)}. ${discoveryResult.reasons.join(', ')}`,
              discoveryScore: discoveryResult.score,
            });
            result.rejected++;
            continue;
          }
        }

        // Step 3: Rule Filter (unless skipped)
        if (!options.skipRuleFilter) {
          const ruleCheck = this.applyRuleFilter(video);
          if (!ruleCheck.passed) {
            result.details.push({
              source_video_id: video.source_video_id,
              status: 'rejected',
              reason: `Rule filter: ${ruleCheck.reason}`,
            });
            result.rejected++;
            continue;
          }
        }

        // Step 4: Add to Candidate Pool as pending
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
          language: 'unknown',
          is_ai_film: false,
          is_story_content: false,
          content_type: 'unknown',
          genre_json: JSON.stringify([]),
          ai_generation_level: 0,
          ai_confidence: 0,
          status: 'pending',
        });

        result.details.push({
          source_video_id: video.source_video_id,
          status: 'accepted',
        });
        result.accepted++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.details.push({
          source_video_id: video.source_video_id,
          status: 'error',
          reason: errorMessage,
        });
        result.errors++;
      }

      result.processed++;
    }

    await jobModel.updateProgress(jobId, 100, 'completed');

    return result;
  }

  private applyRuleFilter(video: CandidateVideo): { passed: boolean; reason?: string } {
    // Minimum duration: 30 seconds
    if (video.duration_seconds < 30) {
      return { passed: false, reason: 'Duration too short (< 30s)' };
    }

    // Maximum duration: 30 minutes
    if (video.duration_seconds > 1800) {
      return { passed: false, reason: 'Duration too long (> 30min)' };
    }

    // Title must not be empty
    if (!video.title || video.title.trim().length < 5) {
      return { passed: false, reason: 'Title too short or empty' };
    }

    // Description must not be empty
    if (!video.description || video.description.trim().length < 10) {
      return { passed: false, reason: 'Description too short or empty' };
    }

    return { passed: true };
  }
}
