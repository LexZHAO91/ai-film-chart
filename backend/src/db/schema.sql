-- AI Film Chart Database Schema (Cloudflare D1)
-- Consolidated schema including all migrations 0001-0007

-- ============================================
-- Films table: core film metadata (legacy, kept for backward compat)
-- ============================================
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

-- ============================================
-- Film metrics: historical snapshots
-- ============================================
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

-- ============================================
-- Film AI analysis: versioned AI classification results
-- ============================================
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

-- ============================================
-- Ranking scores
-- ============================================
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

-- ============================================
-- Ranking snapshots
-- ============================================
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

-- ============================================
-- Snapshot items
-- ============================================
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

-- ============================================
-- Users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Ratings
-- ============================================
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

-- ============================================
-- Ranking configs
-- ============================================
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

-- ============================================
-- Jobs
-- ============================================
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

-- ============================================
-- AI usage tracking
-- ============================================
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

-- ============================================
-- Admin audit logs
-- ============================================
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

-- ============================================
-- Works: the core AI Cinema work entity (0003 + all ALTER TABLEs inlined)
-- ============================================
CREATE TABLE IF NOT EXISTS works (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'SHORT_FILM',
  format TEXT DEFAULT 'UNKNOWN',
  synopsis TEXT,
  original_language TEXT,
  country TEXT,
  release_year INTEGER,
  duration_seconds INTEGER,
  ai_contribution_level REAL DEFAULT 0,
  eligibility_status TEXT DEFAULT 'pending',
  quality_status TEXT DEFAULT 'pending',
  creator_name TEXT,
  creator_url TEXT,
  genre_json TEXT DEFAULT '[]',
  tags_json TEXT DEFAULT '[]',
  poster_url TEXT,
  trailer_url TEXT,
  official_site_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  -- 0004: Human review fields
  human_quality_rating INTEGER DEFAULT NULL,
  human_classification TEXT DEFAULT NULL,
  reviewed_by TEXT DEFAULT NULL,
  reviewed_at TEXT DEFAULT NULL,
  review_notes TEXT DEFAULT NULL,
  eligibility_confidence REAL DEFAULT NULL,
  -- 0006: Data trust fields
  data_trust_score INTEGER DEFAULT NULL,
  data_trust_level TEXT DEFAULT NULL,
  synthetic_test_data INTEGER DEFAULT 0,
  synthetic_reason TEXT DEFAULT NULL,
  -- 0006: Blind review fields
  review_mode TEXT DEFAULT NULL,
  reviewer_id TEXT DEFAULT NULL,
  review_round INTEGER DEFAULT 1,
  -- 0007: Authenticity & validation
  authenticity_status TEXT DEFAULT 'UNVERIFIED',
  invalid_reason TEXT DEFAULT NULL,
  validation_eligible INTEGER DEFAULT 0,
  -- 0005: Series support
  is_series INTEGER DEFAULT 0,
  series_episode_count INTEGER DEFAULT NULL,
  -- Phase 30: Verification notes
  verification_notes TEXT DEFAULT NULL,
  -- Phase 31: Popularity status & split trust scores
  popularity_status TEXT DEFAULT 'UNKNOWN',
  authenticity_score INTEGER DEFAULT NULL,
  metadata_completeness INTEGER DEFAULT NULL,
  popularity_data_confidence INTEGER DEFAULT NULL,
  overall_data_quality INTEGER DEFAULT NULL,
  official_website_url TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_works_type ON works(type);
CREATE INDEX IF NOT EXISTS idx_works_eligibility ON works(eligibility_status);
CREATE INDEX IF NOT EXISTS idx_works_quality ON works(quality_status);
CREATE INDEX IF NOT EXISTS idx_works_release_year ON works(release_year);
CREATE INDEX IF NOT EXISTS idx_works_human_quality ON works(human_quality_rating);
CREATE INDEX IF NOT EXISTS idx_works_human_classification ON works(human_classification);
CREATE INDEX IF NOT EXISTS idx_works_data_trust ON works(data_trust_score);
CREATE INDEX IF NOT EXISTS idx_works_synthetic ON works(synthetic_test_data);
CREATE INDEX IF NOT EXISTS idx_works_authenticity ON works(authenticity_status);
CREATE INDEX IF NOT EXISTS idx_works_validation_eligible ON works(validation_eligible);
-- Phase 31 indexes
CREATE INDEX IF NOT EXISTS idx_works_popularity_status ON works(popularity_status);
CREATE INDEX IF NOT EXISTS idx_works_authenticity_score ON works(authenticity_score);
CREATE INDEX IF NOT EXISTS idx_works_metadata_completeness ON works(metadata_completeness);
CREATE INDEX IF NOT EXISTS idx_watch_sources_role ON watch_sources(source_role);

-- ============================================
-- Work sources: platform publishing pages
-- ============================================
CREATE TABLE IF NOT EXISTS work_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  external_id TEXT,
  canonical_url TEXT NOT NULL,
  title_on_source TEXT,
  source_channel TEXT,
  source_published_at TEXT,
  source_metadata_json TEXT DEFAULT '{}',
  is_primary_source INTEGER DEFAULT 0,
  discovered_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  verification_status TEXT DEFAULT 'UNVERIFIED',
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_work_sources_work_id ON work_sources(work_id);
CREATE INDEX IF NOT EXISTS idx_work_sources_type ON work_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_work_sources_external_id ON work_sources(external_id);

-- ============================================
-- Series episodes
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
CREATE INDEX IF NOT EXISTS idx_series_episodes_series ON series_episodes(series_work_id);

-- ============================================
-- Recognition signals (legacy, 0003)
-- ============================================
CREATE TABLE IF NOT EXISTS recognition_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  organization TEXT NOT NULL,
  event TEXT NOT NULL,
  category TEXT,
  award_level TEXT NOT NULL,
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
-- Recognition events (0004: detailed festival/award records)
-- ============================================
CREATE TABLE IF NOT EXISTS recognition_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  organization TEXT NOT NULL,
  event_name TEXT NOT NULL,
  year INTEGER,
  category TEXT,
  award_level TEXT NOT NULL,
  source_url TEXT,
  source_published_at TEXT,
  verification_status TEXT DEFAULT 'UNVERIFIED',
  verified_at TEXT,
  verified_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_recognition_events_work ON recognition_events(work_id);
CREATE INDEX IF NOT EXISTS idx_recognition_events_verification ON recognition_events(verification_status);

-- ============================================
-- Data provenance
-- ============================================
CREATE TABLE IF NOT EXISTS data_provenance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_url TEXT,
  data_field TEXT NOT NULL,
  data_value TEXT,
  confidence REAL DEFAULT 1.0,
  extraction_method TEXT,
  collected_at TEXT DEFAULT CURRENT_TIMESTAMP,
  verification_status TEXT DEFAULT 'UNVERIFIED',
  -- Phase 31: data source type
  data_source_type TEXT DEFAULT 'OFFICIAL', -- OFFICIAL, EXTRACTED, COMMUNITY
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_provenance_work ON data_provenance(work_id);
CREATE INDEX IF NOT EXISTS idx_provenance_field ON data_provenance(data_field);

-- ============================================
-- Work metrics
-- ============================================
CREATE TABLE IF NOT EXISTS work_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  collected_at TEXT DEFAULT CURRENT_TIMESTAMP,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  audience_rating REAL,
  verification_status TEXT DEFAULT 'UNVERIFIED',
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_work_metrics_work ON work_metrics(work_id);
CREATE INDEX IF NOT EXISTS idx_work_metrics_collected ON work_metrics(collected_at);

-- ============================================
-- Data sources
-- ============================================
CREATE TABLE IF NOT EXISTS data_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  adapter_type TEXT NOT NULL,
  config_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active',
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
-- Ranking experimental
-- ============================================
CREATE TABLE IF NOT EXISTS ranking_experimental (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  ranking_type TEXT NOT NULL,
  rank INTEGER NOT NULL,
  score REAL NOT NULL,
  breakdown_json TEXT DEFAULT '{}',
  calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_ranking_exp_type ON ranking_experimental(ranking_type);
CREATE INDEX IF NOT EXISTS idx_ranking_exp_work ON ranking_experimental(work_id);

-- ============================================
-- Ranking objectives (0005)
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

INSERT OR IGNORE INTO ranking_objectives (name, target_top_k, minimum_quality, target_mean_quality, maximum_bad_rate)
VALUES ('default', 10, 4, 4.0, 0.2);

-- ============================================
-- Platform metrics (0005)
-- ============================================
CREATE TABLE IF NOT EXISTS platform_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  platform TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'POPULARITY',
  external_id TEXT,
  url TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  audience_rating REAL DEFAULT NULL,
  rating_count INTEGER DEFAULT 0,
  collected_at TEXT DEFAULT CURRENT_TIMESTAMP,
  verification_status TEXT DEFAULT 'UNVERIFIED',
  confidence REAL DEFAULT 1.0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_work ON platform_metrics(work_id);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_platform ON platform_metrics(platform);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_collected ON platform_metrics(collected_at);

-- ============================================
-- Source confidence (0005)
-- ============================================
CREATE TABLE IF NOT EXISTS source_confidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  verification_status TEXT DEFAULT 'UNVERIFIED',
  reliability_score REAL DEFAULT 0.5,
  last_verified_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO source_confidence (source_name, source_type, reliability_score)
VALUES
  ('youtube', 'PLATFORM', 0.8),
  ('vimeo', 'PLATFORM', 0.7),
  ('manual_seed', 'MANUAL', 0.9),
  ('festival_adapter', 'FESTIVAL', 0.85),
  ('official_website', 'MANUAL', 0.75);

-- ============================================
-- NDCG tracking (0006)
-- ============================================
CREATE TABLE IF NOT EXISTS ranking_ndcg (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ranking_type TEXT NOT NULL,
  top_k INTEGER NOT NULL,
  ndcg_score REAL NOT NULL,
  calculated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ranking_ndcg_type ON ranking_ndcg(ranking_type);

-- ============================================
-- Ranking stability (0006)
-- ============================================
CREATE TABLE IF NOT EXISTS ranking_stability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  top_k INTEGER NOT NULL,
  stability_score REAL NOT NULL,
  test_config TEXT DEFAULT '{}',
  calculated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ranking_stability_k ON ranking_stability(top_k);

-- ============================================
-- Rank movements (0006)
-- ============================================
CREATE TABLE IF NOT EXISTS rank_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  ranking_a_type TEXT NOT NULL,
  ranking_b_type TEXT NOT NULL,
  rank_a INTEGER NOT NULL,
  rank_b INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  movement_type TEXT DEFAULT 'NORMAL',
  explanation TEXT,
  calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_rank_movements_work ON rank_movements(work_id);
CREATE INDEX IF NOT EXISTS idx_rank_movements_extreme ON rank_movements(movement_type);

-- ============================================
-- Watch sources (0007)
-- ============================================
CREATE TABLE IF NOT EXISTS watch_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  url TEXT NOT NULL,
  is_primary INTEGER DEFAULT 0,
  verification_status TEXT DEFAULT 'UNVERIFIED',
  verified_at TEXT,
  verified_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  -- Phase 31: source role & watch status
  source_role TEXT DEFAULT 'WATCH', -- WATCH, RECOGNITION, METADATA
  watch_status TEXT DEFAULT 'ACTIVE', -- ACTIVE, PENDING, UNAVAILABLE
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_watch_sources_work ON watch_sources(work_id);
CREATE INDEX IF NOT EXISTS idx_watch_sources_type ON watch_sources(source_type);

-- ============================================
-- Human baseline rankings (0007)
-- ============================================
CREATE TABLE IF NOT EXISTS human_baseline_rankings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reviewer_id TEXT NOT NULL,
  review_round INTEGER DEFAULT 1,
  work_id INTEGER NOT NULL,
  human_rank INTEGER NOT NULL,
  human_quality_rating INTEGER NOT NULL,
  review_mode TEXT DEFAULT 'blind',
  reviewed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_human_baseline_reviewer ON human_baseline_rankings(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_human_baseline_work ON human_baseline_rankings(work_id);

-- ============================================
-- Reviewer agreements (0007)
-- ============================================
CREATE TABLE IF NOT EXISTS reviewer_agreements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  reviewer_a_id TEXT NOT NULL,
  reviewer_b_id TEXT NOT NULL,
  rating_a INTEGER NOT NULL,
  rating_b INTEGER NOT NULL,
  difference INTEGER NOT NULL,
  agreement_level TEXT NOT NULL,
  calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_reviewer_agreements_work ON reviewer_agreements(work_id);

-- ============================================
-- Golden dataset snapshots (0007)
-- ============================================
CREATE TABLE IF NOT EXISTS golden_dataset_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_name TEXT NOT NULL,
  total_works INTEGER NOT NULL,
  verified_count INTEGER NOT NULL,
  unverified_count INTEGER NOT NULL,
  invalid_count INTEGER NOT NULL,
  quality_distribution_json TEXT DEFAULT '{}',
  source_distribution_json TEXT DEFAULT '{}',
  recognition_distribution_json TEXT DEFAULT '{}',
  data_trust_stats_json TEXT DEFAULT '{}',
  reviewer_stats_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Seed default data sources
-- ============================================
INSERT OR IGNORE INTO data_sources (source_id, name, source_type, adapter_type, status) VALUES
  ('youtube_discovery', 'YouTube Discovery', 'DISCOVERY', 'YOUTUBE', 'active'),
  ('youtube_popularity', 'YouTube Popularity', 'POPULARITY', 'YOUTUBE', 'active'),
  ('festival_recognition', 'Festival Recognition', 'RECOGNITION', 'FESTIVAL', 'active'),
  ('manual_seed', 'Manual Seed Import', 'DISCOVERY', 'MANUAL', 'active');

-- ============================================
-- Seed default ranking config
-- ============================================
INSERT OR IGNORE INTO ranking_configs (
  version, popularity_weight, momentum_weight, engagement_weight,
  audience_weight, quality_weight, minimum_rating_count
) VALUES (
  'v0.1', 0.35, 0.25, 0.15, 0.15, 0.10, 5
);
