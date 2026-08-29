-- Migration 0007: Phase 29 - Golden Dataset, Authenticity, Watch Sources, Human Baseline

-- ============================================
-- Add authenticity_status to works (independent from synthetic_test_data)
-- ============================================
ALTER TABLE works ADD COLUMN authenticity_status TEXT DEFAULT 'UNVERIFIED'; -- VERIFIED, UNVERIFIED, INVALID
ALTER TABLE works ADD COLUMN invalid_reason TEXT DEFAULT NULL;
ALTER TABLE works ADD COLUMN validation_eligible INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_works_authenticity ON works(authenticity_status);
CREATE INDEX IF NOT EXISTS idx_works_validation_eligible ON works(validation_eligible);

-- ============================================
-- Watch Sources: separate viewing entry points from work_sources
-- ============================================
CREATE TABLE IF NOT EXISTS watch_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  source_type TEXT NOT NULL, -- OFFICIAL_WEBSITE, YOUTUBE, VIMEO, FESTIVAL_SCREENING, OTHER
  url TEXT NOT NULL,
  is_primary INTEGER DEFAULT 0,
  verification_status TEXT DEFAULT 'UNVERIFIED', -- VERIFIED, UNVERIFIED, INVALID
  verified_at TEXT,
  verified_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_watch_sources_work ON watch_sources(work_id);
CREATE INDEX IF NOT EXISTS idx_watch_sources_type ON watch_sources(source_type);

-- ============================================
-- Human Baseline Ranking: reviewer-provided full ranking
-- ============================================
CREATE TABLE IF NOT EXISTS human_baseline_rankings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reviewer_id TEXT NOT NULL,
  review_round INTEGER DEFAULT 1,
  work_id INTEGER NOT NULL,
  human_rank INTEGER NOT NULL,
  human_quality_rating INTEGER NOT NULL,
  review_mode TEXT DEFAULT 'blind', -- blind, standard
  reviewed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_human_baseline_reviewer ON human_baseline_rankings(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_human_baseline_work ON human_baseline_rankings(work_id);

-- ============================================
-- Reviewer Agreement tracking
-- ============================================
CREATE TABLE IF NOT EXISTS reviewer_agreements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  reviewer_a_id TEXT NOT NULL,
  reviewer_b_id TEXT NOT NULL,
  rating_a INTEGER NOT NULL,
  rating_b INTEGER NOT NULL,
  difference INTEGER NOT NULL,
  agreement_level TEXT NOT NULL, -- PERFECT, GOOD, MODERATE, POOR
  calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_reviewer_agreements_work ON reviewer_agreements(work_id);

-- ============================================
-- Golden Dataset metadata
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
