-- Create parks table in atlas schema
-- Parks include city parks, state parks, nature reserves, recreational areas

-- ============================================================================
-- STEP 1: Create parks table in atlas schema
-- ============================================================================

CREATE TABLE atlas.parks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  city_id UUID REFERENCES atlas.cities(id) ON DELETE SET NULL,
  county_id UUID REFERENCES atlas.counties(id) ON DELETE SET NULL,
  
  -- Location data
  lat NUMERIC(10, 8),
  lng NUMERIC(11, 8),
  polygon JSONB,
  address TEXT,
  
  -- Park classification
  park_type TEXT CHECK (park_type IN ('city', 'county', 'state', 'national', 'regional', 'nature_reserve', 'recreation', 'other')),
  
  -- Size and features
  area_acres NUMERIC(10, 2),
  amenities JSONB, -- Array of amenities: playground, trails, picnic, beach, boat_launch, etc.
  
  -- Metadata
  description TEXT,
  meta_title TEXT,
  meta_description TEXT,
  website_url TEXT,
  phone TEXT,
  
  -- Operating info
  hours JSONB, -- Operating hours by day
  
  -- Features
  favorite BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT parks_slug_unique UNIQUE (slug)
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX idx_parks_name ON atlas.parks(name);
CREATE INDEX idx_parks_slug ON atlas.parks(slug);
CREATE INDEX idx_parks_city_id ON atlas.parks(city_id);
CREATE INDEX idx_parks_county_id ON atlas.parks(county_id);
CREATE INDEX idx_parks_park_type ON atlas.parks(park_type);
CREATE INDEX idx_parks_lat_lng ON atlas.parks(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX idx_parks_polygon ON atlas.parks USING GIN (polygon) WHERE polygon IS NOT NULL;
CREATE INDEX idx_parks_amenities ON atlas.parks USING GIN (amenities) WHERE amenities IS NOT NULL;
CREATE INDEX idx_parks_favorite ON atlas.parks(favorite) WHERE favorite = true;
CREATE INDEX idx_parks_view_count ON atlas.parks(view_count DESC);

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_parks_updated_at 
  BEFORE UPDATE ON atlas.parks 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE atlas.parks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS Policies
-- ============================================================================

-- Policy: Anyone can read parks (public reference data)
CREATE POLICY "Anyone can view parks"
  ON atlas.parks
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Admins can insert parks
CREATE POLICY "Admins can insert parks"
  ON atlas.parks
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Policy: Admins can update parks
CREATE POLICY "Admins can update parks"
  ON atlas.parks
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policy: Admins can delete parks
CREATE POLICY "Admins can delete parks"
  ON atlas.parks
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT ON atlas.parks TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON atlas.parks TO authenticated;
GRANT ALL ON atlas.parks TO service_role;

-- ============================================================================
-- STEP 7: Create public view for Supabase client compatibility
-- ============================================================================

CREATE OR REPLACE VIEW public.parks AS
SELECT * FROM atlas.parks;

GRANT SELECT ON public.parks TO authenticated, anon;

-- ============================================================================
-- STEP 8: Create INSTEAD OF triggers for view updates
-- ============================================================================

CREATE OR REPLACE FUNCTION public.parks_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.parks (
    name, slug, city_id, county_id, lat, lng, polygon, address,
    park_type, area_acres, amenities,
    description, meta_title, meta_description, website_url, phone, hours,
    favorite, view_count, created_at, updated_at
  )
  VALUES (
    NEW.name,
    NEW.slug,
    NEW.city_id,
    NEW.county_id,
    NEW.lat,
    NEW.lng,
    NEW.polygon,
    NEW.address,
    NEW.park_type,
    NEW.area_acres,
    NEW.amenities,
    NEW.description,
    NEW.meta_title,
    NEW.meta_description,
    NEW.website_url,
    NEW.phone,
    NEW.hours,
    COALESCE(NEW.favorite, false),
    COALESCE(NEW.view_count, 0),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

CREATE TRIGGER parks_instead_of_insert
  INSTEAD OF INSERT ON public.parks
  FOR EACH ROW
  EXECUTE FUNCTION public.parks_insert_trigger();

CREATE OR REPLACE FUNCTION public.parks_update_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE atlas.parks
  SET
    name = COALESCE(NEW.name, OLD.name),
    slug = COALESCE(NEW.slug, OLD.slug),
    city_id = NEW.city_id,
    county_id = NEW.county_id,
    lat = NEW.lat,
    lng = NEW.lng,
    polygon = NEW.polygon,
    address = NEW.address,
    park_type = NEW.park_type,
    area_acres = NEW.area_acres,
    amenities = NEW.amenities,
    description = NEW.description,
    meta_title = NEW.meta_title,
    meta_description = NEW.meta_description,
    website_url = NEW.website_url,
    phone = NEW.phone,
    hours = NEW.hours,
    favorite = COALESCE(NEW.favorite, OLD.favorite),
    view_count = COALESCE(NEW.view_count, OLD.view_count),
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER parks_instead_of_update
  INSTEAD OF UPDATE ON public.parks
  FOR EACH ROW
  EXECUTE FUNCTION public.parks_update_trigger();

CREATE OR REPLACE FUNCTION public.parks_delete_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM atlas.parks WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER parks_instead_of_delete
  INSTEAD OF DELETE ON public.parks
  FOR EACH ROW
  EXECUTE FUNCTION public.parks_delete_trigger();

-- Grant INSERT, UPDATE, DELETE on view (for triggers)
GRANT INSERT, UPDATE, DELETE ON public.parks TO authenticated;

-- ============================================================================
-- STEP 9: Update record_page_view function to support park entity type
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
  IF p_entity_type NOT IN ('post', 'article', 'city', 'county', 'neighborhood', 'school', 'park', 'account', 'business', 'page', 'feed', 'map', 'map_pin', 'homepage', 'pin') THEN
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
    ELSIF p_entity_type IN ('city', 'county', 'neighborhood', 'school', 'park') THEN
      -- Cities/Counties/Neighborhoods/Schools/Parks: resolve slug to id
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

COMMENT ON TABLE atlas.parks IS 'Reference table for Minnesota parks and recreational areas.';
COMMENT ON COLUMN atlas.parks.id IS 'Unique park ID (UUID)';
COMMENT ON COLUMN atlas.parks.name IS 'Park name';
COMMENT ON COLUMN atlas.parks.slug IS 'URL-friendly slug for the park';
COMMENT ON COLUMN atlas.parks.city_id IS 'Reference to the city this park is in (if applicable)';
COMMENT ON COLUMN atlas.parks.county_id IS 'Reference to the county this park is in';
COMMENT ON COLUMN atlas.parks.lat IS 'Latitude coordinate of park center/entrance';
COMMENT ON COLUMN atlas.parks.lng IS 'Longitude coordinate of park center/entrance';
COMMENT ON COLUMN atlas.parks.polygon IS 'GeoJSON polygon defining park boundaries';
COMMENT ON COLUMN atlas.parks.address IS 'Street address or location description';
COMMENT ON COLUMN atlas.parks.park_type IS 'Type of park: city, county, state, national, regional, nature_reserve, recreation, other';
COMMENT ON COLUMN atlas.parks.area_acres IS 'Park area in acres';
COMMENT ON COLUMN atlas.parks.amenities IS 'JSON array of amenities: playground, trails, picnic, beach, boat_launch, camping, etc.';
COMMENT ON COLUMN atlas.parks.description IS 'Description of the park';
COMMENT ON COLUMN atlas.parks.meta_title IS 'SEO meta title';
COMMENT ON COLUMN atlas.parks.meta_description IS 'SEO meta description';
COMMENT ON COLUMN atlas.parks.website_url IS 'Official park website URL';
COMMENT ON COLUMN atlas.parks.phone IS 'Park contact phone number';
COMMENT ON COLUMN atlas.parks.hours IS 'JSON object with operating hours by day';
COMMENT ON COLUMN atlas.parks.favorite IS 'Whether this is a featured/favorite park';
COMMENT ON COLUMN atlas.parks.view_count IS 'Number of times this park page has been viewed';
COMMENT ON VIEW public.parks IS 'View pointing to atlas.parks for Supabase client compatibility';

-- ============================================================================
-- STEP 11: Verification report
-- ============================================================================

DO $$
DECLARE
  v_parks_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_parks_count FROM atlas.parks;
  
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '  Parks table created in atlas schema';
  RAISE NOTICE '  Public view created for Supabase client compatibility';
  RAISE NOTICE '  RLS policies configured';
  RAISE NOTICE '  record_page_view function updated to support park entity type';
END;
$$;






