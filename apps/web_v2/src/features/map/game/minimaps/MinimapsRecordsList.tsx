'use client';

/**
 * Records pane — what's unlocked. Grouped list of passport stamps.
 */

import { useMemo } from 'react';
import { useAuthSafe } from '@/features/auth';
import {
  passportStanding,
} from '@/features/explore/shared/AreasPlacesSection';
import {
  usePassport,
  type PassportKindProgress,
  type PassportUnlock,
} from '@/features/accountTerritories/store/usePassport';
import { formatRelativeTime } from '@/features/community/pinPostApi';
import { MINIMAPS_NAV_CLEARANCE } from '@/features/map/game/minimaps/minimapsTabs';
import { safePadTop } from '@/lib/despia/safeArea';

const KIND_LABEL: Record<string, string> = {
  county: 'Counties',
  ctu: 'Cities & towns',
  school_district: 'School districts',
  legislative: 'Legislative districts',
  congressional: 'Congressional districts',
  senate_district: 'Senate districts',
  house_district: 'House districts',
};

const KIND_ORDER = [
  'ctu',
  'county',
  'school_district',
  'congressional',
  'legislative',
  'senate_district',
  'house_district',
];

function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind.replace(/_/g, ' ');
}

function kindRank(kind: string): number {
  const i = KIND_ORDER.indexOf(kind);
  return i === -1 ? 50 : i;
}

export function MinimapsRecordsList() {
  const { account } = useAuthSafe();
  const { passport, loading } = usePassport(account?.id ?? null);
  const { unlockedList, unlockedTotal, areasAvailable, minnesotaUnlockedPct } =
    useMemo(() => passportStanding(passport), [passport]);

  const groups = useMemo(() => {
    const byKind = new Map<string, PassportUnlock[]>();
    for (const u of unlockedList) {
      const list = byKind.get(u.unitKind) ?? [];
      list.push(u);
      byKind.set(u.unitKind, list);
    }
    for (const list of byKind.values()) {
      list.sort((a, b) => {
        const at = new Date(a.firstSeenAt).getTime();
        const bt = new Date(b.firstSeenAt).getTime();
        return bt - at;
      });
    }
    const kinds = passport?.kinds ?? [];
    const kindById = new Map(kinds.map((k) => [k.unitKind, k]));
    return [...byKind.entries()]
      .sort((a, b) => kindRank(a[0]) - kindRank(b[0]))
      .map(([unitKind, unlocks]) => ({
        unitKind,
        label: kindById.get(unitKind)?.label ?? kindLabel(unitKind),
        progress: kindById.get(unitKind) ?? null,
        unlocks,
      }));
  }, [unlockedList, passport?.kinds]);

  const pct =
    minnesotaUnlockedPct != null
      ? minnesotaUnlockedPct < 0.1 && minnesotaUnlockedPct > 0
        ? '<0.1%'
        : `${minnesotaUnlockedPct < 10 ? minnesotaUnlockedPct.toFixed(1) : Math.round(minnesotaUnlockedPct)}%`
      : null;

  return (
    <div
      className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4"
      data-minimaps="records"
      style={{
        paddingTop: safePadTop('4.25rem'),
        paddingBottom: `calc(${MINIMAPS_NAV_CLEARANCE} + 1rem)`,
      }}
    >
      <div className="mx-auto w-full max-w-md pb-2">
        <p className="text-[13px] text-white/50">
          {loading
            ? 'Loading your passport…'
            : unlockedTotal != null && areasAvailable
              ? `${unlockedTotal.toLocaleString()} of ${areasAvailable.toLocaleString()} areas · ${pct} of Minnesota`
              : unlockedTotal
                ? `${unlockedTotal.toLocaleString()} ${unlockedTotal === 1 ? 'place' : 'places'} stamped`
                : 'No stamps yet'}
        </p>

        {passport?.kinds && passport.kinds.length > 0 ? (
          <div className="mt-4 space-y-2">
            {passport.kinds
              .slice()
              .sort((a, b) => kindRank(a.unitKind) - kindRank(b.unitKind))
              .map((kind) => (
                <KindProgress key={kind.unitKind} kind={kind} />
              ))}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 space-y-2" aria-busy="true" aria-label="Loading records">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/[0.06]" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-6 text-center">
            <p className="text-[15px] font-semibold text-white/85">Nothing stamped yet</p>
            <p className="mt-1.5 text-[13px] leading-snug text-white/45">
              Walk a Minnesota city with Find Me on — each new place lands here.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {groups.map((group) => (
              <section key={group.unitKind}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    {group.label}
                  </h3>
                  <span className="text-[11px] tabular-nums text-white/35">
                    {group.progress
                      ? `${group.unlocks.length} of ${group.progress.total}`
                      : group.unlocks.length}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {group.unlocks.map((u) => (
                    <li
                      key={`${u.unitKind}:${u.unitId}`}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.06] px-3.5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-white">
                          {u.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-white/40">
                          {formatRelativeTime(u.firstSeenAt)}
                        </p>
                      </div>
                      {u.xpAmount > 0 ? (
                        <span className="shrink-0 text-[13px] font-bold tabular-nums text-[#5BA3FF]">
                          +{u.xpAmount} XP
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KindProgress({ kind }: { kind: PassportKindProgress }) {
  const pct = kind.total > 0 ? Math.min(100, (kind.unlocked / kind.total) * 100) : 0;
  return (
    <div className="rounded-2xl bg-white/[0.05] px-3.5 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[13px] font-medium text-white/85">
          {kind.label}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-white/40">
          {kind.unlocked} of {kind.total}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <span
          className="block h-full rounded-full bg-[#5BA3FF]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
