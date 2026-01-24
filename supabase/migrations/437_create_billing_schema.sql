-- Create billing schema for flexible plan and feature management
-- This replaces hardcoded plan checks with a database-driven system

-- ============================================================================
-- STEP 1: Create billing schema
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS billing;

-- ============================================================================
-- STEP 2: Create plans table
-- ============================================================================

CREATE TABLE billing.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price_monthly_cents INTEGER NOT NULL,
  price_yearly_cents INTEGER,
  display_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_billing_plans_slug ON billing.plans(slug);
CREATE INDEX idx_billing_plans_display_order ON billing.plans(display_order);
CREATE INDEX idx_billing_plans_is_active ON billing.plans(is_active) WHERE is_active = true;

-- ============================================================================
-- STEP 3: Create features table
-- ============================================================================

CREATE TABLE billing.features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_billing_features_slug ON billing.features(slug);
CREATE INDEX idx_billing_features_category ON billing.features(category);
CREATE INDEX idx_billing_features_is_active ON billing.features(is_active) WHERE is_active = true;

-- ============================================================================
-- STEP 4: Create plan_features junction table
-- ============================================================================

CREATE TABLE billing.plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES billing.plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES billing.features(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, feature_id)
);

CREATE INDEX idx_billing_plan_features_plan_id ON billing.plan_features(plan_id);
CREATE INDEX idx_billing_plan_features_feature_id ON billing.plan_features(feature_id);

-- ============================================================================
-- STEP 5: Create updated_at triggers
-- ============================================================================

CREATE TRIGGER update_billing_plans_updated_at
  BEFORE UPDATE ON billing.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_billing_features_updated_at
  BEFORE UPDATE ON billing.features
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 6: Seed initial plans
-- ============================================================================

INSERT INTO billing.plans (slug, name, price_monthly_cents, display_order, description) VALUES
  ('hobby', 'Hobby', 0, 1, 'Free basic access with limited features'),
  ('contributor', 'Contributor', 2000, 2, 'Paid subscription with access to all-time historical data and advanced features'),
  ('professional', 'Professional', 6000, 3, 'Premium subscription with additional capabilities'),
  ('business', 'Business', 20000, 4, 'Enterprise features for businesses')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 7: Seed initial features
-- ============================================================================

INSERT INTO billing.features (slug, name, description, category) VALUES
  ('unlimited_maps', 'Unlimited Custom Maps', 'Create unlimited custom maps', 'maps'),
  ('visitor_analytics', 'Visitor Analytics', 'See who visited your profile and detailed analytics', 'analytics'),
  ('visitor_identities', 'Visitor Identities', 'See names and details of profile visitors', 'analytics'),
  ('time_series_charts', 'Time-Series Charts', 'View analytics data in chart format', 'analytics'),
  ('export_data', 'Export Data', 'Export analytics data to CSV/PDF', 'analytics'),
  ('geographic_data', 'Geographic Data', 'View geographic analytics data', 'analytics'),
  ('referrer_tracking', 'Referrer Tracking', 'Track where your traffic comes from', 'analytics'),
  ('real_time_updates', 'Real-Time Updates', 'Get real-time analytics updates', 'analytics'),
  ('all_time_historical_data', 'All-Time Historical Data', 'Access to all historical data', 'analytics'),
  ('extended_text', 'Extended Text', 'Extended text length for mentions (1,000 chars)', 'content'),
  ('video_uploads', 'Video Uploads', 'Upload videos to mentions', 'content'),
  ('unlimited_collections', 'Unlimited Collections', 'Create unlimited collections', 'content'),
  ('gold_profile_border', 'Gold Profile Border', 'Premium gold border on profile', 'profile'),
  ('advanced_profile_features', 'Advanced Profile Features', 'Access to advanced profile customization', 'profile')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 8: Assign features to plans
-- ============================================================================

