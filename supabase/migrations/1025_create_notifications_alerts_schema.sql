-- Create notifications.alerts schema and table
-- Event-driven, flexible notification system supporting any event type with dynamic metadata
-- Designed for scalability, real-time updates, and extensibility

-- ============================================================================
-- STEP 1: Create notifications schema
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS notifications;

-- ============================================================================
-- STEP 2: Create event type enum
-- ============================================================================

CREATE TYPE notifications.event_type AS ENUM (
  'follow',
  'unfollow',
  'friend_request',
  'friend_accepted',
  'mention',
  'comment',
  'like',
  'map_invite',
  'map_member_added',
  'pin_created',
  'post_created',
  'message',
  'system',
  'custom'
);

-- ============================================================================
-- STEP 3: Create priority enum
-- ============================================================================

CREATE TYPE notifications.priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

-- ============================================================================
-- STEP 4: Create channel enum
-- ============================================================================

CREATE TYPE notifications.channel AS ENUM (
  'in_app',
  'email',
  'push',
  'sms'
);

-- ============================================================================
-- STEP 5: Create alerts table
-- ============================================================================

CREATE TABLE notifications.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Recipient
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Event identification
  event_type notifications.event_type NOT NULL,
  dedupe_key TEXT, -- Prevents duplicate notifications (e.g., "follow:account1:account2")
  
  -- Content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT, -- Optional image/avatar URL
  
  -- Action (for actionable notifications)
  action_url TEXT, -- Deep link URL (e.g., "/profile/username")
  action_label TEXT, -- CTA button text (e.g., "View Profile")
  
  -- Metadata (flexible JSONB for any event-specific data)
  metadata JSONB DEFAULT '{}'::jsonb,
  -- Example metadata:
  -- {
  --   "actor_account_id": "uuid",
  --   "actor_username": "username",
  --   "target_id": "uuid",
  --   "target_type": "post|mention|map|account",
  --   "count": 5,
  --   "custom_field": "value"
  -- }
  
  -- Channels (array of channels this notification should be sent to)
  channels notifications.channel[] DEFAULT ARRAY['in_app']::notifications.channel[],
  
  -- Status
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMP WITH TIME ZONE,
  
  -- Priority
  priority notifications.priority NOT NULL DEFAULT 'normal',
  
  -- Expiration (optional - for time-sensitive notifications)
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Grouping (for batching similar notifications)
  group_key TEXT, -- Groups notifications together (e.g., "follows:account_id")
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- STEP 6: Create indexes for efficient querying
-- ============================================================================

-- Primary query: Get unread notifications for account, ordered by priority and time
CREATE INDEX idx_alerts_account_unread ON notifications.alerts(account_id, read, priority DESC, created_at DESC)
  WHERE read = false AND archived = false;

-- Get all notifications for account (read/unread)
CREATE INDEX idx_alerts_account_created ON notifications.alerts(account_id, created_at DESC)
  WHERE archived = false;

-- Event type queries
CREATE INDEX idx_alerts_event_type ON notifications.alerts(event_type, created_at DESC);

-- Deduplication check
CREATE INDEX idx_alerts_dedupe_key ON notifications.alerts(dedupe_key, created_at DESC)
  WHERE dedupe_key IS NOT NULL;

-- Grouping queries (for batched notifications)
CREATE INDEX idx_alerts_group_key ON notifications.alerts(group_key, created_at DESC)
  WHERE group_key IS NOT NULL;

-- Expiration cleanup
CREATE INDEX idx_alerts_expires_at ON notifications.alerts(expires_at)
  WHERE expires_at IS NOT NULL;

-- Channel filtering
CREATE INDEX idx_alerts_channels ON notifications.alerts USING GIN(channels);

-- Metadata queries (for actor_account_id, target_id, etc.)
CREATE INDEX idx_alerts_metadata_actor ON notifications.alerts USING GIN(metadata jsonb_path_ops)
  WHERE metadata ? 'actor_account_id';

CREATE INDEX idx_alerts_metadata_target ON notifications.alerts USING GIN(metadata jsonb_path_ops)
  WHERE metadata ? 'target_id';

