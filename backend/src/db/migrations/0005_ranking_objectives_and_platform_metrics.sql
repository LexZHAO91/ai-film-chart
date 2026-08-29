-- Migration 0005: Ranking Objectives + Platform Metrics + Popularity Source Confidence
-- Phase 27: Ranking Laboratory & Experimental Dataset Expansion

-- ============================================
-- ranking_objectives: configurable ranking targets
-- ============================================
CREATE TABLE IF NOT EXISTS ranking_objectives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  target_top_k INTEGER NOT NULL DEFAULT 10,
  minimum_quality INTEGER NOT NULL DEFAULT 4,
  target_mean_quality REAL NOT NULL DEFAULT 4.0,
  maximum_bad_rate REAL NOT NULL DEFAULT 0.2,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Insert default objective
INSERT OR IGNORE INTO ranking_objectives (name, target_top_k, minimum_quality, target_mean_quality, maximum_bad_rate)
VALUES ('default', 10, 4, 4.0, 0.2);

-- ============================================
-- platform_metrics: abstract popularity metrics across platforms
-- ============================================
CREATE TABLE IF NOT EXISTS platform_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  platform TEXT NOT NULL, -- youtube, vimeo, bilibili, etc.
  source_type TEXT NOT NULL DEFAULT 'POPULARITY', -- POPULARITY, AUDIENCE, RECOGNITION
  external_id TEXT, -- video_id, channel_id, etc.
  url TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  audience_rating REAL DEFAULT NULL, -- e.g. average rating if available
  rating_count INTEGER DEFAULT 0,
  collected_at TEXT DEFAULT CURRENT_TIMESTAMP,
  verification_status TEXT DEFAULT 'UNVERIFIED', -- VERIFIED, UNVERIFIED, CONFLICTED
  confidence REAL DEFAULT 1.0, -- data source confidence (0.0-1.0)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_work ON platform_metrics(work_id);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_platform ON platform_metrics(platform);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_collected ON platform_metrics(collected_at);

-- ============================================
-- source_confidence: track data source reliability
-- ============================================
CREATE TABLE IF NOT EXISTS source_confidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL, -- PLATFORM, FESTIVAL, MANUAL, API
  verification_status TEXT DEFAULT 'UNVERIFIED',
  reliability_score REAL DEFAULT 0.5, -- 0.0-1.0
  last_verified_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial source confidence entries
INSERT OR IGNORE INTO source_confidence (source_name, source_type, reliability_score)
VALUES
  ('youtube', 'PLATFORM', 0.8),
  ('vimeo', 'PLATFORM', 0.7),
  ('manual_seed', 'MANUAL', 0.9),
  ('festival_adapter', 'FESTIVAL', 0.85),
  ('official_website', 'MANUAL', 0.75);

-- ============================================
-- series_episodes: for AI Series (not individual episodes as works)
-- ============================================
CREATE TABLE IF NOT EXISTS series_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  series_work_id INTEGER NOT NULL, -- references works.id (the series itself)
  episode_number INTEGER NOT NULL,
  title TEXT,
  duration_seconds INTEGER,
  synopsis TEXT,
  release_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (series_work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_series_episodes_series ON series_episodes(series_work_id);

-- ============================================
-- Add series flag to works
-- ============================================
ALTER TABLE works ADD COLUMN is_series INTEGER DEFAULT 0;
ALTER TABLE works ADD COLUMN series_episode_count INTEGER DEFAULT NULL;
