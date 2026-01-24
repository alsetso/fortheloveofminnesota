-- ============================================================================
-- Migration: Add is_active parameter to insert_billing_feature function
-- ============================================================================
-- This allows creating features with is_active = false for "coming soon" features

-- Drop all existing versions of the function to avoid ambiguity
DROP FUNCTION IF EXISTS public.insert_billing_feature(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.insert_billing_feature(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.insert_billing_feature(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);

-- Create the function with the complete signature
CREATE OR REPLACE FUNCTION public.insert_billing_feature(
  p_slug TEXT,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_emoji TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS billing.features
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_feature billing.features;
BEGIN
  -- Check admin access via RLS
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  INSERT INTO billing.features (slug, name, description, category, emoji, is_active)
  VALUES (p_slug, p_name, p_description, p_category, p_emoji, p_is_active)
  RETURNING * INTO v_feature;
  
  RETURN v_feature;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.insert_billing_feature(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
