-- Set RapidAPI key for auto-generate news function
-- Migration 295: Configure RapidAPI key for news generation

-- ============================================================================
-- STEP 1: Set RapidAPI key using ALTER DATABASE
-- ============================================================================

-- IMPORTANT: ALTER DATABASE commands cannot be run in migrations
-- You must run this command directly in Supabase SQL Editor (not as a migration)

-- To set the RapidAPI key:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Copy and paste this command:
--    ALTER DATABASE postgres SET app.rapidapi_key = '47b97acde8msh84e277c4f77789fp170d32jsn47676e8a63b9';
-- 3. Click "Run" to execute it

-- ============================================================================
-- STEP 2: Alternative - Set via Supabase Dashboard
-- ============================================================================

-- If ALTER DATABASE doesn't work, you can set it via Supabase Dashboard:
-- 1. Go to Supabase Dashboard > Settings > Database
-- 2. Scroll to "Custom Database Config" or "Database Settings"
-- 3. Add a new config:
--    Key: app.rapidapi_key
--    Value: your-rapidapi-key-here

-- ============================================================================
-- STEP 3: Verify the setting
-- ============================================================================

-- To check if the setting is configured:
-- SELECT current_setting('app.rapidapi_key', true);

-- Note: The 'true' parameter means it will return NULL if not set (instead of error)
-- If it returns NULL, the key is not configured

-- ============================================================================
-- STEP 4: Test the function manually
-- ============================================================================

-- After setting the key, test the function:
-- SELECT public.auto_generate_news();

-- If successful, you should see a JSONB response with 'success: true' and an 'id' field

