-- Enterprise Analytics Backend: Visitor Sessions Tracking
-- Migration 208: Visitor sessions table for anonymous visitor tracking

-- ============================================================================
-- STEP 1: Visitor Sessions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.visitor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  session_id UUID NOT NULL, -- Client-generated session ID from sessionStorage
  ip_address INET,
  user_agent TEXT,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_views INTEGER DEFAULT 0,
  unique_pages INTEGER DEFAULT 0,
  fingerprint_hash TEXT, -- For browser fingerprinting (future enhancement)
  
  -- Ensure unique session_id
  CONSTRAINT visitor_sessions_session_id_unique UNIQUE(session_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_account 
  ON public.visitor_sessions(account_id)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_session 
  ON public.visitor_sessions(session_id);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_last_seen 
  ON public.visitor_sessions(last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_first_seen 
  ON public.visitor_sessions(first_seen_at DESC);

-- ============================================================================
-- STEP 2: Function to Update Visitor Session
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_visitor_session(
  p_session_id UUID,
  p_account_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_session_uuid UUID;
  v_unique_pages INTEGER;
BEGIN
  -- Get or create visitor session
  INSERT INTO public.visitor_sessions (
    session_id,
    account_id,
    ip_address,
    user_agent,
    first_seen_at,
    last_seen_at,
    total_views
  )
  VALUES (
    p_session_id,
    p_account_id,
    p_ip_address,
    p_user_agent,
    NOW(),
    NOW(),
    1
  )
  ON CONFLICT (session_id) 
  DO UPDATE SET
    account_id = COALESCE(EXCLUDED.account_id, visitor_sessions.account_id),
    last_seen_at = NOW(),
    total_views = visitor_sessions.total_views + 1,
    ip_address = COALESCE(EXCLUDED.ip_address, visitor_sessions.ip_address),
    user_agent = COALESCE(EXCLUDED.user_agent, visitor_sessions.user_agent)
  RETURNING id INTO v_session_uuid;
  
  -- Update unique_pages count
  SELECT COUNT(DISTINCT entity_id) INTO v_unique_pages
  FROM public.page_views
  WHERE session_id = p_session_id
    AND entity_id IS NOT NULL;
  
  UPDATE public.visitor_sessions
  SET unique_pages = v_unique_pages
  WHERE id = v_session_uuid;
  
  RETURN v_session_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_visitor_session IS 
  'Updates or creates a visitor session record. Links anonymous sessions to accounts when users sign in.';

-- ============================================================================
-- STEP 3: RLS Policies for visitor_sessions
-- ============================================================================

-- Enable RLS
ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own sessions
CREATE POLICY "visitor_sessions_select_own" ON public.visitor_sessions
  FOR SELECT
  USING (
    account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
  );

-- ============================================================================
-- STEP 4: Trigger to Auto-Update Visitor Sessions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_update_visitor_session()
RETURNS TRIGGER AS $$
BEGIN
  -- Update visitor session when page view is recorded
  IF NEW.session_id IS NOT NULL THEN
    PERFORM public.update_visitor_session(
      NEW.session_id,
      NEW.account_id,
      NEW.ip_address,
      NEW.user_agent
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS page_views_update_visitor_session ON public.page_views;

CREATE TRIGGER page_views_update_visitor_session
  AFTER INSERT ON public.page_views
  FOR EACH ROW
  WHEN (NEW.session_id IS NOT NULL)
  EXECUTE FUNCTION public.trigger_update_visitor_session();

COMMENT ON TRIGGER page_views_update_visitor_session ON public.page_views IS 
  'Automatically updates visitor_sessions when a page view with session_id is recorded.';



