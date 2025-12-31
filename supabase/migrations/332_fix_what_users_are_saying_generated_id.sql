-- Fix what_users_are_saying to use generated_id (UUID) instead of response_id (TEXT)
-- Links to news.generated.id instead of news.generated.article_id

-- ============================================================================
-- STEP 1: Drop existing index on response_id
-- ============================================================================

DROP INDEX IF EXISTS news.idx_what_users_are_saying_response_id;

-- ============================================================================
-- STEP 2: Add temporary column for UUID values
-- ============================================================================

ALTER TABLE news.what_users_are_saying
  ADD COLUMN generated_id_temp UUID;

-- ============================================================================
-- STEP 3: Migrate data from response_id to generated_id_temp
-- ============================================================================

-- Update existing records by matching response_id (article_id) to news.generated.id
UPDATE news.what_users_are_saying w
SET generated_id_temp = g.id
FROM news.generated g
WHERE w.response_id = g.article_id;

-- ============================================================================
-- STEP 4: Delete orphaned records and make generated_id_temp NOT NULL
-- ============================================================================

-- Delete any records that couldn't be matched (orphaned comments)
DELETE FROM news.what_users_are_saying WHERE generated_id_temp IS NULL;

-- Make generated_id_temp required
ALTER TABLE news.what_users_are_saying
  ALTER COLUMN generated_id_temp SET NOT NULL;

-- ============================================================================
-- STEP 5: Drop old response_id column and rename generated_id_temp
-- ============================================================================

ALTER TABLE news.what_users_are_saying
  DROP COLUMN response_id;

ALTER TABLE news.what_users_are_saying
  RENAME COLUMN generated_id_temp TO generated_id;

-- ============================================================================
-- STEP 6: Add foreign key constraint and index
-- ============================================================================

ALTER TABLE news.what_users_are_saying
  ADD CONSTRAINT fk_what_users_are_saying_generated_id 
  FOREIGN KEY (generated_id) REFERENCES news.generated(id) ON DELETE CASCADE;

CREATE INDEX idx_what_users_are_saying_generated_id ON news.what_users_are_saying(generated_id);

-- ============================================================================
-- STEP 7: Update comments
-- ============================================================================

COMMENT ON COLUMN news.what_users_are_saying.generated_id IS 'References news.generated.id (UUID) - the article this comment is on';

