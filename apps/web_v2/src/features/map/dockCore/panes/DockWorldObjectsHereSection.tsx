'use client';

/**
 * DockWorldObjectsHereSection — "Finds here" for a CTU.
 *
 * Visual priority:
 *   1. Collectibles — hero scoreboard + 3D model chips + progress (primary gamification)
 *   2. Discoveries   — landmark finds (collect+stay) + check-in spots + info objects
 *   3. Props         — silently excluded (see verb / atmosphere only)
 *
 * Classification is purely two-axis: classifyObject(interaction, onCollect).
 * Purpose never drives display logic.
 *
 * Each discovery shows a verb-specific icon and hint so users know exactly
 * what happens when they walk up to it.
 */

import { useEffect, useState } from 'react';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import {
  DockSection,
  ENTRY_ROW_GLASS_CLASS,
} from '@/features/map/dockCore/panes/DockPaneShell';
import {
  IconCheck,
  IconMapPin,
  IconRoute,
  IconSparkles,
} from '@/features/map/dockCore/core/icons';
import { WorldModelPreviewCanvas } from '@/features/map/game/world/WorldModelPreviewCanvas';
import { classifyObject, type ObjectClass } from '@/features/map/game/world/modelVerbs';
import { resolveWorldModelUrl } from '@/features/map/game/world/catalog';

// ── Types ─────────────────────────────────────────────────────────────────────

type ObjectModel = {
  slug: string;
  name: string;
  filePath: string;
  category: string;
  interaction: string | null;
  onCollect: string | null;
  total: number;
  collected: number;
  remaining: number;
};

type ObjectsResponse = {
  total: number;
  collectedTotal: number;
  remainingTotal: number;
  signedIn: boolean;
  models: ObjectModel[];
};

// ── Data hook ─────────────────────────────────────────────────────────────────

