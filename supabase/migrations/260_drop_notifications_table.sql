-- Drop notifications table and all related objects
-- This removes the notifications feature entirely

-- ============================================================================
-- STEP 1: Drop trigger and function
-- ============================================================================

DROP TRIGGER IF EXISTS on_account_created_add_welcome_notification ON public.accounts;
DROP FUNCTION IF EXISTS public.add_welcome_notification();

-- ============================================================================
-- STEP 2: Drop indexes
-- ============================================================================

DROP INDEX IF EXISTS public.idx_notifications_account_id;
DROP INDEX IF EXISTS public.idx_notifications_read;
DROP INDEX IF EXISTS public.idx_notifications_created_at;
DROP INDEX IF EXISTS public.idx_notifications_account_read;
DROP INDEX IF EXISTS public.idx_notifications_profile_id;
DROP INDEX IF EXISTS public.idx_notifications_profile_read;

-- ============================================================================
-- STEP 3: Drop RLS policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can update all notifications" ON public.notifications;

-- ============================================================================
-- STEP 4: Drop table
-- ============================================================================

DROP TABLE IF EXISTS public.notifications;

