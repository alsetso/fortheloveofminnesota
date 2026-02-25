/**
 * Notification service
 * Handles creating and managing notifications
 */

import { createServiceClient } from '@/lib/supabaseServer';
import type {
  NotificationAlert,
  CreateNotificationParams,
  NotificationFilters,
} from '@/types/notification';

/**
 * Create a notification using the database function
 * Handles deduplication automatically
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<NotificationAlert> {
  const supabase = await createServiceClient();

  const { data, error } = await (supabase as any).rpc('create_alert', {
    p_account_id: params.account_id,
    p_event_type: params.event_type,
    p_title: params.title,
    p_message: params.message,
    p_metadata: params.metadata || {},
    p_action_url: params.action_url || null,
    p_action_label: params.action_label || null,
    p_image_url: params.image_url || null,
    p_priority: params.priority || 'normal',
    p_channels: params.channels || ['in_app'],
    p_dedupe_key: params.dedupe_key || null,
    p_group_key: params.group_key || null,
    p_expires_at: params.expires_at || null,
  });

  if (error) {
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  return data as NotificationAlert;
}

/**
 * Get notifications for an account
 */
export async function getNotifications(
  accountId: string,
  filters: NotificationFilters = {}
): Promise<NotificationAlert[]> {
  const supabase = await createServiceClient();

  let query = supabase
    .schema('notifications')
    .from('alerts')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (filters.read !== undefined) {
    query = query.eq('read', filters.read);
  }

  if (filters.archived !== undefined) {
    query = query.eq('archived', filters.archived);
  }

  if (filters.event_type) {
    query = query.eq('event_type', filters.event_type);
  }

  if (filters.priority) {
    query = query.eq('priority', filters.priority);
  }

  if (filters.channels && filters.channels.length > 0) {
    query = query.contains('channels', filters.channels);
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  if (filters.offset) {
    query = query.range(
      filters.offset,
      filters.offset + (filters.limit || 50) - 1
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get notifications: ${error.message}`);
  }

  return (data || []) as NotificationAlert[];
}

/**
 * Get unread notification count for an account
 */
export async function getUnreadCount(accountId: string): Promise<number> {
  const supabase = await createServiceClient();

  const { count, error } = await supabase
    .schema('notifications')
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .eq('read', false)
    .eq('archived', false);

  if (error) {
    throw new Error(`Failed to get unread count: ${error.message}`);
  }

  return count || 0;
}

/**
 * Mark notification as read
 */
export async function markAsRead(
  notificationId: string,
  accountId: string
): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .schema('notifications')
    .from('alerts')
    .update({
      read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId)
    .eq('account_id', accountId);

  if (error) {
    throw new Error(`Failed to mark as read: ${error.message}`);
  }
}

/**
 * Mark all notifications as read for an account
 */
export async function markAllAsRead(accountId: string): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .schema('notifications')
    .from('alerts')
    .update({
      read: true,
      read_at: new Date().toISOString(),
    })
    .eq('account_id', accountId)
    .eq('read', false);

  if (error) {
    throw new Error(`Failed to mark all as read: ${error.message}`);
  }
}

/**
 * Archive a notification
 */
export async function archiveNotification(
  notificationId: string,
  accountId: string
): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .schema('notifications')
    .from('alerts')
    .update({
      archived: true,
      archived_at: new Date().toISOString(),
    })
    .eq('id', notificationId)
    .eq('account_id', accountId);

  if (error) {
    throw new Error(`Failed to archive notification: ${error.message}`);
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(
  notificationId: string,
  accountId: string
): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .schema('notifications')
    .from('alerts')
    .delete()
    .eq('id', notificationId)
    .eq('account_id', accountId);

  if (error) {
    throw new Error(`Failed to delete notification: ${error.message}`);
  }
}

/**
 * Example: Create a follow notification
 * (This is handled automatically by the trigger, but shown as example)
 */
export async function createFollowNotification(
  followerAccountId: string,
  followeeAccountId: string,
  followerUsername: string
): Promise<NotificationAlert> {
  return createNotification({
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
}
