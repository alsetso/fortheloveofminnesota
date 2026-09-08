'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  ACCOUNT_TERRITORY_PRIMARY_KINDS,
  ACCOUNT_TERRITORY_RETIRED_KINDS,
  accountTerritoryKindLabel,
  isAccountTerritoryKind,
  type AccountTerritoryKindId,
} from '@/features/accountTerritories/store/constants';
import {
  useSavedTerritoryMatches,
  type SavedTerritoryMatch,
} from '@/features/accountTerritories/store/useSavedTerritoryMatches';
import { DockSection } from '@/features/map/dockCore/panes/DockPaneShell';
import { useAuthSafe } from '@/features/auth';

type TerritorySaveSectionProps = {
  territoryUnitId: string;
  territoryTitle: string;
};

function formatResetDate(iso: string | null): string {
  if (!iso) return 'soon';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'soon';
  }
}

/**
 * Saved-territory chips on details — add / switch / remove tags.
 * Home units stay locked for Live here during the 30-day cooldown.
 */
export default function TerritorySaveSection({
  territoryUnitId,
  territoryTitle,
}: TerritorySaveSectionProps) {
  const { account } = useAuthSafe();
  const { matches, loading, refresh } = useSavedTerritoryMatches(
    territoryUnitId ? [territoryUnitId] : [],
  );
  const match: SavedTerritoryMatch | undefined = matches[territoryUnitId];
  const [busyKind, setBusyKind] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assigned = useMemo(
    () => new Set((match?.kinds ?? []).filter(isAccountTerritoryKind)),
    [match?.kinds],
  );
  /** Leftover retired affinity rows — shown only so the user can clear them. */
  const retiredAssigned = useMemo(
    () =>
      (match?.kinds ?? []).filter((k) =>
        (ACCOUNT_TERRITORY_RETIRED_KINDS as readonly string[]).includes(k),
      ),
    [match?.kinds],
  );
  const homeLocked = Boolean(match?.homeLocked);
  const isHome = Boolean(match?.isHome);

  const primaryMissing = ACCOUNT_TERRITORY_PRIMARY_KINDS.filter((k) => !assigned.has(k));

  const saveKind = useCallback(
    async (kind: AccountTerritoryKindId) => {
      if (!account) {
        setError('Sign in to save areas');
        return;
      }
      setError(null);
      setBusyKind(kind);
      try {
        const res = await fetch('/api/account-territories/upsert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ territoryUnitId, kind }),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(json.error ?? 'Could not save');
          return;
        }
        refresh();
      } catch {
        setError('Could not save');
      } finally {
        setBusyKind(null);
      }
    },
    [account, refresh, territoryUnitId],
  );

  const removeKind = useCallback(
    async (kind: string) => {
      if (!account) return;
      if (homeLocked && kind === 'live_here') {
        setError(
          `Home · Live here is locked until ${formatResetDate(match?.homeResetAvailableAt ?? null)}.`,
        );
        return;
      }
      setError(null);
      setBusyKind(kind);
      try {
        const res = await fetch('/api/account-territories/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ territoryUnitId, kind }),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(json.error ?? 'Could not remove');
          return;
        }
        refresh();
      } catch {
        setError('Could not remove');
      } finally {
        setBusyKind(null);
      }
    },
    [account, homeLocked, match?.homeResetAvailableAt, refresh, territoryUnitId],
  );

  const removeAll = useCallback(async () => {
    if (!account) return;
    if (homeLocked && assigned.size <= 1 && assigned.has('live_here')) {
      setError(
        `Home until ${formatResetDate(match?.homeResetAvailableAt ?? null)} — can’t remove yet.`,
      );
      return;
    }
    setError(null);
    setBusyKind('all');
    try {
      const res = await fetch('/api/account-territories/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ territoryUnitId }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Could not remove');
        return;
      }
      refresh();
    } catch {
      setError('Could not remove');
    } finally {
      setBusyKind(null);
    }
  }, [account, assigned, homeLocked, match?.homeResetAvailableAt, refresh, territoryUnitId]);

  if (!territoryUnitId) return null;

  const subtitle = homeLocked
    ? `Locked Lives here record · home base until ${formatResetDate(match?.homeResetAvailableAt ?? null)}`
    : isHome
      ? 'Part of your home base — tap a tag to change or remove.'
      : match?.saved
        ? 'Tap a tag to remove · tap + to add.'
        : 'Tag how this place relates to you.';

  const showQuickRemove =
    (Boolean(match?.saved) || retiredAssigned.length > 0) &&
    !(homeLocked && assigned.size > 0 && [...assigned].every((k) => k === 'live_here') && retiredAssigned.length === 0);

  return (
    <DockSection title="Saved area" subtitle={subtitle}>
      {loading && !match ? (
        <p className="px-0.5 text-[12px] text-foreground-muted">Checking…</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {isHome ? (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
              homeLocked
                ? 'bg-amber-500/15 text-amber-800'
                : 'bg-emerald-500/15 text-emerald-700'
            }`}
            title={
              homeLocked
                ? `Home locked until ${formatResetDate(match?.homeResetAvailableAt ?? null)}`
                : 'Home base'
            }
          >
            {homeLocked ? 'Home · locked' : 'Home'}
          </span>
        ) : null}

        {[...assigned].map((kind) => {
          const locked = homeLocked && kind === 'live_here';
          const busy = busyKind === kind;
          return (
            <button
              key={kind}
              type="button"
              disabled={busyKind !== null || !account || locked}
              onClick={() => void removeKind(kind)}
              title={
                locked
                  ? `Locked with home until ${formatResetDate(match?.homeResetAvailableAt ?? null)}`
                  : `Remove “${accountTerritoryKindLabel(kind)}” from ${territoryTitle}`
              }
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold transition disabled:opacity-60 ${
                locked
                  ? 'bg-amber-500/10 text-amber-800'
                  : 'bg-lake-blue/10 text-lake-blue hover:bg-red-500/10 hover:text-red-700'
              }`}
            >
              {busy ? '…' : locked ? '✓' : '×'} {accountTerritoryKindLabel(kind)}
            </button>
          );
        })}

        {retiredAssigned.map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={busyKind !== null || !account}
            onClick={() => void removeKind(kind)}
            title={`Remove retired tag “${accountTerritoryKindLabel(kind)}”`}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold bg-black/[0.06] text-foreground-muted transition hover:bg-red-500/10 hover:text-red-700 disabled:opacity-60"
          >
            {busyKind === kind ? '…' : '×'} {accountTerritoryKindLabel(kind)}
          </button>
        ))}

        {primaryMissing.map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={busyKind !== null || !account}
            onClick={() => void saveKind(kind)}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold text-foreground-muted transition hover:bg-map-ink-subtle hover:text-foreground disabled:opacity-50"
          >
            {busyKind === kind ? '…' : '+'} {accountTerritoryKindLabel(kind)}
          </button>
        ))}
      </div>

      {showQuickRemove ? (
        <button
          type="button"
          disabled={busyKind !== null || !account}
          onClick={() => void removeAll()}
          className="mt-2.5 text-[12px] font-semibold text-red-600/90 transition hover:text-red-700 disabled:opacity-50"
        >
          {busyKind === 'all'
            ? 'Removing…'
            : homeLocked
              ? 'Remove extra tags'
              : 'Remove from saved'}
        </button>
      ) : null}

      {homeLocked ? (
        <p className="mt-1.5 px-0.5 text-[11px] leading-snug text-foreground-muted">
          Set as home — this Lives here record is locked until{' '}
          {formatResetDate(match?.homeResetAvailableAt ?? null)}. Extra tags can
          still change. Reset home from Map layers after that.
        </p>
      ) : null}

      {!account ? (
        <p className="mt-1.5 px-0.5 text-[11px] text-foreground-muted">
          Sign in to save areas.
        </p>
      ) : null}
      {error ? <p className="mt-1.5 px-0.5 text-[11px] text-red-600">{error}</p> : null}
    </DockSection>
  );
}
