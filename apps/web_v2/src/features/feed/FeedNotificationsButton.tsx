'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthSafe } from '@/features/auth';
import { fetchNotifications } from '@/features/community/devAdminApi';
import { IconHeart } from '@/features/map/dockCore/core/icons';
import { NOTIFICATIONS_PATH } from '@/lib/routes/routePolicy';

/**
 * Feed TopBar trailing — outline heart → /notifications.
 * Red corner dot when there is at least one unread alert.
 */
export function FeedNotificationsButton() {
  const { account } = useAuthSafe();
  const [hasUnseen, setHasUnseen] = useState(false);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (!account?.id) {
        setHasUnseen(false);
        return;
      }
      try {
        const res = await fetchNotifications(signal);
        if (signal?.aborted) return;
        setHasUnseen(res.unread_count > 0);
      } catch {
        if (signal?.aborted) return;
        // Keep last known state on transient failures.
      }
    },
    [account?.id],
  );

  useEffect(() => {
    const ac = new AbortController();
    void reload(ac.signal);

    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      ac.abort();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [reload]);

  return (
    <Link
      href={NOTIFICATIONS_PATH}
      aria-label={hasUnseen ? 'Notifications, unread alerts' : 'Notifications'}
      className="relative flex h-8 w-8 items-center justify-center text-foreground transition active:opacity-60"
    >
      <IconHeart className="h-[22px] w-[22px]" />
      {hasUnseen ? (
        <div
          className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#f7f5f1]"
          aria-hidden
        />
      ) : null}
    </Link>
  );
}
