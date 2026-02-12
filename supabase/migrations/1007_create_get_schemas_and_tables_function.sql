-- Create function to get all schemas and their tables
-- Admin-only function for admin dashboard

CREATE OR REPLACE FUNCTION admin.get_schemas_and_tables()
RETURNS TABLE (
  schema_name text,
  table_name text,
  table_type text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  RETURN QUERY
  SELECT 
    t.table_schema::text,
    t.table_name::text,
    t.table_type::text
  FROM information_schema.tables t
  WHERE t.table_schema NOT IN (
    'pg_catalog',
    'information_schema',
    'pg_toast',
    'pg_temp_1',
    'pg_toast_temp_1',
    'pg_temp_2',
    'pg_toast_temp_2'
  )
  AND t.table_schema NOT LIKE 'pg_%'
  ORDER BY t.table_schema, t.table_name;
END;
$$;

-- Grant execute to authenticated users (RLS will check admin status)
GRANT EXECUTE ON FUNCTION admin.get_schemas_and_tables() TO authenticated;

COMMENT ON FUNCTION admin.get_schemas_and_tables() IS 
  'Returns all database schemas and their tables. Admin only.';
