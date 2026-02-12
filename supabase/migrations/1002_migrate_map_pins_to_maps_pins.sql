-- Migrate public.map_pins → maps.pins
-- Converts lat/lng to PostGIS Point geometry and migrates all data

-- ============================================================================
-- STEP 1: Ensure maps.pins has all columns from public.map_pins
-- ============================================================================

-- Add any missing columns (most should already exist from previous migrations)
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS map_id uuid REFERENCES maps.maps(id) ON DELETE CASCADE;
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS author_account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS geometry geometry(Point, 4326);
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS emoji text;
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS caption text;
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS icon_url text;
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS media_type text DEFAULT 'none';
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS full_address text;
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS map_meta jsonb;
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS atlas_meta jsonb;
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0;
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS tagged_account_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public';
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS post_date timestamptz;
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE maps.pins ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Note: maps.pins schema doesn't include legacy columns (lat, lng, account_id, etc.)
-- These are handled via geometry column and author_account_id

-- ============================================================================
-- STEP 2: Migrate data from public.map_pins to maps.pins
-- ============================================================================

INSERT INTO maps.pins (
  id,
  map_id,
  author_account_id,
  title,
  body,
  geometry, -- Convert lat/lng to PostGIS Point
  emoji,
  caption,
  image_url,
  video_url,
  icon_url,
  media_type,
  full_address,
  map_meta,
  atlas_meta,
  view_count,
  tagged_account_ids,
  visibility,
  archived,
  post_date,
  created_at,
  updated_at
)
SELECT 
  id,
  map_id,
  COALESCE(account_id, (SELECT owner_account_id FROM maps.maps WHERE maps.maps.id = map_pins.map_id LIMIT 1)) as author_account_id,
  NULL as title, -- map_pins doesn't have title, use caption/description
  COALESCE(description, caption, 'Pin') as body, -- Use description or caption as body, default to 'Pin' if both are NULL (body must have length > 0)
  ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geometry(Point, 4326) as geometry,
  emoji,
  caption,
  image_url,
  video_url,
  icon_url,
  CASE 
    WHEN media_type::text = 'image' THEN 'image'
    WHEN media_type::text = 'video' THEN 'video'
    ELSE 'none'
  END as media_type,
  full_address,
  map_meta,
  atlas_meta,
  view_count,
  tagged_account_ids,
  CASE 
    WHEN visibility::text = 'public' THEN 'public'
    WHEN visibility::text = 'only_me' THEN 'only_me'
    ELSE 'public'
  END as visibility,
  archived,
  post_date,
  created_at,
  updated_at
FROM public.map_pins
WHERE map_id IN (SELECT id FROM maps.maps) -- Only migrate pins for maps that exist in maps.maps
ON CONFLICT (id) DO UPDATE SET
  map_id = EXCLUDED.map_id,
  author_account_id = EXCLUDED.author_account_id,
  body = EXCLUDED.body,
  geometry = EXCLUDED.geometry,
  emoji = EXCLUDED.emoji,
  caption = EXCLUDED.caption,
  image_url = EXCLUDED.image_url,
  video_url = EXCLUDED.video_url,
  icon_url = EXCLUDED.icon_url,
  media_type = EXCLUDED.media_type,
  full_address = EXCLUDED.full_address,
  map_meta = EXCLUDED.map_meta,
  atlas_meta = EXCLUDED.atlas_meta,
  view_count = EXCLUDED.view_count,
  tagged_account_ids = EXCLUDED.tagged_account_ids,
  visibility = EXCLUDED.visibility,
  archived = EXCLUDED.archived,
  post_date = EXCLUDED.post_date,
  updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- STEP 3: Verification
-- ============================================================================

DO $$
DECLARE
  public_count INTEGER;
  maps_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO public_count FROM public.map_pins;
  SELECT COUNT(*) INTO maps_count FROM maps.pins;
  
  RAISE NOTICE 'Migration Status:';
  RAISE NOTICE '  public.map_pins rows: %', public_count;
  RAISE NOTICE '  maps.pins rows: %', maps_count;
  
  IF maps_count >= public_count THEN
    RAISE NOTICE '✅ Migration successful! All rows migrated.';
  ELSE
    RAISE WARNING '⚠️  Migration incomplete. Missing % rows.', public_count - maps_count;
  END IF;
END $$;
