-- Add welcome notification to all existing accounts
-- This migration runs after the notifications table is created

-- ============================================================================
-- STEP 1: Insert welcome notification for all existing accounts
-- ============================================================================

INSERT INTO public.notifications (account_id, title, message, read, created_at)
SELECT 
  id as account_id,
  'Welcome!' as title,
  'Thank you for joining! We''re excited to have you here. Explore the platform and discover what we have to offer.' as message,
  false as read,
  NOW() as created_at
FROM public.accounts
WHERE id NOT IN (
  -- Skip accounts that already have a welcome notification
  SELECT DISTINCT account_id 
  FROM public.notifications 
  WHERE title = 'Welcome!'
);

-- ============================================================================
-- STEP 2: Create function to add welcome notification for new accounts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_welcome_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (account_id, title, message, read, created_at)
  VALUES (
    NEW.id,
    'Welcome!',
    'Thank you for joining! We''re excited to have you here. Explore the platform and discover what we have to offer.',
    false,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: Create trigger to add welcome notification when account is created
-- ============================================================================

CREATE TRIGGER on_account_created_add_welcome_notification
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.add_welcome_notification();

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON FUNCTION public.add_welcome_notification IS 'Creates a welcome notification for newly created accounts';
COMMENT ON TABLE public.notifications IS 'Notifications table linked to accounts - includes welcome notifications for existing and new accounts';