-- Contributor plan features
INSERT INTO billing.plan_features (plan_id, feature_id)
SELECT p.id, f.id
FROM billing.plans p
CROSS JOIN billing.features f
WHERE p.slug = 'contributor'
  AND f.slug IN (
    'unlimited_maps',
    'visitor_analytics',
    'all_time_historical_data',
    'extended_text',
    'video_uploads',
    'unlimited_collections',
    'gold_profile_border'
  )
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- Professional plan features (includes all contributor features + additional)
INSERT INTO billing.plan_features (plan_id, feature_id)
SELECT p.id, f.id
FROM billing.plans p
CROSS JOIN billing.features f
WHERE p.slug = 'professional'
  AND f.slug IN (
    'unlimited_maps',
    'visitor_analytics',
    'visitor_identities',
    'time_series_charts',
    'export_data',
    'geographic_data',
    'referrer_tracking',
    'real_time_updates',
    'all_time_historical_data',
    'extended_text',
    'video_uploads',
    'unlimited_collections',
    'gold_profile_border',
    'advanced_profile_features'
  )
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- Business plan features (includes all professional features)
INSERT INTO billing.plan_features (plan_id, feature_id)
SELECT p.id, f.id
FROM billing.plans p
CROSS JOIN billing.features f
WHERE p.slug = 'business'
  AND f.slug IN (
    'unlimited_maps',
    'visitor_analytics',
    'visitor_identities',
    'time_series_charts',
    'export_data',
    'geographic_data',
    'referrer_tracking',
    'real_time_updates',
    'all_time_historical_data',
    'extended_text',
    'video_uploads',
    'unlimited_collections',
    'gold_profile_border',
    'advanced_profile_features'
  )
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- ============================================================================
-- STEP 9: Create helper functions
-- ============================================================================

-- Function to get all features for a plan (including inherited from lower tiers)
CREATE OR REPLACE FUNCTION billing.get_plan_features(plan_slug TEXT)
RETURNS TABLE(feature_slug TEXT, feature_name TEXT) AS $$
  WITH RECURSIVE plan_hierarchy AS (
    -- Base: Get the plan
    SELECT p.id, p.slug, p.display_order
    FROM billing.plans p
    WHERE p.slug = plan_slug AND p.is_active = true
    
    UNION ALL
    
    -- Recursive: Get all lower-tier plans (display_order < current)
    SELECT p.id, p.slug, p.display_order
    FROM billing.plans p
    JOIN plan_hierarchy ph ON p.display_order < ph.display_order
    WHERE p.is_active = true
  )
  SELECT DISTINCT f.slug, f.name
  FROM billing.features f
  INNER JOIN billing.plan_features pf ON f.id = pf.feature_id
  INNER JOIN plan_hierarchy ph ON pf.plan_id = ph.id
  WHERE f.is_active = true
  ORDER BY f.name;
$$ LANGUAGE SQL STABLE;

-- Function to check if user has access to a feature (including inherited)
CREATE OR REPLACE FUNCTION billing.user_has_feature(user_id UUID, feature_slug TEXT)
RETURNS BOOLEAN AS $$
  WITH RECURSIVE user_plan AS (
    SELECT a.plan
    FROM accounts a
    WHERE a.user_id = user_id
      AND (a.subscription_status = 'active' OR a.subscription_status = 'trialing' OR a.stripe_subscription_id IS NOT NULL)
    LIMIT 1
  ),
  plan_hierarchy AS (
    -- Base: Get the user's plan
    SELECT p.id, p.slug, p.display_order
    FROM user_plan up
    INNER JOIN billing.plans p ON up.plan = p.slug
    WHERE p.is_active = true
    
    UNION ALL
    
    -- Recursive: Get all lower-tier plans (display_order < current)
    SELECT p.id, p.slug, p.display_order
    FROM billing.plans p
    JOIN plan_hierarchy ph ON p.display_order < ph.display_order
    WHERE p.is_active = true
  )
  SELECT EXISTS (
    SELECT 1
    FROM billing.features f
    INNER JOIN billing.plan_features pf ON f.id = pf.feature_id
    INNER JOIN plan_hierarchy ph ON pf.plan_id = ph.id
    WHERE f.slug = feature_slug
      AND f.is_active = true
  );
$$ LANGUAGE SQL STABLE;

