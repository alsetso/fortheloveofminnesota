-- Drop pin_collections table and related objects

-- ============================================================================
-- STEP 1: Remove foreign key from pins table
-- ============================================================================

ALTER TABLE public.pins DROP COLUMN IF EXISTS collection_id;

-- ============================================================================
-- STEP 2: Drop RLS policies
-- ============================================================================

DROP POLICY IF EXISTS "Users and guests can insert pin_collections" ON public.pin_collections;
DROP POLICY IF EXISTS "Users and guests can update pin_collections" ON public.pin_collections;
DROP POLICY IF EXISTS "Users and guests can delete pin_collections" ON public.pin_collections;
DROP POLICY IF EXISTS "Read own or public collections" ON public.pin_collections;
DROP POLICY IF EXISTS "Users can insert own pin_collections" ON public.pin_collections;
DROP POLICY IF EXISTS "Users can update own pin_collections" ON public.pin_collections;
DROP POLICY IF EXISTS "Users can delete own pin_collections" ON public.pin_collections;
DROP POLICY IF EXISTS "Public read access for pin_collections" ON public.pin_collections;

-- ============================================================================
-- STEP 3: Drop indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_pin_collections_account_id;
DROP INDEX IF EXISTS idx_pin_collections_display_order;
DROP INDEX IF EXISTS idx_pin_collections_is_default;
DROP INDEX IF EXISTS idx_pin_collections_visibility;

-- ============================================================================
-- STEP 4: Drop trigger
-- ============================================================================

DROP TRIGGER IF EXISTS update_pin_collections_updated_at ON public.pin_collections;

-- ============================================================================
-- STEP 5: Drop table
-- ============================================================================

DROP TABLE IF EXISTS public.pin_collections;



