-- Add city_id column to mentions table for city-based filtering
-- This allows filtering mentions by city for better organization and queries

-- ============================================================================
-- STEP 1: Add city_id column to mentions table
-- ============================================================================

ALTER TABLE public.mentions
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES atlas.cities(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 2: Create index for city_id queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_mentions_city_id ON public.mentions(city_id) WHERE city_id IS NOT NULL;

-- Composite index for city + visibility filtering (common query pattern)
CREATE INDEX IF NOT EXISTS idx_mentions_city_id_visibility ON public.mentions(city_id, visibility) 
  WHERE city_id IS NOT NULL AND archived = false;

-- Composite index for city + account filtering
CREATE INDEX IF NOT EXISTS idx_mentions_city_id_account_id ON public.mentions(city_id, account_id) 
  WHERE city_id IS NOT NULL AND account_id IS NOT NULL;

-- ============================================================================
-- STEP 3: Add comment
-- ============================================================================

COMMENT ON COLUMN public.mentions.city_id IS 'City ID reference for filtering mentions by city. Nullable - mentions may not always have an associated city.';
