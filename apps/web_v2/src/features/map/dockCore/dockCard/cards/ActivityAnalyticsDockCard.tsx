'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthSafe } from '@/features/auth';
import {
  fetchAnalyticsSummary,
  socialAccountLabel,
  type AnalyticsSummary,
  type EngagementEvent,
} from '@/features/community/devAdminApi';
import { formatPinCount, formatRelativeTime } from '@/features/community/pinPostApi';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { IconChat, IconEye, IconHeart } from '@/features/map/dockCore/core/icons';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      className={`flex-1 rounded-2xl px-3 py-3 text-center ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
    >
      <p className="text-[1.1rem] font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-foreground-muted">{label}</p>
    </div>
  );
}

function verbLabel(kind: EngagementEvent['kind']): string {
  switch (kind) {
    case 'view':
      return 'viewed';
    case 'like':
      return 'liked';
    case 'comment':
      return 'commented on';
  }
}

function VerbIcon({ kind }: { kind: EngagementEvent['kind'] }) {
  const className = 'h-3.5 w-3.5';
  switch (kind) {
    case 'view':
      return <IconEye className={className} />;
    case 'like':
      return <IconHeart className={className} solid />;
    case 'comment':
      return <IconChat className={className} />;
  }
}

function verbTint(kind: EngagementEvent['kind']): string {
  switch (kind) {
    case 'view':
      return 'bg-slate-500/15 text-slate-600';
    case 'like':
      return 'bg-rose-500/15 text-rose-600';
    case 'comment':
      return 'bg-lake-blue/15 text-lake-blue';
  }
}

/** Actor avatar (who) — falls back to initials when there's no image or no actor (anon view). */
function ActorAvatar({ actor }: { actor: EngagementEvent['actor'] }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-lake-blue/15 text-sm font-semibold text-lake-blue">
      {actor?.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={actor.image_url} alt="" className="h-full w-full object-cover" />
      ) : (
        (actor?.username ?? 'A').slice(0, 1).toUpperCase()
      )}
    </div>
  );
}

/** Pin thumbnail (what) — small square, falls back to a neutral tile when there's no media. */
function PostThumb({ post }: { post: EngagementEvent['post'] }) {
  return (
    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-map-ink-subtle">
      {post.media_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.media_url} alt="" className="h-full w-full object-cover" />
      ) : null}
    </div>
  );
}

function EngagementRow({
  event,
  onOpen,
}: {
  event: EngagementEvent;
  onOpen: (event: EngagementEvent) => void;
}) {
  const actorName = socialAccountLabel(event.actor);
  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      className={`flex w-full items-center gap-2.5 rounded-[1.15rem] px-3 py-2.5 text-left transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
    >
      <div className="relative shrink-0">
        <ActorAvatar actor={event.actor} />
        <span
          className={`absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full ring-2 ring-white ${verbTint(event.kind)}`}
        >
          <VerbIcon kind={event.kind} />
        </span>
      </div>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-foreground">
          <span className="font-semibold">{actorName}</span> {verbLabel(event.kind)} your pin
        </span>
        {event.kind === 'comment' && event.comment_preview?.trim() ? (
          <span className="mt-0.5 line-clamp-1 block text-[12px] text-foreground-muted">
            “{event.comment_preview.trim()}”
          </span>
        ) : event.post.body_snippet ? (
          <span className="mt-0.5 line-clamp-1 block text-[12px] text-foreground-muted">
            {event.post.body_snippet}
          </span>
        ) : null}
        <span className="mt-0.5 block text-[11px] font-medium text-foreground-muted">
          {formatRelativeTime(event.occurred_at)}
        </span>
      </span>
      <PostThumb post={event.post} />
    </button>
  );
}

/**
 * Account → Your activity → Dev admin → Analytics.
 * Pin totals come straight off `community.posts` counters. Below that, a
 * single unified engagement feed answers the "who did what to which of mine"
 * question — one row per view/like/comment, tap to jump to that exact pin.
 */
export default function ActivityAnalyticsDockCard() {
  const { openDockCard, openPinCard } = useMapDock();
  const { account } = useAuthSafe();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (signal?: AbortSignal) => {
    if (!account?.id) {
      setSummary(null);
      return;
    }
    setError(null);
    try {
      const res = await fetchAnalyticsSummary(signal);
      if (!signal?.aborted) setSummary(res);
    } catch (e: unknown) {
      if (signal?.aborted) return;
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [account?.id]);

  useEffect(() => {
    const ac = new AbortController();
    void reload(ac.signal);
    return () => ac.abort();
  }, [reload]);

  const onOpenEvent = (event: EngagementEvent) => {
    openPinCard(
      {
        id: event.post.id,
        kind: 'pin',
        title: (event.post.body_snippet ?? 'Pin').slice(0, 80),
        kindLabel: 'Pin',
        summary: event.post.body_snippet ?? undefined,
        imageUrl: account?.image_url ?? null,
      },
      { fromActivity: true },
    );
  };

  return (
    <DockCardShell
      variant="feed"
      titleMode="sub"
      backLabel="Activity"
      onBack={() => openDockCard('activity')}
      eyebrow="Dev admin"
      title="Analytics"
      subtitle="community.post_views + reactions + comments"
    >
      {!account ? (
          <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">
            Sign in to see your activity.
          </p>
        ) : error ? (
          <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">{error}</p>
        ) : !summary ? (
          <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">Loading…</p>
        ) : (
          <div className="space-y-5">
            <section>
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                Your pins
              </p>
              <div className="flex gap-2">
                <StatTile label="Pins" value={formatPinCount(summary.pins.total)} />
                <StatTile label="Views" value={formatPinCount(summary.pins.view_count_sum)} />
                <StatTile label="Likes" value={formatPinCount(summary.pins.like_count_sum)} />
                <StatTile label="Comments" value={formatPinCount(summary.pins.comment_count_sum)} />
              </div>
              <p className="mt-1.5 px-1 text-[12px] text-foreground-muted">
                {summary.pins.live} live · {summary.pins.archived} archived
              </p>
            </section>

            <section>
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                Engagement — who did what
              </p>

              {summary.engagement.items.length > 0 ? (
                <div className="space-y-2">
                  {summary.engagement.items.map((event, i) => (
                    <EngagementRow
                      key={`${event.kind}-${event.post.id}-${event.actor?.id ?? 'anon'}-${event.occurred_at}-${i}`}
                      event={event}
                      onOpen={onOpenEvent}
                    />
                  ))}
                </div>
              ) : (
                <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">
                  No one has viewed, liked, or commented on your pins yet.
                </p>
              )}
            </section>
          </div>
        )}
    </DockCardShell>
  );
}
