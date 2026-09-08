'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSafe } from '@/features/auth';
import { DmPeerAvatar } from '@/features/messages/DmPeerAvatar';
import {
  dmInboxTime,
  dmPeerDisplayName,
  fetchDmThreads,
  type DmThreadSummary,
} from '@/features/messages/messagesApi';
import { IconChat } from '@/features/map/dockCore/core/icons';
import { SettingsChrome } from '@/features/settings/SettingsChrome';
import { FEED_PATH, messageThreadPath } from '@/lib/routes/routePolicy';

function MessagesEmptyState() {
  return (
    <section
      className="flex flex-col items-center px-6 pb-8 pt-16 text-center"
      aria-label="No messages"
    >
      <span className="text-foreground-muted" aria-hidden>
        <IconChat className="h-10 w-10 opacity-35" />
      </span>
      <h3 className="mt-4 text-[22px] font-semibold tracking-tight text-foreground">
        No Messages Yet
      </h3>
      <p className="mt-2 max-w-[17.5rem] text-[15px] leading-[1.35] text-foreground-muted">
        Direct messages with people you know in Minnesota will show up here.
      </p>
    </section>
  );
}

/**
 * /messages — simple DM inbox.
 */
export default function MessagesPage() {
  const router = useRouter();
  const { account } = useAuthSafe();
  const [threads, setThreads] = useState<DmThreadSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (!account?.id) {
        setThreads([]);
        return;
      }
      setError(null);
      try {
        const rows = await fetchDmThreads(signal);
        if (signal?.aborted) return;
        setThreads(rows);
      } catch (e: unknown) {
        if (signal?.aborted) return;
        setError(e instanceof Error ? e.message : 'Failed to load');
        setThreads([]);
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

  return (
    <SettingsChrome
      title="Messages"
      backLabel="Back"
      onBack={onBack}
      onRefresh={() => reload()}
    >
      <div className="pb-12 pt-2">
        <h2 className="px-5 pb-3 text-[28px] font-extrabold tracking-tight text-foreground">
          Messages
        </h2>

        {!account ? (
          <p className="px-5 py-10 text-center text-[14px] text-foreground-muted">
            Sign in to see messages.
          </p>
        ) : error ? (
          <p className="px-5 py-10 text-center text-[14px] text-foreground-muted">{error}</p>
        ) : threads === null ? (
          <p className="px-5 py-10 text-center text-[14px] text-foreground-muted">Loading…</p>
        ) : threads.length === 0 ? (
          <MessagesEmptyState />
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {threads.map((thread) => {
              const name = dmPeerDisplayName(thread.other_account);
              const preview = thread.last_message?.body?.trim() || 'Say hello';
              const when = thread.last_message?.created_at
                ? dmInboxTime(thread.last_message.created_at)
                : '';
              const unread = thread.unread_count > 0;

              return (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => router.push(messageThreadPath(thread.id))}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition active:bg-black/[0.03]"
                  >
                    <DmPeerAvatar peer={thread.other_account} size={52} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-[16px] tracking-tight text-foreground ${
                            unread ? 'font-bold' : 'font-semibold'
                          }`}
                        >
                          {name}
                        </span>
                        {when ? (
                          <span
                            className={`shrink-0 text-[12px] tabular-nums ${
                              unread
                                ? 'font-semibold text-lake-blue'
                                : 'text-foreground-muted'
                            }`}
                          >
                            {when}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span
                          className={`min-w-0 flex-1 truncate text-[14px] leading-snug ${
                            unread
                              ? 'font-medium text-foreground'
                              : 'text-foreground-muted'
                          }`}
                        >
                          {preview}
                        </span>
                        {unread ? (
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full bg-lake-blue"
                            aria-label={`${thread.unread_count} unread`}
                          />
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SettingsChrome>
  );
}
