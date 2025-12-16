'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { CheckIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { useNotifications } from '@/features/notifications';

export default function NotificationsClient() {
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const {
    notifications,
    loading,
    error: notificationError,
    unreadCount,
    markAsRead: markAsReadNotification,
    markAllAsRead: markAllAsReadNotifications,
  } = useNotifications({ limit: 100, autoLoad: true });

  const markAsRead = async (notificationId: string) => {
    try {
      setMarkingRead(notificationId);
      await markAsReadNotification(notificationId);
    } catch (err) {
      console.error('Error marking notification as read:', err);
    } finally {
      setMarkingRead(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      setMarkingRead('all');
      await markAllAsReadNotifications();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    } finally {
      setMarkingRead(null);
    }
  };

  const error = notificationError || '';

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-xs text-gray-600 font-medium">Loading notifications...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="p-[10px] bg-white border border-gray-200 rounded-md">
            <CheckCircleIcon className="w-4 h-4 text-gray-700" />
          </div>
          <h1 className="text-sm font-semibold text-gray-900">Notifications</h1>
        </div>
        {unreadCount > 0 && (
          <p className="text-xs text-gray-600">
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-[10px] py-[10px] rounded-md text-xs flex items-start gap-2">
          <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Notifications Card */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        {unreadCount > 0 && (
          <div className="px-[10px] py-[10px] border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-end">
              <button
                onClick={markAllAsRead}
                disabled={markingRead === 'all'}
                className="flex items-center gap-1.5 px-[10px] py-[10px] text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {markingRead === 'all' ? (
                  <>
                    <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    Marking...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-3 h-3" />
                    Mark all as read
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="p-[10px]">
          {/* Notifications List */}
          {notifications.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs font-medium text-gray-600 mb-1">No notifications yet</p>
              <p className="text-xs text-gray-500">You&apos;ll see notifications here when they arrive</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-[10px] rounded-md border transition-colors ${
                    notification.read
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${
                      notification.read ? 'bg-transparent' : 'bg-gray-900'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-xs font-semibold mb-1 ${
                            notification.read ? 'text-gray-500' : 'text-gray-900'
                          }`}>
                            {notification.title}
                          </h3>
                          <p className="text-xs text-gray-600 mb-1.5 line-clamp-3">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatTime(notification.created_at)}
                          </p>
                        </div>
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            disabled={markingRead === notification.id}
                            className="flex-shrink-0 p-[10px] text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Mark as read"
                          >
                            {markingRead === notification.id ? (
                              <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <CheckIcon className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

