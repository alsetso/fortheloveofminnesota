-- Create storage bucket for government people photos
-- This bucket stores headshot photos for people in the civic schema
-- Path structure: {person_id}/{filename}
--
-- NOTE: Storage policies must be created separately using migration 305a
-- or through the Supabase Dashboard. Run this migration first, then run
-- 305a_create_gov_people_storage_policies.sql with service role permissions.

-- ============================================================================
-- STEP 1: Create gov-people-storage bucket
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gov-people-storage',
  'gov-people-storage',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

