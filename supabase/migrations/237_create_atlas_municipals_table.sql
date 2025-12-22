-- Create municipals table in atlas schema
-- Municipals are point-based location entities tied to cities (city halls, courthouses, etc.)

-- ============================================================================
-- STEP 1: Create municipals table in atlas schema
-- ============================================================================

CREATE TABLE atlas.municipals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  city_id UUID REFERENCES atlas.cities(id) ON DELETE SET NULL,
  
  -- Location data (pin coordinates)
  lat NUMERIC(10, 8),
  lng NUMERIC(11, 8),
  address TEXT,
  
  -- Municipal classification
  municipal_type TEXT CHECK (municipal_type IN ('city_hall', 'courthouse', 'police_station', 'fire_station', 'library', 'community_center', 'town_hall', 'government_office', 'other')),
  
  -- Metadata
  description TEXT,
  meta_title TEXT,
  meta_description TEXT,
  website_url TEXT,
  phone TEXT,
  
  -- Features
  favorite BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT municipals_slug_unique UNIQUE (slug)
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX idx_municipals_name ON atlas.municipals(name);
CREATE INDEX idx_municipals_slug ON atlas.municipals(slug);
CREATE INDEX idx_municipals_city_id ON atlas.municipals(city_id);
CREATE INDEX idx_municipals_municipal_type ON atlas.municipals(municipal_type);
CREATE INDEX idx_municipals_lat_lng ON atlas.municipals(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX idx_municipals_favorite ON atlas.municipals(favorite) WHERE favorite = true;
CREATE INDEX idx_municipals_view_count ON atlas.municipals(view_count DESC);

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_municipals_updated_at 
  BEFORE UPDATE ON atlas.municipals 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE atlas.municipals ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS Policies
-- ============================================================================

-- Policy: Anyone can read municipals (public reference data)
CREATE POLICY "Anyone can view municipals"
  ON atlas.municipals
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Admins can insert municipals
CREATE POLICY "Admins can insert municipals"
  ON atlas.municipals
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Policy: Admins can update municipals
CREATE POLICY "Admins can update municipals"
  ON atlas.municipals
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policy: Admins can delete municipals
CREATE POLICY "Admins can delete municipals"
  ON atlas.municipals
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT ON atlas.municipals TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON atlas.municipals TO authenticated;
GRANT ALL ON atlas.municipals TO service_role;

-- ============================================================================
-- STEP 7: Create public view for Supabase client compatibility
-- ============================================================================

CREATE OR REPLACE VIEW public.municipals AS
SELECT * FROM atlas.municipals;

GRANT SELECT ON public.municipals TO authenticated, anon;

-- ============================================================================
-- STEP 8: Create INSTEAD OF triggers for view updates
-- ============================================================================

CREATE OR REPLACE FUNCTION public.municipals_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.municipals (
    name, slug, city_id, lat, lng, address,
    municipal_type,
    description, meta_title, meta_description, website_url, phone,
    favorite, view_count, created_at, updated_at
  )
  VALUES (
    NEW.name,
    NEW.slug,
    NEW.city_id,
    NEW.lat,
    NEW.lng,
    NEW.address,
    NEW.municipal_type,
    NEW.description,
    NEW.meta_title,
    NEW.meta_description,
    NEW.website_url,
    NEW.phone,
    COALESCE(NEW.favorite, false),
    COALESCE(NEW.view_count, 0),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

CREATE TRIGGER municipals_instead_of_insert
  INSTEAD OF INSERT ON public.municipals
  FOR EACH ROW
  EXECUTE FUNCTION public.municipals_insert_trigger();

CREATE OR REPLACE FUNCTION public.municipals_update_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE atlas.municipals
  SET
    name = COALESCE(NEW.name, OLD.name),
    slug = COALESCE(NEW.slug, OLD.slug),
    city_id = NEW.city_id,
    lat = NEW.lat,
    lng = NEW.lng,
    address = NEW.address,
    municipal_type = NEW.municipal_type,
    description = NEW.description,
    meta_title = NEW.meta_title,
    meta_description = NEW.meta_description,
    website_url = NEW.website_url,
    phone = NEW.phone,
    favorite = COALESCE(NEW.favorite, OLD.favorite),
    view_count = COALESCE(NEW.view_count, OLD.view_count),
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER municipals_instead_of_update
  INSTEAD OF UPDATE ON public.municipals
  FOR EACH ROW
  EXECUTE FUNCTION public.municipals_update_trigger();

CREATE OR REPLACE FUNCTION public.municipals_delete_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM atlas.municipals WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER municipals_instead_of_delete
  INSTEAD OF DELETE ON public.municipals
  FOR EACH ROW
  EXECUTE FUNCTION public.municipals_delete_trigger();

-- Grant INSERT, UPDATE, DELETE on view (for triggers)
GRANT INSERT, UPDATE, DELETE ON public.municipals TO authenticated;

-- ============================================================================
-- STEP 9: Update record_page_view function to support municipal entity type
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_page_view(
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_entity_slug TEXT DEFAULT NULL,
  p_account_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_view_count INTEGER;
  v_table_name TEXT;
  v_entity_id_for_update UUID;
BEGIN
  -- Validate entity_type
  IF p_entity_type NOT IN ('post', 'article', 'city', 'county', 'neighborhood', 'school', 'park', 'watertower', 'cemetery', 'golf_course', 'hospital', 'airport', 'church', 'municipal', 'account', 'business', 'page', 'feed', 'map', 'map_pin', 'homepage', 'pin') THEN
    RAISE EXCEPTION 'Invalid entity_type: %', p_entity_type;
  END IF;
  
  -- Map entity_type to table name
  v_table_name := CASE p_entity_type
    WHEN 'post' THEN 'posts'
    WHEN 'article' THEN 'articles'
    WHEN 'city' THEN 'cities'
    WHEN 'county' THEN 'counties'
    WHEN 'neighborhood' THEN 'neighborhoods'
    WHEN 'school' THEN 'schools'
    WHEN 'park' THEN 'parks'
    WHEN 'watertower' THEN 'watertowers'
    WHEN 'cemetery' THEN 'cemeteries'
    WHEN 'golf_course' THEN 'golf_courses'
    WHEN 'hospital' THEN 'hospitals'
    WHEN 'airport' THEN 'airports'
    WHEN 'church' THEN 'churches'
    WHEN 'municipal' THEN 'municipals'
    WHEN 'account' THEN 'accounts'
    WHEN 'business' THEN 'pages'
    WHEN 'page' THEN 'pages'
    WHEN 'map_pin' THEN 'pins'
    WHEN 'pin' THEN 'pins'
    ELSE NULL
  END;
  
  -- Resolve entity_id based on entity_type and provided identifiers
  IF p_entity_id IS NOT NULL THEN
    -- Direct entity_id provided - use it
    v_entity_id_for_update := p_entity_id;
  ELSIF p_entity_slug IS NOT NULL THEN
    -- Need to resolve slug to entity_id based on entity_type
    IF p_entity_type = 'account' THEN
      -- Accounts: resolve username to account_id
      SELECT id INTO v_entity_id_for_update
      FROM public.accounts
      WHERE username = p_entity_slug
      LIMIT 1;
    ELSIF p_entity_type IN ('post', 'article') THEN
      -- Posts/Articles: resolve slug to id
      EXECUTE format('SELECT id FROM public.%I WHERE slug = $1 LIMIT 1', v_table_name)
      USING p_entity_slug
      INTO v_entity_id_for_update;
    ELSIF p_entity_type IN ('city', 'county', 'neighborhood', 'school', 'park', 'watertower', 'cemetery', 'golf_course', 'hospital', 'airport', 'church', 'municipal') THEN
      -- Atlas entities: resolve slug to id
      EXECUTE format('SELECT id FROM public.%I WHERE slug = $1 LIMIT 1', v_table_name)
      USING p_entity_slug
      INTO v_entity_id_for_update;
    ELSIF p_entity_type IN ('business', 'page', 'feed', 'map', 'homepage') THEN
      -- Business/Page/Feed/Map/Homepage pages: slugs don't resolve to entity_id
      -- These are page-level tracking, not entity-specific
      v_entity_id_for_update := NULL;
    ELSIF p_entity_type IN ('map_pin', 'pin') THEN
      -- Map pins use UUID entity_id, not slug
      v_entity_id_for_update := NULL;
    END IF;
  END IF;
  
  -- Insert page view record
  INSERT INTO public.page_views (
    entity_type,
    entity_id,
    entity_slug,
    account_id,
    ip_address,
    viewed_at
  ) VALUES (
    p_entity_type,
    v_entity_id_for_update,
    p_entity_slug,
    p_account_id,
    p_ip_address,
    NOW()
  );
  
  -- Update view_count on entity table if applicable
  IF v_table_name IS NOT NULL AND v_entity_id_for_update IS NOT NULL THEN
    EXECUTE format('UPDATE public.%I SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1 RETURNING view_count', v_table_name)
    USING v_entity_id_for_update
    INTO v_view_count;
  ELSE
    v_view_count := 1;
  END IF;
  
  RETURN COALESCE(v_view_count, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 10: Add comments
-- ============================================================================

COMMENT ON TABLE atlas.municipals IS 'Reference table for Minnesota municipal buildings. Point-based location entities tied to cities.';
COMMENT ON COLUMN atlas.municipals.id IS 'Unique municipal ID (UUID)';
COMMENT ON COLUMN atlas.municipals.name IS 'Municipal building name';
COMMENT ON COLUMN atlas.municipals.slug IS 'URL-friendly slug for the municipal building';
COMMENT ON COLUMN atlas.municipals.city_id IS 'Reference to the city this municipal building is in';
COMMENT ON COLUMN atlas.municipals.lat IS 'Latitude coordinate of municipal building location';
COMMENT ON COLUMN atlas.municipals.lng IS 'Longitude coordinate of municipal building location';
COMMENT ON COLUMN atlas.municipals.address IS 'Street address or location description';
COMMENT ON COLUMN atlas.municipals.municipal_type IS 'Type of municipal building: city_hall, courthouse, police_station, fire_station, library, community_center, town_hall, government_office, other';
COMMENT ON COLUMN atlas.municipals.description IS 'Description of the municipal building';
COMMENT ON COLUMN atlas.municipals.meta_title IS 'SEO meta title';
COMMENT ON COLUMN atlas.municipals.meta_description IS 'SEO meta description';
COMMENT ON COLUMN atlas.municipals.website_url IS 'Official municipal building website URL';
COMMENT ON COLUMN atlas.municipals.phone IS 'Municipal building contact phone number';
COMMENT ON COLUMN atlas.municipals.favorite IS 'Whether this is a featured/favorite municipal building';
COMMENT ON COLUMN atlas.municipals.view_count IS 'Number of times this municipal building page has been viewed';
COMMENT ON VIEW public.municipals IS 'View pointing to atlas.municipals for Supabase client compatibility';

-- ============================================================================
-- STEP 11: Verification report
-- ============================================================================

DO $$
DECLARE
  v_municipals_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_municipals_count FROM atlas.municipals;
  
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '  Municipals table created in atlas schema';
  RAISE NOTICE '  Public view created for Supabase client compatibility';
  RAISE NOTICE '  RLS policies configured';
  RAISE NOTICE '  record_page_view function updated to support municipal entity type';
END;
$$;


