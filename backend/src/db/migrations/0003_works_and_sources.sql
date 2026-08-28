-- Migration 0003: Works and Work Sources
-- Phase 21: Work / WorkSource 数据模型
--
-- 核心原则：
-- - 不删除现有 films 表，保持向后兼容
-- - 新增 works + work_sources 作为更通用的数据模型
-- - Work = 真正的影视作品实体
-- - WorkSource = 作品在某个平台上的发布页面

-- ============================================
-- works: 真正的影视作品实体
-- ============================================
CREATE TABLE IF NOT EXISTS works (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'SHORT_FILM', -- SHORT_FILM, FEATURE_FILM, SERIES, DOCUMENTARY, EXPERIMENTAL
  format TEXT DEFAULT 'UNKNOWN', -- ANIMATION, LIVE_ACTION, MIXED, UNKNOWN
  synopsis TEXT,
  original_language TEXT,
  country TEXT,
  release_year INTEGER,
  duration_seconds INTEGER,
  ai_contribution_level REAL DEFAULT 0,
  eligibility_status TEXT DEFAULT 'pending', -- pending, eligible, ineligible, approved, rejected, excluded
  quality_status TEXT DEFAULT 'pending', -- pending, reviewed, approved, flagged
  creator_name TEXT,
  creator_url TEXT,
  genre_json TEXT DEFAULT '[]',
  tags_json TEXT DEFAULT '[]',
  poster_url TEXT,
  trailer_url TEXT,
  official_site_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_works_type ON works(type);
CREATE INDEX IF NOT EXISTS idx_works_eligibility ON works(eligibility_status);
CREATE INDEX IF NOT EXISTS idx_works_quality ON works(quality_status);
CREATE INDEX IF NOT EXISTS idx_works_release_year ON works(release_year);

-- ============================================
-- work_sources: 作品在各个平台上的发布来源
-- ============================================
CREATE TABLE IF NOT EXISTS work_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  source_type TEXT NOT NULL, -- YOUTUBE, VIMEO, FESTIVAL, OFFICIAL_SITE, OTHER
  external_id TEXT,
  canonical_url TEXT NOT NULL,
  title_on_source TEXT,
  source_channel TEXT,
  source_published_at TEXT,
  source_metadata_json TEXT DEFAULT '{}',
  is_primary_source INTEGER DEFAULT 0,
  discovered_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_work_sources_work_id ON work_sources(work_id);
CREATE INDEX IF NOT EXISTS idx_work_sources_type ON work_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_work_sources_external_id ON work_sources(external_id);

-- ============================================
-- series_episodes: 剧集的分集信息
-- ============================================
CREATE TABLE IF NOT EXISTS series_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  series_work_id INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  season_number INTEGER DEFAULT 1,
  title TEXT NOT NULL,
  synopsis TEXT,
  duration_seconds INTEGER,
  release_date TEXT,
  source_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (series_work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_episodes_series ON series_episodes(series_work_id);

-- ============================================
-- recognition_signals: 作品获得的赛事/奖项/认可
-- ============================================
CREATE TABLE IF NOT EXISTS recognition_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  organization TEXT NOT NULL,
  event TEXT NOT NULL,
  category TEXT,
  award_level TEXT NOT NULL, -- WINNER, NOMINEE, OFFICIAL_SELECTION, AUDIENCE_AWARD, JURY_AWARD, HONORABLE_MENTION
  year INTEGER,
  source_url TEXT,
  verified INTEGER DEFAULT 0,
  verified_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_recognition_work ON recognition_signals(work_id);
CREATE INDEX IF NOT EXISTS idx_recognition_org ON recognition_signals(organization);
CREATE INDEX IF NOT EXISTS idx_recognition_level ON recognition_signals(award_level);

-- ============================================
-- data_provenance: 数据来源审计
-- ============================================
CREATE TABLE IF NOT EXISTS data_provenance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  source_type TEXT NOT NULL, -- YOUTUBE, FESTIVAL, MANUAL, ADMIN, OTHER
  source_url TEXT,
  data_field TEXT NOT NULL, -- views, likes, rating, award, duration, etc.
  data_value TEXT,
  confidence REAL DEFAULT 1.0,
  extraction_method TEXT, -- API, SCRAPER, MANUAL_ENTRY, AI_INFERENCE
  collected_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_provenance_work ON data_provenance(work_id);
CREATE INDEX IF NOT EXISTS idx_provenance_field ON data_provenance(data_field);

-- ============================================
-- work_metrics: 作品指标历史（类似 film_metrics，但面向 work）
-- ============================================
CREATE TABLE IF NOT EXISTS work_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  source_type TEXT NOT NULL, -- 指标来自哪个来源
  collected_at TEXT DEFAULT CURRENT_TIMESTAMP,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  audience_rating REAL,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_work_metrics_work ON work_metrics(work_id);
CREATE INDEX IF NOT EXISTS idx_work_metrics_collected ON work_metrics(collected_at);

-- ============================================
-- data_sources: 数据源配置与管理
-- ============================================
CREATE TABLE IF NOT EXISTS data_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL, -- DISCOVERY, POPULARITY, RECOGNITION, AUDIENCE, METADATA
  adapter_type TEXT NOT NULL, -- YOUTUBE, FESTIVAL, MANUAL, OTHER
  config_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active', -- active, paused, disabled, error
  last_run_at TEXT,
  last_error TEXT,
  candidate_count INTEGER DEFAULT 0,
  successful_imports INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_data_sources_status ON data_sources(status);

-- ============================================
-- Seed default data sources
-- ============================================
INSERT OR IGNORE INTO data_sources (source_id, name, source_type, adapter_type, status) VALUES
  ('youtube_discovery', 'YouTube Discovery', 'DISCOVERY', 'YOUTUBE', 'active'),
  ('youtube_popularity', 'YouTube Popularity', 'POPULARITY', 'YOUTUBE', 'active'),
  ('festival_recognition', 'Festival Recognition', 'RECOGNITION', 'FESTIVAL', 'active'),
  ('manual_seed', 'Manual Seed Import', 'DISCOVERY', 'MANUAL', 'active');
