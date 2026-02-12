/**
 * Notification types and interfaces
 * Matches notifications.alerts schema
 */

export type NotificationEventType =
  | 'follow'
  | 'unfollow'
  | 'friend_request'
  | 'friend_accepted'
  | 'mention'
  | 'comment'
  | 'like'
  | 'map_invite'
  | 'map_member_added'
  | 'pin_created'
  | 'post_created'
  | 'message'
  | 'system'
  | 'custom';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type NotificationChannel = 'in_app' | 'email' | 'push' | 'sms';

export interface NotificationMetadata {
  actor_account_id?: string;
  actor_username?: string;
  target_id?: string;
  target_type?: 'post' | 'mention' | 'map' | 'account' | 'pin';
  count?: number;
  [key: string]: unknown;
}

export interface NotificationAlert {
  id: string;
  account_id: string;
  event_type: NotificationEventType;
  dedupe_key: string | null;
  title: string;
  message: string;
  image_url: string | null;
  action_url: string | null;
  action_label: string | null;
  metadata: NotificationMetadata;
  channels: NotificationChannel[];
  read: boolean;
  read_at: string | null;
  archived: boolean;
  archived_at: string | null;
  priority: NotificationPriority;
  expires_at: string | null;
  group_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationParams {
  account_id: string;
  event_type: NotificationEventType;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
  action_url?: string;
  action_label?: string;
  image_url?: string;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  dedupe_key?: string;
  group_key?: string;
  expires_at?: string | null;
}

export interface NotificationFilters {
  account_id?: string;
  event_type?: NotificationEventType;
  read?: boolean;
  archived?: boolean;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  limit?: number;
  offset?: number;
}
