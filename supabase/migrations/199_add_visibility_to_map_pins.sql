-- Add visibility column to map_pins table
-- Visibility controls who can see the pin: 'public' (everyone) or 'only_me' (creator only)
-- Designed to be extensible for future visibility types

-- ============================================================================
-- STEP 1: Add visibility column with default value
-- ============================================================================

ALTER TABLE public.map_pins
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'only_me'));

-- ============================================================================
-- STEP 2: Create index for visibility filtering
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_map_pins_visibility 
  ON public.map_pins(visibility) 
  WHERE visibility IS NOT NULL;

-- ============================================================================
-- STEP 3: Update RLS policies to respect visibility
-- ============================================================================

-- Drop existing read policy
DROP POLICY IF EXISTS "Public read access for map pins" ON public.map_pins;

-- New policy: Public pins are readable by everyone
-- Private pins (only_me) are only readable by their creator
CREATE POLICY "Read map pins based on visibility"
  ON public.map_pins
  FOR SELECT
  TO authenticated, anon
  USING (
    -- Public pins are visible to everyone
    visibility = 'public'
    OR
    -- Private pins are only visible to their creator
    (
      visibility = 'only_me' 
      AND account_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.accounts
        WHERE accounts.id = map_pins.account_id
        AND accounts.user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- STEP 4: Update comments
-- ============================================================================

COMMENT ON COLUMN public.map_pins.visibility IS 'Pin visibility: ''public'' (visible to everyone) or ''only_me'' (visible only to creator). Extensible for future types.';







