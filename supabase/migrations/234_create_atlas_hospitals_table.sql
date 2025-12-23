-- Create hospitals table in atlas schema
-- Hospitals are point-based location entities tied to cities

-- ============================================================================
-- STEP 1: Create hospitals table in atlas schema
-- ============================================================================

CREATE TABLE atlas.hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  city_id UUID REFERENCES atlas.cities(id) ON DELETE SET NULL,
  
  -- Location data (pin coordinates)
  lat NUMERIC(10, 8),
  lng NUMERIC(11, 8),
  address TEXT,
  
  -- Hospital classification
  hospital_type TEXT CHECK (hospital_type IN ('general', 'specialty', 'emergency', 'children', 'veterans', 'teaching', 'community', 'other')),
  
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
  CONSTRAINT hospitals_slug_unique UNIQUE (slug)
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX idx_hospitals_name ON atlas.hospitals(name);
CREATE INDEX idx_hospitals_slug ON atlas.hospitals(slug);
CREATE INDEX idx_hospitals_city_id ON atlas.hospitals(city_id);
CREATE INDEX idx_hospitals_hospital_type ON atlas.hospitals(hospital_type);
CREATE INDEX idx_hospitals_lat_lng ON atlas.hospitals(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX idx_hospitals_favorite ON atlas.hospitals(favorite) WHERE favorite = true;
CREATE INDEX idx_hospitals_view_count ON atlas.hospitals(view_count DESC);

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_hospitals_updated_at 
  BEFORE UPDATE ON atlas.hospitals 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE atlas.hospitals ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS Policies
-- ============================================================================

-- Policy: Anyone can read hospitals (public reference data)
CREATE POLICY "Anyone can view hospitals"
  ON atlas.hospitals
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Admins can insert hospitals
CREATE POLICY "Admins can insert hospitals"
  ON atlas.hospitals
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Policy: Admins can update hospitals
CREATE POLICY "Admins can update hospitals"
  ON atlas.hospitals
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policy: Admins can delete hospitals
CREATE POLICY "Admins can delete hospitals"
  ON atlas.hospitals
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT ON atlas.hospitals TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON atlas.hospitals TO authenticated;
GRANT ALL ON atlas.hospitals TO service_role;

-- ============================================================================
-- STEP 7: Create public view for Supabase client compatibility
-- ============================================================================

CREATE OR REPLACE VIEW public.hospitals AS
SELECT * FROM atlas.hospitals;

GRANT SELECT ON public.hospitals TO authenticated, anon;

-- ============================================================================
-- STEP 8: Create INSTEAD OF triggers for view updates
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hospitals_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.hospitals (
    name, slug, city_id, lat, lng, address,
    hospital_type,
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
    NEW.hospital_type,
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

CREATE TRIGGER hospitals_instead_of_insert
  INSTEAD OF INSERT ON public.hospitals
  FOR EACH ROW
  EXECUTE FUNCTION public.hospitals_insert_trigger();

CREATE OR REPLACE FUNCTION public.hospitals_update_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE atlas.hospitals
  SET
    name = COALESCE(NEW.name, OLD.name),
    slug = COALESCE(NEW.slug, OLD.slug),
    city_id = NEW.city_id,
    lat = NEW.lat,
    lng = NEW.lng,
    address = NEW.address,
    hospital_type = NEW.hospital_type,
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

CREATE TRIGGER hospitals_instead_of_update
  INSTEAD OF UPDATE ON public.hospitals
  FOR EACH ROW
  EXECUTE FUNCTION public.hospitals_update_trigger();

CREATE OR REPLACE FUNCTION public.hospitals_delete_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM atlas.hospitals WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER hospitals_instead_of_delete
  INSTEAD OF DELETE ON public.hospitals
  FOR EACH ROW
  EXECUTE FUNCTION public.hospitals_delete_trigger();

-- Grant INSERT, UPDATE, DELETE on view (for triggers)
GRANT INSERT, UPDATE, DELETE ON public.hospitals TO authenticated;

-- ============================================================================
-- STEP 9: Update record_page_view function to support hospital entity type
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

COMMENT ON TABLE atlas.hospitals IS 'Reference table for Minnesota hospitals. Point-based location entities tied to cities.';
COMMENT ON COLUMN atlas.hospitals.id IS 'Unique hospital ID (UUID)';
COMMENT ON COLUMN atlas.hospitals.name IS 'Hospital name';
COMMENT ON COLUMN atlas.hospitals.slug IS 'URL-friendly slug for the hospital';
COMMENT ON COLUMN atlas.hospitals.city_id IS 'Reference to the city this hospital is in';
COMMENT ON COLUMN atlas.hospitals.lat IS 'Latitude coordinate of hospital location';
COMMENT ON COLUMN atlas.hospitals.lng IS 'Longitude coordinate of hospital location';
COMMENT ON COLUMN atlas.hospitals.address IS 'Street address or location description';
COMMENT ON COLUMN atlas.hospitals.hospital_type IS 'Type of hospital: general, specialty, emergency, children, veterans, teaching, community, other';
COMMENT ON COLUMN atlas.hospitals.description IS 'Description of the hospital';
COMMENT ON COLUMN atlas.hospitals.meta_title IS 'SEO meta title';
COMMENT ON COLUMN atlas.hospitals.meta_description IS 'SEO meta description';
COMMENT ON COLUMN atlas.hospitals.website_url IS 'Official hospital website URL';
COMMENT ON COLUMN atlas.hospitals.phone IS 'Hospital contact phone number';
COMMENT ON COLUMN atlas.hospitals.favorite IS 'Whether this is a featured/favorite hospital';
COMMENT ON COLUMN atlas.hospitals.view_count IS 'Number of times this hospital page has been viewed';
COMMENT ON VIEW public.hospitals IS 'View pointing to atlas.hospitals for Supabase client compatibility';

-- ============================================================================
-- STEP 11: Verification report
-- ============================================================================

DO $$
DECLARE
  v_hospitals_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_hospitals_count FROM atlas.hospitals;
  
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '  Hospitals table created in atlas schema';
  RAISE NOTICE '  Public view created for Supabase client compatibility';
  RAISE NOTICE '  RLS policies configured';
  RAISE NOTICE '  record_page_view function updated to support hospital entity type';
END;
$$;



