-- Create simple map table with title, description, visibility, and map_style

-- ============================================================================
-- STEP 1: Create map_style enum
-- ============================================================================

CREATE TYPE public.map_style AS ENUM ('street', 'satellite');

-- ============================================================================
-- STEP 2: Create map table
-- ============================================================================

CREATE TABLE public.map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Basic info
  title TEXT NOT NULL,
  description TEXT,
  
  -- Settings
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'shared')),
  map_style public.map_style NOT NULL DEFAULT 'street'::public.map_style,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: Create indexes
-- ============================================================================

CREATE INDEX idx_map_account_id ON public.map(account_id);
CREATE INDEX idx_map_visibility ON public.map(visibility);
CREATE INDEX idx_map_created_at ON public.map(created_at DESC);

-- ============================================================================
-- STEP 4: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_map_updated_at
  BEFORE UPDATE ON public.map
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 5: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.map ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: Create RLS policies
-- ============================================================================

-- Policy: Users can view maps they own or that are public
CREATE POLICY "Users can view accessible maps"
  ON public.map
  FOR SELECT
  TO authenticated, anon
  USING (
    visibility = 'public'
    OR (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.accounts
        WHERE accounts.id = map.account_id
        AND accounts.user_id = auth.uid()
      )
    )
  );

-- Policy: Users can create maps
CREATE POLICY "Users can create maps"
  ON public.map
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  );

-- Policy: Users can update maps they own
CREATE POLICY "Users can update own maps"
  ON public.map
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = map.account_id
      AND accounts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = map.account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Policy: Users can delete maps they own
CREATE POLICY "Users can delete own maps"
  ON public.map
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = map.account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 7: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.map TO authenticated;
GRANT SELECT ON public.map TO anon; -- Anonymous users can view public maps

-- ============================================================================
-- STEP 8: Add comments
-- ============================================================================

COMMENT ON TABLE public.map IS 'Simple maps with title, description, visibility, and map style';
COMMENT ON COLUMN public.map.account_id IS 'Account that owns this map';
COMMENT ON COLUMN public.map.title IS 'Map title';
COMMENT ON COLUMN public.map.description IS 'Optional map description';
COMMENT ON COLUMN public.map.visibility IS 'Visibility: private (owner only), public (everyone), shared (via shares)';
COMMENT ON COLUMN public.map.map_style IS 'Map style: street or satellite';

