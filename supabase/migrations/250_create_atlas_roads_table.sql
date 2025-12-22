-- Create roads table in atlas schema
-- Roads are point/segment-based location entities that can have multiple entries for the same road name
-- (e.g., multiple segments of Highway 61) - NO unique name constraint

-- ============================================================================
-- STEP 1: Create roads table in atlas schema
-- ============================================================================

CREATE TABLE atlas.roads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  city_id UUID REFERENCES atlas.cities(id) ON DELETE SET NULL,
  
  -- Location data (pin coordinates for this segment)
  lat NUMERIC(10, 8),
  lng NUMERIC(11, 8),
  
  -- Road classification
  road_type TEXT CHECK (road_type IN (
    'interstate',
    'us_highway',
    'state_highway',
    'county_road',
    'local_road',
    'township_road',
    'private_road',
    'trail',
    'bridge',
    'tunnel',
    'other'
  )),
  route_number TEXT,
  direction TEXT CHECK (direction IN ('north', 'south', 'east', 'west', 'northbound', 'southbound', 'eastbound', 'westbound', NULL)),
  
  -- Segment identification
  segment_name TEXT,
  start_point TEXT,
  end_point TEXT,
  mile_marker NUMERIC(10, 2),
  
  -- Metadata
  description TEXT,
  meta_title TEXT,
  meta_description TEXT,
  wikipedia_url TEXT,
  
  -- Features
  favorite BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  
  -- NOTE: No unique constraint on name or slug - roads can have multiple segments
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX idx_roads_name ON atlas.roads(name);
CREATE INDEX idx_roads_slug ON atlas.roads(slug);
CREATE INDEX idx_roads_city_id ON atlas.roads(city_id);
CREATE INDEX idx_roads_road_type ON atlas.roads(road_type);
CREATE INDEX idx_roads_route_number ON atlas.roads(route_number);
CREATE INDEX idx_roads_lat_lng ON atlas.roads(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX idx_roads_favorite ON atlas.roads(favorite) WHERE favorite = true;
CREATE INDEX idx_roads_view_count ON atlas.roads(view_count DESC);
CREATE INDEX idx_roads_mile_marker ON atlas.roads(mile_marker) WHERE mile_marker IS NOT NULL;

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_roads_updated_at 
  BEFORE UPDATE ON atlas.roads 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE atlas.roads ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS Policies
-- ============================================================================

-- Policy: Anyone can read roads (public reference data)
CREATE POLICY "Anyone can view roads"
  ON atlas.roads
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Admins can insert roads
CREATE POLICY "Admins can insert roads"
  ON atlas.roads
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Policy: Admins can update roads
CREATE POLICY "Admins can update roads"
  ON atlas.roads
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policy: Admins can delete roads
CREATE POLICY "Admins can delete roads"
  ON atlas.roads
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT ON atlas.roads TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON atlas.roads TO authenticated;
GRANT ALL ON atlas.roads TO service_role;

-- ============================================================================
-- STEP 7: Create public view for Supabase client compatibility
-- ============================================================================

CREATE OR REPLACE VIEW public.roads AS
SELECT * FROM atlas.roads;

GRANT SELECT ON public.roads TO authenticated, anon;

-- ============================================================================
-- STEP 8: Create INSTEAD OF triggers for view updates
-- ============================================================================

CREATE OR REPLACE FUNCTION public.roads_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.roads (
    name, slug, city_id, lat, lng,
    road_type, route_number, direction,
    segment_name, start_point, end_point, mile_marker,
    description, meta_title, meta_description, wikipedia_url,
    favorite, view_count, created_at, updated_at
  )
  VALUES (
    NEW.name,
    NEW.slug,
    NEW.city_id,
    NEW.lat,
    NEW.lng,
    NEW.road_type,
    NEW.route_number,
    NEW.direction,
    NEW.segment_name,
    NEW.start_point,
    NEW.end_point,
    NEW.mile_marker,
    NEW.description,
    NEW.meta_title,
    NEW.meta_description,
    NEW.wikipedia_url,
    COALESCE(NEW.favorite, false),
    COALESCE(NEW.view_count, 0),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

CREATE TRIGGER roads_instead_of_insert
  INSTEAD OF INSERT ON public.roads
  FOR EACH ROW
  EXECUTE FUNCTION public.roads_insert_trigger();

CREATE OR REPLACE FUNCTION public.roads_update_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE atlas.roads
  SET
    name = COALESCE(NEW.name, OLD.name),
    slug = COALESCE(NEW.slug, OLD.slug),
    city_id = NEW.city_id,
    lat = NEW.lat,
    lng = NEW.lng,
    road_type = NEW.road_type,
    route_number = NEW.route_number,
    direction = NEW.direction,
    segment_name = NEW.segment_name,
    start_point = NEW.start_point,
    end_point = NEW.end_point,
    mile_marker = NEW.mile_marker,
    description = NEW.description,
    meta_title = NEW.meta_title,
    meta_description = NEW.meta_description,
    wikipedia_url = NEW.wikipedia_url,
    favorite = COALESCE(NEW.favorite, OLD.favorite),
    view_count = COALESCE(NEW.view_count, OLD.view_count),
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER roads_instead_of_update
  INSTEAD OF UPDATE ON public.roads
  FOR EACH ROW
  EXECUTE FUNCTION public.roads_update_trigger();

CREATE OR REPLACE FUNCTION public.roads_delete_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM atlas.roads WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER roads_instead_of_delete
  INSTEAD OF DELETE ON public.roads
  FOR EACH ROW
  EXECUTE FUNCTION public.roads_delete_trigger();

-- Grant INSERT, UPDATE, DELETE on view (for triggers)
GRANT INSERT, UPDATE, DELETE ON public.roads TO authenticated;

-- ============================================================================
-- STEP 9: Update record_page_view function to support road entity type
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
  IF p_entity_type NOT IN ('post', 'article', 'city', 'county', 'neighborhood', 'school', 'park', 'watertower', 'cemetery', 'golf_course', 'hospital', 'airport', 'church', 'municipal', 'road', 'account', 'business', 'page', 'feed', 'map', 'map_pin', 'homepage', 'pin') THEN
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
    WHEN 'road' THEN 'roads'
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
    ELSIF p_entity_type IN ('city', 'county', 'neighborhood', 'school', 'park', 'watertower', 'cemetery', 'golf_course', 'hospital', 'airport', 'church', 'municipal', 'road') THEN
      -- Atlas entities: resolve slug to id (note: road slugs are not unique, this returns first match)
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

COMMENT ON TABLE atlas.roads IS 'Reference table for Minnesota roads. Point-based location entities that can have multiple segments per road (no unique name constraint).';
COMMENT ON COLUMN atlas.roads.id IS 'Unique road segment ID (UUID)';
COMMENT ON COLUMN atlas.roads.name IS 'Road name (e.g., "Interstate 35", "Highway 61", "County Road 42")';
COMMENT ON COLUMN atlas.roads.slug IS 'URL-friendly slug for the road segment';
COMMENT ON COLUMN atlas.roads.city_id IS 'Reference to the city this road segment is in (optional - roads can span multiple cities)';
COMMENT ON COLUMN atlas.roads.lat IS 'Latitude coordinate of road segment location';
COMMENT ON COLUMN atlas.roads.lng IS 'Longitude coordinate of road segment location';
COMMENT ON COLUMN atlas.roads.road_type IS 'Type of road: interstate, us_highway, state_highway, county_road, local_road, township_road, private_road, trail, bridge, tunnel, other';
COMMENT ON COLUMN atlas.roads.route_number IS 'Official route number (e.g., "35", "61", "494", "42")';
COMMENT ON COLUMN atlas.roads.direction IS 'Direction for divided highways (north, south, east, west, or bound variants)';
COMMENT ON COLUMN atlas.roads.segment_name IS 'Human-readable segment identifier (e.g., "I-35 through downtown Minneapolis")';
COMMENT ON COLUMN atlas.roads.start_point IS 'Description of where this segment starts';
COMMENT ON COLUMN atlas.roads.end_point IS 'Description of where this segment ends';
COMMENT ON COLUMN atlas.roads.mile_marker IS 'Mile marker for this segment location';
COMMENT ON COLUMN atlas.roads.description IS 'Description of the road or segment';
COMMENT ON COLUMN atlas.roads.meta_title IS 'SEO meta title';
COMMENT ON COLUMN atlas.roads.meta_description IS 'SEO meta description';
COMMENT ON COLUMN atlas.roads.wikipedia_url IS 'Wikipedia article URL for the road';
COMMENT ON COLUMN atlas.roads.favorite IS 'Whether this is a featured/favorite road segment';
COMMENT ON COLUMN atlas.roads.view_count IS 'Number of times this road segment page has been viewed';
COMMENT ON VIEW public.roads IS 'View pointing to atlas.roads for Supabase client compatibility';

-- ============================================================================
-- STEP 11: Verification report
-- ============================================================================

DO $$
DECLARE
  v_roads_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_roads_count FROM atlas.roads;
  
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '  Roads table created in atlas schema';
  RAISE NOTICE '  Public view created for Supabase client compatibility';
  RAISE NOTICE '  RLS policies configured (admin-only write access)';
  RAISE NOTICE '  record_page_view function updated to support road entity type';
  RAISE NOTICE '  No unique constraints on name/slug - multiple segments per road allowed';
END;
$$;

