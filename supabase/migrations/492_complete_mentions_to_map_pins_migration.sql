-- Complete mentions to map_pins migration (Steps 5-10)
-- Continues from migration 491 where step 5 failed
-- Migrates all mentions to map_pins and sets up likes, RLS, etc.

-- ============================================================================
-- STEP 5: Migrate all mentions to map_pins
-- ============================================================================

INSERT INTO public.map_pins (
  id,
  map_id,
  lat,
  lng,
  account_id,
  visibility,
  archived,
  post_date,
  description,
  caption, -- Keep caption as NULL for mentions (they use description)
  city_id,
  map_meta,
  atlas_meta,
  full_address,
  icon_url,
  image_url,
  video_url,
  media_type,
  collection_id,
  mention_type_id,
  view_count,
  tagged_account_ids,
  is_active,
  created_at,
  updated_at
)
SELECT 
  m.id,
  (SELECT id FROM public.map WHERE slug = 'live' AND is_active = true LIMIT 1) as map_id,
  m.lat,
  m.lng,
  m.account_id,
  CASE 
    WHEN m.visibility = 'public' THEN 'public'::public.map_pin_visibility
    WHEN m.visibility = 'only_me' THEN 'only_me'::public.map_pin_visibility
    ELSE 'public'::public.map_pin_visibility
  END as visibility,
  COALESCE(m.archived, false) as archived,
  m.post_date,
  m.description,
  NULL as caption, -- Mentions don't have caption
  m.city_id,
  m.map_meta,
  m.atlas_meta,
  m.full_address,
  m.icon_url,
  m.image_url,
  m.video_url,
  CASE 
    WHEN m.media_type::text = 'image' THEN 'image'::public.map_pin_media_type
    WHEN m.media_type::text = 'video' THEN 'video'::public.map_pin_media_type
    ELSE 'none'::public.map_pin_media_type
  END as media_type,
  m.collection_id,
  m.mention_type_id,
  COALESCE(m.view_count, 0) as view_count,
  COALESCE(m.tagged_account_ids, '[]'::jsonb) as tagged_account_ids,
  NOT COALESCE(m.archived, false) as is_active, -- Active if not archived
  m.created_at,
  m.updated_at
FROM public.mentions m
WHERE NOT EXISTS (
  SELECT 1 FROM public.map_pins mp WHERE mp.id = m.id
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 6: Create map_pins_likes table and migrate mentions_likes
-- ============================================================================

-- Create map_pins_likes table (unified likes table)
CREATE TABLE IF NOT EXISTS public.map_pins_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_pin_id UUID NOT NULL REFERENCES public.map_pins(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- One like per account per pin
  CONSTRAINT map_pins_likes_unique UNIQUE (map_pin_id, account_id)
);

-- Migrate existing mentions_likes to map_pins_likes
INSERT INTO public.map_pins_likes (
  map_pin_id,
  account_id,
  created_at
)
SELECT 
  ml.mention_id as map_pin_id,
  ml.account_id,
  ml.created_at
FROM public.mentions_likes ml
WHERE EXISTS (
  SELECT 1 FROM public.map_pins mp WHERE mp.id = ml.mention_id
)
ON CONFLICT (map_pin_id, account_id) DO NOTHING;

-- Create indexes for map_pins_likes
CREATE INDEX IF NOT EXISTS idx_map_pins_likes_map_pin_id ON public.map_pins_likes(map_pin_id);
CREATE INDEX IF NOT EXISTS idx_map_pins_likes_account_id ON public.map_pins_likes(account_id);
CREATE INDEX IF NOT EXISTS idx_map_pins_likes_created_at ON public.map_pins_likes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_map_pins_likes_map_pin_account ON public.map_pins_likes(map_pin_id, account_id);

-- Enable RLS on map_pins_likes
ALTER TABLE public.map_pins_likes ENABLE ROW LEVEL SECURITY;

-- RLS policies for map_pins_likes (similar to mentions_likes)
CREATE POLICY "map_pins_likes_select_public"
  ON public.map_pins_likes FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.map_pins
      WHERE map_pins.id = map_pins_likes.map_pin_id
      AND (
        map_pins.visibility = 'public'
        OR (
          map_pins.account_id IS NOT NULL
          AND public.user_owns_account(map_pins.account_id)
        )
      )
      AND map_pins.archived = false
      AND map_pins.is_active = true
    )
  );

CREATE POLICY "map_pins_likes_insert"
  ON public.map_pins_likes FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
    AND EXISTS (
      SELECT 1 FROM public.map_pins
      WHERE map_pins.id = map_pin_id
      AND map_pins.archived = false
      AND map_pins.is_active = true
      AND (
        map_pins.visibility = 'public'
        OR (
          map_pins.account_id IS NOT NULL
          AND public.user_owns_account(map_pins.account_id)
        )
      )
    )
  );

CREATE POLICY "map_pins_likes_delete"
  ON public.map_pins_likes FOR DELETE
  TO authenticated
  USING (
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  );

GRANT SELECT, INSERT, DELETE ON public.map_pins_likes TO authenticated;
GRANT SELECT ON public.map_pins_likes TO anon;

-- ============================================================================
-- STEP 7: Update RLS policies for map_pins to handle mentions functionality
-- ============================================================================

