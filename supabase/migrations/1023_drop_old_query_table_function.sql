-- Drop the old 4-parameter query_table function to resolve overload conflict
-- The enhanced 8-parameter version has defaults for all optional params
-- This prevents PostgreSQL from being unable to choose between overloaded functions

DROP FUNCTION IF EXISTS public.query_table(TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS admin.query_table(TEXT, TEXT, INTEGER, INTEGER);

COMMENT ON FUNCTION public.query_table(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, JSONB) IS 
  'Query any table in any schema. Admin only. Enhanced version with filtering, sorting, and search. Use this version with all parameters (NULL for optional ones).';
