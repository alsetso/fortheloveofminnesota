-- Fix collections RLS to allow anonymous users to read collections associated with public map_pins
-- This allows profile pages to display collection info for public mentions without requiring authentication

-- ============================================================================
-- STEP 1: Drop existing restrictive SELECT policy
-- ============================================================================

DROP POLICY IF EXISTS "collections_select" ON public.collections;

-- ============================================================================
-- STEP 2: Create new SELECT policy that allows anonymous users to read collections
-- associated with public map_pins
-- ============================================================================

CREATE POLICY "collections_select"
  ON public.collections
  FOR SELECT
  TO authenticated, anon
  USING (
    -- Authenticated users can read their own collections
    (
      account_id IS NOT NULL
      AND auth.uid() IS NOT NULL
      AND public.user_owns_account(account_id)
    )
    OR
    -- Anonymous users can read collections that are referenced by public map_pins
    -- This allows profile pages to show collection info for public mentions
    (
      auth.uid() IS NULL
      AND EXISTS (
        SELECT 1 FROM public.map_pins
        WHERE map_pins.collection_id = collections.id
        AND map_pins.visibility = 'public'
        AND map_pins.archived = false
        AND map_pins.is_active = true
      )
    )
    OR
    -- Authenticated users can also read collections referenced by public map_pins
    -- (for viewing other users' public collections)
    (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.map_pins
        WHERE map_pins.collection_id = collections.id
        AND map_pins.visibility = 'public'
        AND map_pins.archived = false
        AND map_pins.is_active = true
      )
    )
  );

-- ============================================================================
-- STEP 3: Grant SELECT permission to anonymous role
-- ============================================================================

GRANT SELECT ON public.collections TO anon;

-- ============================================================================
-- STEP 4: Add comment
-- ============================================================================

COMMENT ON POLICY "collections_select" ON public.collections IS
  'Allows authenticated users to read their own collections, and anonymous/authenticated users to read collections referenced by public map_pins. This enables profile pages to display collection info for public mentions without requiring authentication.';
