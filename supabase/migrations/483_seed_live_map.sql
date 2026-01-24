-- Seed the "live" primary map
-- This map will be used for the /live page and will have custom_slug='live'

-- ============================================================================
-- STEP 1: Create the live map
-- ============================================================================

-- First, we need an admin account to own this map
-- We'll use the first admin account, or create a system account if none exists
DO $$
DECLARE
  admin_account_id UUID;
  live_map_id UUID;
BEGIN
  -- Find the first admin account
  SELECT id INTO admin_account_id
  FROM public.accounts
  WHERE role = 'admin'
  LIMIT 1;

  -- If no admin exists, we can't create the map (this should be run after admin accounts exist)
  IF admin_account_id IS NULL THEN
    RAISE EXCEPTION 'No admin account found. Please create an admin account first.';
  END IF;

  -- Check if live map already exists
  SELECT id INTO live_map_id
  FROM public.map
  WHERE custom_slug = 'live'
  LIMIT 1;

  -- Create the live map if it doesn't exist
  IF live_map_id IS NULL THEN
    INSERT INTO public.map (
      account_id,
      title,
      description,
      visibility,
      map_style,
      custom_slug,
      is_primary,
      collection_type,
      hide_creator,
      map_layers,
      meta
    ) VALUES (
      admin_account_id,
      'Live Map',
      'The live map showing all public mentions across Minnesota',
      'public',
      'street',
      'live',
      true,
      'community',
      false,
      '{}'::jsonb,
      '{}'::jsonb
    )
    RETURNING id INTO live_map_id;
  END IF;

  RAISE NOTICE 'Live map created/verified with ID: %', live_map_id;
END $$;

-- ============================================================================
-- STEP 2: Add comment
-- ============================================================================

COMMENT ON TABLE public.map IS 'Maps table. The "live" map (custom_slug=''live'') is the primary public map for the /live page.';
