-- Add user tagging support to mentions
-- Allows users to tag other users by username in posts
-- Tagged account IDs are stored in a JSONB array on the mentions table
-- Users can control whether they can be tagged via account_taggable column

-- ============================================================================
-- STEP 1: Add account_taggable column to accounts table
-- ============================================================================

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS account_taggable BOOLEAN NOT NULL DEFAULT false;

-- Index for filtering taggable accounts
CREATE INDEX IF NOT EXISTS idx_accounts_account_taggable 
  ON public.accounts(account_taggable) 
  WHERE account_taggable = true;

-- ============================================================================
-- STEP 2: Add tagged_account_ids JSONB column to mentions table
-- ============================================================================

ALTER TABLE public.mentions
  ADD COLUMN IF NOT EXISTS tagged_account_ids JSONB DEFAULT '[]'::jsonb;

-- GIN index for efficient JSONB queries (checking if account is tagged)
CREATE INDEX IF NOT EXISTS idx_mentions_tagged_account_ids 
  ON public.mentions USING GIN (tagged_account_ids) 
  WHERE tagged_account_ids IS NOT NULL AND jsonb_array_length(tagged_account_ids) > 0;

-- Index for querying mentions that tag a specific account
-- This allows efficient lookups of "mentions where account_id X is tagged"
CREATE INDEX IF NOT EXISTS idx_mentions_tagged_account_ids_gin 
  ON public.mentions USING GIN (tagged_account_ids jsonb_path_ops)
  WHERE tagged_account_ids IS NOT NULL AND jsonb_array_length(tagged_account_ids) > 0;

-- ============================================================================
-- STEP 3: Add constraint to ensure tagged_account_ids is always an array
-- ============================================================================

ALTER TABLE public.mentions
  ADD CONSTRAINT mentions_tagged_account_ids_is_array 
  CHECK (jsonb_typeof(tagged_account_ids) = 'array');

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON COLUMN public.accounts.account_taggable IS 
  'Whether this account can be tagged by other users in mentions. Defaults to false. Users can enable this in their account settings.';

COMMENT ON COLUMN public.mentions.tagged_account_ids IS 
  'JSONB array of account IDs (UUIDs) for users tagged in this mention. Stored as array of UUID strings. Only accounts with account_taggable=true can be tagged.';
