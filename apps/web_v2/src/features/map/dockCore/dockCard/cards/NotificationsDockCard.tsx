'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthSafe } from '@/features/auth';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/features/community/devAdminApi';
import { formatRelativeTime } from '@/features/community/pinPostApi';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';

/** Account → Notifications (`platform.alerts`). */
export default function NotificationsDockCard() {
  const { openAccount, openDockCard } = useMapDock();
  const { account } = useAuthSafe();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (!account?.id) {
        setItems([]);
        return;
      }
      setError(null);
      try {
        const res = await fetchNotifications(signal);
        if (signal?.aborted) return;
        setItems(res.items);
        setUnreadCount(res.unread_count);
      } catch (e: unknown) {
        if (signal?.aborted) return;
        setError(e instanceof Error ? e.message : 'Failed to load');
        setItems([]);
      }
    },
    [account?.id],
  );

  useEffect(() => {
    const ac = new AbortController();
    void reload(ac.signal);
    return () => ac.abort();
  }, [reload]);

  const onMarkRead = async (item: NotificationItem) => {
    if (item.read) return;
    setItems((prev) =>
      prev ? prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)) : prev,
    );
    setUnreadCount((n) => Math.max(0, n - 1));
    await markNotificationRead(item.id);
  };

  const onMarkAll = async () => {
    if (busy || unreadCount === 0) return;
    setBusy(true);
    setItems((prev) => (prev ? prev.map((n) => ({ ...n, read: true })) : prev));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DockCardShell
      variant="feed"
      titleMode="sub"
      backLabel="Account"
      onBack={() => openAccount()}
      eyebrow="Account"
      title="Notifications"
      subtitle="Follows, messages, and invites"
    >
      {!account ? (
        <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">
          Sign in to see notifications.
        </p>
      ) : error ? (
        <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">{error}</p>
      ) : items === null ? (
        <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">Loading…</p>
      ) : (
        <div className="space-y-3">
          {unreadCount > 0 ? (
            <div className="flex items-center justify-between px-1">
              <span className="text-[12px] font-medium text-foreground-muted">
                {unreadCount} unread
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onMarkAll()}
                className="text-[12px] font-semibold text-lake-blue transition active:opacity-70 disabled:opacity-40"
              >
                Mark all read
              </button>
            </div>
          ) : null}

          {items.length === 0 ? (
            <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">
              No notifications yet
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void onMarkRead(item)}
                  className={`flex w-full items-start gap-3 rounded-[1.15rem] px-3 py-2.5 text-left transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
                >
                  {!item.read ? (
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-lake-blue"
                      aria-hidden
                    />
                  ) : (
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-transparent"
                      aria-hidden
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-foreground">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-[13px] text-foreground-muted">
                      {item.message}
                    </span>
                    <span className="mt-1 block text-[11px] font-medium text-foreground-muted">
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </DockCardShell>
  );
}
