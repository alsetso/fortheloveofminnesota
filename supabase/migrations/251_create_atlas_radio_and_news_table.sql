-- Create radio_and_news table in atlas schema
-- Radio stations, TV stations, newspapers, and online news outlets
-- Point-based location entities with unique name+city constraint

-- ============================================================================
-- STEP 1: Create radio_and_news table in atlas schema
-- ============================================================================

CREATE TABLE atlas.radio_and_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  city_id UUID REFERENCES atlas.cities(id) ON DELETE SET NULL,
  
  -- Location data
  lat NUMERIC(10, 8),
  lng NUMERIC(11, 8),
  
  -- Media classification
  media_type TEXT NOT NULL CHECK (media_type IN (
    'am_radio',
    'fm_radio',
    'television',
    'newspaper',
    'online_news',
    'podcast',
    'magazine',
    'wire_service',
    'other'
  )),
  
  -- Broadcast-specific fields (for radio/TV)
  call_sign TEXT,
  frequency TEXT,
  channel_number TEXT,
  format TEXT,
  
  -- Organization details
  address TEXT,
  phone TEXT,
  website_url TEXT,
  
  -- Ownership and affiliation
  parent_company TEXT,
  network_affiliation TEXT,
  
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint per city (same name can exist in different cities)
  CONSTRAINT radio_and_news_name_city_unique UNIQUE (name, city_id)
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX idx_radio_and_news_name ON atlas.radio_and_news(name);
CREATE INDEX idx_radio_and_news_slug ON atlas.radio_and_news(slug);
CREATE INDEX idx_radio_and_news_city_id ON atlas.radio_and_news(city_id);
CREATE INDEX idx_radio_and_news_media_type ON atlas.radio_and_news(media_type);
CREATE INDEX idx_radio_and_news_call_sign ON atlas.radio_and_news(call_sign) WHERE call_sign IS NOT NULL;
CREATE INDEX idx_radio_and_news_lat_lng ON atlas.radio_and_news(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX idx_radio_and_news_favorite ON atlas.radio_and_news(favorite) WHERE favorite = true;
CREATE INDEX idx_radio_and_news_view_count ON atlas.radio_and_news(view_count DESC);

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE TRIGGER update_radio_and_news_updated_at 
  BEFORE UPDATE ON atlas.radio_and_news 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE atlas.radio_and_news ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS Policies
-- ============================================================================

-- Policy: Anyone can read radio_and_news (public reference data)
CREATE POLICY "Anyone can view radio_and_news"
  ON atlas.radio_and_news
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Admins can insert radio_and_news
CREATE POLICY "Admins can insert radio_and_news"
  ON atlas.radio_and_news
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Policy: Admins can update radio_and_news
CREATE POLICY "Admins can update radio_and_news"
  ON atlas.radio_and_news
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policy: Admins can delete radio_and_news
CREATE POLICY "Admins can delete radio_and_news"
  ON atlas.radio_and_news
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT ON atlas.radio_and_news TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON atlas.radio_and_news TO authenticated;
GRANT ALL ON atlas.radio_and_news TO service_role;

-- ============================================================================
-- STEP 7: Create public view for Supabase client compatibility
-- ============================================================================

CREATE OR REPLACE VIEW public.radio_and_news AS
SELECT * FROM atlas.radio_and_news;

GRANT SELECT ON public.radio_and_news TO authenticated, anon;

-- ============================================================================
-- STEP 8: Create INSTEAD OF triggers for view updates
-- ============================================================================

CREATE OR REPLACE FUNCTION public.radio_and_news_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.radio_and_news (
    name, slug, city_id, lat, lng,
    media_type, call_sign, frequency, channel_number, format,
    address, phone, website_url,
    parent_company, network_affiliation,
    description, meta_title, meta_description, wikipedia_url,
    favorite, view_count, created_at, updated_at
  )
  VALUES (
    NEW.name,
    NEW.slug,
    NEW.city_id,
    NEW.lat,
    NEW.lng,
    NEW.media_type,
    NEW.call_sign,
    NEW.frequency,
    NEW.channel_number,
    NEW.format,
    NEW.address,
    NEW.phone,
    NEW.website_url,
    NEW.parent_company,
    NEW.network_affiliation,
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

CREATE TRIGGER radio_and_news_instead_of_insert
  INSTEAD OF INSERT ON public.radio_and_news
  FOR EACH ROW
  EXECUTE FUNCTION public.radio_and_news_insert_trigger();

CREATE OR REPLACE FUNCTION public.radio_and_news_update_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE atlas.radio_and_news
  SET
    name = COALESCE(NEW.name, OLD.name),
    slug = COALESCE(NEW.slug, OLD.slug),
    city_id = NEW.city_id,
    lat = NEW.lat,
    lng = NEW.lng,
    media_type = COALESCE(NEW.media_type, OLD.media_type),
    call_sign = NEW.call_sign,
    frequency = NEW.frequency,
    channel_number = NEW.channel_number,
    format = NEW.format,
    address = NEW.address,
    phone = NEW.phone,
    website_url = NEW.website_url,
    parent_company = NEW.parent_company,
    network_affiliation = NEW.network_affiliation,
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

CREATE TRIGGER radio_and_news_instead_of_update
  INSTEAD OF UPDATE ON public.radio_and_news
  FOR EACH ROW
  EXECUTE FUNCTION public.radio_and_news_update_trigger();

CREATE OR REPLACE FUNCTION public.radio_and_news_delete_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM atlas.radio_and_news WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER radio_and_news_instead_of_delete
  INSTEAD OF DELETE ON public.radio_and_news
  FOR EACH ROW
  EXECUTE FUNCTION public.radio_and_news_delete_trigger();

-- Grant INSERT, UPDATE, DELETE on view (for triggers)
GRANT INSERT, UPDATE, DELETE ON public.radio_and_news TO authenticated;

-- ============================================================================
-- STEP 9: Update record_page_view function to support radio_and_news entity type
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
  IF p_entity_type NOT IN ('post', 'article', 'city', 'county', 'neighborhood', 'school', 'park', 'watertower', 'cemetery', 'golf_course', 'hospital', 'airport', 'church', 'municipal', 'road', 'radio_and_news', 'account', 'business', 'page', 'feed', 'map', 'map_pin', 'homepage', 'pin') THEN
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
    WHEN 'radio_and_news' THEN 'radio_and_news'
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
    ELSIF p_entity_type IN ('city', 'county', 'neighborhood', 'school', 'park', 'watertower', 'cemetery', 'golf_course', 'hospital', 'airport', 'church', 'municipal', 'road', 'radio_and_news') THEN
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

COMMENT ON TABLE atlas.radio_and_news IS 'Reference table for Minnesota radio stations, TV stations, newspapers, and news outlets. Point-based location entities with unique name+city constraint.';
COMMENT ON COLUMN atlas.radio_and_news.id IS 'Unique radio/news outlet ID (UUID)';
COMMENT ON COLUMN atlas.radio_and_news.name IS 'Outlet name (e.g., "WCCO-AM", "Star Tribune", "KARE 11")';
COMMENT ON COLUMN atlas.radio_and_news.slug IS 'URL-friendly slug for the outlet';
COMMENT ON COLUMN atlas.radio_and_news.city_id IS 'Reference to the city this outlet is based in';
COMMENT ON COLUMN atlas.radio_and_news.lat IS 'Latitude coordinate of outlet location';
COMMENT ON COLUMN atlas.radio_and_news.lng IS 'Longitude coordinate of outlet location';
COMMENT ON COLUMN atlas.radio_and_news.media_type IS 'Type of media: am_radio, fm_radio, television, newspaper, online_news, podcast, magazine, wire_service, other';
COMMENT ON COLUMN atlas.radio_and_news.call_sign IS 'FCC call sign for broadcast stations (e.g., WCCO, KARE, KSTP)';
COMMENT ON COLUMN atlas.radio_and_news.frequency IS 'Broadcast frequency for radio (e.g., "830 AM", "102.1 FM")';
COMMENT ON COLUMN atlas.radio_and_news.channel_number IS 'Channel number for TV stations (e.g., "11", "5.1")';
COMMENT ON COLUMN atlas.radio_and_news.format IS 'Programming format (e.g., "News/Talk", "Country", "Classical", "Top 40")';
COMMENT ON COLUMN atlas.radio_and_news.address IS 'Street address of headquarters or studio';
COMMENT ON COLUMN atlas.radio_and_news.phone IS 'Contact phone number';
COMMENT ON COLUMN atlas.radio_and_news.website_url IS 'Official website URL';
COMMENT ON COLUMN atlas.radio_and_news.parent_company IS 'Parent company or ownership group (e.g., "iHeartMedia", "TEGNA")';
COMMENT ON COLUMN atlas.radio_and_news.network_affiliation IS 'Network affiliation for TV (e.g., "NBC", "CBS", "ABC", "FOX")';
COMMENT ON COLUMN atlas.radio_and_news.description IS 'Description of the outlet';
COMMENT ON COLUMN atlas.radio_and_news.meta_title IS 'SEO meta title';
COMMENT ON COLUMN atlas.radio_and_news.meta_description IS 'SEO meta description';
COMMENT ON COLUMN atlas.radio_and_news.wikipedia_url IS 'Wikipedia article URL';
COMMENT ON COLUMN atlas.radio_and_news.favorite IS 'Whether this is a featured/favorite outlet';
COMMENT ON COLUMN atlas.radio_and_news.view_count IS 'Number of times this outlet page has been viewed';
COMMENT ON VIEW public.radio_and_news IS 'View pointing to atlas.radio_and_news for Supabase client compatibility';

-- ============================================================================
-- STEP 11: Verification report
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM atlas.radio_and_news;
  
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '  radio_and_news table created in atlas schema';
  RAISE NOTICE '  Public view created for Supabase client compatibility';
  RAISE NOTICE '  RLS policies configured (admin-only write access)';
  RAISE NOTICE '  record_page_view function updated to support radio_and_news entity type';
  RAISE NOTICE '  Unique constraint on name+city_id to prevent duplicates within same city';
END;
$$;



