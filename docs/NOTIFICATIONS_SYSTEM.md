# Notifications System Architecture

## Overview

Event-driven notification system built on `notifications.alerts` schema. Supports any event type with dynamic metadata, multi-channel delivery, deduplication, grouping, and real-time updates.

## Core Principles

1. **Event-Driven**: Notifications triggered by events (follow, mention, comment, etc.)
2. **Flexible Metadata**: JSONB field stores any event-specific data
3. **Multi-Channel**: Support in-app, email, push, SMS via channels array
4. **Deduplication**: Prevents duplicate notifications within 24-hour window
5. **Grouping**: Batch similar notifications (e.g., "5 people followed you")
6. **Actionable**: Deep links with CTA buttons
7. **Priority-Based**: Low, normal, high, urgent priority levels
8. **Expiration**: Optional expiration for time-sensitive notifications

## Schema Structure

### `notifications.alerts` Table

```sql
- id: UUID (primary key)
- account_id: UUID (recipient)
- event_type: enum (follow, mention, comment, etc.)
- dedupe_key: TEXT (prevents duplicates)
- title: TEXT
- message: TEXT
- image_url: TEXT (optional)
- action_url: TEXT (deep link)
- action_label: TEXT (CTA button text)
- metadata: JSONB (flexible event data)
- channels: channel[] (in_app, email, push, sms)
- read: BOOLEAN
- read_at: TIMESTAMPTZ
- archived: BOOLEAN
- archived_at: TIMESTAMPTZ
- priority: enum (low, normal, high, urgent)
- expires_at: TIMESTAMPTZ (optional)
- group_key: TEXT (for batching)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

## Event Types

- `follow` - Someone follows you
- `unfollow` - Someone unfollows you
- `friend_request` - Friend request received
- `friend_accepted` - Friend request accepted
- `mention` - You were mentioned
- `comment` - Comment on your content
- `like` - Like on your content
- `map_invite` - Invited to a map
- `map_member_added` - Added to map
- `pin_created` - Pin created near you
- `post_created` - Post created by followed user
- `message` - Direct message
- `system` - System notification
- `custom` - Custom event type

## Automatic Triggers

### Follow Notifications

When a `follow` relationship is created in `social_graph.edges`:
- Trigger `notifications.handle_follow_event()` fires automatically
- Creates notification for the person being followed
- Includes actor metadata and profile link

## Usage Examples

### Create Notification (Service/API)

```typescript
import { createNotification } from '@/lib/notifications/notificationService';

