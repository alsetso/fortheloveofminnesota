-- Enhance admin.query_table function to support WHERE, ORDER BY, and search
-- Extends existing function with filtering, sorting, and global search capabilities

-- Drop and recreate admin.query_table with enhanced parameters
CREATE OR REPLACE FUNCTION admin.query_table(
  p_schema_name TEXT,
  p_table_name TEXT,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT NULL,
  p_order_direction TEXT DEFAULT 'ASC',
  p_search TEXT DEFAULT NULL,
  p_filters JSONB DEFAULT NULL
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
  v_where_clauses TEXT[] := ARRAY[]::TEXT[];
  v_order_clause TEXT := '';
  v_column_name TEXT;
  v_column_type TEXT;
  v_filter_value TEXT;
  v_filter_operator TEXT;
BEGIN
  -- Check if user is admin or service role
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Validate schema and table names (prevent SQL injection)
  IF NOT (p_schema_name ~ '^[a-zA-Z_][a-zA-Z0-9_]*$' AND p_table_name ~ '^[a-zA-Z_][a-zA-Z0-9_]*$') THEN
    RAISE EXCEPTION 'Invalid schema or table name';
  END IF;

  -- Validate order_direction
  IF p_order_direction IS NOT NULL AND UPPER(p_order_direction) NOT IN ('ASC', 'DESC') THEN
    RAISE EXCEPTION 'Invalid order direction. Must be ASC or DESC';
  END IF;

  -- Build WHERE clauses from filters (JSONB format: {"column": {"operator": "value"}})
  -- Example: {"name": {"=": "test"}, "age": {">": "18"}}
  IF p_filters IS NOT NULL THEN
    FOR v_column_name, v_filter_value IN SELECT * FROM jsonb_each(p_filters) LOOP
      -- Validate column name (prevent SQL injection)
      IF NOT (v_column_name ~ '^[a-zA-Z_][a-zA-Z0-9_]*$') THEN
        CONTINUE; -- Skip invalid column names
      END IF;

      -- Get filter operator and value from nested JSONB
      SELECT jsonb_object_keys(v_filter_value) INTO v_filter_operator;
      v_filter_value := v_filter_value->>v_filter_operator;

      -- Build WHERE clause based on operator
      IF v_filter_operator = '=' THEN
        v_where_clauses := array_append(v_where_clauses, format('%I = %L', v_column_name, v_filter_value));
      ELSIF v_filter_operator = '!=' OR v_filter_operator = '<>' THEN
        v_where_clauses := array_append(v_where_clauses, format('%I != %L', v_column_name, v_filter_value));
      ELSIF v_filter_operator = '>' THEN
        v_where_clauses := array_append(v_where_clauses, format('%I > %L', v_column_name, v_filter_value));
      ELSIF v_filter_operator = '>=' THEN
        v_where_clauses := array_append(v_where_clauses, format('%I >= %L', v_column_name, v_filter_value));
      ELSIF v_filter_operator = '<' THEN
        v_where_clauses := array_append(v_where_clauses, format('%I < %L', v_column_name, v_filter_value));
      ELSIF v_filter_operator = '<=' THEN
        v_where_clauses := array_append(v_where_clauses, format('%I <= %L', v_column_name, v_filter_value));
      ELSIF v_filter_operator = 'LIKE' OR v_filter_operator = 'ILIKE' THEN
        v_where_clauses := array_append(v_where_clauses, format('%I %s %L', v_column_name, v_filter_operator, '%' || replace(v_filter_value, '%', '%%') || '%'));
      ELSIF v_filter_operator = 'IS NULL' THEN
        v_where_clauses := array_append(v_where_clauses, format('%I IS NULL', v_column_name));
      ELSIF v_filter_operator = 'IS NOT NULL' THEN
        v_where_clauses := array_append(v_where_clauses, format('%I IS NOT NULL', v_column_name));
      END IF;
    END LOOP;
  END IF;

  -- Add global search (searches across all text/varchar columns)
  IF p_search IS NOT NULL AND p_search != '' THEN
    -- Get all text/varchar columns for the table
    SELECT string_agg(
      format('%I::TEXT ILIKE %L', column_name, '%' || replace(p_search, '%', '%%') || '%'),
      ' OR '
    )
    INTO v_column_name
    FROM information_schema.columns
    WHERE table_schema = p_schema_name
      AND table_name = p_table_name
      AND data_type IN ('text', 'varchar', 'character varying', 'char', 'character');

    IF v_column_name IS NOT NULL THEN
      v_where_clauses := array_append(v_where_clauses, '(' || v_column_name || ')');
    END IF;
  END IF;

  -- Build ORDER BY clause
  IF p_order_by IS NOT NULL AND p_order_by != '' THEN
    -- Validate column name (prevent SQL injection)
    IF p_order_by ~ '^[a-zA-Z_][a-zA-Z0-9_]*$' THEN
      v_order_clause := format('ORDER BY %I %s', p_order_by, COALESCE(UPPER(p_order_direction), 'ASC'));
    END IF;
  END IF;

  -- Build WHERE clause string
  DECLARE
    v_where_clause TEXT := '';
  BEGIN
    IF array_length(v_where_clauses, 1) > 0 THEN
      v_where_clause := 'WHERE ' || array_to_string(v_where_clauses, ' AND ');
    END IF;

    -- Build count query with WHERE clause
    v_count_sql := format(
      'SELECT COUNT(*) FROM %I.%I %s',
      p_schema_name,
      p_table_name,
      v_where_clause
    );
    EXECUTE v_count_sql INTO v_total;

    -- Build data query with WHERE, ORDER BY, LIMIT, OFFSET
    v_sql := format(
      'SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM %I.%I %s %s LIMIT %s OFFSET %s) t',
      p_schema_name,
      p_table_name,
      v_where_clause,
      v_order_clause,
      p_limit,
      p_offset
    );
    
    EXECUTE v_sql INTO v_result;
  END;

  -- Return result
  RETURN QUERY SELECT COALESCE(v_result, '[]'::jsonb), v_total;
END;
$$;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION admin.query_table(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;

-- Update public wrapper
CREATE OR REPLACE FUNCTION public.query_table(
  p_schema_name TEXT,
  p_table_name TEXT,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT NULL,
  p_order_direction TEXT DEFAULT 'ASC',
  p_search TEXT DEFAULT NULL,
  p_filters JSONB DEFAULT NULL
)
RETURNS TABLE (
  data JSONB,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin or service role
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Call the admin schema function
  RETURN QUERY SELECT * FROM admin.query_table(
    p_schema_name, 
    p_table_name, 
    p_limit, 
    p_offset,
    p_order_by,
    p_order_direction,
    p_search,
    p_filters
  );
END;
$$;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.query_table(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;

COMMENT ON FUNCTION public.query_table(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, JSONB) IS 
  'Enhanced admin query function with filtering, sorting, and search. Admin only.';
