-- Migration 0008: Phase 31 - Data Enrichment & Source Correction
--
-- 核心变更：
-- 1. 增加 popularity_status 枚举字段
-- 2. 增加拆分式信任评分（authenticity_score, metadata_completeness, popularity_data_confidence, overall_data_quality）
-- 3. 增加 official_website_url 字段到 works
-- 4. 增加 source_role 到 watch_sources（区分 WATCH/RECOGNITION/METADATA）
-- 5. 增加 data_source_type 到 data_provenance（OFFICIAL/EXTRACTED/COMMUNITY）

-- ============================================
-- 1. Popularity status on works
-- ============================================
ALTER TABLE works ADD COLUMN popularity_status TEXT DEFAULT 'UNKNOWN'; -- VERIFIED, PARTIAL, UNKNOWN

CREATE INDEX IF NOT EXISTS idx_works_popularity_status ON works(popularity_status);

-- ============================================
-- 2. Split trust scores on works
-- ============================================
ALTER TABLE works ADD COLUMN authenticity_score INTEGER DEFAULT NULL; -- 0-100
ALTER TABLE works ADD COLUMN metadata_completeness INTEGER DEFAULT NULL; -- 0-100
ALTER TABLE works ADD COLUMN popularity_data_confidence INTEGER DEFAULT NULL; -- 0-100
ALTER TABLE works ADD COLUMN overall_data_quality INTEGER DEFAULT NULL; -- 0-100

CREATE INDEX IF NOT EXISTS idx_works_authenticity_score ON works(authenticity_score);
CREATE INDEX IF NOT EXISTS idx_works_metadata_completeness ON works(metadata_completeness);

-- ============================================
-- 3. Official website URL on works
-- ============================================
ALTER TABLE works ADD COLUMN official_website_url TEXT DEFAULT NULL;

-- ============================================
-- 4. Source role on watch_sources (reclassify sources)
-- ============================================
ALTER TABLE watch_sources ADD COLUMN source_role TEXT DEFAULT 'WATCH'; -- WATCH, RECOGNITION, METADATA

CREATE INDEX IF NOT EXISTS idx_watch_sources_role ON watch_sources(source_role);

-- ============================================
-- 5. Data source type on data_provenance (OFFICIAL/EXTRACTED/COMMUNITY)
-- ============================================
ALTER TABLE data_provenance ADD COLUMN data_source_type TEXT DEFAULT 'OFFICIAL'; -- OFFICIAL, EXTRACTED, COMMUNITY

-- ============================================
-- 6. Watch source status tracking
-- ============================================
ALTER TABLE watch_sources ADD COLUMN watch_status TEXT DEFAULT 'ACTIVE'; -- ACTIVE, PENDING, UNAVAILABLE
