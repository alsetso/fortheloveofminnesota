-- Create RPC function to upsert plan feature limits
-- This function handles both insert and update operations

CREATE OR REPLACE FUNCTION billing.upsert_plan_feature_limits(
  p_plan_id UUID,
  p_feature_id UUID,
  p_limit_value INTEGER,
  p_limit_type TEXT
)
RETURNS TABLE(
  id UUID,
  plan_id UUID,
  feature_id UUID,
  limit_value INTEGER,
  limit_type TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Upsert: Insert or update if exists
  INSERT INTO billing.plan_features (plan_id, feature_id, limit_value, limit_type)
  VALUES (p_plan_id, p_feature_id, p_limit_value, p_limit_type)
  ON CONFLICT (plan_id, feature_id) 
  DO UPDATE SET
    limit_value = EXCLUDED.limit_value,
    limit_type = EXCLUDED.limit_type;
  
  -- Return the updated/inserted row
  RETURN QUERY
  SELECT 
    pf.id,
    pf.plan_id,
    pf.feature_id,
    pf.limit_value,
    pf.limit_type,
    pf.created_at
  FROM billing.plan_features pf
  WHERE pf.plan_id = p_plan_id AND pf.feature_id = p_feature_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION billing.upsert_plan_feature_limits IS 'Upserts limit values for a plan-feature relationship (admin only)';

-- Grant execute permission to authenticated users (RLS policies on the table will still apply)
GRANT EXECUTE ON FUNCTION billing.upsert_plan_feature_limits TO authenticated;
