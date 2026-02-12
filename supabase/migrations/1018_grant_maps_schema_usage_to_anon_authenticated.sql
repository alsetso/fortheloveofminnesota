-- Grant USAGE on maps schema to anon and authenticated roles
-- This is required to query tables in the maps schema (maps.maps, maps.pins, etc.)
-- Without this, queries using .schema('maps') will fail with "permission denied for schema maps"

GRANT USAGE ON SCHEMA maps TO anon, authenticated;

-- Verify grants are in place (informational only, won't fail if already granted)
DO $$
BEGIN
  -- Check if grants exist
  IF EXISTS (
    SELECT 1 
    FROM information_schema.usage_privileges 
    WHERE object_schema = 'maps' 
    AND grantee = 'anon'
  ) THEN
    RAISE NOTICE 'USAGE on schema maps already granted to anon';
  END IF;
  
  IF EXISTS (
    SELECT 1 
    FROM information_schema.usage_privileges 
    WHERE object_schema = 'maps' 
    AND grantee = 'authenticated'
  ) THEN
    RAISE NOTICE 'USAGE on schema maps already granted to authenticated';
  END IF;
END $$;
