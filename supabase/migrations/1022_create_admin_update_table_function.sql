-- Create admin function to update rows in admin schema tables
-- Admin-only function for updating system_visibility and route_visibility

CREATE OR REPLACE FUNCTION admin.update_table(
  p_schema_name TEXT,
  p_table_name TEXT,
  p_id UUID,
  p_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sql TEXT;
  v_result JSONB;
  v_key TEXT;
  v_value TEXT;
  v_set_clauses TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Validate schema and table names (prevent SQL injection)
  IF NOT (p_schema_name ~ '^[a-zA-Z_][a-zA-Z0-9_]*$' AND p_table_name ~ '^[a-zA-Z_][a-zA-Z0-9_]*$') THEN
    RAISE EXCEPTION 'Invalid schema or table name';
  END IF;

  -- Only allow updates to admin schema tables
  IF p_schema_name != 'admin' THEN
    RAISE EXCEPTION 'Only admin schema tables can be updated via this function';
  END IF;

  -- Build SET clauses from JSONB updates
  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_updates)
  LOOP
    -- Validate column name (prevent SQL injection)
    IF NOT (v_key ~ '^[a-zA-Z_][a-zA-Z0-9_]*$') THEN
      RAISE EXCEPTION 'Invalid column name: %', v_key;
    END IF;
    
    -- Add to SET clauses (properly escape values)
    v_set_clauses := array_append(
      v_set_clauses,
      format('%I = %L', v_key, v_value)
    );
  END LOOP;

  -- Add updated_at if not already in updates
  IF NOT (p_updates ? 'updated_at') THEN
    v_set_clauses := array_append(
      v_set_clauses,
      'updated_at = NOW()'
    );
  END IF;

  -- Build UPDATE query
  v_sql := format(
    'UPDATE %I.%I SET %s WHERE id = %L RETURNING row_to_json(%I.*)',
    p_schema_name,
    p_table_name,
    array_to_string(v_set_clauses, ', '),
    p_id,
    p_table_name
  );
  
  EXECUTE v_sql INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION admin.update_table(TEXT, TEXT, UUID, JSONB) TO authenticated;

-- Create public wrapper
CREATE OR REPLACE FUNCTION public.update_table(
  p_schema_name TEXT,
  p_table_name TEXT,
  p_id UUID,
  p_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Call the admin schema function
  RETURN admin.update_table(p_schema_name, p_table_name, p_id, p_updates);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.update_table(TEXT, TEXT, UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.update_table(TEXT, TEXT, UUID, JSONB) IS 
  'Public wrapper for admin.update_table(). Updates rows in admin schema tables. Admin only.';
