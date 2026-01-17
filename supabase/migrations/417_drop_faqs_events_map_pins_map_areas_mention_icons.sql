-- Drop tables: faqs, events, map_pins, map_areas, mention_icons
-- Part of project cleanup to consolidate analytics schema
-- WARNING: This is destructive and will remove all data from these tables

-- ============================================================================
-- STEP 1: Drop foreign key constraints and dependencies
-- ============================================================================

-- Drop FK from mentions.icon_url references (mentions table keeps icon_url column, just loses FK)
-- Note: mentions.icon_url column remains but no longer references mention_icons

-- Drop any views that reference these tables
DROP VIEW IF EXISTS public.faqs CASCADE;
DROP VIEW IF EXISTS public.events CASCADE;
DROP VIEW IF EXISTS public.map_pins CASCADE;
DROP VIEW IF EXISTS public.map_areas CASCADE;
DROP VIEW IF EXISTS public.mention_icons CASCADE;

-- ============================================================================
-- STEP 2: Drop triggers
-- ============================================================================

DROP TRIGGER IF EXISTS update_faqs_updated_at ON public.faqs;
DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
DROP TRIGGER IF EXISTS update_map_pins_updated_at ON public.map_pins;
DROP TRIGGER IF EXISTS update_map_areas_updated_at ON public.map_areas;
DROP TRIGGER IF EXISTS update_mention_icons_updated_at ON public.mention_icons;

-- ============================================================================
-- STEP 3: Drop RLS policies (automatically dropped with tables, but explicit for clarity)
-- ============================================================================

-- FAQs policies
DROP POLICY IF EXISTS "Anyone can view visible FAQs" ON public.faqs;
DROP POLICY IF EXISTS "Authenticated users can submit questions" ON public.faqs;
DROP POLICY IF EXISTS "Users can view own questions" ON public.faqs;
DROP POLICY IF EXISTS "Admins can view all FAQs" ON public.faqs;
DROP POLICY IF EXISTS "Admins can update all FAQs" ON public.faqs;
DROP POLICY IF EXISTS "Admins can delete all FAQs" ON public.faqs;

-- Events policies
DROP POLICY IF EXISTS "events_select" ON public.events;
DROP POLICY IF EXISTS "events_insert" ON public.events;
DROP POLICY IF EXISTS "events_update" ON public.events;
DROP POLICY IF EXISTS "events_delete" ON public.events;

-- Map pins policies (drop all policies)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'map_pins'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.map_pins', r.policyname);
  END LOOP;
END $$;

-- Map areas policies (drop all policies)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'map_areas'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.map_areas', r.policyname);
  END LOOP;
END $$;

-- Mention icons policies (if any)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mention_icons'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.mention_icons', r.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 4: Revoke grants
-- ============================================================================

REVOKE ALL ON TABLE public.faqs FROM authenticated, anon, public;
REVOKE ALL ON TABLE public.events FROM authenticated, anon, public;
REVOKE ALL ON TABLE public.map_pins FROM authenticated, anon, public;
REVOKE ALL ON TABLE public.map_areas FROM authenticated, anon, public;
REVOKE ALL ON TABLE public.mention_icons FROM authenticated, anon, public;

-- ============================================================================
-- STEP 5: Drop indexes (automatically dropped with tables, but explicit for clarity)
-- ============================================================================

-- Indexes are automatically dropped with tables via CASCADE, but we list them for documentation:
-- faqs: faqs_is_visible_idx, faqs_account_id_idx, faqs_created_at_idx, faqs_has_answer_idx
-- events: idx_events_account_id, idx_events_start_date, idx_events_end_date, idx_events_created_at, idx_events_visibility, idx_events_archived, idx_events_active_public, idx_events_lat_lng, idx_events_active_by_account, idx_events_tags
-- map_pins: idx_map_pins_map_id, idx_map_pins_created_at, idx_map_pins_lat_lng
-- map_areas: idx_map_areas_map_id, idx_map_areas_created_at, idx_map_areas_geometry
-- mention_icons: idx_mention_icons_slug, idx_mention_icons_is_active, idx_mention_icons_display_order

-- ============================================================================
-- STEP 6: Drop tables (CASCADE will drop dependent objects)
-- ============================================================================

DROP TABLE IF EXISTS public.faqs CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.map_pins CASCADE;
DROP TABLE IF EXISTS public.map_areas CASCADE;
DROP TABLE IF EXISTS public.mention_icons CASCADE;

-- ============================================================================
-- STEP 7: Clean up any functions that reference these tables
-- ============================================================================

-- Drop any functions that might reference these tables
-- Note: Most functions are in migrations, but check for any remaining references

-- ============================================================================
-- STEP 8: Update mentions table (remove icon_url column if it exists)
-- Note: We keep the column but it no longer references mention_icons
-- The column can remain for backward compatibility or be removed in a future migration
-- ============================================================================

-- Keep mentions.icon_url column for now (backward compatibility)
-- Future migration can remove it if needed

-- ============================================================================
-- VERIFICATION: Confirm tables are dropped
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'faqs') THEN
    RAISE EXCEPTION 'faqs table still exists after drop operation';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    RAISE EXCEPTION 'events table still exists after drop operation';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'map_pins') THEN
    RAISE EXCEPTION 'map_pins table still exists after drop operation';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'map_areas') THEN
    RAISE EXCEPTION 'map_areas table still exists after drop operation';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mention_icons') THEN
    RAISE EXCEPTION 'mention_icons table still exists after drop operation';
  END IF;
  
  RAISE NOTICE 'All tables successfully dropped: faqs, events, map_pins, map_areas, mention_icons';
END $$;
