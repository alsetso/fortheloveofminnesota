-- Drop collections table and remove collection_id from pins
-- This migration removes the collections feature entirely

-- ============================================================================
-- STEP 1: Remove collection_id column from pins table
-- ============================================================================

-- Drop the index first
DROP INDEX IF EXISTS idx_pins_collection_id;

-- Remove the foreign key column
ALTER TABLE public.pins DROP COLUMN IF EXISTS collection_id;

-- ============================================================================
-- STEP 2: Drop RLS policies on collections table
-- ============================================================================

DROP POLICY IF EXISTS "Read public collections or own private" ON public.collections;
DROP POLICY IF EXISTS "Users can insert own collections" ON public.collections;
DROP POLICY IF EXISTS "Users can update own collections" ON public.collections;
DROP POLICY IF EXISTS "Users can delete own collections" ON public.collections;

-- ============================================================================
-- STEP 3: Drop indexes on collections table
-- ============================================================================

DROP INDEX IF EXISTS idx_collections_account_id;
DROP INDEX IF EXISTS idx_collections_visibility;
DROP INDEX IF EXISTS idx_collections_display_order;
DROP INDEX IF EXISTS idx_collections_is_default;

-- ============================================================================
-- STEP 4: Drop trigger on collections table
-- ============================================================================

DROP TRIGGER IF EXISTS update_collections_updated_at ON public.collections;

-- ============================================================================
-- STEP 5: Drop collections table
-- ============================================================================

DROP TABLE IF EXISTS public.collections CASCADE;

-- ============================================================================
-- STEP 6: Also drop any remnants of old pin_collections table
-- ============================================================================

DROP POLICY IF EXISTS "Users and guests can insert pin_collections" ON public.pin_collections;
DROP POLICY IF EXISTS "Users and guests can update pin_collections" ON public.pin_collections;
DROP POLICY IF EXISTS "Users and guests can delete pin_collections" ON public.pin_collections;
DROP POLICY IF EXISTS "Read own or public collections" ON public.pin_collections;
DROP POLICY IF EXISTS "Users can insert own pin_collections" ON public.pin_collections;
DROP POLICY IF EXISTS "Users can update own pin_collections" ON public.pin_collections;
DROP POLICY IF EXISTS "Users can delete own pin_collections" ON public.pin_collections;
DROP POLICY IF EXISTS "Public read access for pin_collections" ON public.pin_collections;

DROP INDEX IF EXISTS idx_pin_collections_account_id;
DROP INDEX IF EXISTS idx_pin_collections_display_order;
DROP INDEX IF EXISTS idx_pin_collections_is_default;
DROP INDEX IF EXISTS idx_pin_collections_visibility;

DROP TRIGGER IF EXISTS update_pin_collections_updated_at ON public.pin_collections;

DROP TABLE IF EXISTS public.pin_collections CASCADE;



