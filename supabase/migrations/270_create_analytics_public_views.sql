-- Create public views for analytics schema tables
-- Supabase PostgREST only exposes public schema by default
-- These views allow client code to use .from('page_views') and .from('pin_views') without changes

-- ============================================================================
-- STEP 1: Create public views pointing to analytics schema tables
-- ============================================================================

CREATE OR REPLACE VIEW public.page_views AS
SELECT * FROM analytics.page_views;

CREATE OR REPLACE VIEW public.pin_views AS
SELECT * FROM analytics.pin_views;

-- ============================================================================
-- STEP 2: Grant permissions on views
-- ============================================================================

GRANT SELECT, INSERT ON public.page_views TO anon, authenticated;
GRANT SELECT, INSERT ON public.pin_views TO anon, authenticated;

-- ============================================================================
-- STEP 3: Create INSTEAD OF triggers for INSERT operations
-- ============================================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS page_views_instead_of_insert ON public.page_views;
DROP TRIGGER IF EXISTS pin_views_instead_of_insert ON public.pin_views;

-- Insert trigger function for page_views
CREATE OR REPLACE FUNCTION public.page_views_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO analytics.page_views (
    page_url,
    account_id,
    user_agent,
    referrer_url,
    session_id,
    viewed_at
  )
  VALUES (
    NEW.page_url,
    NEW.account_id,
    NEW.user_agent,
    NEW.referrer_url,
    NEW.session_id,
    COALESCE(NEW.viewed_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Insert trigger function for pin_views
CREATE OR REPLACE FUNCTION public.pin_views_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO analytics.pin_views (
    pin_id,
    account_id,
    user_agent,
    referrer_url,
    session_id,
    viewed_at
  )
  VALUES (
    NEW.pin_id,
    NEW.account_id,
    NEW.user_agent,
    NEW.referrer_url,
    NEW.session_id,
    COALESCE(NEW.viewed_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER page_views_instead_of_insert
  INSTEAD OF INSERT ON public.page_views
  FOR EACH ROW
  EXECUTE FUNCTION public.page_views_insert_trigger();

CREATE TRIGGER pin_views_instead_of_insert
  INSTEAD OF INSERT ON public.pin_views
  FOR EACH ROW
  EXECUTE FUNCTION public.pin_views_insert_trigger();

-- ============================================================================
-- STEP 4: Create public wrapper functions for analytics schema functions
-- ============================================================================

-- PostgREST can't call functions with schema prefixes, so we create wrappers in public schema

-- Drop existing wrapper functions if they exist
DROP FUNCTION IF EXISTS public.record_page_view(TEXT, UUID, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.record_pin_view(UUID, UUID, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_page_stats(TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_pin_stats(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_page_viewers(TEXT, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_pin_viewers(UUID, INTEGER, INTEGER) CASCADE;

-- Wrapper for record_page_view
CREATE OR REPLACE FUNCTION public.record_page_view(
  p_page_url TEXT,
  p_account_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer_url TEXT DEFAULT NULL,
  p_session_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.record_page_view(
    p_page_url,
    p_account_id,
    p_user_agent,
    p_referrer_url,
    p_session_id
  );
END;
$$;

-- Wrapper for record_pin_view
CREATE OR REPLACE FUNCTION public.record_pin_view(
  p_pin_id UUID,
  p_account_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer_url TEXT DEFAULT NULL,
  p_session_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.record_pin_view(
    p_pin_id,
    p_account_id,
    p_user_agent,
    p_referrer_url,
    p_session_id
  );
END;
$$;

-- Wrapper for get_page_stats
CREATE OR REPLACE FUNCTION public.get_page_stats(
  p_page_url TEXT,
  p_hours INTEGER DEFAULT NULL
)
RETURNS TABLE (
  total_views BIGINT,
  unique_viewers BIGINT,
  accounts_viewed BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM analytics.get_page_stats(p_page_url, p_hours);
END;
$$;

-- Wrapper for get_pin_stats
CREATE OR REPLACE FUNCTION public.get_pin_stats(
  p_pin_id UUID,
  p_hours INTEGER DEFAULT NULL
)
RETURNS TABLE (
  total_views BIGINT,
  unique_viewers BIGINT,
  accounts_viewed BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM analytics.get_pin_stats(p_pin_id, p_hours);
END;
$$;

-- Wrapper for get_page_viewers
CREATE OR REPLACE FUNCTION public.get_page_viewers(
  p_page_url TEXT,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  account_id UUID,
  account_username TEXT,
  account_first_name TEXT,
  account_last_name TEXT,
  account_image_url TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE,
  view_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM analytics.get_page_viewers(p_page_url, p_limit, p_offset);
END;
$$;

-- Wrapper for get_pin_viewers
CREATE OR REPLACE FUNCTION public.get_pin_viewers(
  p_pin_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  account_id UUID,
  account_username TEXT,
  account_first_name TEXT,
  account_last_name TEXT,
  account_image_url TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE,
  view_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM analytics.get_pin_viewers(p_pin_id, p_limit, p_offset);
END;
$$;

-- Grant permissions on wrapper functions
GRANT EXECUTE ON FUNCTION public.record_page_view TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_pin_view TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_page_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pin_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_page_viewers TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pin_viewers TO authenticated;

-- ============================================================================
-- STEP 5: Add comments
-- ============================================================================

COMMENT ON VIEW public.page_views IS
  'Public view of analytics.page_views. Allows Supabase client to access analytics schema tables via public schema.';

COMMENT ON VIEW public.pin_views IS
  'Public view of analytics.pin_views. Allows Supabase client to access analytics schema tables via public schema.';

COMMENT ON FUNCTION public.record_page_view IS
  'Public wrapper for analytics.record_page_view. Records a page view for any URL.';

COMMENT ON FUNCTION public.record_pin_view IS
  'Public wrapper for analytics.record_pin_view. Records a pin view.';

COMMENT ON FUNCTION public.get_page_stats IS
  'Public wrapper for analytics.get_page_stats. Returns page statistics.';

COMMENT ON FUNCTION public.get_pin_stats IS
  'Public wrapper for analytics.get_pin_stats. Returns pin statistics.';

COMMENT ON FUNCTION public.get_page_viewers IS
  'Public wrapper for analytics.get_page_viewers. Returns list of accounts that viewed a page.';

COMMENT ON FUNCTION public.get_pin_viewers IS
  'Public wrapper for analytics.get_pin_viewers. Returns list of accounts that viewed a pin.';