-- ============================================================================
-- STEP 7: Create updated_at trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION notifications.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER alerts_updated_at
  BEFORE UPDATE ON notifications.alerts
  FOR EACH ROW
  EXECUTE FUNCTION notifications.update_updated_at();

-- ============================================================================
-- STEP 8: Enable Row Level Security
-- ============================================================================

ALTER TABLE notifications.alerts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 9: Create RLS policies
-- ============================================================================

-- Users can view their own notifications
CREATE POLICY "Users can view own alerts"
  ON notifications.alerts
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
  );

-- Users can update their own notifications (mark as read, archive)
CREATE POLICY "Users can update own alerts"
  ON notifications.alerts
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
  );

-- Users can delete their own notifications
CREATE POLICY "Users can delete own alerts"
  ON notifications.alerts
  FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
  );

-- System/service role can insert notifications for any account
-- (No INSERT policy for authenticated users - only service role can create)

-- Admins can view all notifications
CREATE POLICY "Admins can view all alerts"
  ON notifications.alerts
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can update all notifications
CREATE POLICY "Admins can update all alerts"
  ON notifications.alerts
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete all notifications
CREATE POLICY "Admins can delete all alerts"
  ON notifications.alerts
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 10: Grant permissions
-- ============================================================================

GRANT USAGE ON SCHEMA notifications TO authenticated, anon;
GRANT SELECT, UPDATE, DELETE ON notifications.alerts TO authenticated;
GRANT SELECT ON notifications.alerts TO anon; -- For public notification counts

-- Grant execute on trigger function
GRANT EXECUTE ON FUNCTION notifications.update_updated_at() TO authenticated, anon;

-- ============================================================================
-- STEP 11: Create helper function to create notification
-- ============================================================================

