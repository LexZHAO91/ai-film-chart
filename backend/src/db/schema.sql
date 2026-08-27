-- AI Film Chart Database Schema (Cloudflare D1)

-- Films table: core film metadata
CREATE TABLE IF NOT EXISTS films (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL DEFAULT 'youtube',
  source_video_id TEXT NOT NULL UNIQUE,
  canonical_url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  channel_id TEXT,
  channel_name TEXT,
  published_at TEXT,
  duration_seconds INTEGER DEFAULT 0,
  language TEXT,
  is_ai_film INTEGER DEFAULT 0,
  is_story_content INTEGER DEFAULT 0,
  content_type TEXT,
  genre_json TEXT DEFAULT '[]',
  ai_generation_level REAL DEFAULT 0,
  ai_confidence REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_films_status ON films(status);
CREATE INDEX IF NOT EXISTS idx_films_published_at ON films(published_at);
CREATE INDEX IF NOT EXISTS idx_films_is_ai_film ON films(is_ai_film);

-- Film metrics: historical snapshots, never overwrite
CREATE TABLE IF NOT EXISTS film_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  film_id INTEGER NOT NULL,
  collected_at TEXT DEFAULT CURRENT_TIMESTAMP,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  FOREIGN KEY (film_id) REFERENCES films(id)
);

CREATE INDEX IF NOT EXISTS idx_metrics_film_id ON film_metrics(film_id);
CREATE INDEX IF NOT EXISTS idx_metrics_collected_at ON film_metrics(collected_at);

-- Film AI analysis: versioned AI classification results
CREATE TABLE IF NOT EXISTS film_ai_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  film_id INTEGER NOT NULL,
  model_name TEXT,
  model_version TEXT,
  prompt_version TEXT,
  is_ai_film INTEGER DEFAULT 0,
  is_story_content INTEGER DEFAULT 0,
  content_type TEXT,
  genres_json TEXT DEFAULT '[]',
  language TEXT,
  ai_generation_level REAL DEFAULT 0,
  story_completeness REAL DEFAULT 0,
  summary TEXT,
  analyzed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (film_id) REFERENCES films(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_film_id ON film_ai_analysis(film_id);

-- Ranking scores: calculated scores per film per version
CREATE TABLE IF NOT EXISTS ranking_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  film_id INTEGER NOT NULL,
  calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  popularity_score REAL DEFAULT 0,
  momentum_score REAL DEFAULT 0,
  engagement_score REAL DEFAULT 0,
  audience_score REAL DEFAULT 0,
  quality_score REAL DEFAULT 0,
  final_score REAL DEFAULT 0,
  rank INTEGER,
  previous_rank INTEGER,
  ranking_version TEXT,
  FOREIGN KEY (film_id) REFERENCES films(id)
);

CREATE INDEX IF NOT EXISTS idx_scores_version ON ranking_scores(ranking_version);
CREATE INDEX IF NOT EXISTS idx_scores_rank ON ranking_scores(rank);

-- Ranking snapshots: each published edition
CREATE TABLE IF NOT EXISTS ranking_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ranking_type TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  ranking_version TEXT NOT NULL,
  published_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_snapshots_type ON ranking_snapshots(ranking_type);
CREATE INDEX IF NOT EXISTS idx_snapshots_published ON ranking_snapshots(published_at);

-- Snapshot items: individual film entries in a snapshot
CREATE TABLE IF NOT EXISTS ranking_snapshot_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  film_id INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  previous_rank INTEGER,
  score REAL NOT NULL,
  rank_change INTEGER DEFAULT 0,
  is_new INTEGER DEFAULT 0,
  FOREIGN KEY (snapshot_id) REFERENCES ranking_snapshots(id),
  FOREIGN KEY (film_id) REFERENCES films(id)
);

CREATE INDEX IF NOT EXISTS idx_snapshot_items_snapshot ON ranking_snapshot_items(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_items_rank ON ranking_snapshot_items(rank);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Ratings table: user ratings with unique constraint per user+film
CREATE TABLE IF NOT EXISTS ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  film_id INTEGER NOT NULL,
  rating REAL NOT NULL CHECK(rating >= 0 AND rating <= 10),
  review TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, film_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (film_id) REFERENCES films(id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_film ON ratings(film_id);

-- Ranking configs: versioned algorithm parameters
CREATE TABLE IF NOT EXISTS ranking_configs (
  version TEXT PRIMARY KEY,
  popularity_weight REAL NOT NULL DEFAULT 0.35,
  momentum_weight REAL NOT NULL DEFAULT 0.25,
  engagement_weight REAL NOT NULL DEFAULT 0.15,
  audience_weight REAL NOT NULL DEFAULT 0.15,
  quality_weight REAL NOT NULL DEFAULT 0.10,
  minimum_rating_count INTEGER DEFAULT 5,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Jobs table: batch processing jobs with checkpoint support
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  cursor TEXT,
  batch_size INTEGER DEFAULT 20,
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);

-- AI usage tracking: daily quota protection
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  requests INTEGER DEFAULT 0,
  estimated_tokens INTEGER DEFAULT 0,
  neurons REAL DEFAULT 0,
  task_type TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date, task_type)
);

-- Admin audit logs: track admin actions
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  film_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  operator TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (film_id) REFERENCES films(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_film_id ON admin_audit_logs(film_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON admin_audit_logs(created_at);

-- Seed default ranking config
INSERT OR IGNORE INTO ranking_configs (
  version, popularity_weight, momentum_weight, engagement_weight,
  audience_weight, quality_weight, minimum_rating_count
) VALUES (
  'v0.1', 0.35, 0.25, 0.15, 0.15, 0.10, 5
);