// Follow notification (handled by trigger, but example)
await createNotification({
  account_id: followeeAccountId,
  event_type: 'follow',
  title: 'New Follower',
  message: `${followerUsername} started following you`,
  metadata: {
    actor_account_id: followerAccountId,
    actor_username: followerUsername,
  },
  action_url: `/people/${followerAccountId}`,
  action_label: 'View Profile',
  priority: 'normal',
  channels: ['in_app'],
  dedupe_key: `follow:${followeeAccountId}:${followerAccountId}`,
  group_key: `follows:${followeeAccountId}`,
});
```

### Mention Notification

```typescript
await createNotification({
  account_id: mentionedAccountId,
  event_type: 'mention',
  title: 'You were mentioned',
  message: `${authorUsername} mentioned you in a post`,
  metadata: {
    actor_account_id: authorAccountId,
    actor_username: authorUsername,
    target_id: postId,
    target_type: 'post',
  },
  action_url: `/post/${postId}`,
  action_label: 'View Post',
  priority: 'high',
  channels: ['in_app', 'email'],
});
```

### Map Invite Notification

```typescript
await createNotification({
  account_id: inviteeAccountId,
  event_type: 'map_invite',
  title: 'Map Invitation',
  message: `${inviterUsername} invited you to join "${mapName}"`,
  metadata: {
    actor_account_id: inviterAccountId,
    actor_username: inviterUsername,
    target_id: mapId,
    target_type: 'map',
  },
  action_url: `/map/${mapId}`,
  action_label: 'View Map',
  priority: 'normal',
  channels: ['in_app', 'email'],
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
});
```

### Batch/Group Notifications

```typescript
// Multiple follows can be grouped
await createNotification({
  account_id: accountId,
  event_type: 'follow',
  title: 'New Followers',
  message: '5 people started following you',
  metadata: {
    count: 5,
    actor_account_ids: [id1, id2, id3, id4, id5],
  },
  group_key: `follows:${accountId}`, // Groups with other follow notifications
  priority: 'normal',
});
```

## API Endpoints

### GET /api/notifications
Get notifications for authenticated user

Query params:
- `read` - Filter by read status (true/false)
- `archived` - Filter by archived status (true/false)
- `event_type` - Filter by event type
- `priority` - Filter by priority
- `limit` - Limit results (default: 50)
- `offset` - Pagination offset

### GET /api/notifications/unread/count
Get unread notification count

### PATCH /api/notifications/[id]
Update notification (mark as read, archive)

Body:
```json
{
  "read": true,
  "archived": false
}
```

### DELETE /api/notifications/[id]
Delete a notification

### POST /api/notifications/mark-all-read
Mark all notifications as read

## Database Functions

### `notifications.create_alert()`

Helper function with built-in deduplication:

```sql
SELECT notifications.create_alert(
  p_account_id := 'uuid',
  p_event_type := 'follow',
  p_title := 'New Follower',
  p_message := 'Someone started following you',
  p_metadata := '{"actor_account_id": "uuid"}'::jsonb,
  p_action_url := '/profile/username',
  p_action_label := 'View Profile',
  p_priority := 'normal',
  p_channels := ARRAY['in_app']::notifications.channel[],
  p_dedupe_key := 'follow:account1:account2',
  p_group_key := 'follows:account1',
  p_expires_at := NULL
);
```

**Deduplication Logic:**
- If `dedupe_key` matches existing notification within 24 hours → returns existing
- Otherwise creates new notification

## Indexes

Optimized for common queries:

1. **Unread notifications**: `(account_id, read, priority DESC, created_at DESC)`
2. **All notifications**: `(account_id, created_at DESC)`
3. **Event type queries**: `(event_type, created_at DESC)`
4. **Deduplication**: `(dedupe_key, created_at DESC)`
5. **Grouping**: `(group_key, created_at DESC)`
6. **Expiration cleanup**: `(expires_at)`
7. **Metadata queries**: GIN indexes on `metadata` for actor_account_id, target_id

## Real-Time Support

Enable Supabase Realtime:

```typescript
const supabase = createClient();

supabase
  .channel('notifications')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'notifications',
      table: 'alerts',
      filter: `account_id=eq.${accountId}`,
    },
    (payload) => {
      console.log('New notification:', payload.new);
    }
  )
  .subscribe();
```

## RLS Policies

- Users can view/update/delete their own notifications
- Admins can view/update/delete all notifications
- Service role can insert notifications for any account
- No INSERT policy for authenticated users (prevents user-created spam)

## Best Practices

1. **Always use dedupe_key** for events that shouldn't repeat (follows, invites)
2. **Use group_key** to batch similar notifications
3. **Set expires_at** for time-sensitive notifications (invites, limited-time offers)
4. **Include action_url** for actionable notifications
5. **Use metadata** for flexible event data (don't add columns for each event type)
6. **Set appropriate priority** (urgent for critical, normal for most)
7. **Use channels array** to control delivery (start with in_app, add email/push later)

## Migration Path

1. Run migration: `1025_create_notifications_alerts_schema.sql`
2. Follow notifications automatically work via trigger
3. Add more triggers/API calls for other event types as needed
4. Frontend: Subscribe to realtime channel, display notifications
5. Future: Add email/push notification workers that read from channels array

## Extensibility

To add new event types:

1. Add to enum: `ALTER TYPE notifications.event_type ADD VALUE 'new_event';`
2. Create trigger or API call that creates notification
3. Frontend handles display (no schema changes needed)

The system is designed to scale without schema changes - just add event types and use metadata for event-specific data.
