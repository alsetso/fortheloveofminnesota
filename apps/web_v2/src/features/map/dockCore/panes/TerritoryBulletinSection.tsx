'use client';

/**
 * TerritoryBulletinSection — the public bulletin board for a territory entity.
 *
 * Renders inside DockDetailsPane when the account has unlocked this territory
 * (passport visit confirmed). Any signed-in account can read and post here.
 *
 * Feed cards support three post types:
 *   • Text + image(s)   — the most common; photo + caption from inside a meeting
 *   • Document          — PDF agenda, public notice, budget summary
 *   • YouTube embed     — council meeting recording posted after the fact
 *
 * The "Post to bulletin" row uses the existing compose flow by passing
 * content_shape='territory_bulletin' into the community post create payload.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import {
  DockSection,
  DockSkeletonRows,
  ENTRY_ROW_GLASS_CLASS,
} from '@/features/map/dockCore/panes/DockPaneShell';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import {
  IconLock,
  IconSparkles,
} from '@/features/map/dockCore/core/icons';
import { formatRelativeTime, pinAuthorLabel } from '@/features/community/pinPostApi';
import type { BulletinPost, BulletinMedia } from '@/app/api/community/territory-bulletin/route';

// ─── Data hook ─────────────────────────────────────────────────────────────────

type FeedState = {
  posts: BulletinPost[];
  hasMore: boolean;
  loading: boolean;
  error: string | null;
};

function useTerritoryBulletinFeed(entityId: string): FeedState & { reload: () => void } {
  const [state, setState] = useState<FeedState>({
    posts: [],
    hasMore: false,
    loading: true,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetch(`/api/community/territory-bulletin?entity_id=${encodeURIComponent(entityId)}&limit=20`, {
      cache: 'no-store',
      credentials: 'include',
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(json?.error ?? 'Failed to load bulletin');
        }
        const json = (await res.json()) as { posts: BulletinPost[]; hasMore: boolean };
        setState({ posts: json.posts ?? [], hasMore: json.hasMore, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if ((err as { name?: string }).name === 'AbortError') return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: (err as Error)?.message ?? 'Could not load bulletin.',
        }));
      });

    return () => ctrl.abort();
  }, [entityId]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  return { ...state, reload: load };
}

// ─── Media rendering ───────────────────────────────────────────────────────────

function BulletinMediaThumb({ media }: { media: BulletinMedia }) {
  if (media.type === 'youtube') {
    const meta = media.meta as { thumbnail?: string; title?: string } | null;
    const thumb = meta?.thumbnail;
    return (
      <div className="relative h-[140px] w-full shrink-0 overflow-hidden rounded-xl bg-black">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={meta?.title ?? 'YouTube video'} className="h-full w-full object-cover opacity-80" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-black/60">
            <span className="text-4xl">▶️</span>
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600/90 shadow-lg">
            <span className="ml-0.5 text-white text-lg">▶</span>
          </div>
        </div>
        {/* YouTube badge */}
        <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          YouTube
        </span>
        {meta?.title ? (
          <span className="absolute bottom-2 right-2 max-w-[60%] truncate rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
            {meta.title}
          </span>
        ) : null}
      </div>
    );
  }

  if (media.type === 'document') {
    const filename = media.url.split('/').pop() ?? 'Document';
    return (
      <div className={`flex items-center gap-3 rounded-xl px-3.5 py-3 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lake-blue/10 text-2xl">
          📄
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">{filename}</p>
          <p className="text-[11px] text-foreground-muted">PDF · Tap to open</p>
        </div>
        <span className="shrink-0 text-[12px] text-foreground-muted">→</span>
      </div>
    );
  }

  if (media.type === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={media.url}
        alt=""
        className="h-[180px] w-full shrink-0 rounded-xl object-cover"
        loading="lazy"
      />
    );
  }

  // video
  return (
    <div className="relative h-[140px] w-full shrink-0 overflow-hidden rounded-xl bg-black/60">
      <div className="flex h-full items-center justify-center">
        <span className="text-4xl">🎥</span>
      </div>
    </div>
  );
}

function BulletinMediaStack({ media }: { media: BulletinMedia[] }) {
  if (media.length === 0) return null;
  if (media.length === 1) {
    return <BulletinMediaThumb media={media[0]} />;
  }
  // Multiple images: show first + count badge
  const first = media[0];
  return (
    <div className="relative">
      <BulletinMediaThumb media={first} />
      {media.length > 1 && first.type === 'image' ? (
        <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
          +{media.length - 1}
        </span>
      ) : null}
    </div>
  );
}

// ─── Individual post card ──────────────────────────────────────────────────────

function BulletinCard({ post }: { post: BulletinPost }) {
  const authorLabel = pinAuthorLabel(
    post.author ?? {
      id: '',
      username: null,
      first_name: null,
      last_name: null,
      image_url: null,
    },
  );
  const relTime = formatRelativeTime(post.created_at);
  const hasMedia = post.media.length > 0;

  return (
    <article
      className={`overflow-hidden rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
    >
      {/* Media stack */}
      {hasMedia ? (
        <div className="p-2.5 pb-0">
          <BulletinMediaStack media={post.media} />
        </div>
      ) : null}

      {/* Text body */}
      <div className="px-3.5 py-3 space-y-2">
        {/* Title */}
        {post.title ? (
          <p className="text-[14px] font-semibold leading-snug text-foreground">{post.title}</p>
        ) : null}

        {/* Body */}
        {post.body?.trim() ? (
          <p className="text-[13px] leading-relaxed text-foreground/85">{post.body.trim()}</p>
        ) : null}

        {/* Author + timestamp */}
        <div className="flex items-center gap-2 pt-0.5">
          {/* Avatar */}
          <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-[#c8d8e4]">
            {post.author?.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.author.image_url}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-lake-blue">
                {(
                  post.author?.username?.[0] ??
                  post.author?.first_name?.[0] ??
                  '?'
                ).toUpperCase()}
              </span>
            )}
          </div>

          <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-lake-blue">
            {authorLabel}
          </p>

          <p className="shrink-0 text-[11px] text-foreground-muted">{relTime}</p>
        </div>
      </div>

      {/* Interactions footer */}
      {(post.like_count > 0 || post.comment_count > 0) ? (
        <div className="flex items-center gap-3 border-t border-foreground/[0.06] px-3.5 py-2">
          {post.like_count > 0 ? (
            <span className="flex items-center gap-1 text-[12px] text-foreground-muted">
              <span>♥</span>
              <span>{post.like_count.toLocaleString()}</span>
            </span>
          ) : null}
          {post.comment_count > 0 ? (
            <span className="flex items-center gap-1 text-[12px] text-foreground-muted">
              <span>💬</span>
              <span>{post.comment_count.toLocaleString()}</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function BulletinEmpty() {
  return (
    <div className={`rounded-2xl px-4 py-5 text-center ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}>
      <p className="text-2xl">📋</p>
      <p className="mt-1.5 text-[13px] font-semibold text-foreground">Nothing posted yet</p>
      <p className="mt-0.5 text-[12px] text-foreground-muted">
        Be the first — share a meeting agenda, photo, or update for this area.
      </p>
    </div>
  );
}

// ─── Post CTA row ──────────────────────────────────────────────────────────────

function BulletinComposeRow({ entity }: { entity: DockEntity }) {
  // TODO: wire to compose modal with content_shape='territory_bulletin',
  //       territory_kind derived from entity.kind, territory_unit_id = entity.id
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition active:opacity-70 ${ENTRY_ROW_GLASS_CLASS}`}
      aria-label={`Post to ${entity.title} bulletin`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lake-blue/10 text-lake-blue">
        <IconSparkles className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-foreground">Post to bulletin</p>
        <p className="text-[12px] text-foreground-muted">
          Share an agenda, photo, video, or update
        </p>
      </div>
      <span className="shrink-0 text-foreground-muted text-[18px] leading-none">+</span>
    </button>
  );
}

// ─── Main section ──────────────────────────────────────────────────────────────

/**
 * Bulletin board section for a territory dock pane.
 * Only rendered when the account has unlocked this territory (passport visit).
 * The `entity.id` (= territory.units.id) is used as the bulletin anchor key.
 */
export function TerritoryBulletinSection({ entity }: { entity: DockEntity }) {
  const { posts, loading, error, reload } = useTerritoryBulletinFeed(entity.id);

  if (loading && posts.length === 0) {
    return (
      <DockSection title="Public Bulletin" subtitle="Meeting agendas, photos, and community updates">
        <DockSkeletonRows count={2} />
      </DockSection>
    );
  }

  return (
    <DockSection
      title="Public Bulletin"
      subtitle={
        posts.length > 0
          ? `${posts.length} update${posts.length === 1 ? '' : 's'} · open to all visitors`
          : 'Open to all visitors of this place'
      }
      badge={
        <span className="inline-flex items-center gap-1 rounded-full bg-lake-blue/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lake-blue">
          <IconLock className="h-3 w-3" />
          Unlocked
        </span>
      }
    >
      {/* Compose CTA */}
      <BulletinComposeRow entity={entity} />

      {/* Error state */}
      {error ? (
        <div className={`flex items-center justify-between rounded-2xl px-3.5 py-3 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}>
          <p className="text-[13px] text-foreground-muted">{error}</p>
          <button
            type="button"
            onClick={reload}
            className="shrink-0 text-[12px] font-semibold text-lake-blue"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* Feed */}
      {!error && posts.length === 0 && !loading ? <BulletinEmpty /> : null}

      {posts.map((post) => (
        <BulletinCard key={post.id} post={post} />
      ))}
    </DockSection>
  );
}
