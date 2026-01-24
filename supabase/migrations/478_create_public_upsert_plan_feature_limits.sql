-- Create public wrapper function for upserting plan feature limits
-- PostgREST only exposes public schema by default

DROP FUNCTION IF EXISTS public.upsert_plan_feature_limits(UUID, UUID, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.upsert_plan_feature_limits(
  p_plan_id UUID,
  p_feature_id UUID,
  p_limit_value INTEGER,
  p_limit_type TEXT
)
RETURNS json AS $$
DECLARE
  result_row RECORD;
BEGIN
  -- Admin check: Verify the caller has admin role
  IF NOT EXISTS (
    SELECT 1 FROM accounts 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Upsert: Insert or update if exists
  INSERT INTO billing.plan_features (plan_id, feature_id, limit_value, limit_type)
  VALUES (p_plan_id, p_feature_id, p_limit_value, p_limit_type)
  ON CONFLICT (plan_id, feature_id) 
  DO UPDATE SET
    limit_value = EXCLUDED.limit_value,
    limit_type = EXCLUDED.limit_type
  RETURNING * INTO result_row;
  
  -- Return as JSON
  RETURN row_to_json(result_row);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.upsert_plan_feature_limits IS 'Upserts limit values for a plan-feature relationship (admin only via RPC)';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.upsert_plan_feature_limits TO authenticated, anon;