function useTerritoryObjects(unitId: string): {
  data: ObjectsResponse | null;
  loading: boolean;
} {
  const [data, setData] = useState<ObjectsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/territory/units/${unitId}/objects?kind=ctu`, {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!res.ok) return;
        setData((await res.json()) as ObjectsResponse);
      } catch {
        // keep prior state on abort
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [unitId]);

  return { data, loading };
}

// ── Discovery verb meta ────────────────────────────────────────────────────────

type DiscoveryMeta = {
  icon: React.FC<{ className?: string }>;
  label: string;
  foundHint: string;
  notFoundHint: string;
  accentClass: string;
  badgeClass: string;
};

function discoveryMeta(cls: ObjectClass): DiscoveryMeta {
  switch (cls) {
    case 'check_in':
      return {
        icon: IconRoute,
        label: 'Check-in',
        foundHint: 'Checked in',
        notFoundHint: 'Walk up to check in',
        accentClass: 'bg-emerald-500/15 text-emerald-400',
        badgeClass: 'bg-emerald-500/15 text-emerald-400',
      };
    case 'info':
      return {
        icon: IconSparkles,
        label: 'Info',
        foundHint: 'Viewed',
        notFoundHint: 'Tap to learn more',
        accentClass: 'bg-amber-500/15 text-amber-400',
        badgeClass: 'bg-amber-500/15 text-amber-400',
      };
    default: // discovery (collect+stay)
      return {
        icon: IconMapPin,
        label: 'Landmark',
        foundHint: 'Found',
        notFoundHint: 'Walk up to discover',
        accentClass: 'bg-lake-blue/15 text-lake-blue',
        badgeClass: 'bg-lake-blue/15 text-lake-blue',
      };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function progressPct(collected: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((collected / total) * 100));
}

// ── Collectible chip ──────────────────────────────────────────────────────────

function CollectibleChip({ model }: { model: ObjectModel }) {
  const done = model.remaining === 0 && model.total > 0;
  const pct = progressPct(model.collected, model.total);
  const url = resolveWorldModelUrl(model.filePath, model.slug);

  return (
    <div className="flex min-w-[6.5rem] flex-col gap-2">
      <div
        className={`relative overflow-hidden rounded-xl border transition-colors ${
          done ? 'border-lake-blue/40 bg-lake-blue/[0.06]' : 'border-white/8 bg-white/[0.04]'
        }`}
        style={{ height: 88 }}
      >
        <WorldModelPreviewCanvas url={url} transparent className="h-full w-full" />
        {done && (
          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-lake-blue shadow-sm">
            <IconCheck className="h-3 w-3 text-white" />
          </span>
        )}
        {!done && model.remaining > 0 && (
          <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-white">
            {model.remaining} left
          </span>
        )}
      </div>

      <div className="px-0.5">
        <p className="truncate text-[12px] font-semibold text-foreground">{model.name}</p>
        <p className="mt-0.5 text-[10px] tabular-nums text-foreground-muted">
          {model.collected}/{model.total}
        </p>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-black/[0.10]">
        <span
          className={`block h-full rounded-full transition-[width] duration-500 ${
            done ? 'bg-lake-blue' : 'bg-lake-blue/70'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Collectibles section ──────────────────────────────────────────────────────

function CollectiblesSection({
  models,
  territory,
  signedIn,
}: {
  models: ObjectModel[];
  territory: string;
  signedIn: boolean;
}) {
  const total     = models.reduce((s, m) => s + m.total, 0);
  const collected = models.reduce((s, m) => s + m.collected, 0);
  const remaining = models.reduce((s, m) => s + m.remaining, 0);
  const pct       = progressPct(collected, total);
  const complete  = total > 0 && remaining === 0;

  return (
    <DockSection
      title="Collectibles"
      subtitle={
        complete
          ? `All ${total} cleared in ${territory}`
          : collected === 0
            ? `${total} on the map`
            : `${collected} of ${total} · ${remaining} still out`
      }
    >
      {/* Hero scoreboard */}
      <div className={`rounded-2xl px-3.5 py-3.5 ${ENTRY_ROW_GLASS_CLASS}`}>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
              {territory}
            </p>
            {signedIn ? (
              <p className="mt-1 text-[26px] font-bold tabular-nums leading-none text-foreground">
                {collected}
                <span className="text-[16px] font-semibold text-foreground-muted">
                  /{total}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-[17px] font-semibold text-foreground-muted">
                {total} collectibles
              </p>
            )}
            <p className="mt-1.5 text-[12px] text-foreground-muted">
              {!signedIn
                ? 'Sign in to track your progress'
                : complete
                  ? 'Area cleared'
                  : collected === 0
                    ? 'None collected yet'
                    : `${pct}% collected`}
            </p>
          </div>
          {signedIn && (
            <div className="shrink-0 text-right">
              <p className={`text-[20px] font-bold tabular-nums ${complete ? 'text-lake-blue' : 'text-foreground-muted'}`}>
                {complete ? '✓' : remaining}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
                {complete ? 'Done' : 'left'}
              </p>
            </div>
          )}
        </div>

        {signedIn && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/[0.08]">
            <span
              className={`block h-full rounded-full transition-[width] duration-500 ${
                complete ? 'bg-lake-blue' : 'bg-lake-blue/75'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      {/* 3D model chips */}
      <div className="flex gap-3 overflow-x-auto pb-0.5 scrollbar-none">
        {models.map((m) => (
          <CollectibleChip key={m.slug} model={m} />
        ))}
      </div>
    </DockSection>
  );
}

// ── Discovery row ─────────────────────────────────────────────────────────────

function DiscoveryRow({
  model,
  cls,
}: {
  model: ObjectModel;
  cls: ObjectClass;
}) {
  const found = model.collected > 0;
  const meta  = discoveryMeta(cls);
  const Icon  = meta.icon;

  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      {/* Verb-specific icon */}
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          found ? meta.accentClass : 'bg-foreground/5 text-foreground-muted/50'
        }`}
      >
        {found ? (
          <IconCheck className="h-3.5 w-3.5" />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-foreground">{model.name}</p>
        <p className="mt-0.5 text-[11px] text-foreground-muted">
          {found ? meta.foundHint : meta.notFoundHint}
        </p>
      </div>

      {/* Status + verb type badge */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        {found ? (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badgeClass}`}>
            {meta.foundHint}
          </span>
        ) : (
          <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-medium text-foreground-muted">
            Not yet
          </span>
        )}
        <span className="text-[9px] font-semibold uppercase tracking-wide text-foreground-muted/40">
          {meta.label}
        </span>
      </div>
    </div>
  );
}

// ── Discoveries section ───────────────────────────────────────────────────────

function DiscoveriesSection({
  models,
  classMap,
}: {
  models: ObjectModel[];
  classMap: Map<string, ObjectClass>;
}) {
  const foundCount = models.filter((m) => m.collected > 0).length;

  return (
    <DockSection
      title="Discoveries"
      subtitle={
        foundCount === models.length && models.length > 0
          ? `All ${models.length} found`
          : foundCount > 0
            ? `${foundCount} of ${models.length} found`
            : `${models.length} to discover`
      }
    >
      <div
        className={`overflow-hidden rounded-2xl ${ENTRY_ROW_GLASS_CLASS} divide-y divide-[rgb(var(--map-ink-subtle))]`}
      >
        {models.map((m) => (
          <DiscoveryRow
            key={m.slug}
            model={m}
            cls={classMap.get(m.slug) ?? 'discovery'}
          />
        ))}
      </div>
    </DockSection>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <DockSection title="Finds here" subtitle="Loading…">
      <div className="space-y-2" aria-hidden>
        <div className={`h-20 animate-pulse rounded-2xl ${ENTRY_ROW_GLASS_CLASS}`} />
        <div className="flex gap-3">
          <div className={`h-28 w-24 animate-pulse rounded-xl ${ENTRY_ROW_GLASS_CLASS}`} />
          <div className={`h-28 w-24 animate-pulse rounded-xl ${ENTRY_ROW_GLASS_CLASS}`} />
          <div className={`h-28 w-24 animate-pulse rounded-xl ${ENTRY_ROW_GLASS_CLASS}`} />
        </div>
      </div>
    </DockSection>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ territory }: { territory: string }) {
  return (
    <DockSection title="Finds here" subtitle={territory}>
      <div className={`rounded-2xl px-3.5 py-4 ${ENTRY_ROW_GLASS_CLASS}`}>
        <p className="text-[14px] font-semibold text-foreground">Nothing placed yet</p>
        <p className="mt-1 text-[13px] leading-snug text-foreground-muted">
          No world objects here yet — check back as more land on the map.
        </p>
      </div>
    </DockSection>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function DockWorldObjectsHereSection({ entity }: { entity: DockEntity }) {
  const { data, loading } = useTerritoryObjects(entity.id);

  if (loading && !data) return <LoadingSkeleton />;
  if (!data || data.total === 0) return <EmptyState territory={entity.title} />;

  // ── Tier split ────────────────────────────────────────────────────────────
  const collectibles: ObjectModel[] = [];
  const discoveries: ObjectModel[]  = [];
  const classMap = new Map<string, ObjectClass>();

  for (const m of data.models) {
    const cls = classifyObject(m.interaction, m.onCollect);
    classMap.set(m.slug, cls);

    if (cls === 'collectible') {
      collectibles.push(m);
    } else if (cls === 'discovery' || cls === 'check_in' || cls === 'info') {
      discoveries.push(m);
    }
    // prop / route / unlock / redeem / challenge → silently excluded
  }

  const hasCollectibles = collectibles.length > 0;
  const hasDiscoveries  = discoveries.length > 0;

  if (!hasCollectibles && !hasDiscoveries) {
    return <EmptyState territory={entity.title} />;
  }

  return (
    <div className="space-y-5">
      {hasCollectibles && (
        <CollectiblesSection
          models={collectibles}
          territory={entity.title}
          signedIn={data.signedIn}
        />
      )}
      {hasDiscoveries && (
        <DiscoveriesSection
          models={discoveries}
          classMap={classMap}
        />
      )}
    </div>
  );
}
