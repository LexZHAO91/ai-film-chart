-- Phase 35: Initial 100 Works & Global Discovery Refactor
-- Architecture Changes:
-- 1. Watch Source is OPTIONAL (not required for Ranking or Golden Dataset)
-- 2. Candidate Pool = Official candidate pool
-- 3. Initial Rating system (separate from human_quality_rating)
-- 4. Data Availability tracking per work

-- ============================================
-- 1. Add initial_rating columns to works
-- ============================================
ALTER TABLE works ADD COLUMN initial_rating REAL;
ALTER TABLE works ADD COLUMN initial_rating_source TEXT;
ALTER TABLE works ADD COLUMN initial_rating_confidence REAL DEFAULT 0;
ALTER TABLE works ADD COLUMN initial_rating_raw_value TEXT;
ALTER TABLE works ADD COLUMN initial_rating_source_url TEXT;
ALTER TABLE works ADD COLUMN initial_rating_collected_at TEXT;

-- ============================================
-- 2. Add data_availability JSON tracking
-- ============================================
ALTER TABLE works ADD COLUMN data_availability TEXT;
-- JSON format: {"metadata":"COMPLETE|PARTIAL|UNKNOWN","popularity":"VERIFIED|PARTIAL|UNKNOWN","audience":"VERIFIED|UNKNOWN","recognition":"VERIFIED|UNKNOWN","watch":"AVAILABLE|UNAVAILABLE"}

-- ============================================
-- 3. Add pool_status for candidate pool management
-- ============================================
ALTER TABLE works ADD COLUMN pool_status TEXT DEFAULT 'CANDIDATE';
-- Values: CANDIDATE, INITIAL_POOL, ARCHIVED, REJECTED

-- ============================================
-- 4. Add initial_rating_override_log
-- ============================================
CREATE TABLE IF NOT EXISTS initial_rating_override_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  old_value REAL,
  new_value REAL NOT NULL,
  reason TEXT NOT NULL,
  operator TEXT NOT NULL,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

-- ============================================
-- 5. Add discovery_candidates table for tracking found works
-- ============================================
CREATE TABLE IF NOT EXISTS discovery_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  creator TEXT,
  source TEXT NOT NULL,
  source_url TEXT,
  source_type TEXT NOT NULL,
  work_type TEXT,
  year INTEGER,
  duration INTEGER,
  synopsis TEXT,
  genre TEXT,
  country TEXT,
  language TEXT,
  recognition TEXT,
  watch_url TEXT,
  ai_tools TEXT,
  discovery_score REAL DEFAULT 0,
  eligibility_status TEXT DEFAULT 'PENDING',
  reject_reason TEXT,
  duplicate_of INTEGER,
  added_to_pool INTEGER DEFAULT 0,
  work_id INTEGER,
  discovered_at TEXT DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

-- ============================================
-- 6. Add external_ratings table
-- ============================================
CREATE TABLE IF NOT EXISTS external_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  score TEXT NOT NULL,
  rating_count INTEGER,
  source_url TEXT,
  collected_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

-- ============================================
-- 7. Update existing works: set pool_status
-- ============================================
UPDATE works SET pool_status = 'INITIAL_POOL' WHERE eligibility_status = 'approved';
UPDATE works SET pool_status = 'CANDIDATE' WHERE eligibility_status = 'pending';
UPDATE works SET pool_status = 'REJECTED' WHERE eligibility_status = 'rejected';

-- ============================================
-- 8. Update existing works: set data_availability
-- ============================================
-- This will be populated by the Phase 35 service
