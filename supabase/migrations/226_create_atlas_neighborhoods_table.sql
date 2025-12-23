-- Create neighborhoods table in atlas schema
-- Neighborhoods are subdivision areas within cities that users can explore

-- ============================================================================
-- STEP 1: Create neighborhoods table in atlas schema
-- ============================================================================

CREATE TABLE atlas.neighborhoods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  city_id UUID REFERENCES atlas.cities(id) ON DELETE SET NULL,
  
  -- Location data
  lat NUMERIC(10, 8),
  lng NUMERIC(11, 8),
  polygon JSONB,
  
  -- Demographics (optional)
  population INTEGER,
  area_sq_mi NUMERIC(10, 4),
  
  -- Metadata
  description TEXT,
  meta_title TEXT,
  meta_description TEXT,
  website_url TEXT,
  
  -- Features
  favorite BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT neighborhoods_slug_unique UNIQUE (slug),
  CONSTRAINT neighborhoods_name_city_unique UNIQUE (name, city_id)
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX idx_neighborhoods_name ON atlas.neighborhoods(name);
CREATE INDEX idx_neighborhoods_slug ON atlas.neighborhoods(slug);
CREATE INDEX idx_neighborhoods_city_id ON atlas.neighborhoods(city_id);
CREATE INDEX idx_neighborhoods_lat_lng ON atlas.neighborhoods(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX idx_neighborhoods_polygon ON atlas.neighborhoods USING GIN (polygon) WHERE polygon IS NOT NULL;
CREATE INDEX idx_neighborhoods_favorite ON atlas.neighborhoods(favorite) WHERE favorite = true;
CREATE INDEX idx_neighborhoods_view_count ON atlas.neighborhoods(view_count DESC);

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_neighborhoods_updated_at 
  BEFORE UPDATE ON atlas.neighborhoods 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE atlas.neighborhoods ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS Policies
-- ============================================================================

-- Policy: Anyone can read neighborhoods (public reference data)
CREATE POLICY "Anyone can view neighborhoods"
  ON atlas.neighborhoods
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Admins can insert neighborhoods
CREATE POLICY "Admins can insert neighborhoods"
  ON atlas.neighborhoods
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Policy: Admins can update neighborhoods
CREATE POLICY "Admins can update neighborhoods"
  ON atlas.neighborhoods
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policy: Admins can delete neighborhoods
CREATE POLICY "Admins can delete neighborhoods"
  ON atlas.neighborhoods
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT ON atlas.neighborhoods TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON atlas.neighborhoods TO authenticated;
GRANT ALL ON atlas.neighborhoods TO service_role;

-- ============================================================================
-- STEP 7: Create public view for Supabase client compatibility
-- ============================================================================

CREATE OR REPLACE VIEW public.neighborhoods AS
SELECT * FROM atlas.neighborhoods;

GRANT SELECT ON public.neighborhoods TO authenticated, anon;

-- ============================================================================
-- STEP 8: Create INSTEAD OF triggers for view updates
-- ============================================================================

CREATE OR REPLACE FUNCTION public.neighborhoods_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.neighborhoods (
    name, slug, city_id, lat, lng, polygon,
    population, area_sq_mi, description,
    meta_title, meta_description, website_url,
    favorite, view_count, created_at, updated_at
  )
  VALUES (
    NEW.name,
    NEW.slug,
    NEW.city_id,
    NEW.lat,
    NEW.lng,
    NEW.polygon,
    NEW.population,
    NEW.area_sq_mi,
    NEW.description,
    NEW.meta_title,
    NEW.meta_description,
    NEW.website_url,
    COALESCE(NEW.favorite, false),
    COALESCE(NEW.view_count, 0),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

CREATE TRIGGER neighborhoods_instead_of_insert
  INSTEAD OF INSERT ON public.neighborhoods
  FOR EACH ROW
  EXECUTE FUNCTION public.neighborhoods_insert_trigger();

CREATE OR REPLACE FUNCTION public.neighborhoods_update_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE atlas.neighborhoods
  SET
    name = COALESCE(NEW.name, OLD.name),
    slug = COALESCE(NEW.slug, OLD.slug),
    city_id = NEW.city_id,
    lat = NEW.lat,
    lng = NEW.lng,
    polygon = NEW.polygon,
    population = NEW.population,
    area_sq_mi = NEW.area_sq_mi,
    description = NEW.description,
    meta_title = NEW.meta_title,
    meta_description = NEW.meta_description,
    website_url = NEW.website_url,
    favorite = COALESCE(NEW.favorite, OLD.favorite),
    view_count = COALESCE(NEW.view_count, OLD.view_count),
    updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER neighborhoods_instead_of_update
  INSTEAD OF UPDATE ON public.neighborhoods
  FOR EACH ROW
  EXECUTE FUNCTION public.neighborhoods_update_trigger();

CREATE OR REPLACE FUNCTION public.neighborhoods_delete_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM atlas.neighborhoods WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER neighborhoods_instead_of_delete
  INSTEAD OF DELETE ON public.neighborhoods
  FOR EACH ROW
  EXECUTE FUNCTION public.neighborhoods_delete_trigger();

-- Grant INSERT, UPDATE, DELETE on view (for triggers)
GRANT INSERT, UPDATE, DELETE ON public.neighborhoods TO authenticated;

-- ============================================================================
-- STEP 9: Update record_page_view function to support neighborhood entity type
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
  IF p_entity_type NOT IN ('post', 'article', 'city', 'county', 'neighborhood', 'account', 'business', 'page', 'feed', 'map', 'map_pin', 'homepage', 'pin') THEN
    RAISE EXCEPTION 'Invalid entity_type: %', p_entity_type;
  END IF;
  
  -- Map entity_type to table name
  v_table_name := CASE p_entity_type
    WHEN 'post' THEN 'posts'
    WHEN 'article' THEN 'articles'
    WHEN 'city' THEN 'cities'
    WHEN 'county' THEN 'counties'
    WHEN 'neighborhood' THEN 'neighborhoods'
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
    ELSIF p_entity_type IN ('city', 'county', 'neighborhood') THEN
      -- Cities/Counties/Neighborhoods: resolve slug to id
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

COMMENT ON TABLE atlas.neighborhoods IS 'Standalone reference table for Minnesota neighborhoods. Subdivision areas within cities.';
COMMENT ON COLUMN atlas.neighborhoods.id IS 'Unique neighborhood ID (UUID)';
COMMENT ON COLUMN atlas.neighborhoods.name IS 'Neighborhood name';
COMMENT ON COLUMN atlas.neighborhoods.slug IS 'URL-friendly slug for the neighborhood';
COMMENT ON COLUMN atlas.neighborhoods.city_id IS 'Reference to the city this neighborhood belongs to';
COMMENT ON COLUMN atlas.neighborhoods.lat IS 'Latitude coordinate of neighborhood center';
COMMENT ON COLUMN atlas.neighborhoods.lng IS 'Longitude coordinate of neighborhood center';
COMMENT ON COLUMN atlas.neighborhoods.polygon IS 'GeoJSON polygon defining neighborhood boundaries';
COMMENT ON COLUMN atlas.neighborhoods.population IS 'Neighborhood population (if available)';
COMMENT ON COLUMN atlas.neighborhoods.area_sq_mi IS 'Neighborhood area in square miles';
COMMENT ON COLUMN atlas.neighborhoods.description IS 'Description of the neighborhood';
COMMENT ON COLUMN atlas.neighborhoods.meta_title IS 'SEO meta title';
COMMENT ON COLUMN atlas.neighborhoods.meta_description IS 'SEO meta description';
COMMENT ON COLUMN atlas.neighborhoods.website_url IS 'Official neighborhood website URL';
COMMENT ON COLUMN atlas.neighborhoods.favorite IS 'Whether this is a featured/favorite neighborhood';
COMMENT ON COLUMN atlas.neighborhoods.view_count IS 'Number of times this neighborhood page has been viewed';
COMMENT ON VIEW public.neighborhoods IS 'View pointing to atlas.neighborhoods for Supabase client compatibility';

-- ============================================================================
-- STEP 11: Verification report
-- ============================================================================

DO $$
DECLARE
  v_neighborhoods_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_neighborhoods_count FROM atlas.neighborhoods;
  
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '  Neighborhoods table created in atlas schema';
  RAISE NOTICE '  Public view created for Supabase client compatibility';
  RAISE NOTICE '  RLS policies configured';
  RAISE NOTICE '  record_page_view function updated to support neighborhood entity type';
END;
$$;



