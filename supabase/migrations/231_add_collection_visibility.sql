-- Add visibility column to pin_collections table
-- Allows users to mark collections as public or private

-- ============================================================================
-- STEP 1: Add visibility column
-- ============================================================================

ALTER TABLE public.pin_collections
ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
CHECK (visibility IN ('public', 'private'));

-- ============================================================================
-- STEP 2: Create index for visibility filtering
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_pin_collections_visibility 
ON public.pin_collections(visibility);

-- ============================================================================
-- STEP 3: Update RLS policy for read access
-- ============================================================================

-- Drop the old public read policy
DROP POLICY IF EXISTS "Public read access for pin_collections" ON public.pin_collections;

-- Create new policy: users can read their own collections OR public collections
CREATE POLICY "Read own or public collections"
  ON public.pin_collections
  FOR SELECT
  TO authenticated, anon
  USING (
    visibility = 'public'
    OR (
      account_id IS NOT NULL 
      AND public.user_owns_account(account_id)
    )
  );

-- ============================================================================
-- STEP 4: Add comment
-- ============================================================================

COMMENT ON COLUMN public.pin_collections.visibility IS 
  'Collection visibility: public (visible on profile) or private (only owner can see)';