-- Function to get all features for a user (including inherited)
CREATE OR REPLACE FUNCTION billing.get_user_features(user_id UUID)
RETURNS TABLE(feature_slug TEXT, feature_name TEXT) AS $$
  WITH RECURSIVE user_plan AS (
    SELECT a.plan
    FROM accounts a
    WHERE a.user_id = user_id
      AND (a.subscription_status = 'active' OR a.subscription_status = 'trialing' OR a.stripe_subscription_id IS NOT NULL)
    LIMIT 1
  ),
  plan_hierarchy AS (
    -- Base: Get the user's plan
    SELECT p.id, p.slug, p.display_order
    FROM user_plan up
    INNER JOIN billing.plans p ON up.plan = p.slug
    WHERE p.is_active = true
    
    UNION ALL
    
    -- Recursive: Get all lower-tier plans (display_order < current)
    SELECT p.id, p.slug, p.display_order
    FROM billing.plans p
    JOIN plan_hierarchy ph ON p.display_order < ph.display_order
    WHERE p.is_active = true
  )
  SELECT DISTINCT f.slug, f.name
  FROM billing.features f
  INNER JOIN billing.plan_features pf ON f.id = pf.feature_id
  INNER JOIN plan_hierarchy ph ON pf.plan_id = ph.id
  WHERE f.is_active = true
  ORDER BY f.name;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- STEP 10: Enable RLS and create policies
-- ============================================================================

ALTER TABLE billing.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.plan_features ENABLE ROW LEVEL SECURITY;

-- Plans: Public read, admin write
CREATE POLICY "Plans are viewable by everyone" 
  ON billing.plans FOR SELECT 
  USING (true);

CREATE POLICY "Plans are editable by admins" 
  ON billing.plans FOR ALL 
  USING (
    EXISTS (SELECT 1 FROM accounts WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Features: Public read, admin write
CREATE POLICY "Features are viewable by everyone" 
  ON billing.features FOR SELECT 
  USING (true);

CREATE POLICY "Features are editable by admins" 
  ON billing.features FOR ALL 
  USING (
    EXISTS (SELECT 1 FROM accounts WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Plan features: Public read, admin write
CREATE POLICY "Plan features are viewable by everyone" 
  ON billing.plan_features FOR SELECT 
  USING (true);

CREATE POLICY "Plan features are editable by admins" 
  ON billing.plan_features FOR ALL 
  USING (
    EXISTS (SELECT 1 FROM accounts WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- STEP 11: Create public views for Supabase client compatibility
-- ============================================================================

-- Supabase PostgREST only exposes the public schema by default
-- Create views in public schema that point to billing schema tables
-- This allows client code to work without schema prefix

CREATE OR REPLACE VIEW public.billing_plans AS
SELECT * FROM billing.plans;

CREATE OR REPLACE VIEW public.billing_features AS
SELECT * FROM billing.features;

CREATE OR REPLACE VIEW public.billing_plan_features AS
SELECT * FROM billing.plan_features;

-- Grant permissions on views
GRANT SELECT ON public.billing_plans TO authenticated, anon;
GRANT SELECT ON public.billing_features TO authenticated, anon;
GRANT SELECT ON public.billing_plan_features TO authenticated, anon;

-- For write operations, we need to use the billing schema directly or create functions
-- RLS policies on billing schema tables will handle write permissions

-- ============================================================================
-- STEP 12: Force PostgREST schema cache refresh
-- ============================================================================

-- Force PostgREST to reload schema cache after creating views
-- This fixes "Could not find the table in the schema cache" errors
-- In Supabase cloud, PostgREST will auto-refresh within a few minutes
-- In local dev, you may need to restart the Supabase stack
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- STEP 13: Add comments
-- ============================================================================

COMMENT ON SCHEMA billing IS 'Billing schema for managing subscription plans and features';
COMMENT ON TABLE billing.plans IS 'Subscription plans with pricing and metadata';
COMMENT ON TABLE billing.features IS 'Available features that can be assigned to plans';
COMMENT ON TABLE billing.plan_features IS 'Many-to-many relationship between plans and features';
COMMENT ON FUNCTION billing.get_plan_features IS 'Returns all features for a plan including inherited features from lower tiers';
COMMENT ON FUNCTION billing.user_has_feature IS 'Checks if a user has access to a specific feature based on their plan';
COMMENT ON FUNCTION billing.get_user_features IS 'Returns all features available to a user based on their plan';
COMMENT ON VIEW public.billing_plans IS 'Public view of billing.plans for Supabase client access';
COMMENT ON VIEW public.billing_features IS 'Public view of billing.features for Supabase client access';
COMMENT ON VIEW public.billing_plan_features IS 'Public view of billing.plan_features for Supabase client access';
