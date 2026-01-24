-- Fix ambiguous column reference in assign_billing_plan_features function
-- The issue is that RETURN TABLE defines columns 'plan_id' and 'feature_id'
-- which conflicts with table column references in the SELECT statement.
-- Solution: Use table alias 'pf' in RETURN QUERY to disambiguate.

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
  -- Use constraint name in ON CONFLICT to avoid ambiguity with RETURN TABLE columns
  -- The UNIQUE constraint is auto-named by PostgreSQL as: plan_features_plan_id_feature_id_key
  INSERT INTO billing.plan_features (plan_id, feature_id)
  SELECT p_plan_id, unnest(p_feature_ids)
  ON CONFLICT ON CONSTRAINT plan_features_plan_id_feature_id_key DO NOTHING;
  
  -- Use table alias 'pf' to avoid ambiguity between RETURN TABLE columns
  -- and table columns. Without the alias, PostgreSQL can't tell if we're
  -- referring to the RETURN TABLE column 'plan_id' or the table column 'plan_id'.
  RETURN QUERY
  SELECT pf.plan_id, pf.feature_id
  FROM billing.plan_features pf
  WHERE pf.plan_id = p_plan_id
    AND pf.feature_id = ANY(p_feature_ids);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.assign_billing_plan_features TO authenticated;
