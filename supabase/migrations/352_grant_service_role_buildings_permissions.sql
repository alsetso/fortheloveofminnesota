-- Grant missing permissions to service_role for civic.buildings table
-- This fixes the "permission denied for table buildings" error

-- Grant schema usage (if not already granted)
GRANT USAGE ON SCHEMA civic TO service_role;

-- Grant all permissions to service_role on buildings table
GRANT ALL ON civic.buildings TO service_role;

