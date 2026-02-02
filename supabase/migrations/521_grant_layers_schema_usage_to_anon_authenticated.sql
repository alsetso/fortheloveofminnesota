-- Grant USAGE on layers schema to anon and authenticated roles
-- This is required to query tables in the layers schema
-- The migration 507_move_civic_tables_to_layers_schema.sql only granted USAGE to service_role

GRANT USAGE ON SCHEMA layers TO anon, authenticated;

-- Verify grants are in place (informational only, won't fail if already granted)
DO $$
BEGIN
  -- Check if grants exist
  IF EXISTS (
    SELECT 1 
    FROM information_schema.usage_privileges 
    WHERE object_schema = 'layers' 
    AND grantee = 'anon'
  ) THEN
    RAISE NOTICE 'USAGE on schema layers already granted to anon';
  END IF;
  
  IF EXISTS (
    SELECT 1 
    FROM information_schema.usage_privileges 
    WHERE object_schema = 'layers' 
    AND grantee = 'authenticated'
  ) THEN
    RAISE NOTICE 'USAGE on schema layers already granted to authenticated';
  END IF;
END $$;
