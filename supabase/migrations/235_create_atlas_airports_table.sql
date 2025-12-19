-- Create airports table in atlas schema
-- Airports are point-based location entities tied to cities

-- ============================================================================
-- STEP 1: Create airports table in atlas schema
-- ============================================================================

CREATE TABLE atlas.airports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  city_id UUID REFERENCES atlas.cities(id) ON DELETE SET NULL,
  
  -- Location data (pin coordinates)
  lat NUMERIC(10, 8),
  lng NUMERIC(11, 8),
  address TEXT,
  
  -- Airport classification
  airport_type TEXT CHECK (airport_type IN ('commercial', 'general_aviation', 'private', 'military', 'regional', 'international', 'other')),
  iata_code TEXT,
  icao_code TEXT,
  
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
  CONSTRAINT airports_slug_unique UNIQUE (slug)
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX idx_airports_name ON atlas.airports(name);
CREATE INDEX idx_airports_slug ON atlas.airports(slug);
CREATE INDEX idx_airports_city_id ON atlas.airports(city_id);
CREATE INDEX idx_airports_airport_type ON atlas.airports(airport_type);
CREATE INDEX idx_airports_iata_code ON atlas.airports(iata_code) WHERE iata_code IS NOT NULL;
CREATE INDEX idx_airports_icao_code ON atlas.airports(icao_code) WHERE icao_code IS NOT NULL;
CREATE INDEX idx_airports_lat_lng ON atlas.airports(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX idx_airports_favorite ON atlas.airports(favorite) WHERE favorite = true;
CREATE INDEX idx_airports_view_count ON atlas.airports(view_count DESC);

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_airports_updated_at 
  BEFORE UPDATE ON atlas.airports 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE atlas.airports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS Policies
-- ============================================================================

-- Policy: Anyone can read airports (public reference data)
CREATE POLICY "Anyone can view airports"
  ON atlas.airports
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Admins can insert airports
CREATE POLICY "Admins can insert airports"
  ON atlas.airports
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Policy: Admins can update airports
CREATE POLICY "Admins can update airports"
  ON atlas.airports
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policy: Admins can delete airports
CREATE POLICY "Admins can delete airports"
  ON atlas.airports
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT ON atlas.airports TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON atlas.airports TO authenticated;
GRANT ALL ON atlas.airports TO service_role;

-- ============================================================================
-- STEP 7: Create public view for Supabase client compatibility
-- ============================================================================

CREATE OR REPLACE VIEW public.airports AS
SELECT * FROM atlas.airports;

GRANT SELECT ON public.airports TO authenticated, anon;

-- ============================================================================
-- STEP 8: Create INSTEAD OF triggers for view updates
-- ============================================================================

CREATE OR REPLACE FUNCTION public.airports_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.airports (
    name, slug, city_id, lat, lng, address,
    airport_type, iata_code, icao_code,
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
    NEW.airport_type,
    NEW.iata_code,
    NEW.icao_code,
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

CREATE TRIGGER airports_instead_of_insert
  INSTEAD OF INSERT ON public.airports
  FOR EACH ROW
  EXECUTE FUNCTION public.airports_insert_trigger();

CREATE OR REPLACE FUNCTION public.airports_update_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE atlas.airports
  SET
    name = COALESCE(NEW.name, OLD.name),
    slug = COALESCE(NEW.slug, OLD.slug),
    city_id = NEW.city_id,
    lat = NEW.lat,
    lng = NEW.lng,
    address = NEW.address,
    airport_type = NEW.airport_type,
    iata_code = NEW.iata_code,
    icao_code = NEW.icao_code,
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

CREATE TRIGGER airports_instead_of_update
  INSTEAD OF UPDATE ON public.airports
  FOR EACH ROW
  EXECUTE FUNCTION public.airports_update_trigger();

CREATE OR REPLACE FUNCTION public.airports_delete_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM atlas.airports WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER airports_instead_of_delete
  INSTEAD OF DELETE ON public.airports
  FOR EACH ROW
  EXECUTE FUNCTION public.airports_delete_trigger();

-- Grant INSERT, UPDATE, DELETE on view (for triggers)
GRANT INSERT, UPDATE, DELETE ON public.airports TO authenticated;

-- ============================================================================
-- STEP 9: Update record_page_view function to support airport entity type
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
  IF p_entity_type NOT IN ('post', 'article', 'city', 'county', 'neighborhood', 'school', 'park', 'watertower', 'cemetery', 'golf_course', 'hospital', 'airport', 'account', 'business', 'page', 'feed', 'map', 'map_pin', 'homepage', 'pin') THEN
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
    ELSIF p_entity_type IN ('city', 'county', 'neighborhood', 'school', 'park', 'watertower', 'cemetery', 'golf_course', 'hospital', 'airport') THEN
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

COMMENT ON TABLE atlas.airports IS 'Reference table for Minnesota airports. Point-based location entities tied to cities.';
COMMENT ON COLUMN atlas.airports.id IS 'Unique airport ID (UUID)';
COMMENT ON COLUMN atlas.airports.name IS 'Airport name';
COMMENT ON COLUMN atlas.airports.slug IS 'URL-friendly slug for the airport';
COMMENT ON COLUMN atlas.airports.city_id IS 'Reference to the city this airport is in';
COMMENT ON COLUMN atlas.airports.lat IS 'Latitude coordinate of airport location';
COMMENT ON COLUMN atlas.airports.lng IS 'Longitude coordinate of airport location';
COMMENT ON COLUMN atlas.airports.address IS 'Street address or location description';
COMMENT ON COLUMN atlas.airports.airport_type IS 'Type of airport: commercial, general_aviation, private, military, regional, international, other';
COMMENT ON COLUMN atlas.airports.iata_code IS 'IATA airport code (3-letter)';
COMMENT ON COLUMN atlas.airports.icao_code IS 'ICAO airport code (4-letter)';
COMMENT ON COLUMN atlas.airports.description IS 'Description of the airport';
COMMENT ON COLUMN atlas.airports.meta_title IS 'SEO meta title';
COMMENT ON COLUMN atlas.airports.meta_description IS 'SEO meta description';
COMMENT ON COLUMN atlas.airports.website_url IS 'Official airport website URL';
COMMENT ON COLUMN atlas.airports.phone IS 'Airport contact phone number';
COMMENT ON COLUMN atlas.airports.favorite IS 'Whether this is a featured/favorite airport';
COMMENT ON COLUMN atlas.airports.view_count IS 'Number of times this airport page has been viewed';
COMMENT ON VIEW public.airports IS 'View pointing to atlas.airports for Supabase client compatibility';

-- ============================================================================
-- STEP 11: Verification report
-- ============================================================================

DO $$
DECLARE
  v_airports_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_airports_count FROM atlas.airports;
  
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '  Airports table created in atlas schema';
  RAISE NOTICE '  Public view created for Supabase client compatibility';
  RAISE NOTICE '  RLS policies configured';
  RAISE NOTICE '  record_page_view function updated to support airport entity type';
END;
$$;

