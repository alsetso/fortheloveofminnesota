'use client';

/**
 * DockCityPane — ambient "Where You Are" panel for the active CTU.
 *
 * Becomes the default dock root when GPS resolves a CTU via
 * currentTerritoryStackStore. Five searchable tabs:
 *   Locals    — accounts with this city as home territory (avatar grid)
 *   Posts     — TerritoryBulletinSection for this CTU
 *   Directory — nearby directory pages (proximity-filtered by GPS coords)
 *   Officials — DockOfficeholdersSection for this CTU
 *   Nearby    — Mapbox POIs from /api/geo/nearby at user's position
 *
 * The search pill placeholder becomes "Search [City]" and typing here
 * filters the active tab in-place (via mapSearchStore).
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { DockCtuItem, DockEntity } from '@/features/map/dockCore/core/dockPanes';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { useMapSearchQuery, setMapSearchQuery } from '@/features/map/dockCore/store/mapSearchStore';
import { MAP_SHEET_BODY_CLASS, MAP_SHEET_SHELL_X } from '@/lib/map/mapChrome';
import { MAP_DOCK_GLASS_BORDER_CLASS, MAP_DOCK_GLASS_FILL_CLASS } from '@/features/map/dockCore/core/mapDockTokens';
import { IconChevronRight } from '@/features/map/dockCore/core/icons';
import { DockOfficeholdersSection } from '@/features/map/dockCore/panes/DockOfficeholdersSection';
import {
  getCurrentTerritoryStackSnapshot,
  subscribeCurrentTerritoryStack,
  useCurrentTerritoryStack,
} from '@/features/accountTerritories/store/currentTerritoryStackStore';
import { useAuthSafe } from '@/features/auth';
import { HOME_RESET_COOLDOWN_DAYS } from '@/features/accountTerritories/store/constants';
import type { CityLocalAccount } from '@/app/api/territory/units/[id]/locals/route';
import type { CityPost } from '@/app/api/territory/units/[id]/posts/route';
import type { CityDirectoryPage } from '@/app/api/territory/units/[id]/directory/route';
import type { MyRelationshipResponse } from '@/app/api/territory/units/[id]/my-relationship/route';
import { openContributeSheet } from '@/features/community/contributeSheetStore';

// ─── Types ───────────────────────────────────────────────────────────────────

type CityTab = 'locals' | 'posts' | 'directory' | 'officials' | 'nearby';
type PostTypeFilter = 'all' | 'photo' | 'video' | 'text';

type NearbyPlace = {
  id: string;
  name: string;
  category?: string;
  address?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function distanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function ctuToEntity(ctu: DockCtuItem): DockEntity {
  return {
    id: ctu.id,
    kind: 'ctu',
    title: ctu.name,
    kindLabel: ctu.kindLabel,
    subtitle: ctu.ctu_class
      ? ctu.ctu_class.charAt(0).toUpperCase() + ctu.ctu_class.slice(1).toLowerCase()
      : undefined,
  };
}

function accountDisplayName(a: CityLocalAccount): string {
  if (a.username) return `@${a.username}`;
  const parts = [a.first_name, a.last_name].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Member';
}

// ─── Relationship row ─────────────────────────────────────────────────────────

const RELATIONSHIP_CHIPS: { kind: 'live_here' | 'work_here'; label: string; activeLabel: string }[] = [
  { kind: 'live_here', label: 'Live here', activeLabel: 'Lives here' },
  { kind: 'work_here', label: 'Work here', activeLabel: 'Works here' },
];

function RelationshipRow({ ctuId, refreshToken = 0 }: { ctuId: string; refreshToken?: number }) {
  const { account } = useAuthSafe();
  const [kinds, setKinds] = useState<string[]>([]);
  const [homeLocked, setHomeLocked] = useState(false);
  const [homeResetAvailableAt, setHomeResetAvailableAt] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!account?.id) return;
    // refreshToken forces a re-fetch (e.g. after home is set)
    const key = `${account.id}::${ctuId}::${refreshToken}`;
    if (fetchedFor.current === key) return;
    fetchedFor.current = key;

    fetch(`/api/territory/units/${ctuId}/my-relationship`, { credentials: 'include' })
      .then((r) => r.json() as Promise<MyRelationshipResponse>)
      .then((data) => {
        setKinds(data.kinds ?? []);
        setHomeLocked(data.homeLocked ?? false);
        setHomeResetAvailableAt(data.homeResetAvailableAt ?? null);
      })
      .catch(() => {/* silent — non-critical */});
  }, [account?.id, ctuId, refreshToken]);

  const toggle = async (kind: 'live_here' | 'work_here') => {
    if (!account?.id || toggling) return;
    const isActive = kinds.includes(kind);

    // Block removing a locked live_here
    if (isActive && kind === 'live_here' && homeLocked) {
      const resetDate = homeResetAvailableAt
        ? new Date(homeResetAvailableAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : 'the cooldown ends';
      setError(`Home locked until ${resetDate}`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    setError(null);
    setToggling(kind);

    // Optimistic update
    setKinds((prev) =>
      isActive ? prev.filter((k) => k !== kind) : [...prev, kind],
    );

    try {
      const res = await fetch(`/api/territory/units/${ctuId}/my-relationship`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, action: isActive ? 'remove' : 'add' }),
      });
      const data = (await res.json()) as MyRelationshipResponse & { error?: string };
      if (!res.ok) {
        // Revert optimistic update
        setKinds((prev) =>
          isActive ? [...prev, kind] : prev.filter((k) => k !== kind),
        );
        setError(data.error ?? 'Could not update');
        setTimeout(() => setError(null), 3000);
        return;
      }
      setKinds(data.kinds ?? []);
      setHomeLocked(data.homeLocked ?? false);
      setHomeResetAvailableAt(data.homeResetAvailableAt ?? null);
    } catch {
      // Revert
      setKinds((prev) =>
        isActive ? [...prev, kind] : prev.filter((k) => k !== kind),
      );
      setError('Could not update');
      setTimeout(() => setError(null), 3000);
    } finally {
      setToggling(null);
    }
  };

  if (!account?.id) return null;

  return (
    <>
      {RELATIONSHIP_CHIPS.map((chip) => {
        const active = kinds.includes(chip.kind);
        const busy = toggling === chip.kind;
        const locked = active && chip.kind === 'live_here' && homeLocked;
        return (
          <button
            key={chip.kind}
            type="button"
            disabled={busy}
            onClick={() => void toggle(chip.kind)}
            aria-pressed={active}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 active:scale-[0.96] disabled:opacity-60 ${
              active
                ? 'bg-lake-blue text-white'
                : `${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} text-foreground-muted`
            }`}
          >
            {active ? (
              locked ? (
                <span className="text-[10px] leading-none">🔒</span>
              ) : busy ? (
                <span className="h-2.5 w-2.5 animate-spin rounded-full border border-white/40 border-t-white" />
              ) : (
                <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5 shrink-0" aria-hidden>
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )
            ) : busy ? (
              <span className="h-2.5 w-2.5 animate-spin rounded-full border border-foreground-muted/40 border-t-foreground-muted" />
            ) : (
              <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5 shrink-0" aria-hidden>
                <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
            {active ? chip.activeLabel : chip.label}
          </button>
        );
      })}
      {error ? (
        <p className="w-full text-[11px] font-medium text-red-600">{error}</p>
      ) : null}
    </>
  );
}

// ─── Set-as-home ─────────────────────────────────────────────────────────────

type HomeStatusData = {
  homeSetAt: string | null;
  homeResetAvailableAt: string | null;
  canReset: boolean;
  unitIds: string[];
  jurisdictions: { id: string; kind: string; name: string; kindLabel?: string }[];
};

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

/**
 * Modal overlay for confirming / blocking home territory setting.
 * Rendered inside the dock pane; uses a fixed full-screen backdrop.
 */
function SetHomeModal({
  ctu,
  onClose,
  onSuccess,
}: {
  ctu: DockCtuItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { account } = useAuthSafe();
  const stack = useCurrentTerritoryStack();
  const [homeStatus, setHomeStatus] = useState<HomeStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current home status
  useEffect(() => {
    if (!account?.id) return;
    fetch('/api/account-territories/home', { credentials: 'include' })
      .then((r) => r.json() as Promise<HomeStatusData>)
      .then((d) => setHomeStatus(d))
      .catch(() => setHomeStatus(null))
      .finally(() => setLoading(false));
  }, [account?.id]);

  const alreadyHome = homeStatus?.unitIds.includes(ctu.id) ?? false;
  const hasHome = Boolean(homeStatus?.homeSetAt);
  const canReset = homeStatus?.canReset ?? true;
  const locked = hasHome && !canReset;
  const resetAt = homeStatus?.homeResetAvailableAt ?? null;
  const daysLeft = resetAt ? daysUntil(resetAt) : 0;

  // Current home city name (first CTU jurisdiction in the snapshot)
  const currentHomeCityName = homeStatus?.jurisdictions.find(
    (j) => j.kind === 'ctu' && j.id !== ctu.id,
  )?.name ?? null;

  const canConfirm = !locked && !alreadyHome && Boolean(stack.coords);

  const handleConfirm = async () => {
    if (!canConfirm || !stack.coords || submitting) return;
    setSubmitting(true);
    setError(null);

    const jurisdictions = stack.jurisdictions.map((j) => ({
      id: j.id,
      kind: j.kind,
      name: j.name ?? '',
      kindLabel: j.kindLabel,
    }));

    try {
      const res = await fetch('/api/account-territories/home', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: stack.coords.lat,
          lng: stack.coords.lng,
          jurisdictions,
          confirm: true,
        }),
      });
      const data = (await res.json()) as { error?: string; resetAvailableAt?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not set home');
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    /* Fills the entire dock pane — no overlay, no backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set home territory"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-end bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl bg-[rgb(var(--bg-surface))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
      {/* Back / close row */}
      <div className={`${MAP_SHEET_SHELL_X} flex items-center gap-2 pb-2 pt-4`}>
        <button
          type="button"
          onClick={onClose}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition active:opacity-70 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} text-foreground-muted`}
        >
          <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" aria-hidden>
            <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <span className="truncate text-[13px] font-semibold text-foreground">
          {alreadyHome ? `${ctu.name} · Home` : 'Set home city'}
        </span>
      </div>

      <div className={`${MAP_SHEET_SHELL_X} space-y-5 overflow-y-auto pb-safe-or-8 pt-2`}>
        {loading ? (
          <div className="space-y-3">
            <div className="h-5 w-2/3 animate-pulse rounded-full bg-black/[0.08]" />
            <div className="h-4 w-1/2 animate-pulse rounded-full bg-black/[0.06]" />
            <div className="h-4 w-3/4 animate-pulse rounded-full bg-black/[0.06]" />
          </div>
        ) : alreadyHome ? (
          /* Already home */
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-[22px] font-bold text-foreground">🏠 {ctu.name}</p>
              <p className="text-[14px] font-semibold text-emerald-700">This is your home city</p>
              <p className="text-[13px] leading-relaxed text-foreground-muted">
                {locked && resetAt
                  ? `You can move your home on ${formatDate(resetAt)} — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} from now.`
                  : 'You can reset your home anytime from My Places.'}
              </p>
            </div>
            {locked && resetAt ? (
              <div className={`rounded-2xl px-4 py-3 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}>
                <p className="text-[12px] font-semibold text-amber-800">
                  🔒 Home can only be changed once every {HOME_RESET_COOLDOWN_DAYS} days
                </p>
                <p className="mt-0.5 text-[11px] text-foreground-muted">
                  Reset available {formatDate(resetAt)}
                </p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl bg-lake-blue py-3.5 text-[15px] font-semibold text-white transition active:opacity-80"
            >
              Got it
            </button>
          </div>
        ) : locked ? (
          /* Locked — can't change yet */
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-[22px] font-bold text-foreground">🔒 Home locked</p>
              <p className="text-[13px] leading-relaxed text-foreground-muted">
                {currentHomeCityName
                  ? `Your home is currently set to ${currentHomeCityName}.`
                  : 'Your home city is already set.'}{' '}
                Home can be changed once every {HOME_RESET_COOLDOWN_DAYS} days.
              </p>
              {resetAt ? (
                <p className="text-[13px] font-semibold text-foreground-muted">
                  Reset available in {daysLeft} day{daysLeft !== 1 ? 's' : ''} · {formatDate(resetAt)}
                </p>
              ) : null}
            </div>
            <div className={`rounded-2xl px-4 py-3 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}>
              <p className="text-[12px] font-semibold text-amber-800">
                You can set {ctu.name} as home once the cooldown expires.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl bg-black/[0.06] py-3.5 text-[15px] font-semibold text-foreground transition active:opacity-80"
            >
              Close
            </button>
          </div>
        ) : (
          /* Confirm */
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-[22px] font-bold text-foreground">
                {hasHome ? `Move home to ${ctu.name}?` : `Set ${ctu.name} as your home?`}
              </p>
              <p className="text-[13px] leading-relaxed text-foreground-muted">
                {hasHome && currentHomeCityName
                  ? `This replaces ${currentHomeCityName} as your home city.`
                  : `Marks you as a local of ${ctu.name}.`}{' '}
                You can change it again after {HOME_RESET_COOLDOWN_DAYS} days.
              </p>
            </div>

            {!stack.coords ? (
              <div className={`rounded-2xl px-4 py-3 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}>
                <p className="text-[12px] text-foreground-muted">
                  Enable location services to set your home city.
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-[12px] font-medium text-red-700">{error}</p>
            ) : null}

            <div className="flex gap-3 pb-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 rounded-2xl bg-black/[0.06] py-3.5 text-[15px] font-semibold text-foreground transition active:opacity-80 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={!canConfirm || submitting}
                className="flex-1 rounded-2xl bg-lake-blue py-3.5 text-[15px] font-semibold text-white transition active:opacity-80 disabled:opacity-40"
              >
                {submitting ? 'Saving…' : hasHome ? 'Move home' : 'Set as home'}
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function SetHomeButton({
  ctu,
  isHome,
  locked,
  resetAt,
  onOpen,
}: {
  ctu: DockCtuItem;
  isHome: boolean;
  locked: boolean;
  resetAt: string | null;
  onOpen: () => void;
}) {
  void ctu;
  if (isHome) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 active:scale-[0.96] ${
          locked
            ? `${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} text-amber-700`
            : 'bg-emerald-500/15 text-emerald-800'
        }`}
      >
        {locked ? (
          <>
            <span className="text-[10px] leading-none">🔒</span>
            Home · {resetAt ? `resets ${daysUntil(resetAt)}d` : 'locked'}
          </>
        ) : (
          <>
            <span className="text-[10px] leading-none">🏠</span>
            Home city
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 active:scale-[0.96] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} text-foreground-muted`}
    >
      <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5 shrink-0" aria-hidden>
        <path d="M6 1L1 5.5h1.5V11h3V7.5h1V11h3V5.5H11L6 1z" fill="currentColor" />
      </svg>
      Set as home
    </button>
  );
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────

const TABS: { id: CityTab; label: string }[] = [
  { id: 'locals', label: 'Locals' },
  { id: 'posts', label: 'Posts' },
  { id: 'directory', label: 'Directory' },
  { id: 'officials', label: 'Officials' },
  { id: 'nearby', label: 'Nearby' },
];

function TabBar({
  active,
  onChange,
}: {
  active: CityTab;
  onChange: (id: CityTab) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors duration-150 ${
            active === tab.id
              ? 'bg-lake-blue text-white'
              : `${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} text-foreground-muted`
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Locals tab ──────────────────────────────────────────────────────────────

function LocalsTab({
  ctuId,
  query,
}: {
  ctuId: string;
  query: string;
}) {
  const { openProfileCard } = useMapDock();
  const [locals, setLocals] = useState<CityLocalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    if (fetchedFor.current === ctuId) return;
    fetchedFor.current = ctuId;
    setLoading(true);
    setError(null);

    fetch(`/api/territory/units/${ctuId}/locals`)
      .then((r) => r.json() as Promise<{ locals?: CityLocalAccount[]; error?: string }>)
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setLocals(data.locals ?? []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [ctuId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return locals;
    return locals.filter((a) =>
      accountDisplayName(a).toLowerCase().includes(q) ||
      (a.first_name ?? '').toLowerCase().includes(q) ||
      (a.last_name ?? '').toLowerCase().includes(q),
    );
  }, [locals, query]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3 px-0.5">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div className="h-16 w-16 animate-pulse rounded-full bg-black/[0.06]" />
            <div className="h-2.5 w-14 animate-pulse rounded-full bg-black/[0.06]" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="px-0.5 text-[13px] text-foreground-muted">{error}</p>;
  }

  if (filtered.length === 0) {
    return (
      <p className="px-0.5 text-[13px] text-foreground-muted">
        {query ? 'No locals matching that search.' : 'No one has set this as their home city yet.'}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-5 px-0.5">
      {filtered.map((a) => (
        <button
          key={a.account_id}
          type="button"
          onClick={() => openProfileCard(a.account_id)}
          className="flex flex-col items-center gap-1 text-center transition active:opacity-70"
        >
          {/* Avatar */}
          <div className="relative h-16 w-16 overflow-hidden rounded-full bg-black/[0.06]">
            {a.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.image_url}
                alt={accountDisplayName(a)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-lake-blue/10 text-[22px] font-bold text-lake-blue/60">
                {(a.username ?? a.first_name ?? '?').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {/* Username / name */}
          <p className="w-full truncate text-[11px] font-medium text-foreground">
            {accountDisplayName(a)}
          </p>
          {/* Relationship label */}
          {a.relationship ? (
            <p className="w-full truncate text-[10px] font-medium text-foreground-muted/70">
              {a.relationship}
            </p>
          ) : null}
        </button>
      ))}
    </div>
  );
}

// ─── Posts tab ───────────────────────────────────────────────────────────────

const POST_TYPE_FILTERS: { id: PostTypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'photo', label: 'Photos' },
  { id: 'text', label: 'Text' },
  { id: 'video', label: 'Video' },
];

function formatRelative(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(isoStr).toLocaleDateString();
}

function PostAuthorLine({ author }: { author: CityPost['author'] }) {
  const name = author
    ? (author.username ? `@${author.username}` : [author.first_name, author.last_name].filter(Boolean).join(' ') || 'Member')
    : 'Member';
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-black/[0.06]">
        {author?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={author.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-lake-blue/10 text-[8px] font-bold text-lake-blue/60">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <span className="text-[11px] font-medium text-foreground-muted">{name}</span>
    </div>
  );
}

function PostsTab({
  ctuId,
  query,
  userLat,
  userLng,
}: {
  ctuId: string;
  query: string;
  userLat: number | null;
  userLng: number | null;
}) {
  const { openPinCard } = useMapDock();
  const [typeFilter, setTypeFilter] = useState<PostTypeFilter>('all');
  const [posts, setPosts] = useState<CityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    if (fetchedFor.current === ctuId) return;
    fetchedFor.current = ctuId;
    setLoading(true);
    setError(null);

    fetch(`/api/territory/units/${ctuId}/posts?limit=40`)
      .then((r) => r.json() as Promise<{ posts?: CityPost[]; error?: string }>)
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPosts(data.posts ?? []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [ctuId, userLat, userLng]);

  const filtered = useMemo(() => {
    let result = posts;
    if (typeFilter !== 'all') result = result.filter((p) => p.post_type === typeFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          (p.body ?? '').toLowerCase().includes(q) ||
          (p.title ?? '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [posts, typeFilter, query]);

  return (
    <div className="space-y-3">
      {/* Type filter pills */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {POST_TYPE_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setTypeFilter(f.id)}
            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
              typeFilter === f.id
                ? 'bg-foreground text-background'
                : `${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} text-foreground-muted`
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-black/[0.06]" />
          ))}
        </div>
      ) : error ? (
        <p className="text-[13px] text-foreground-muted">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-[13px] text-foreground-muted">
          {query ? 'No posts match that search.' : typeFilter !== 'all' ? `No ${typeFilter} posts yet.` : 'No posts in this city yet.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => openPinCard({ id: post.id, kind: 'pin', title: post.body?.slice(0, 60) ?? 'Post' })}
              className={`w-full rounded-2xl px-3 py-2.5 text-left transition-colors ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} active:bg-black/[0.06]`}
            >
              <div className="flex items-start justify-between gap-2">
                <PostAuthorLine author={post.author} />
                <span className="shrink-0 text-[10px] text-foreground-muted/60">
                  {formatRelative(post.created_at)}
                </span>
              </div>
              {post.title ? (
                <p className="mt-1 truncate text-[13px] font-semibold text-foreground">{post.title}</p>
              ) : null}
              {post.body ? (
                <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-foreground/80">{post.body}</p>
              ) : null}
              {/* Photo strip */}
              {post.media.filter((m) => m.type === 'image').length > 0 ? (
                <div className="mt-2 flex gap-1.5 overflow-hidden">
                  {post.media
                    .filter((m) => m.type === 'image')
                    .slice(0, 3)
                    .map((m, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={m.url}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-xl object-cover"
                      />
                    ))}
                </div>
              ) : null}
              {/* Counts */}
              {(post.like_count > 0 || post.comment_count > 0) ? (
                <div className="mt-1.5 flex gap-3 text-[10px] text-foreground-muted/60">
                  {post.like_count > 0 ? <span>{post.like_count} ♥</span> : null}
                  {post.comment_count > 0 ? <span>{post.comment_count} replies</span> : null}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Directory tab ────────────────────────────────────────────────────────────

function DirectoryTab({
  ctuId,
  query,
}: {
  ctuId: string;
  query: string;
}) {
  const { openPageCard } = useMapDock();
  const [pages, setPages] = useState<CityDirectoryPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedFor = useRef<string | null>(null);

  // Re-fetch when CTU changes; pass q for server-side filtering
  useEffect(() => {
    const key = `${ctuId}::${query}`;
    if (fetchedFor.current === key) return;
    fetchedFor.current = key;
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams({ limit: '40' });
    if (query) qs.set('q', query);

    fetch(`/api/territory/units/${ctuId}/directory?${qs}`)
      .then((r) => r.json() as Promise<{ pages?: CityDirectoryPage[]; error?: string }>)
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPages(data.pages ?? []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [ctuId, query]);

  if (loading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl bg-black/[0.06]" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="px-0.5 text-[13px] text-foreground-muted">{error}</p>;
  }

  if (pages.length === 0) {
    return (
      <p className="px-0.5 text-[13px] text-foreground-muted">
        {query ? 'No listings match that search.' : 'No directory listings found in this city.'}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {pages.map((page) => (
        <button
          key={page.id}
          type="button"
          onClick={() => openPageCard({ id: page.id, kind: 'page', title: page.title })}
          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} active:bg-black/[0.06]`}
        >
          {/* Icon / initial */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/[0.04]">
            {page.icon ? (
              <span className="text-lg leading-none">{page.icon}</span>
            ) : (
              <span className="text-[11px] font-bold text-foreground/40">
                {page.title.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[13px] font-semibold text-foreground">{page.title}</p>
              {page.isVerified && (
                <span className="shrink-0 text-lake-blue" aria-label="Verified">✓</span>
              )}
            </div>
            {page.pageType ? (
              <p className="truncate text-[11px] capitalize text-foreground-muted">
                {page.pageType.replace(/-/g, ' ')}
              </p>
            ) : null}
            {page.addressLine ? (
              <p className="truncate text-[10px] text-foreground-muted/60">{page.addressLine}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {page.source === 'boundary' && (
              <span className="rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-foreground-muted/60">
                nearby
              </span>
            )}
            <IconChevronRight className="h-4 w-4 text-foreground-muted/40" />
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Nearby tab ───────────────────────────────────────────────────────────────

function NearbyTab({
  query,
  userLat,
  userLng,
}: {
  query: string;
  userLat: number | null;
  userLng: number | null;
}) {
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedCoords = useRef<string | null>(null);

  const coordsKey = userLat != null && userLng != null
    ? `${userLat.toFixed(4)},${userLng.toFixed(4)}`
    : null;

  useEffect(() => {
    if (!coordsKey || fetchedCoords.current === coordsKey) return;
    fetchedCoords.current = coordsKey;
    setLoading(true);
    setError(null);

    fetch(`/api/geo/nearby?lat=${userLat}&lng=${userLng}&limit=40`)
      .then((r) => r.json() as Promise<{ places?: NearbyPlace[]; error?: string; outsideMinnesota?: boolean }>)
      .then((data) => {
        if (data.outsideMinnesota) { setPlaces([]); return; }
        if (data.error) throw new Error(data.error);
        setPlaces(data.places ?? []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordsKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return places;
    return places.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q),
    );
  }, [places, query]);

  if (!userLat || !userLng) {
    return (
      <p className="px-0.5 text-[13px] text-foreground-muted">
        Enable location to see nearby places.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-2xl bg-black/[0.06]" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="px-0.5 text-[13px] text-foreground-muted">{error}</p>;
  }

  if (filtered.length === 0) {
    return (
      <p className="px-0.5 text-[13px] text-foreground-muted">
        {query ? 'No places match that search.' : 'No places found nearby.'}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {filtered.map((place) => (
        <div
          key={place.id}
          className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-foreground">{place.name}</p>
            {place.category ? (
              <p className="truncate text-[11px] capitalize text-foreground-muted">{place.category}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function DockCityPane({ ctu }: { ctu: DockCtuItem }) {
  const { account } = useAuthSafe();
  const { openDetails } = useMapDock();
  const searchQuery = useMapSearchQuery();
  const [activeTab, setActiveTab] = useState<CityTab>('locals');
  const [homeModalOpen, setHomeModalOpen] = useState(false);
  const [homeRefreshToken, setHomeRefreshToken] = useState(0);
  const [homeStatus, setHomeStatus] = useState<HomeStatusData | null>(null);

  const stack = useSyncExternalStore(
    subscribeCurrentTerritoryStack,
    getCurrentTerritoryStackSnapshot,
    () => ({ coords: null, jurisdictions: [], stackKey: null, loading: false, error: null, ready: false, updatedAt: null }),
  );
  const userLat = stack.coords?.lat ?? null;
  const userLng = stack.coords?.lng ?? null;

  const entity = useMemo(() => ctuToEntity(ctu), [ctu]);

  const handleTabChange = useCallback((tab: CityTab) => {
    setActiveTab(tab);
    setMapSearchQuery('');
  }, []);

  // Load home status for the home button (lightweight — just accounts + home_units)
  useEffect(() => {
    if (!account?.id) return;
    fetch('/api/account-territories/home', { credentials: 'include' })
      .then((r) => r.json() as Promise<HomeStatusData>)
      .then(setHomeStatus)
      .catch(() => {/* non-critical */});
  }, [account?.id, homeRefreshToken]);

  const isHome = homeStatus?.unitIds.includes(ctu.id) ?? false;
  const homeLocked = isHome && Boolean(homeStatus?.homeSetAt) && !homeStatus?.canReset;
  const homeResetAt = homeStatus?.homeResetAvailableAt ?? null;

  const classLabel = ctu.ctu_class
    ? ctu.ctu_class.charAt(0).toUpperCase() + ctu.ctu_class.slice(1).toLowerCase()
    : ctu.kindLabel;

  return (
    <div className={`flex flex-col ${MAP_SHEET_BODY_CLASS}`}>
      {/* Sticky hero + tab bar */}
      <div className={`sticky top-0 z-[5] ${MAP_SHEET_SHELL_X} space-y-3 pb-3 pt-1`}>
        {/* City identity row */}
        <button
          type="button"
          onClick={() => openDetails(entity)}
          className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left transition-colors active:bg-black/[0.04]"
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-lake-blue" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-bold text-foreground">{ctu.name}</span>
            <span className="block truncate text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
              {classLabel}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-lake-blue/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-lake-blue">
            Where you are
          </span>
          <IconChevronRight className="h-4 w-4 shrink-0 text-foreground-muted/40" />
        </button>

        {/* Relationship chips + Set as home */}
        {account ? (
          <div className="flex flex-wrap gap-2">
            <RelationshipRow ctuId={ctu.id} refreshToken={homeRefreshToken} />
            <SetHomeButton
              ctu={ctu}
              isHome={isHome}
              locked={homeLocked}
              resetAt={homeResetAt}
              onOpen={() => setHomeModalOpen(true)}
            />
          </div>
        ) : null}

        {/* Contribute button */}
        <button
          type="button"
          onClick={() =>
            openContributeSheet({
              ctu: {
                id: ctu.id,
                name: ctu.name,
                kindLabel: classLabel,
              },
            })
          }
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-lake-blue py-3 text-[15px] font-bold text-white shadow-sm transition-transform duration-150 active:scale-[0.98]"
        >
          <span className="text-[18px] leading-none">＋</span>
          Contribute to {ctu.name}
        </button>

        {/* Tab bar */}
        <TabBar active={activeTab} onChange={handleTabChange} />
      </div>

      {/* Tab content */}
      <div className={`${MAP_SHEET_SHELL_X} pb-6 pt-1`}>
        {activeTab === 'locals' ? (
          <LocalsTab ctuId={ctu.id} query={searchQuery} />
        ) : activeTab === 'posts' ? (
          <PostsTab ctuId={ctu.id} query={searchQuery} userLat={userLat} userLng={userLng} />
        ) : activeTab === 'directory' ? (
          <DirectoryTab ctuId={ctu.id} query={searchQuery} />
        ) : activeTab === 'officials' ? (
          <DockOfficeholdersSection entity={entity} />
        ) : (
          <NearbyTab query={searchQuery} userLat={userLat} userLng={userLng} />
        )}
      </div>

      {/* Set-as-home modal */}
      {homeModalOpen ? (
        <SetHomeModal
          ctu={ctu}
          onClose={() => setHomeModalOpen(false)}
          onSuccess={() => setHomeRefreshToken((n) => n + 1)}
        />
      ) : null}
    </div>
  );
}
