'use client';

import { useAuthSafe } from '@/features/auth';
import { useAccountLevel } from '@/features/xp/logic/useAccountLevel';
import { getLevelTier } from '@/features/xp/logic/levelTiers';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { DockSection, DockSkeletonRows } from '@/features/map/dockCore/panes/DockPaneShell';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';

/** Big level number, progress bar to the next level, and the XP breakdown by
 * source ("why is my level going up").
 * `embedded` — body only for Standing segments (no shell). */
export default function LevelDockCard({ embedded = false }: { embedded?: boolean }) {
  const { openAccount, openDockCard } = useMapDock();
  const { account } = useAuthSafe();
  const { level, loading } = useAccountLevel(account?.id);
  const tier = getLevelTier(level?.level ?? 1);

  const body = (
    <>
      <DockSection title="Current level">
        {loading && !level ? (
          <DockSkeletonRows count={2} />
        ) : level ? (
          <div
            className={`overflow-hidden rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} px-4 py-5 text-center`}
          >
            <p className="text-[13px] font-medium uppercase tracking-wide text-foreground-muted">
              {tier.name}
            </p>
            <p className="mt-1 text-[40px] font-bold leading-none tabular-nums text-foreground">
              {level.level}
            </p>
            {level.level < 99 ? (
              <>
                <div className="mx-auto mt-4 h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-black/[0.08]">
                  <span
                    className="block h-full rounded-full bg-lake-blue transition-[width] duration-300"
                    style={{ width: `${Math.round(level.progressPct * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-[12px] tabular-nums text-foreground-muted">
                  {level.totalXp - level.xpForCurrentLevel} / {level.xpForNextLevel - level.xpForCurrentLevel} XP
                  to Level {level.level + 1}
                </p>
              </>
            ) : (
              <p className="mt-2 text-[12px] text-foreground-muted">Max level reached</p>
            )}
          </div>
        ) : null}
      </DockSection>

      <DockSection
        title="Where it came from"
        subtitle="Collecting objects and unlocking areas both count"
      >
        {loading && !level ? <DockSkeletonRows count={2} /> : null}
        {!loading && level && level.breakdown.length === 0 ? (
          <p className="px-0.5 text-[13px] text-foreground-muted">
            Collect an object or unlock a new area to start earning XP.
          </p>
        ) : null}
        {level?.breakdown.length ? (
          <div
            className={`overflow-hidden rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} divide-y divide-[rgb(var(--map-ink-subtle))]`}
          >
            {level.breakdown.map((row) => (
              <div
                key={row.sourceType}
                className="flex items-center justify-between gap-3 px-3.5 py-3"
              >
                <span className="truncate text-[14px] font-medium text-foreground">
                  {row.label}
                </span>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-lake-blue">
                  +{row.xp} XP
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </DockSection>
    </>
  );

  if (embedded) return body;

  return (
    <DockCardShell
      titleMode="sub"
      backLabel="Account"
      onBack={() => openAccount()}
      title="Level"
      subtitle={level ? `${tier.name} · ${level.totalXp} XP total` : undefined}
    >
      {body}
    </DockCardShell>
  );
}
