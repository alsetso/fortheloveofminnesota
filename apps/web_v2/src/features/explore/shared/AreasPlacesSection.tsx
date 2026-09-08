'use client';

/**
 * Shared Areas & Places block — unlocked territory progress.
 * Today uses `summary` (compact dock). Discover uses `explore`
 * (section header + horizontal kind cards).
 */

import { useMemo } from 'react';
import { DiscoverSectionHeader } from '@/features/discover/DiscoverChrome';
import type { TodayRecord } from '@/features/today/records/records';
import type {
  PassportKindProgress,
  PassportState,
  PassportUnlock,
} from '@/features/accountTerritories/store/usePassport';
import { emptyPassportKindProgress } from '@/features/accountTerritories/store/passportKinds';

const CTU_KIND = 'ctu';

const KIND_SHORT: Record<string, string> = {
  ctu: 'City / township',
  county: 'County',
  school_district: 'School district',
  district: 'Congressional',
  senate_district: 'Senate',
  house_district: 'House',
};

/** Cities & towns lead — hardest passport layer. */
function sortKindsCtuFirst<T extends { unitKind: string }>(kinds: T[]): T[] {
  return [...kinds].sort((a, b) => {
    if (a.unitKind === CTU_KIND && b.unitKind !== CTU_KIND) return -1;
    if (b.unitKind === CTU_KIND && a.unitKind !== CTU_KIND) return 1;
    return 0;
  });
}

function Pulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-black/[0.06] ${className ?? ''}`} />;
}

function ProgressBar({
  value,
  max,
}: {
  value: number;
  max: number;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.08]">
      <span
        className="block h-full rounded-full bg-lake-blue transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function formatUnlockedPct(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return '0%';
  if (pct < 0.1) return '<0.1%';
  if (pct < 10) return `${pct.toFixed(1)}%`;
  if (pct >= 99.95 && pct < 100) return '99.9%';
  return `${Math.round(pct)}%`;
}

/**
 * Cities & Towns (CTU) is the only territory kind surfaced in the product.
 * All other kinds are tracked in presence but hidden from all UI surfaces.
 */
const PRIMARY_KINDS = new Set(['ctu']);

export function passportStanding(passport: PassportState | null | undefined): {
  unlockedList: PassportUnlock[];
  unlockedTotal: number | null;
  areasAvailable: number | null;
  minnesotaUnlockedPct: number | null;
} {
  if (!passport) {
    return {
      unlockedList: [],
      unlockedTotal: null,
      areasAvailable: null,
      minnesotaUnlockedPct: null,
    };
  }
  const unlockedList = passport.unlocked ?? [];
  const unlockedTotal = passport.unlockedTotal ?? unlockedList.length;
  // Sum only primary kinds (county + ctu + school_district = 3,108 max).
  // Legislative / congressional contribute to passport bars but must not
  // inflate the denominator — the server already excludes them from unlockedTotal.
  const areasAvailable = passport.kinds
    .filter((k) => PRIMARY_KINDS.has(k.unitKind))
    .reduce((sum, k) => sum + (Number(k.total) || 0), 0);
  const minnesotaUnlockedPct =
    areasAvailable > 0 ? (unlockedTotal / areasAvailable) * 100 : 0;
  return { unlockedList, unlockedTotal, areasAvailable, minnesotaUnlockedPct };
}

function KindProgressCard({
  kind,
  onOpen,
  compact = false,
}: {
  kind: PassportKindProgress;
  onOpen: () => void;
  /** Tighter card for Today dock summary. */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      role="listitem"
      onClick={onOpen}
      className={`shrink-0 snap-start rounded-[14px] border border-black/[0.08] bg-white/85 text-left shadow-[0_1px_0_rgba(0,0,0,0.04)] transition active:scale-[0.98] ${
        compact
          ? 'w-[min(52vw,188px)] px-3.5 py-3'
          : 'w-[min(58vw,220px)] px-4 py-3.5'
      }`}
    >
      <span className="block truncate text-[14px] font-semibold leading-snug text-foreground">
        {kind.label}
      </span>
      <span className="mt-1 block text-[12px] tabular-nums text-foreground-muted">
        {kind.unlocked.toLocaleString()} of {kind.total.toLocaleString()}
      </span>
      <div className="mt-3">
        <ProgressBar value={kind.unlocked} max={kind.total} />
      </div>
    </button>
  );
}

function KindProgressCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="listitem"
      className={`shrink-0 snap-start rounded-[14px] border border-black/[0.06] bg-black/[0.03] ${
        compact
          ? 'w-[min(52vw,188px)] px-3.5 py-3'
          : 'w-[min(58vw,220px)] px-4 py-3.5'
      }`}
      aria-hidden
    >
      <Pulse className="h-3.5 w-28" />
      <Pulse className="mt-2 h-3 w-16" />
      <Pulse className="mt-3 h-2 w-full rounded-full" />
    </div>
  );
}

const KINDS_CAROUSEL_CLASS =
  'flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden';

function KindProgressCarousel({
  kinds,
  onOpenKind,
  compact = false,
  className = '',
}: {
  kinds: PassportKindProgress[];
  onOpenKind: (kind: PassportKindProgress) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`${KINDS_CAROUSEL_CLASS} ${className}`} role="list">
      {kinds.map((kind) => (
        <KindProgressCard
          key={kind.unitKind}
          kind={kind}
          compact={compact}
          onOpen={() => onOpenKind(kind)}
        />
      ))}
    </div>
  );
}

type Props = {
  accountId: string | null;
  passport: PassportState | null;
  loading: boolean;
  /** summary = Today snapshot; explore = full Explore / Discover workspace */
  variant?: 'summary' | 'explore';
  onSelectRecord: (record: TodayRecord) => void;
  /**
   * When set, kind progress taps open this instead of the territory_kind sheet
   * (Discover → `/discover/:slug`).
   */
  onOpenKind?: (kind: PassportKindProgress) => void;
  /** Optional search filter (Explore). */
  query?: string;
};

export function AreasPlacesSection({
  accountId,
  passport,
  loading,
  variant = 'summary',
  onSelectRecord,
  onOpenKind,
  query = '',
}: Props) {
  const pending = Boolean(accountId) && !passport;
  const { unlockedList, unlockedTotal, areasAvailable, minnesotaUnlockedPct } =
    useMemo(() => passportStanding(passport), [passport]);

  const q = query.trim().toLowerCase();
  const explore = variant === 'explore';

  const filteredKinds = useMemo(() => {
    const kinds =
      passport?.kinds && passport.kinds.length > 0
        ? passport.kinds
        : emptyPassportKindProgress();
    const matched = !q
      ? kinds
      : kinds.filter(
          (k) =>
            k.label.toLowerCase().includes(q) ||
            (KIND_SHORT[k.unitKind] ?? k.unitKind).toLowerCase().includes(q),
        );
    return sortKindsCtuFirst(matched.filter((k) => PRIMARY_KINDS.has(k.unitKind)));
  }, [passport?.kinds, q]);

  const openKind = (kind: PassportKindProgress) => {
    if (onOpenKind) {
      onOpenKind(kind);
      return;
    }
    onSelectRecord({
      kind: 'territory_kind',
      kindProgress: kind,
      unlocked: unlockedList.filter((u) => u.unitKind === kind.unitKind),
    });
  };

  const showAreasHeading =
    Boolean(accountId) &&
    (pending || filteredKinds.length > 0 || (explore && !q));

  const kindsCarousel = (
    kinds: PassportKindProgress[],
    { compact = false, className = 'mt-3 px-5' }: { compact?: boolean; className?: string } = {},
  ) => (
    <KindProgressCarousel
      kinds={kinds}
      onOpenKind={openKind}
      compact={compact}
      className={className}
    />
  );

  if (!accountId) {
    if (!explore) return null;
    const guestKinds = emptyPassportKindProgress();
    return (
      <section>
        <DiscoverSectionHeader title="Unlocked areas" />
        <p className="mt-2 px-5 text-[14px] leading-relaxed text-foreground-muted">
          Sign in to stamp cities and townships with Find Me.
        </p>
        {kindsCarousel(guestKinds.filter((k) => PRIMARY_KINDS.has(k.unitKind)))}
      </section>
    );
  }

  const pctLabel =
    minnesotaUnlockedPct != null ? formatUnlockedPct(minnesotaUnlockedPct) : null;
  const exploreSubtitle = pending
    ? 'Loading how much of Minnesota you’ve unlocked…'
    : unlockedTotal === 0
      ? 'You haven’t unlocked Minnesota yet. Start roaming to claim new cities and townships.'
      : pctLabel
        ? `You’ve unlocked ${pctLabel} of Minnesota. Keep going to new cities and townships.`
        : 'Stamp Minnesota’s cities and townships as you roam with Find Me.';

  return (
    <section>
      {showAreasHeading ? (
        explore ? (
          <>
            <DiscoverSectionHeader title="Unlocked areas" />
            <div className="mt-2 px-5">
              {pctLabel && !pending && unlockedTotal != null && areasAvailable != null ? (
                <button
                  type="button"
                  onClick={() =>
                    onSelectRecord({
                      kind: 'minnesota',
                      areasUnlocked: unlockedTotal,
                      areasAvailable,
                      kinds: passport?.kinds ?? [],
                    })
                  }
                  className="w-full text-left transition active:opacity-70"
                >
                  <p className="text-[14px] leading-snug text-foreground-muted">
                    You&apos;ve unlocked{' '}
                    <span className="font-semibold tabular-nums text-foreground">
                      {pctLabel}
                    </span>{' '}
                    of Minnesota. Keep going to new cities and townships.
                  </p>
                </button>
              ) : (
                <p className="text-[14px] leading-snug text-foreground-muted">
                  {exploreSubtitle}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="px-5">
            <h2 className="text-[13px] font-semibold text-foreground">Unlocked areas</h2>
          </div>
        )
      ) : null}

      {pending ? (
        <div
          className={`${KINDS_CAROUSEL_CLASS} mb-1 mt-3 px-5`}
          aria-busy="true"
          aria-label="Loading areas"
        >
          {[0, 1, 2, 3].map((i) => (
            <KindProgressCardSkeleton key={i} compact={!explore} />
          ))}
        </div>
      ) : filteredKinds.length > 0 ? (
        kindsCarousel(filteredKinds, { compact: !explore })
      ) : q ? (
        <p className="mt-2 px-5 text-[14px] text-foreground-muted">
          No territory types match.
        </p>
      ) : explore ? (
        <p className="mt-2 px-5 text-[14px] text-foreground-muted">
          Cities and townships unlock as you visit them with Find Me.
        </p>
      ) : null}

      {!pending && !explore && unlockedList.length === 0 && !loading ? (
        <p className="mt-2 px-5 text-[14px] text-foreground-muted">
          No stamps yet — turn on Find Me and start roaming.
        </p>
      ) : null}
    </section>
  );
}
