export interface Film {
  id: number;
  source: string;
  source_video_id: string;
  canonical_url: string;
  title: string;
  description: string;
  thumbnail_url: string;
  channel_id: string;
  channel_name: string;
  published_at: string;
  duration_seconds: number;
  language: string;
  is_ai_film: boolean;
  is_story_content: boolean;
  content_type: string;
  genre_json: string;
  ai_generation_level: number;
  ai_confidence: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface FilmMetrics {
  id: number;
  film_id: number;
  collected_at: string;
  views: number;
  likes: number;
  comments: number;
}

export interface FilmAIAnalysis {
  id: number;
  film_id: number;
  model_name: string;
  model_version: string;
  prompt_version: string;
  is_ai_film: boolean;
  is_story_content: boolean;
  content_type: string;
  genres_json: string;
  language: string;
  ai_generation_level: number;
  story_completeness: number;
  summary: string;
  analyzed_at: string;
}

export interface RankingScores {
  id: number;
  film_id: number;
  calculated_at: string;
  popularity_score: number;
  momentum_score: number;
  engagement_score: number;
  audience_score: number;
  quality_score: number;
  final_score: number;
  rank: number;
  previous_rank: number | null;
  ranking_version: string;
}

export interface RankingSnapshot {
  id: number;
  ranking_type: string;
  period_start: string;
  period_end: string;
  ranking_version: string;
  published_at: string;
}

export interface RankingSnapshotItem {
  id: number;
  snapshot_id: number;
  film_id: number;
  rank: number;
  previous_rank: number | null;
  score: number;
  rank_change: number;
  is_new: boolean;
}

export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface Rating {
  id: number;
  user_id: number;
  film_id: number;
  rating: number;
  review: string | null;
  created_at: string;
  updated_at: string;
}

export interface RankingConfig {
  version: string;
  popularity_weight: number;
  momentum_weight: number;
  engagement_weight: number;
  audience_weight: number;
  quality_weight: number;
  minimum_rating_count: number;
  created_at: string;
}

export interface Job {
  id: number;
  job_id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  cursor: string | null;
  batch_size: number;
  progress: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIClassificationResult {
  is_ai_film: boolean;
  is_story_content: boolean;
  content_type: string;
  genre: string[];
  language: string;
  ai_generation_level: number;
  story_completeness: number;
  confidence: number;
  summary: string;
  model_name?: string;
  model_version?: string;
  prompt_version?: string;
}

export interface CandidateVideo {
  source_video_id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  channel_id: string;
  channel_name: string;
  published_at: string;
  duration_seconds: number;
}

export interface RankingType {
  type: 'top100' | 'rising50' | 'new50';
  label: string;
  description: string;
}

export const RANKING_TYPES: RankingType[] = [
  { type: 'top100', label: 'TOP 100', description: '综合最终评分' },
  { type: 'rising50', label: 'RISING 50', description: '重点根据 Momentum' },
  { type: 'new50', label: 'NEW 50', description: '最近加入 Candidate Pool 的作品' },
];
