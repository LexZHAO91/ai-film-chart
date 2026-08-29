-- Migration 0011: Fix ratings table for anonymous users
-- Problem: user_id was INTEGER with FK to users(id), but anonymous ratings use string IDs
-- Solution: Change user_id to TEXT, drop FK constraint, keep UNIQUE(user_id, film_id)

-- SQLite doesn't support ALTER COLUMN, so we recreate the table
CREATE TABLE IF NOT EXISTS ratings_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  film_id INTEGER NOT NULL,
  rating REAL NOT NULL CHECK(rating >= 0 AND rating <= 10),
  review TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, film_id)
);

-- Copy existing data (convert integer user_ids to text)
INSERT INTO ratings_new (id, user_id, film_id, rating, review, created_at, updated_at)
SELECT id, CAST(user_id AS TEXT), film_id, rating, review, created_at, updated_at
FROM ratings;

-- Drop old table and rename
DROP TABLE IF EXISTS ratings;
ALTER TABLE ratings_new RENAME TO ratings;

CREATE INDEX IF NOT EXISTS idx_ratings_film ON ratings(film_id);
