import type { D1Database } from '@cloudflare/workers-types';
import { FilmModel } from '../models/film';
import { RankingModel } from '../models/ranking';
import { JobModel } from '../models/job';
import { RankingEngine } from '../ranking/ranking-engine';
import { RANKING_TYPES } from '../types';

interface RankingJobConfig {
  maxFilms: number;
}

export async function runRankingJob(
  db: D1Database,
  jobId: string,
  config: RankingJobConfig = { maxFilms: 1000 }
): Promise<void> {
  const filmModel = new FilmModel(db);
  const rankingModel = new RankingModel(db);
  const jobModel = new JobModel(db);

  await jobModel.updateStatus(jobId, 'processing');

  try {
    const rankingConfig = await rankingModel.getLatestConfig();
    if (!rankingConfig) {
      throw new Error('No ranking config found');
    }

    const engine = new RankingEngine(rankingConfig);
    const films = await filmModel.findAll({ status: 'approved', limit: config.maxFilms });

    if (films.length === 0) {
      await jobModel.updateStatus(jobId, 'completed');
      await jobModel.updateProgress(jobId, 100, undefined);
      return;
    }

    await jobModel.updateProgress(jobId, 30, 'calculating');

    // Calculate scores
    const scores = await engine.runRanking(db, films, rankingConfig.version);

    await jobModel.updateProgress(jobId, 60, 'saving');

    // Save scores
    await rankingModel.saveScores(scores);

    await jobModel.updateProgress(jobId, 80, 'snapshot');

    // Create snapshots for each ranking type
    const now = new Date();
    const periodStart = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // TOP 100 snapshot
    const top100Scores = scores.slice(0, 100);
    const top100SnapshotId = await rankingModel.createSnapshot(
      'top100',
      rankingConfig.version,
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
      rankingConfig.version,
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
      rankingConfig.version,
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await jobModel.updateStatus(jobId, 'failed', errorMessage);
    throw error;
  }
}
