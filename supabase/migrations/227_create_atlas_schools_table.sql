-- Create schools table in atlas schema
-- Schools include K-12, universities, colleges, and other educational institutions

-- ============================================================================
-- STEP 1: Create schools table in atlas schema
-- ============================================================================

CREATE TABLE atlas.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  city_id UUID REFERENCES atlas.cities(id) ON DELETE SET NULL,
  
  -- Location data
  lat NUMERIC(10, 8),
  lng NUMERIC(11, 8),
  polygon JSONB,
  address TEXT,
  
  -- School classification
  school_type TEXT CHECK (school_type IN ('elementary', 'middle', 'high', 'k12', 'university', 'college', 'technical', 'other')),
  is_public BOOLEAN DEFAULT TRUE,
  district TEXT,
  
  -- Demographics (optional)
  enrollment INTEGER,
  
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
  CONSTRAINT schools_slug_unique UNIQUE (slug)
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX idx_schools_name ON atlas.schools(name);
CREATE INDEX idx_schools_slug ON atlas.schools(slug);
CREATE INDEX idx_schools_city_id ON atlas.schools(city_id);
CREATE INDEX idx_schools_school_type ON atlas.schools(school_type);
CREATE INDEX idx_schools_lat_lng ON atlas.schools(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX idx_schools_polygon ON atlas.schools USING GIN (polygon) WHERE polygon IS NOT NULL;
CREATE INDEX idx_schools_favorite ON atlas.schools(favorite) WHERE favorite = true;
CREATE INDEX idx_schools_view_count ON atlas.schools(view_count DESC);

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_schools_updated_at 
  BEFORE UPDATE ON atlas.schools 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE atlas.schools ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS Policies
-- ============================================================================

-- Policy: Anyone can read schools (public reference data)
CREATE POLICY "Anyone can view schools"
  ON atlas.schools
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Admins can insert schools
CREATE POLICY "Admins can insert schools"
  ON atlas.schools
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Policy: Admins can update schools
CREATE POLICY "Admins can update schools"
  ON atlas.schools
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policy: Admins can delete schools
CREATE POLICY "Admins can delete schools"
  ON atlas.schools
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT ON atlas.schools TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON atlas.schools TO authenticated;
GRANT ALL ON atlas.schools TO service_role;

-- ============================================================================
-- STEP 7: Create public view for Supabase client compatibility
-- ============================================================================

CREATE OR REPLACE VIEW public.schools AS
SELECT * FROM atlas.schools;

GRANT SELECT ON public.schools TO authenticated, anon;

-- ============================================================================
-- STEP 8: Create INSTEAD OF triggers for view updates
-- ============================================================================

CREATE OR REPLACE FUNCTION public.schools_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.schools (
    name, slug, city_id, lat, lng, polygon, address,
    school_type, is_public, district, enrollment,
    description, meta_title, meta_description, website_url, phone,
    favorite, view_count, created_at, updated_at
  )
  VALUES (
    NEW.name,
    NEW.slug,
    NEW.city_id,
    NEW.lat,
    NEW.lng,
    NEW.polygon,
    NEW.address,
    NEW.school_type,
    COALESCE(NEW.is_public, true),
    NEW.district,
    NEW.enrollment,
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

CREATE TRIGGER schools_instead_of_insert
  INSTEAD OF INSERT ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION public.schools_insert_trigger();

CREATE OR REPLACE FUNCTION public.schools_update_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE atlas.schools
  SET
    name = COALESCE(NEW.name, OLD.name),
    slug = COALESCE(NEW.slug, OLD.slug),
    city_id = NEW.city_id,
    lat = NEW.lat,
    lng = NEW.lng,
    polygon = NEW.polygon,
    address = NEW.address,
    school_type = NEW.school_type,
    is_public = COALESCE(NEW.is_public, OLD.is_public),
    district = NEW.district,
    enrollment = NEW.enrollment,
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

CREATE TRIGGER schools_instead_of_update
  INSTEAD OF UPDATE ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION public.schools_update_trigger();

CREATE OR REPLACE FUNCTION public.schools_delete_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM atlas.schools WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER schools_instead_of_delete
  INSTEAD OF DELETE ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION public.schools_delete_trigger();

-- Grant INSERT, UPDATE, DELETE on view (for triggers)
GRANT INSERT, UPDATE, DELETE ON public.schools TO authenticated;

-- ============================================================================
-- STEP 9: Update record_page_view function to support school entity type
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
  IF p_entity_type NOT IN ('post', 'article', 'city', 'county', 'neighborhood', 'school', 'account', 'business', 'page', 'feed', 'map', 'map_pin', 'homepage', 'pin') THEN
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
    ELSIF p_entity_type IN ('city', 'county', 'neighborhood', 'school') THEN
      -- Cities/Counties/Neighborhoods/Schools: resolve slug to id
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

COMMENT ON TABLE atlas.schools IS 'Reference table for Minnesota schools and educational institutions.';
COMMENT ON COLUMN atlas.schools.id IS 'Unique school ID (UUID)';
COMMENT ON COLUMN atlas.schools.name IS 'School name';
COMMENT ON COLUMN atlas.schools.slug IS 'URL-friendly slug for the school';
COMMENT ON COLUMN atlas.schools.city_id IS 'Reference to the city this school is in';
COMMENT ON COLUMN atlas.schools.lat IS 'Latitude coordinate of school location';
COMMENT ON COLUMN atlas.schools.lng IS 'Longitude coordinate of school location';
COMMENT ON COLUMN atlas.schools.polygon IS 'GeoJSON polygon defining school campus boundaries';
COMMENT ON COLUMN atlas.schools.address IS 'Street address of the school';
COMMENT ON COLUMN atlas.schools.school_type IS 'Type of school: elementary, middle, high, k12, university, college, technical, other';
COMMENT ON COLUMN atlas.schools.is_public IS 'Whether this is a public school (vs private)';
COMMENT ON COLUMN atlas.schools.district IS 'School district name';
COMMENT ON COLUMN atlas.schools.enrollment IS 'Current student enrollment';
COMMENT ON COLUMN atlas.schools.description IS 'Description of the school';
COMMENT ON COLUMN atlas.schools.meta_title IS 'SEO meta title';
COMMENT ON COLUMN atlas.schools.meta_description IS 'SEO meta description';
COMMENT ON COLUMN atlas.schools.website_url IS 'Official school website URL';
COMMENT ON COLUMN atlas.schools.phone IS 'School contact phone number';
COMMENT ON COLUMN atlas.schools.favorite IS 'Whether this is a featured/favorite school';
COMMENT ON COLUMN atlas.schools.view_count IS 'Number of times this school page has been viewed';
COMMENT ON VIEW public.schools IS 'View pointing to atlas.schools for Supabase client compatibility';

-- ============================================================================
-- STEP 11: Verification report
-- ============================================================================

DO $$
DECLARE
  v_schools_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_schools_count FROM atlas.schools;
  
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '  Schools table created in atlas schema';
  RAISE NOTICE '  Public view created for Supabase client compatibility';
  RAISE NOTICE '  RLS policies configured';
  RAISE NOTICE '  record_page_view function updated to support school entity type';
END;
$$;






