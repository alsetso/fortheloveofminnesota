'use client';

/**
 * Hearts dock card — collect progress + recent heart finds.
 * Opened from the game header hearts chip.
 */

import { useAuthSafe } from '@/features/auth';
import { useAccountCollections } from '@/features/collections/useAccountCollections';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { DockSection, DockSkeletonRows } from '@/features/map/dockCore/panes/DockPaneShell';
import { IconHeart } from '@/features/map/dockCore/core/icons';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';

const HEART_SLUG = 'heart-quaternius';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function HeartsDockCard() {
  const { account } = useAuthSafe();
  const { collections, loading } = useAccountCollections(account?.id);

  const hearts = collections?.hearts ?? null;
  const remaining = hearts ? Math.max(0, hearts.available - hearts.collected) : 0;
  const pct =
    hearts && hearts.available > 0
      ? Math.min(100, (hearts.collected / hearts.available) * 100)
      : 0;
  const recentHearts =
    collections?.recent.filter((item) => item.model?.slug === HEART_SLUG) ?? [];

  return (
    <DockCardShell
      titleMode="center"
      eyebrow="Collectibles"
      title="Hearts"
      subtitle={
        hearts
          ? `${hearts.collected} of ${hearts.available} on the map`
          : undefined
      }
    >
      <div
        className={`rounded-2xl px-4 py-5 text-center ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
      >
        {loading && !hearts ? (
          <div className="mx-auto h-10 w-24 animate-pulse rounded-lg bg-map-ink-subtle" />
        ) : hearts ? (
          <>
            <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
              <IconHeart solid className="h-5 w-5 text-red-500" />
            </div>
            <p className="mt-3 text-4xl font-semibold tracking-tight tabular-nums text-foreground">
              {hearts.collected}
              <span className="text-[18px] font-medium text-foreground-muted">
                {' '}
                / {hearts.available}
              </span>
            </p>
            <div className="mx-auto mt-4 h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-black/[0.08]">
              <span
                className="block h-full rounded-full bg-[#c45c6a] transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] text-foreground-muted">
              {remaining > 0
                ? `${remaining} still out on the map`
                : hearts.available === 0
                  ? 'No hearts on the map yet'
                  : 'Every heart found — more may appear'}
            </p>
          </>
        ) : null}
      </div>

      <DockSection title="Recent hearts">
        {loading && !collections ? <DockSkeletonRows count={3} /> : null}
        {!loading && recentHearts.length === 0 ? (
          <p className="px-0.5 text-[13px] text-foreground-muted">
            Open the map and tap a heart to start collecting.
          </p>
        ) : null}
        {recentHearts.length > 0 ? (
          <div
            className={`overflow-hidden rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} divide-y divide-[rgb(var(--map-ink-subtle))]`}
          >
            {recentHearts.slice(0, 12).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 px-3.5 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-foreground">
                    {item.model?.name ?? 'Heart'}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-foreground-muted">
                    {timeAgo(item.collectedAt)}
                  </span>
                </span>
                {item.reward?.amount ? (
                  <span className="shrink-0 text-[12px] font-semibold text-[#c45c6a]">
                    +{item.reward.amount}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </DockSection>
    </DockCardShell>
  );
}
