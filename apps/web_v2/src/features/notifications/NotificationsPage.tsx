'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSafe } from '@/features/auth';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/features/community/devAdminApi';
import { formatRelativeTime } from '@/features/community/pinPostApi';
import { IconBell } from '@/features/map/dockCore/core/icons';
import { SettingsChrome } from '@/features/settings/SettingsChrome';
import { FEED_PATH } from '@/lib/routes/routePolicy';

const ALERT_SUMMARY =
  'Likes, comments, follows, messages, map invites, and system updates will show up here.';

function NotificationsEmptyState() {
  return (
    <section
      className="flex flex-col items-center px-6 pb-8 pt-16 text-center"
      aria-label="No notifications"
    >
      <span className="text-foreground-muted" aria-hidden>
        <IconBell className="h-10 w-10 opacity-35" />
      </span>
      <h3 className="mt-4 text-[22px] font-semibold tracking-tight text-foreground">
        You&apos;re All Caught Up
      </h3>
      <p className="mt-2 max-w-[17.5rem] text-[15px] leading-[1.35] text-foreground-muted">
        {ALERT_SUMMARY}
      </p>
    </section>
  );
}

/**
 * /notifications — full-page inbox for `platform.alerts`
 * (sidebar → Notifications).
 */
export default function NotificationsPage() {
  const router = useRouter();
  const { account } = useAuthSafe();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (!account?.id) {
        setItems([]);
        setUnreadCount(0);
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

  const onBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(FEED_PATH);
  };

  const onMarkRead = async (item: NotificationItem) => {
    const follow =
      item.action_url?.startsWith('/') && !item.action_url.startsWith('//')
        ? item.action_url
        : null;

    if (item.read) {
      if (follow) router.push(follow);
      return;
    }
    setItems((prev) =>
      prev ? prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)) : prev,
    );
    setUnreadCount((n) => Math.max(0, n - 1));
    await markNotificationRead(item.id);
    if (follow) router.push(follow);
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
    <SettingsChrome
      title="Notifications"
      backLabel="Back"
      onBack={onBack}
      onRefresh={() => reload()}
      trailing={
        unreadCount > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onMarkAll()}
            className="px-2 py-1.5 text-[15px] font-semibold text-lake-blue transition active:opacity-60 disabled:opacity-40"
          >
            Mark all read
          </button>
        ) : null
      }
    >
      <div className="space-y-4 px-4 pb-12 pt-4">
        <div className="flex items-end justify-between gap-3 px-1">
          <h2 className="text-[28px] font-extrabold tracking-tight text-foreground">
            Notifications
          </h2>
          {unreadCount > 0 ? (
            <span className="mb-1 shrink-0 text-[13px] font-semibold tabular-nums text-foreground-muted">
              {unreadCount} unread
            </span>
          ) : null}
        </div>

        {!account ? (
          <p className="px-1 py-10 text-center text-[14px] text-foreground-muted">
            Sign in to see notifications.
          </p>
        ) : error ? (
          <p className="px-1 py-10 text-center text-[14px] text-foreground-muted">{error}</p>
        ) : items === null ? (
          <p className="px-1 py-10 text-center text-[14px] text-foreground-muted">Loading…</p>
        ) : items.length === 0 ? (
          <NotificationsEmptyState />
        ) : (
          <ul className="overflow-hidden rounded-[14px] border border-black/[0.08] bg-white shadow-sm">
            {items.map((item) => (
              <li key={item.id} className="border-b border-black/[0.06] last:border-b-0">
                <button
                  type="button"
                  onClick={() => void onMarkRead(item)}
                  className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition active:bg-black/[0.03]"
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
                    <span className="block truncate text-[16px] font-semibold text-foreground">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-[14px] text-foreground-muted">
                      {item.message}
                    </span>
                    <span className="mt-1.5 block text-[12px] font-medium text-foreground-muted">
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SettingsChrome>
  );
}