-- Drop existing policies (will recreate with enhanced logic)
DROP POLICY IF EXISTS "Users can view pins on accessible maps" ON public.map_pins;
DROP POLICY IF EXISTS "Users can create pins on accessible maps" ON public.map_pins;
DROP POLICY IF EXISTS "Users can update pins on own maps" ON public.map_pins;
DROP POLICY IF EXISTS "Users can delete pins on own maps" ON public.map_pins;

-- Enhanced SELECT policy: supports both map-based and account-based access
CREATE POLICY "map_pins_select"
  ON public.map_pins
  FOR SELECT
  TO authenticated, anon
  USING (
    -- Users can always see their own pins (including archived)
    (
      account_id IS NOT NULL
      AND public.user_owns_account(account_id)
    )
    OR
    -- Public pins on accessible maps (not archived, active)
    (
      visibility = 'public' 
      AND archived = false 
      AND is_active = true
      AND EXISTS (
        SELECT 1 FROM public.map
        WHERE map.id = map_pins.map_id
        AND map.is_active = true
        AND (
          map.visibility = 'public'
          OR (
            auth.uid() IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.accounts
              WHERE accounts.id = map.account_id
              AND accounts.user_id = auth.uid()
            )
          )
        )
      )
    )
    OR
    -- Only_me pins visible only to owner
    (
      visibility = 'only_me'
      AND account_id IS NOT NULL
      AND public.user_owns_account(account_id)
      AND archived = false
      AND is_active = true
    )
  );

-- Enhanced INSERT policy: supports both map-based and account-based creation
CREATE POLICY "map_pins_insert"
  ON public.map_pins
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    account_id IS NOT NULL
    AND (
      -- Authenticated users: must own the account
      (auth.uid() IS NOT NULL AND public.user_owns_account(account_id))
      OR
      -- Anonymous users: account must be a guest account
      (
        auth.uid() IS NULL
        AND EXISTS (
          SELECT 1 FROM public.accounts
          WHERE accounts.id = account_id
          AND accounts.user_id IS NULL
          AND accounts.guest_id IS NOT NULL
        )
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.map
      WHERE map.id = map_pins.map_id
      AND map.is_active = true
      AND (
        -- Map owner can always create pins
        EXISTS (
          SELECT 1 FROM public.accounts
          WHERE accounts.id = map.account_id
          AND accounts.user_id = auth.uid()
        )
        OR
        -- Public maps allow anyone to create pins
        map.visibility = 'public'
      )
    )
  );

-- Enhanced UPDATE policy: users can update their own pins
CREATE POLICY "map_pins_update"
  ON public.map_pins
  FOR UPDATE
  TO authenticated
  USING (
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  )
  WITH CHECK (
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  );

-- Enhanced DELETE policy: users can delete their own pins
CREATE POLICY "map_pins_delete"
  ON public.map_pins
  FOR DELETE
  TO authenticated
  USING (
    account_id IS NOT NULL
    AND public.user_owns_account(account_id)
  );

-- ============================================================================
-- STEP 8: Add comments
-- ============================================================================

COMMENT ON COLUMN public.map_pins.account_id IS 'Account that owns this pin. Required for mentions functionality.';
COMMENT ON COLUMN public.map_pins.visibility IS 'Pin visibility: public (visible to everyone) or only_me (visible only to creator)';
COMMENT ON COLUMN public.map_pins.archived IS 'Soft delete flag. When true, pin is archived (treated as deleted but data is preserved).';
COMMENT ON COLUMN public.map_pins.post_date IS 'Date when the event/memory happened. Used for year filtering on the map.';
COMMENT ON COLUMN public.map_pins.description IS 'Text content for the pin (used by mentions). Caption is for custom map pins.';
COMMENT ON COLUMN public.map_pins.city_id IS 'City ID reference for filtering pins by city.';
COMMENT ON COLUMN public.map_pins.map_meta IS 'JSON metadata containing all location details from the map.';
COMMENT ON COLUMN public.map_pins.atlas_meta IS 'JSON metadata containing atlas entity details (parks, schools, cities, etc.).';
COMMENT ON COLUMN public.map_pins.full_address IS 'Full address string from reverse geocoding.';
COMMENT ON COLUMN public.map_pins.icon_url IS 'URL to the icon image for this pin.';
COMMENT ON COLUMN public.map_pins.media_type IS 'Type of media attached: image, video, or none.';
COMMENT ON COLUMN public.map_pins.collection_id IS 'Optional reference to a collection for categorizing pins.';
COMMENT ON COLUMN public.map_pins.mention_type_id IS 'Reference to mention_types table for categorizing pins.';
COMMENT ON COLUMN public.map_pins.view_count IS 'Total number of views for this pin.';
COMMENT ON COLUMN public.map_pins.tagged_account_ids IS 'JSONB array of account IDs for users tagged in this pin.';
COMMENT ON COLUMN public.map_pins.is_active IS 'Active flag. When false, pin is soft-deleted.';

COMMENT ON TABLE public.map_pins_likes IS 'Tracks likes on map pins. Accounts can like any pin they can see, including their own.';
COMMENT ON COLUMN public.map_pins_likes.map_pin_id IS 'Reference to the liked pin';
COMMENT ON COLUMN public.map_pins_likes.account_id IS 'Reference to the account that liked the pin';

-- ============================================================================
-- STEP 9: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
