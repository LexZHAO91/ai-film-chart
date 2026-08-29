-- Migration 0009: Phase 32 - Real Data Completion & First Real Ranking
-- Tables only (columns already added via wrangler execute)

-- ============================================
-- 1. Experimental real ranking snapshots
-- ============================================
CREATE TABLE IF NOT EXISTS ranking_experimental_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_name TEXT NOT NULL, -- e.g., "real_top20_beta_1"
  ranking_type TEXT NOT NULL, -- popularity_only, popularity_audience, full, quality_only
  total_works INTEGER NOT NULL,
  works_with_popularity INTEGER NOT NULL,
  works_without_popularity INTEGER NOT NULL,
  status TEXT DEFAULT 'experimental', -- experimental, reviewed, approved, rejected
  reviewer_notes TEXT DEFAULT NULL,
  calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_ranking_exp_snapshots_name ON ranking_experimental_snapshots(snapshot_name);
CREATE INDEX IF NOT EXISTS idx_ranking_exp_snapshots_type ON ranking_experimental_snapshots(ranking_type);

CREATE TABLE IF NOT EXISTS ranking_experimental_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  work_id INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  score REAL NOT NULL,
  popularity_status TEXT DEFAULT 'UNKNOWN', -- VERIFIED, PARTIAL, UNKNOWN
  has_popularity_data INTEGER DEFAULT 0,
  human_quality_rating INTEGER DEFAULT NULL,
  breakdown_json TEXT DEFAULT '{}',
  FOREIGN KEY (snapshot_id) REFERENCES ranking_experimental_snapshots(id),
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_ranking_exp_items_snapshot ON ranking_experimental_items(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_ranking_exp_items_rank ON ranking_experimental_items(snapshot_id, rank);
