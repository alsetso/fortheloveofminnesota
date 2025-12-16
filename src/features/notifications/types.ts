/**
 * Notification types and interfaces
 */

export interface Notification {
  id: string;
  account_id: string;
  profile_id?: string | null;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface NotificationFilters {
  limit?: number;
  unreadOnly?: boolean;
}

export interface MarkNotificationReadParams {
  notification_id?: string;
  mark_all_read?: boolean;
}




