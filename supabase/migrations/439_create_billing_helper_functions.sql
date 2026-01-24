-- Create helper functions for billing schema writes
-- These functions allow the API to write to billing schema tables securely
-- while respecting RLS policies

-- ============================================================================
-- Function to insert a plan
-- ============================================================================

CREATE OR REPLACE FUNCTION public.insert_billing_plan(
  p_slug TEXT,
  p_name TEXT,
  p_price_monthly_cents INTEGER,
  p_display_order INTEGER,
  p_price_yearly_cents INTEGER DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_stripe_price_id_monthly TEXT DEFAULT NULL,
  p_stripe_price_id_yearly TEXT DEFAULT NULL
)
RETURNS billing.plans
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan billing.plans;
BEGIN
  -- Check admin access via RLS
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  INSERT INTO billing.plans (
    slug, name, price_monthly_cents, price_yearly_cents,
    display_order, description, stripe_price_id_monthly, stripe_price_id_yearly
  )
  VALUES (
    p_slug, p_name, p_price_monthly_cents, p_price_yearly_cents,
    p_display_order, p_description, p_stripe_price_id_monthly, p_stripe_price_id_yearly
  )
  RETURNING * INTO v_plan;
  
  RETURN v_plan;
END;
$$;

-- ============================================================================
-- Function to update a plan
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_billing_plan(
  p_id UUID,
  p_slug TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_price_monthly_cents INTEGER DEFAULT NULL,
  p_display_order INTEGER DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL,
  p_price_yearly_cents INTEGER DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_stripe_price_id_monthly TEXT DEFAULT NULL,
  p_stripe_price_id_yearly TEXT DEFAULT NULL
)
RETURNS billing.plans
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan billing.plans;
BEGIN
  -- Check admin access via RLS
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  UPDATE billing.plans
  SET
    slug = COALESCE(p_slug, slug),
    name = COALESCE(p_name, name),
    price_monthly_cents = COALESCE(p_price_monthly_cents, price_monthly_cents),
    price_yearly_cents = COALESCE(p_price_yearly_cents, price_yearly_cents),
    display_order = COALESCE(p_display_order, display_order),
    is_active = COALESCE(p_is_active, is_active),
    description = COALESCE(p_description, description),
    stripe_price_id_monthly = COALESCE(p_stripe_price_id_monthly, stripe_price_id_monthly),
    stripe_price_id_yearly = COALESCE(p_stripe_price_id_yearly, stripe_price_id_yearly),
    updated_at = NOW()
  WHERE id = p_id
  RETURNING * INTO v_plan;
  
  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;
  
  RETURN v_plan;
END;
$$;

-- ============================================================================
-- Function to insert a feature
-- ============================================================================

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

-- ============================================================================
-- Function to update a feature
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_billing_feature(
  p_id UUID,
  p_slug TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
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

-- ============================================================================
-- Function to assign features to a plan
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_billing_plan_features(
  p_plan_id UUID,
  p_feature_ids UUID[]
)
RETURNS TABLE(plan_id UUID, feature_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check admin access via RLS
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  -- Insert plan-feature relationships
  INSERT INTO billing.plan_features (plan_id, feature_id)
  SELECT p_plan_id, unnest(p_feature_ids)
  ON CONFLICT (billing.plan_features.plan_id, billing.plan_features.feature_id) DO NOTHING;
  
  RETURN QUERY
  SELECT billing.plan_features.plan_id, billing.plan_features.feature_id
  FROM billing.plan_features
  WHERE billing.plan_features.plan_id = p_plan_id
    AND billing.plan_features.feature_id = ANY(p_feature_ids);
END;
$$;

-- ============================================================================
-- Function to remove a feature from a plan
-- ============================================================================

CREATE OR REPLACE FUNCTION public.remove_billing_plan_feature(
  p_plan_id UUID,
  p_feature_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check admin access via RLS
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  DELETE FROM billing.plan_features
  WHERE plan_id = p_plan_id AND feature_id = p_feature_id;
  
  RETURN FOUND;
END;
$$;

-- ============================================================================
-- Read functions (query billing schema directly)
-- ============================================================================

-- Function to get all plans
CREATE OR REPLACE FUNCTION public.get_billing_plans()
RETURNS TABLE(
  id UUID,
  slug TEXT,
  name TEXT,
  price_monthly_cents INTEGER,
  price_yearly_cents INTEGER,
  display_order INTEGER,
  is_active BOOLEAN,
  description TEXT,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.slug,
    p.name,
    p.price_monthly_cents,
    p.price_yearly_cents,
    p.display_order,
    p.is_active,
    p.description,
    p.stripe_price_id_monthly,
    p.stripe_price_id_yearly,
    p.created_at,
    p.updated_at
  FROM billing.plans p
  ORDER BY p.display_order ASC;
END;
$$;

-- Function to get all features
CREATE OR REPLACE FUNCTION public.get_billing_features()
RETURNS TABLE(
  id UUID,
  slug TEXT,
  name TEXT,
  description TEXT,
  category TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.slug,
    f.name,
    f.description,
    f.category,
    f.is_active,
    f.created_at,
    f.updated_at
  FROM billing.features f
  ORDER BY f.category ASC, f.name ASC;
END;
$$;

-- ============================================================================
-- Grant execute permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.insert_billing_plan TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_billing_plan TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_billing_feature TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_billing_feature TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_billing_plan_features TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_billing_plan_feature TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_billing_plans TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_billing_features TO authenticated, anon;