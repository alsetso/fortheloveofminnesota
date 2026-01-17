-- Test script to verify profile view count increment is working
-- Run this in your Supabase SQL editor

-- 1. Check current view_count for a test account
SELECT id, username, view_count 
FROM public.accounts 
WHERE username IS NOT NULL 
LIMIT 5;

-- 2. Test the function directly with a profile URL
-- Replace 'testusername' with an actual username from your accounts table
SELECT analytics.record_page_view(
  '/profile/testusername',
  NULL, -- visitor account_id (NULL for anonymous)
  'Test User Agent',
  NULL,
  NULL
);

-- 3. Check if view_count was incremented
SELECT id, username, view_count 
FROM public.accounts 
WHERE username = 'testusername';

-- 4. Check recent page views
SELECT page_url, account_id, viewed_at 
FROM analytics.page_views 
WHERE page_url LIKE '/profile/%' 
ORDER BY viewed_at DESC 
LIMIT 10;

-- 5. Test with a logged-in user (replace UUIDs with actual values)
-- SELECT analytics.record_page_view(
--   '/profile/testusername',
--   'visitor-account-id-here', -- visitor's account_id
--   'Test User Agent',
--   NULL,
--   NULL
-- );
