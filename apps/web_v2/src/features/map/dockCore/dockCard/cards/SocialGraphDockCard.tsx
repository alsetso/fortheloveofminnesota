'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthSafe } from '@/features/auth';
import {
  fetchSocialGraph,
  socialAccountLabel,
  type SocialGraphEntry,
} from '@/features/community/devAdminApi';
import { removeFollower, unfollowAccount } from '@/features/community/profileApi';
import { formatRelativeTime } from '@/features/community/pinPostApi';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { IconEye } from '@/features/map/dockCore/core/icons';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';

function EntryAvatar({ entry }: { entry: SocialGraphEntry }) {
  const src = entry.account.image_url?.trim() || null;
  if (src) {
    return (
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-lake-blue/15">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }
  const initials = (
    entry.account.username?.trim() || entry.account.first_name?.trim() || 'P'
  )
    .slice(0, 1)
    .toUpperCase();
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lake-blue/15 text-sm font-semibold text-lake-blue">
      {initials}
    </div>
  );
}

/**
 * Shared list body for Followers + Following. Defaults to the signed-in
 * account's own graph (Your activity); pass `accountId` +
 * `backLabel`/`onBack` to embed it scoped to any public profile (used inline
 * by `ProfileDockCard`). Owner rows get an armed Remove / Unfollow control.
 */
export function SocialGraphDockCard({
  variant,
  accountId,
  backLabel,
  onBack,
  listPrivate,
  onRemoved,
}: {
  variant: 'followers' | 'following';
  /** Whose graph to show — defaults to the signed-in account. */
  accountId?: string;
  backLabel?: string;
  onBack?: () => void;
  /**
   * Owner viewing their own hidden list (`hide_followers` / `hide_following`).
   * When omitted, falls back to the signed-in account's privacy flags for self.
   */
  listPrivate?: boolean;
  /** Fired after a successful owner Remove / Unfollow (for parent count updates). */
  onRemoved?: () => void;
}) {
  const { openDockCard, openProfileCard } = useMapDock();
  const { account } = useAuthSafe();
  const targetId = accountId ?? account?.id ?? null;
  const isSelf = Boolean(targetId && account?.id && targetId === account.id);
  const [entries, setEntries] = useState<SocialGraphEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const ownerOnly =
    listPrivate ??
    (isSelf &&
      (variant === 'followers'
        ? account?.hide_followers === true
        : account?.hide_following === true));

  const reload = useCallback(async (signal?: AbortSignal) => {
    if (!targetId) {
      setEntries([]);
      return;
    }
    setLoadError(null);
    try {
      const graph = await fetchSocialGraph({ accountId, signal });
      if (signal?.aborted) return;
      setEntries(variant === 'followers' ? graph.followers : graph.following);
    } catch (e: unknown) {
      if (signal?.aborted) return;
      setLoadError(e instanceof Error ? e.message : 'Failed to load');
      setEntries([]);
    }
  }, [accountId, targetId, variant]);

  useEffect(() => {
    const ac = new AbortController();
    void reload(ac.signal);
    return () => ac.abort();
  }, [reload]);

  const isFollowers = variant === 'followers';
  const title = isFollowers ? 'Followers' : 'Following';
  const subtitle = isFollowers ? 'Accounts following you' : 'Accounts you follow';
  const emptyCopy = isFollowers ? 'No followers yet' : "You haven't followed anyone yet";
  const showOwnerOnlyBanner = Boolean(ownerOnly && entries && entries.length > 0);
  const showActions = isSelf;

  const onConfirmAction = async (entryId: string) => {
    if (busyId) return;
    setBusyId(entryId);
    setActionError(null);
    try {
      if (isFollowers) await removeFollower(entryId);
      else await unfollowAccount(entryId);
      setEntries((prev) => (prev ?? []).filter((e) => e.account.id !== entryId));
      setArmedId(null);
      onRemoved?.();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
      setArmedId(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DockCardShell
      variant="feed"
      titleMode="sub"
      backLabel={backLabel ?? 'Activity'}
      onBack={onBack ?? (() => openDockCard('activity'))}
      title={title}
      subtitle={subtitle}
      scrollKey={variant}
    >
      <div className="space-y-2">
        {!targetId ? (
          <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">
            Sign in to see your activity.
          </p>
        ) : loadError ? (
          <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">{loadError}</p>
        ) : entries === null ? (
          <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">{emptyCopy}</p>
        ) : (
          <>
            {actionError ? (
              <p className="px-1 text-center text-[12px] text-red-700">{actionError}</p>
            ) : null}
            {showOwnerOnlyBanner ? (
              <p
                className={`flex items-start gap-2 rounded-[1.15rem] px-3 py-2.5 text-[12px] leading-snug text-foreground-muted ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
              >
                <IconEye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Only you can see this list — it is hidden from everyone else on your
                  profile.
                </span>
              </p>
            ) : null}
            <div className={showOwnerOnlyBanner ? 'space-y-2 opacity-70' : 'space-y-2'}>
              {entries.map((entry) => {
                const id = entry.account.id;
                const armed = armedId === id;
                const busy = busyId === id;
                return (
                  <div
                    key={id}
                    className={`flex w-full items-center gap-2 rounded-[1.15rem] px-2 py-2 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
                  >
                    <button
                      type="button"
                      onClick={() => openProfileCard(id)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left transition hover:bg-map-ink-subtle active:scale-[0.99]"
                    >
                      <EntryAvatar entry={entry} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-foreground">
                          {socialAccountLabel(entry.account)}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-foreground-muted">
                          <span>
                            {isFollowers ? 'Followed you' : 'Followed'}{' '}
                            {formatRelativeTime(entry.since)}
                          </span>
                          {entry.is_friend ? (
                            <span className="inline-flex items-center rounded-full bg-lake-blue/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lake-blue">
                              Mutual
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                    {showActions ? (
                      armed ? (
                        <div className="flex shrink-0 items-center gap-1 pr-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setArmedId(null)}
                            className="rounded-full px-2.5 py-1.5 text-[12px] font-medium text-foreground-muted transition active:scale-95 disabled:opacity-40"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void onConfirmAction(id)}
                            className="rounded-full bg-red-600 px-2.5 py-1.5 text-[12px] font-semibold text-white transition active:scale-95 disabled:opacity-40"
                          >
                            {busy
                              ? '…'
                              : isFollowers
                                ? 'Remove'
                                : 'Unfollow'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId != null}
                          onClick={() => setArmedId(id)}
                          className="mr-1 shrink-0 rounded-full px-2.5 py-1.5 text-[12px] font-semibold text-foreground-muted transition hover:bg-black/[0.05] active:scale-95 disabled:opacity-40"
                        >
                          {isFollowers ? 'Remove' : 'Unfollow'}
                        </button>
                      )
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DockCardShell>
  );
}