CREATE OR REPLACE FUNCTION notifications.create_alert(
  p_account_id UUID,
  p_event_type notifications.event_type,
  p_title TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_action_url TEXT DEFAULT NULL,
  p_action_label TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_priority notifications.priority DEFAULT 'normal',
  p_channels notifications.channel[] DEFAULT ARRAY['in_app']::notifications.channel[],
  p_dedupe_key TEXT DEFAULT NULL,
  p_group_key TEXT DEFAULT NULL,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS notifications.alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = notifications, public
AS $$
DECLARE
  v_alert notifications.alerts;
  v_dedupe_key TEXT;
BEGIN
  -- Generate dedupe_key if not provided
  IF p_dedupe_key IS NULL THEN
    v_dedupe_key := p_event_type::TEXT || ':' || p_account_id::TEXT || ':' || COALESCE((p_metadata->>'actor_account_id'), 'system');
  ELSE
    v_dedupe_key := p_dedupe_key;
  END IF;

  -- Check for duplicate within last 24 hours (if dedupe_key provided)
  IF v_dedupe_key IS NOT NULL THEN
    SELECT * INTO v_alert
    FROM notifications.alerts
    WHERE dedupe_key = v_dedupe_key
      AND created_at > NOW() - INTERVAL '24 hours'
      AND archived = false
    LIMIT 1;

    -- If duplicate found, return existing notification
    IF v_alert IS NOT NULL THEN
      RETURN v_alert;
    END IF;
  END IF;

  -- Create new notification
  INSERT INTO notifications.alerts (
    account_id,
    event_type,
    title,
    message,
    metadata,
    action_url,
    action_label,
    image_url,
    priority,
    channels,
    dedupe_key,
    group_key,
    expires_at
  )
  VALUES (
    p_account_id,
    p_event_type,
    p_title,
    p_message,
    p_metadata,
    p_action_url,
    p_action_label,
    p_image_url,
    p_priority,
    p_channels,
    v_dedupe_key,
    p_group_key,
    p_expires_at
  )
  RETURNING * INTO v_alert;

  RETURN v_alert;
END;
$$;

-- Grant execute to authenticated users (they can create notifications for themselves via API)
-- Service role will use this directly
GRANT EXECUTE ON FUNCTION notifications.create_alert(
  UUID, notifications.event_type, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, 
  notifications.priority, notifications.channel[], TEXT, TEXT, TIMESTAMP WITH TIME ZONE
) TO authenticated, service_role;

-- ============================================================================
-- STEP 12: Create trigger for follow events
-- ============================================================================

CREATE OR REPLACE FUNCTION notifications.handle_follow_event()
RETURNS TRIGGER AS $$
DECLARE
  v_from_account_username TEXT;
  v_to_account_username TEXT;
BEGIN
  -- Only create notification for accepted follow relationships
  IF NEW.relationship = 'follow' AND NEW.status = 'accepted' THEN
    -- Get usernames for notification
    SELECT username INTO v_from_account_username
    FROM public.accounts
    WHERE id = NEW.from_account_id;

    SELECT username INTO v_to_account_username
    FROM public.accounts
    WHERE id = NEW.to_account_id;

    -- Create notification for the person being followed
    PERFORM notifications.create_alert(
      p_account_id := NEW.to_account_id,
      p_event_type := 'follow',
      p_title := 'New Follower',
      p_message := COALESCE(v_from_account_username, 'Someone') || ' started following you',
      p_metadata := jsonb_build_object(
        'actor_account_id', NEW.from_account_id,
        'actor_username', v_from_account_username,
        'edge_id', NEW.id
      ),
      p_action_url := '/people/' || NEW.from_account_id::TEXT,
      p_action_label := 'View Profile',
      p_priority := 'normal',
      p_channels := ARRAY['in_app']::notifications.channel[],
      p_dedupe_key := 'follow:' || NEW.to_account_id::TEXT || ':' || NEW.from_account_id::TEXT,
      p_group_key := 'follows:' || NEW.to_account_id::TEXT
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on social_graph.edges
CREATE TRIGGER on_follow_create_notification
  AFTER INSERT ON social_graph.edges
  FOR EACH ROW
  WHEN (NEW.relationship = 'follow' AND NEW.status = 'accepted')
  EXECUTE FUNCTION notifications.handle_follow_event();

-- ============================================================================
-- STEP 13: Add comments
-- ============================================================================

COMMENT ON SCHEMA notifications IS 'Notifications schema for event-driven alert system';
COMMENT ON TABLE notifications.alerts IS 'Flexible notification alerts table supporting any event type with dynamic metadata';
COMMENT ON COLUMN notifications.alerts.id IS 'Unique alert ID (UUID)';
COMMENT ON COLUMN notifications.alerts.account_id IS 'Recipient account ID';
COMMENT ON COLUMN notifications.alerts.event_type IS 'Type of event that triggered this notification';
COMMENT ON COLUMN notifications.alerts.dedupe_key IS 'Optional deduplication key to prevent duplicate notifications within time window';
COMMENT ON COLUMN notifications.alerts.title IS 'Notification title';
COMMENT ON COLUMN notifications.alerts.message IS 'Notification message content';
COMMENT ON COLUMN notifications.alerts.image_url IS 'Optional image/avatar URL for the notification';
COMMENT ON COLUMN notifications.alerts.action_url IS 'Optional deep link URL for actionable notifications';
COMMENT ON COLUMN notifications.alerts.action_label IS 'Optional CTA button label';
COMMENT ON COLUMN notifications.alerts.metadata IS 'Flexible JSONB metadata for event-specific data (actor_account_id, target_id, etc.)';
COMMENT ON COLUMN notifications.alerts.channels IS 'Array of channels to send notification (in_app, email, push, sms)';
COMMENT ON COLUMN notifications.alerts.read IS 'Whether notification has been read';
COMMENT ON COLUMN notifications.alerts.read_at IS 'When notification was read';
COMMENT ON COLUMN notifications.alerts.archived IS 'Whether notification has been archived';
COMMENT ON COLUMN notifications.alerts.archived_at IS 'When notification was archived';
COMMENT ON COLUMN notifications.alerts.priority IS 'Notification priority level';
COMMENT ON COLUMN notifications.alerts.expires_at IS 'Optional expiration timestamp for time-sensitive notifications';
COMMENT ON COLUMN notifications.alerts.group_key IS 'Optional grouping key for batching similar notifications';
COMMENT ON FUNCTION notifications.create_alert IS 'Helper function to create notifications with deduplication logic';
COMMENT ON FUNCTION notifications.handle_follow_event IS 'Trigger function to create notifications when follow relationships are created';
