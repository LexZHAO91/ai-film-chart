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

export interface RankingSnapshotItem {
  id: number;
  snapshot_id: number;
  film_id: number;
  rank: number;
  previous_rank: number | null;
  score: number;
  rank_change: number;
  is_new: boolean;
  film_title?: string;
  thumbnail_url?: string;
}

export interface RankingSnapshot {
  id: number;
  ranking_type: string;
  period_start: string;
  period_end: string;
  ranking_version: string;
  published_at: string;
}

export interface RankingResponse {
  snapshot: RankingSnapshot;
  items: RankingSnapshotItem[];
}

export interface FilmScore {
  final_score: number;
  popularity_score: number;
  momentum_score: number;
  engagement_score: number;
  audience_score: number;
  quality_score: number;
}

export interface UserRating {
  average: number;
  count: number;
}

export interface FilmDetailResponse {
  film: Film;
  metrics: FilmMetrics | null;
  aiAnalysis: FilmAIAnalysis | null;
  score: FilmScore | null;
  userRating: UserRating | null;
}

export interface AdminDashboard {
  stats: {
    totalFilms: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  recentJobs: Job[];
}

export interface Job {
  id: number;
  job_id: string;
  type: string;
  status: string;
  cursor: string | null;
  batch_size: number;
  progress: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: number;
  source: string;
  source_video_id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  channel_name: string;
  published_at: string;
  duration_seconds: number;
  is_ai_film: boolean;
  is_story_content: boolean;
  ai_confidence: number;
  status: string;
}
