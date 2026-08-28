-- Migration 0004: Human Review Fields + Verification Status + Recognition Events
-- Phase 26: Real Seed Pool & Ranking Validation

-- ============================================
-- Add human review fields to works
-- ============================================
ALTER TABLE works ADD COLUMN human_quality_rating INTEGER DEFAULT NULL;
ALTER TABLE works ADD COLUMN human_classification TEXT DEFAULT NULL; -- keep, reject, review
ALTER TABLE works ADD COLUMN reviewed_by TEXT DEFAULT NULL;
ALTER TABLE works ADD COLUMN reviewed_at TEXT DEFAULT NULL;
ALTER TABLE works ADD COLUMN review_notes TEXT DEFAULT NULL;
ALTER TABLE works ADD COLUMN eligibility_confidence REAL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_works_human_quality ON works(human_quality_rating);
CREATE INDEX IF NOT EXISTS idx_works_human_classification ON works(human_classification);

-- ============================================
-- recognition_events: detailed festival/award event records
-- ============================================
CREATE TABLE IF NOT EXISTS recognition_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  organization TEXT NOT NULL,
  event_name TEXT NOT NULL,
  year INTEGER,
  category TEXT,
  award_level TEXT NOT NULL, -- WINNER, NOMINEE, OFFICIAL_SELECTION, AUDIENCE_AWARD, JURY_AWARD, HONORABLE_MENTION
  source_url TEXT,
  source_published_at TEXT,
  verification_status TEXT DEFAULT 'UNVERIFIED', -- VERIFIED, UNVERIFIED, CONFLICTED
  verified_at TEXT,
  verified_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_recognition_events_work ON recognition_events(work_id);
CREATE INDEX IF NOT EXISTS idx_recognition_events_verification ON recognition_events(verification_status);

-- ============================================
-- Add verification_status to existing tables
-- ============================================
ALTER TABLE work_sources ADD COLUMN verification_status TEXT DEFAULT 'UNVERIFIED'; -- VERIFIED, UNVERIFIED, CONFLICTED
ALTER TABLE data_provenance ADD COLUMN verification_status TEXT DEFAULT 'UNVERIFIED'; -- VERIFIED, UNVERIFIED, CONFLICTED

-- ============================================
-- ranking_experimental: store experimental ranking results
-- ============================================
CREATE TABLE IF NOT EXISTS ranking_experimental (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  ranking_type TEXT NOT NULL, -- popularity_only, popularity_audience, full
  rank INTEGER NOT NULL,
  score REAL NOT NULL,
  breakdown_json TEXT DEFAULT '{}',
  calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_ranking_exp_type ON ranking_experimental(ranking_type);
CREATE INDEX IF NOT EXISTS idx_ranking_exp_work ON ranking_experimental(work_id);
