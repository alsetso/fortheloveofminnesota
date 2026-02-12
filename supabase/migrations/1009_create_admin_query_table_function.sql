-- Create admin function to query any table in any schema
-- Admin-only function for admin database viewer

CREATE OR REPLACE FUNCTION admin.query_table(
  p_schema_name TEXT,
  p_table_name TEXT,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  data JSONB,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sql TEXT;
  v_count_sql TEXT;
  v_result JSONB;
  v_total BIGINT;
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Validate schema and table names (prevent SQL injection)
  IF NOT (p_schema_name ~ '^[a-zA-Z_][a-zA-Z0-9_]*$' AND p_table_name ~ '^[a-zA-Z_][a-zA-Z0-9_]*$') THEN
    RAISE EXCEPTION 'Invalid schema or table name';
  END IF;

  -- Build count query
  v_count_sql := format('SELECT COUNT(*) FROM %I.%I', p_schema_name, p_table_name);
  EXECUTE v_count_sql INTO v_total;

  -- Build data query
  v_sql := format(
    'SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM %I.%I LIMIT %s OFFSET %s) t',
    p_schema_name,
    p_table_name,
    p_limit,
    p_offset
  );
  
  EXECUTE v_sql INTO v_result;

  -- Return result
  RETURN QUERY SELECT COALESCE(v_result, '[]'::jsonb), v_total;
END;
$$;

-- Grant execute to authenticated users (RLS will check admin status)
GRANT EXECUTE ON FUNCTION admin.query_table(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

-- Create public wrapper for easier RPC access
CREATE OR REPLACE FUNCTION public.query_table(
  p_schema_name TEXT,
  p_table_name TEXT,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  data JSONB,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Call the admin schema function
  RETURN QUERY SELECT * FROM admin.query_table(p_schema_name, p_table_name, p_limit, p_offset);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.query_table(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.query_table(TEXT, TEXT, INTEGER, INTEGER) IS 
  'Public wrapper for admin.query_table(). Queries any table in any schema. Admin only.';
