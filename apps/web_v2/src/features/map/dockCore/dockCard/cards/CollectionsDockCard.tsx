'use client';

import { useAccountCollections } from '@/features/collections/useAccountCollections';
import { useAuthSafe } from '@/features/auth';
import { usePassport } from '@/features/accountTerritories/store/usePassport';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { DockSection, DockSkeletonRows } from '@/features/map/dockCore/panes/DockPaneShell';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function rewardLabel(reward: { type: string; amount?: number; item?: string } | null): string {
  if (!reward) return 'Collected';
  if (reward.type === 'hearts') {
    const n = reward.amount ?? 1;
    return `+${n} heart${n === 1 ? '' : 's'}`;
  }
  if (reward.type === 'credits') return `+${reward.amount ?? 1} credit${(reward.amount ?? 1) === 1 ? '' : 's'}`;
  if (reward.type === 'loot' && reward.item) return `+${reward.item}`;
  return 'Logged';
}

/** Collections — statewide per-model totals + the account's recent finds.
 * `embedded` — body only for Standing segments (no shell). */
export default function CollectionsDockCard({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const { openAccount, openDockCard } = useMapDock();
  const { account } = useAuthSafe();
  const { collections, loading } = useAccountCollections(account?.id);
  const { passport } = usePassport(account?.id);

  const body = (
    <>
      <DockSection
        title="Collectibles"
        subtitle={
          collections
            ? `${collections.total} of ${collections.availableTotal} on the map`
            : undefined
        }
      >
        {loading && !collections ? <DockSkeletonRows count={3} /> : null}
        {!loading && collections?.byModel.length === 0 ? (
          <p className="px-0.5 text-[13px] text-foreground-muted">
            Nothing collected yet — find a heart on the map and tap Collect.
          </p>
        ) : null}
        {collections?.byModel.map((m) => {
          const pct =
            m.availableTotal > 0 ? Math.min(100, (m.count / m.availableTotal) * 100) : 0;
          return (
            <div key={m.slug} className="px-0.5 py-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                  <span className="block truncate text-[14px] font-medium text-foreground">
                    {m.name}
                  </span>
                  {m.xp > 0 ? (
                    <span className="mt-0.5 block text-[12px] font-semibold tabular-nums text-lake-blue">
                      +{m.xp} XP each
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-foreground-muted">
                  {m.count} of {m.availableTotal}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.08]">
                <span
                  className={`block h-full rounded-full transition-[width] duration-300 ${
                    m.slug === 'heart-quaternius' ? 'bg-[#c45c6a]' : 'bg-lake-blue'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </DockSection>

      <DockSection title="Recent finds">
        {loading && !collections ? (
          <DockSkeletonRows count={3} />
        ) : collections && collections.recent.length > 0 ? (
          <div
            className={`overflow-hidden rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} divide-y divide-[rgb(var(--map-ink-subtle))]`}
          >
            {collections.recent.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-foreground">
                    {item.model?.name ?? 'Collected object'}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-foreground-muted">
                    {timeAgo(item.collectedAt)}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] font-semibold text-lake-blue">
                  {rewardLabel(item.reward)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-0.5 text-[13px] text-foreground-muted">
            Your most recent finds will show up here.
          </p>
        )}
      </DockSection>
    </>
  );

  if (embedded) return body;

  return (
    <DockCardShell
      titleMode="sub"
      backLabel="Account"
      onBack={() => openAccount()}
      title="Collections"
      subtitle={
        collections
          ? `${collections.hearts.collected} of ${collections.hearts.available} hearts${
              passport ? ` · Level ${passport.level.level}` : ''
            }`
          : passport
            ? `Level ${passport.level.level} · ${passport.level.totalXp} XP`
            : undefined
      }
    >
      {body}
    </DockCardShell>
  );
}
