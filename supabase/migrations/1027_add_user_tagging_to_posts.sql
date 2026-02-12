-- Add user tagging support to posts
-- Allows users to tag other users by username in post content
-- Tagged account IDs are stored in a JSONB array on the content.posts table
-- Users can control whether they can be tagged via account_taggable column

-- ============================================================================
-- STEP 1: Add tagged_account_ids JSONB column to content.posts table
-- ============================================================================

ALTER TABLE content.posts
  ADD COLUMN IF NOT EXISTS tagged_account_ids JSONB DEFAULT '[]'::jsonb;

-- GIN index for efficient JSONB queries (checking if account is tagged)
CREATE INDEX IF NOT EXISTS idx_posts_tagged_account_ids 
  ON content.posts USING GIN (tagged_account_ids) 
  WHERE tagged_account_ids IS NOT NULL AND jsonb_array_length(tagged_account_ids) > 0;

-- Index for querying posts that tag a specific account
-- This allows efficient lookups of "posts where account_id X is tagged"
CREATE INDEX IF NOT EXISTS idx_posts_tagged_account_ids_gin 
  ON content.posts USING GIN (tagged_account_ids jsonb_path_ops)
  WHERE tagged_account_ids IS NOT NULL AND jsonb_array_length(tagged_account_ids) > 0;

-- ============================================================================
-- STEP 2: Add constraint to ensure tagged_account_ids is always an array
-- ============================================================================

ALTER TABLE content.posts
  ADD CONSTRAINT posts_tagged_account_ids_is_array 
  CHECK (jsonb_typeof(tagged_account_ids) = 'array');

-- ============================================================================
-- STEP 3: Add comments
-- ============================================================================

COMMENT ON COLUMN content.posts.tagged_account_ids IS 
  'JSONB array of account IDs (UUIDs) for users tagged in this post. Stored as array of UUID strings. Only accounts with account_taggable=true can be tagged. Parsed from @username patterns in the content field.';
