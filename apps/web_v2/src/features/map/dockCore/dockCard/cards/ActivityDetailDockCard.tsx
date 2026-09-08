'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthSafe } from '@/features/auth';
import {
  deleteOwnComment,
  fetchActivity,
  formatRelativeTime,
  pinAuthorLabel,
  togglePinPostLike,
  type ActivityItem,
  type ActivityTab,
} from '@/features/community/pinPostApi';
import { postTypeLabel } from '@/lib/community/storyExpiry';
import { activityTypeMeta } from '@/features/map/dockCore/dockCard/activityTypes';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { IconX } from '@/features/map/dockCore/core/icons';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';

function rowTitle(item: ActivityItem, tab: ActivityTab): string {
  if (tab === 'comments' && item.comment_preview?.trim()) {
    return item.comment_preview.trim();
  }
  const type = postTypeLabel(item.content_shape);
  return item.body?.trim() || type;
}

function rowSubtitle(item: ActivityItem, tab: ActivityTab): string | undefined {
  if (tab === 'comments') {
    const caption = item.body?.trim();
    if (caption) return caption;
  }
  return item.full_address?.trim() || undefined;
}

function actionLabel(tab: ActivityTab): string {
  switch (tab) {
    case 'likes':
      return 'Unlike';
    case 'comments':
      return 'Remove comment';
    default:
      return 'Remove';
  }
}

/**
 * Leading visual — post media thumbnail first, else the actual author's
 * avatar when it's not the viewer's own post (Likes/Comments surface others'
 * posts), else the existing emoji/own-avatar/initials fallback.
 */
function RowThumbnail({
  item,
  isOwnPost,
  viewer,
}: {
  item: ActivityItem;
  isOwnPost: boolean;
  viewer: { username: string | null; image_url: string | null };
}) {
  if (item.media_url) {
    return (
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-lake-blue/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.media_url} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  const authorImage = !isOwnPost ? item.account?.image_url ?? null : null;
  const ownImage = isOwnPost ? viewer.image_url : null;
  const initialsSource = isOwnPost ? viewer.username : item.account?.username;

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-lake-blue/20 text-lg">
      {authorImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={authorImage} alt="" className="h-full w-full object-cover" />
      ) : item.emoji?.trim() ? (
        <span aria-hidden>{item.emoji}</span>
      ) : ownImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ownImage} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm font-semibold text-foreground">
          {(initialsSource ?? 'P').slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );
}

/** Account → Your activity → one type's list (Pins / Likes / Comments / Archive / …). */
export default function ActivityDetailDockCard() {
  const { openDockCard, openPinCard, activityTab } = useMapDock();
  const { account } = useAuthSafe();
  const tab = activityTab;
  const meta = activityTypeMeta(tab);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (!account?.id) {
        setItems([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchActivity(tab, signal);
        if (!signal?.aborted) setItems(rows);
      } catch (e: unknown) {
        if (signal?.aborted) return;
        setError(e instanceof Error ? e.message : 'Failed to load');
        setItems([]);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [account?.id, tab],
  );

  useEffect(() => {
    const ac = new AbortController();
    void reload(ac.signal);
    return () => ac.abort();
  }, [reload]);

  const onOpen = (item: ActivityItem) => {
    const isOwnPost = !item.account_id || item.account_id === account?.id;
    const typeLabel = postTypeLabel(item.content_shape);
    openPinCard(
      {
        id: item.id,
        kind: 'pin',
        title: rowTitle(item, tab).slice(0, 80),
        subtitle: rowSubtitle(item, tab),
        kindLabel: tab === 'archived' ? `Archived ${typeLabel}` : typeLabel,
        summary: item.body ?? undefined,
        imageUrl: (isOwnPost ? account?.image_url : item.account?.image_url) ?? null,
      },
      { fromActivity: true },
    );
  };

  const onRowAction = async (item: ActivityItem) => {
    const key = `${tab}-${item.id}-${item.comment_id ?? item.interaction_at}`;
    if (busyKey) return;
    setBusyKey(key);
    try {
      if (tab === 'likes') {
        await togglePinPostLike(item.id, false);
      } else if (tab === 'comments') {
        if (!item.comment_id) throw new Error('Missing comment');
        await deleteOwnComment(item.comment_id);
      } else {
        return;
      }
      setItems((prev) =>
        prev.filter((row) => {
          if (tab === 'comments') return row.comment_id !== item.comment_id;
          return !(row.id === item.id && row.interaction_at === item.interaction_at);
        }),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyKey(null);
    }
  };

  // Archive rows are pin records — restore/delete live in the pin's own ⋯ menu
  // (open the record), not as a loose icon in the list.
  const showRowAction = tab === 'likes' || tab === 'comments';

  return (
    <DockCardShell
      variant="feed"
      titleMode="sub"
      backLabel="Activity"
      onBack={() => openDockCard('activity')}
      eyebrow="Activity"
      title={meta.label}
      subtitle={meta.subtitle}
    >
      {!account ? (
          <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">
            Sign in to see your activity.
          </p>
        ) : error ? (
          <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">{error}</p>
        ) : loading && items.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">
            {meta.emptyCopy}
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const title = rowTitle(item, tab);
              const subtitle = rowSubtitle(item, tab);
              const key = `${tab}-${item.id}-${item.comment_id ?? item.interaction_at}`;
              const busy = busyKey === key;
              const isOwnPost = !item.account_id || item.account_id === account.id;
              const authorLabel = !isOwnPost ? pinAuthorLabel(item.account) : null;
              return (
                <div
                  key={key}
                  className={`flex w-full items-center gap-2 rounded-[1.15rem] px-2 py-2 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
                >
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left transition hover:bg-map-ink-subtle active:scale-[0.99]"
                  >
                    <RowThumbnail item={item} isOwnPost={isOwnPost} viewer={account} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-[15px] font-medium text-foreground">
                        {title}
                      </span>
                      {subtitle ? (
                        <span className="mt-0.5 block truncate text-[12px] text-foreground-muted">
                          {subtitle}
                        </span>
                      ) : null}
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-foreground-muted">
                        {(tab === 'pins' || tab === 'archived') && (
                          <span
                            className={
                              item.content_shape === 'story'
                                ? 'inline-flex items-center rounded-full bg-lake-blue/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lake-blue'
                                : 'inline-flex items-center rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted'
                            }
                          >
                            {postTypeLabel(item.content_shape)}
                          </span>
                        )}
                        <span>{formatRelativeTime(item.interaction_at)}</span>
                        {authorLabel ? (
                          <span className="min-w-0 truncate">· {authorLabel}</span>
                        ) : null}
                        {tab === 'archived' ? (
                          <span className="inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            Archived
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                  {showRowAction ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onRowAction(item)}
                      aria-label={actionLabel(tab)}
                      title={actionLabel(tab)}
                      className="mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground-muted transition active:scale-95 disabled:opacity-40 hover:bg-black/[0.05]"
                    >
                      <IconX className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="pr-2 text-foreground-muted" aria-hidden>
                      ›
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </DockCardShell>
  );
}
