-- ============================================================================
-- Migration: Add p_emoji parameter to update_billing_feature function
-- ============================================================================
-- This allows updating the emoji field when editing features

-- Drop all existing versions of the function to avoid ambiguity
DROP FUNCTION IF EXISTS public.update_billing_feature(UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_billing_feature(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.update_billing_feature(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);

-- Create the function with the complete signature including emoji
CREATE OR REPLACE FUNCTION public.update_billing_feature(
  p_id UUID,
  p_slug TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_emoji TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
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
  
  UPDATE billing.features
  SET
    slug = COALESCE(p_slug, slug),
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    category = COALESCE(p_category, category),
    emoji = COALESCE(p_emoji, emoji),
    is_active = COALESCE(p_is_active, is_active),
    updated_at = NOW()
  WHERE id = p_id
  RETURNING * INTO v_feature;
  
  IF v_feature IS NULL THEN
    RAISE EXCEPTION 'Feature not found';
  END IF;
  
  RETURN v_feature;
END;
$$;

-- Grant execute permission with explicit signature
GRANT EXECUTE ON FUNCTION public.update_billing_feature(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- Force PostgREST schema cache refresh
NOTIFY pgrst, 'reload schema';
