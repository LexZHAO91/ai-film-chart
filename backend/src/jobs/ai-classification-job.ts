import type { D1Database } from '@cloudflare/workers-types';
import { FilmModel } from '../models/film';
import { JobModel } from '../models/job';
import { AIUsageService } from '../services/ai-usage-service';
import { CloudflareWorkersAIClassifier } from '../ai/cloudflare-workers-ai-classifier';
import { withRetry } from '../utils/retry';

interface AIClassificationJobConfig {
  batchSize: number;
  maxFilms: number;
}

export async function runAIClassificationJob(
  db: D1Database,
  cfAccountId: string,
  cfApiToken: string,
  jobId: string,
  config: AIClassificationJobConfig = { batchSize: 20, maxFilms: 200 }
): Promise<void> {
  const filmModel = new FilmModel(db);
  const jobModel = new JobModel(db);
  const aiUsage = new AIUsageService(db);
  const classifier = new CloudflareWorkersAIClassifier(undefined, cfAccountId, cfApiToken);

  await jobModel.updateStatus(jobId, 'processing');

  // Check AI budget
  const budgetStatus = await aiUsage.getBudgetStatus();
  if (budgetStatus.status === 'stopped') {
    await jobModel.updateStatus(jobId, 'failed', 'AI budget exceeded');
    return;
  }

  try {
    const pendingFilms = await filmModel.getFilmsNeedingAIAnalysis(config.maxFilms);

    if (pendingFilms.length === 0) {
      await jobModel.updateStatus(jobId, 'completed');
      await jobModel.updateProgress(jobId, 100, undefined);
      return;
    }

    let processed = 0;

    for (let i = 0; i < pendingFilms.length; i += config.batchSize) {
      const batch = pendingFilms.slice(i, i + config.batchSize);
      const progress = Math.floor((i / pendingFilms.length) * 100);
      await jobModel.updateProgress(jobId, progress, String(i));

      for (const film of batch) {
        // Check budget before each classification
        const shouldProcess = await aiUsage.shouldProcessTask('medium');
        if (!shouldProcess) {
          await jobModel.updateStatus(jobId, 'failed', 'AI budget limit reached during processing');
          return;
        }

        try {
          const result = await withRetry(
            () => classifier.classify(film.title, film.description, film.duration_seconds),
            { maxRetries: 2, baseDelay: 1000 }
          );

          if (result) {
            await filmModel.addAIAnalysis({
              film_id: film.id,
              model_name: classifier.name,
              model_version: classifier.modelVersion,
              prompt_version: classifier.promptVersion,
              is_ai_film: result.is_ai_film,
              is_story_content: result.is_story_content,
              content_type: result.content_type,
              genres_json: JSON.stringify(result.genre),
              language: result.language,
              ai_generation_level: result.ai_generation_level,
              story_completeness: result.story_completeness,
              summary: result.summary,
            });

            // Update film with classification results
            await filmModel.update(film.id, {
              is_ai_film: result.is_ai_film,
              is_story_content: result.is_story_content,
              content_type: result.content_type,
              genre_json: JSON.stringify(result.genre),
              language: result.language,
              ai_generation_level: result.ai_generation_level,
              ai_confidence: result.confidence,
            });

            // Record AI usage (estimate)
            await aiUsage.recordUsage({
              requests: 1,
              estimatedTokens: 500,
              neurons: 50,
              taskType: 'classification',
            });
          }
        } catch (error) {
          // Log error but continue with next film
          console.error(`AI classification failed for film ${film.id}:`, error);
        }

        processed++;
      }

      // Rate limit protection between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    await jobModel.updateStatus(jobId, 'completed');
    await jobModel.updateProgress(jobId, 100, undefined);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await jobModel.updateStatus(jobId, 'failed', errorMessage);
    throw error;
  }
}
