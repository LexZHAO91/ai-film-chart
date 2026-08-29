-- Migration 0006: Phase 28 - Data Trust, Blind Review, Synthetic Data Markers

-- ============================================
-- Add data trust fields to works
-- ============================================
ALTER TABLE works ADD COLUMN data_trust_score INTEGER DEFAULT NULL;
ALTER TABLE works ADD COLUMN data_trust_level TEXT DEFAULT NULL; -- HIGH, MEDIUM, LOW
ALTER TABLE works ADD COLUMN synthetic_test_data INTEGER DEFAULT 0;
ALTER TABLE works ADD COLUMN synthetic_reason TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_works_data_trust ON works(data_trust_score);
CREATE INDEX IF NOT EXISTS idx_works_synthetic ON works(synthetic_test_data);

-- ============================================
-- Add blind review fields to works
-- ============================================
ALTER TABLE works ADD COLUMN review_mode TEXT DEFAULT NULL; -- blind, standard
ALTER TABLE works ADD COLUMN reviewer_id TEXT DEFAULT NULL;
ALTER TABLE works ADD COLUMN review_round INTEGER DEFAULT 1;

-- ============================================
-- Add NDCG tracking table
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
-- Add ranking stability tracking
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
-- Add extreme rank movement tracking
-- ============================================
CREATE TABLE IF NOT EXISTS rank_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  ranking_a_type TEXT NOT NULL,
  ranking_b_type TEXT NOT NULL,
  rank_a INTEGER NOT NULL,
  rank_b INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  movement_type TEXT DEFAULT 'NORMAL', -- NORMAL, EXTREME
  explanation TEXT,
  calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_rank_movements_work ON rank_movements(work_id);
CREATE INDEX IF NOT EXISTS idx_rank_movements_extreme ON rank_movements(movement_type);
