'use client';

/**
 * TerritoryHeroHeader — gamified passport stamp + civic identity card.
 *
 * Renders at the top of DockDetailsPane for every territory entity.
 * The passport stamp is the primary visual driver:
 *   • LOCKED  → frosted dashed-circle seal, civic teaser bullets, XP hint
 *   • UNLOCKED → filled lake-blue seal, "Passport Stamped", XP earned badge
 *   • LOADING  → animated skeleton
 *   • non-passport kinds → identity chips only (no stamp)
 *
 * Minnesota-specific copy is keyed by entity.kind so each territory type
 * (county, city/township, school district) speaks to what locals actually
 * care about.
 */

import Link from 'next/link';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import {
  IconCheck,
  IconLock,
  IconSparkles,
} from '@/features/map/dockCore/core/icons';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import {
  exploreLayerForEntityKind,
  getTerritoryLayer,
} from '@/features/map/territory/territoryLayers';
import { discoverKindPath } from '@/lib/routes/routePolicy';

// ─── Minnesota civic context ──────────────────────────────────────────────────

/** One-liner that grounds the entity in Minnesota geography / governance. */
const KIND_CONTEXT: Record<string, string> = {
  county: 'One of 87 Minnesota counties',
  ctu: 'Minnesota city, township, or town',
  school_district: 'Minnesota independent school district',
};

/**
 * Civic teasers — what unlocks after a passport visit.
 * Written for Minnesotans: commissioners, ISD boards, snow plowing aside.
 */
const KIND_UNLOCK_TEASERS: Record<string, readonly string[]> = {
  county: [
    'County Board of Commissioners & contacts',
    'Public bulletin — agendas, meeting photos, community updates',
    'Place AI — county services, history, facts',
  ],
  ctu: [
    'City council or township board & contacts',
    'Public bulletin — meeting agendas, photos, and updates',
    'Finds — collectibles placed inside this city or town',
    'Place AI — local government, services, history',
  ],
  school_district: [
    'School board members & district contacts',
    'Public bulletin — board meeting agendas and updates',
    'Place AI — district facts, enrollment, history',
  ],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KindChipRow({ entity }: { entity: DockEntity }) {
  const chipClass = `inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} text-foreground`;

  // School districts: subtitle is "ISD 11" — show it as a badge + kind badge
  const isISD =
    entity.kind === 'school_district' &&
    entity.subtitle?.startsWith('ISD');

  const context = KIND_CONTEXT[entity.kind];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isISD ? (
        <>
          <span className={chipClass}>{entity.subtitle}</span>
          <span className={chipClass}>School District</span>
        </>
      ) : (
        <span className={chipClass}>
          {entity.kindLabel ?? entity.subtitle ?? entity.kind}
        </span>
      )}
      {context ? (
        <span className="text-[11px] text-foreground-muted">{context}</span>
      ) : null}
    </div>
  );
}

function StampSkeleton() {
  return (
    <div
      className={`h-24 animate-pulse rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
    />
  );
}

function StampUnlocked({ xpEarned }: { xpEarned: number | null }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-lake-blue/10 ring-1 ring-lake-blue/20">
      <div className="flex items-center gap-4 px-4 py-3.5">
        {/* Filled seal */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-lake-blue/40 bg-lake-blue/15">
          <IconCheck className="h-5 w-5 text-lake-blue" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-lake-blue/70">
            Passport Stamped
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-foreground/80">
            You&apos;ve visited — full record unlocked.
          </p>
        </div>

        {xpEarned ? (
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-lake-blue/15 px-2.5 py-1">
            <IconSparkles className="h-3 w-3 text-lake-blue" />
            <span className="text-[12px] font-bold text-lake-blue">+{xpEarned}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StampLocked({ entity }: { entity: DockEntity }) {
  const teasers = KIND_UNLOCK_TEASERS[entity.kind] ?? [];

  return (
    <div
      className={`overflow-hidden rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
    >
      <div className="flex items-start gap-3.5 px-4 py-3.5">
        {/* Dashed seal — empty, waiting */}
        <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-foreground/20 bg-foreground/[0.03]">
          <IconLock className="h-4 w-4 text-foreground-muted" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/40">
            Locked
          </p>
          <p className="text-[14px] font-semibold leading-snug text-foreground">
            Earn your stamp
          </p>

          {teasers.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {teasers.map((teaser) => (
                <li
                  key={teaser}
                  className="flex items-baseline gap-2 text-[12px] leading-snug text-foreground-muted"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground/25" />
                  {teaser}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {/* XP hint footer */}
      <div className="flex items-center gap-1.5 border-t border-foreground/[0.06] px-4 py-2.5">
        <IconSparkles className="h-3 w-3 text-foreground-muted" />
        <p className="text-[11px] font-semibold text-foreground-muted">
          XP earned + full record unlocked when you visit in person
        </p>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export type TerritoryHeroHeaderProps = {
  entity: DockEntity;
  unlockable: boolean;
  loading: boolean;
  unlocked: boolean;
  locked: boolean;
  xpEarned: number | null;
  /**
   * Place page: kind lives in the identity strip above — skip chips,
   * keep stamp + browse link.
   */
  compact?: boolean;
};

export function TerritoryHeroHeader({
  entity,
  unlockable,
  loading,
  unlocked,
  locked,
  xpEarned,
  compact = false,
}: TerritoryHeroHeaderProps) {
  const layerSlug = exploreLayerForEntityKind(entity.kind);
  const layerLabel = layerSlug
    ? (getTerritoryLayer(layerSlug)?.label ?? null)
    : null;

  return (
    <div className="space-y-3">
      {!compact ? <KindChipRow entity={entity} /> : null}

      {/* Passport stamp — the gamification hero */}
      {unlockable ? (
        loading ? (
          <StampSkeleton />
        ) : unlocked ? (
          <StampUnlocked xpEarned={xpEarned} />
        ) : (
          <StampLocked entity={entity} />
        )
      ) : null}

      {/* "See all [kind]" explore link */}
      {layerSlug && layerLabel ? (
        <div>
          <Link
            href={discoverKindPath(layerSlug)}
            className={
              compact
                ? 'inline-flex items-center gap-1 text-[13px] font-semibold text-foreground-muted transition hover:text-foreground active:opacity-70'
                : 'inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-3 py-1 text-[12px] font-semibold text-foreground-muted transition hover:bg-black/[0.07] hover:text-foreground active:opacity-70'
            }
          >
            See all {layerLabel} →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
