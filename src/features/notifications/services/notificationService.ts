/**
 * Notification service for API interactions
 */

import { Notification, NotificationFilters, MarkNotificationReadParams } from '../types';

export class NotificationService {
  /**
   * Fetch notifications for the authenticated user
   */
  static async getNotifications(filters: NotificationFilters = {}): Promise<Notification[]> {
    const { limit = 50, unreadOnly = false } = filters;
    
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit.toString());
    if (unreadOnly) params.set('unread_only', 'true');

    const response = await fetch(`/api/notifications?${params.toString()}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch notifications' }));
      throw new Error(error.error || 'Failed to fetch notifications');
    }

    return response.json();
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(notificationId: string): Promise<void> {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ notification_id: notificationId } as MarkNotificationReadParams),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to mark notification as read' }));
      throw new Error(error.error || 'Failed to mark notification as read');
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(): Promise<void> {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ mark_all_read: true } as MarkNotificationReadParams),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to mark all notifications as read' }));
      throw new Error(error.error || 'Failed to mark all notifications as read');
    }
  }
}





