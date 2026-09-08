'use client';

import { useMemo, useState } from 'react';
import { accountTerritoryKindLabel } from '@/features/accountTerritories/store/constants';
import {
  formatHomeResetDate,
  useHomeStatus,
  type HomeStackJurisdiction,
} from '@/features/accountTerritories/store/useHomeStatus';
import { usePassport } from '@/features/accountTerritories/store/usePassport';
import {
  getAccountHandle,
  useAccountPlaces,
  useAuthSafe,
  type AccountPlaceAffinity,
} from '@/features/auth';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { IconMapPin, IconX } from '@/features/map/dockCore/core/icons';
import { DockSection, DockSkeletonRows } from '@/features/map/dockCore/panes/DockPaneShell';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { ToolPrimaryButton, ToolResultRow } from '@/features/tools/core/toolUi';

const DOCK_ENTITY_KINDS = new Set<DockEntity['kind']>([
  'county',
  'ctu',
  'school_district',
  'school',
  // district / district_part / senate_district / house_district: hidden for first launch
]);

function homeEntity(j: HomeStackJurisdiction): DockEntity | null {
  if (!DOCK_ENTITY_KINDS.has(j.kind as DockEntity['kind'])) return null;
  return {
    id: j.id,
    kind: j.kind as DockEntity['kind'],
    title: j.name,
    kindLabel: j.kindLabel,
  };
}

type OtherTerritory = {
  territoryUnitId: string;
  entity: DockEntity;
  kinds: string[];
};

/**
 * My Places — the account home stack card.
 * Home boundary records live in a contained list (every row opens the
 * territory profile); saved territories outside the home stack follow with
 * their relation tags and inline remove.
 */
export default function MyPlacesDockCard() {
  const { openAccount, openDockCard, closeDockCard, openSubpage, openDetails } = useMapDock();
  const { account } = useAuthSafe();
  const { status } = useHomeStatus();
  const { places, isLoading: placesLoading, refresh: refreshPlaces } = useAccountPlaces(
    account?.id,
  );
  const { passport } = usePassport(account?.id);

  const [removingUnitId, setRemovingUnitId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [homeListOpen, setHomeListOpen] = useState(true);

  const handle = getAccountHandle(account);
  const hasHome = Boolean(status?.homeSetAt);
  const locked = hasHome && !status?.canReset;
  const homeJurisdictions = status?.jurisdictions ?? [];
  const homeUnitIds = useMemo(
    () => new Set(status?.unitIds ?? []),
    [status?.unitIds],
  );

  /** Saved territories outside the home stack, grouped with relation tags. */
  const otherTerritories = useMemo<OtherTerritory[]>(() => {
    const map = new Map<string, OtherTerritory>();
    for (const row of places as AccountPlaceAffinity[]) {
      if (!row.territoryUnitId) continue;
      if (homeUnitIds.has(row.territoryUnitId)) continue;
      const existing = map.get(row.territoryUnitId);
      if (existing) {
        if (!existing.kinds.includes(row.kind)) existing.kinds.push(row.kind);
        continue;
      }
      map.set(row.territoryUnitId, {
        territoryUnitId: row.territoryUnitId,
        entity: row.entity,
        kinds: [row.kind],
      });
    }
    return [...map.values()];
  }, [places, homeUnitIds]);

  const openTerritory = (entity: DockEntity) => {
    closeDockCard();
    openDetails(entity);
  };

  const removeOther = async (place: OtherTerritory) => {
    setRemoveError(null);
    setRemovingUnitId(place.territoryUnitId);
    try {
      const res = await fetch('/api/account-territories/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ territoryUnitId: place.territoryUnitId }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setRemoveError(json.error ?? 'Could not remove');
        return;
      }
      refreshPlaces();
    } catch {
      setRemoveError('Could not remove');
    } finally {
      setRemovingUnitId(null);
    }
  };

  const openSavedPlaces = () => {
    closeDockCard();
    openSubpage({
      title: 'My places',
      subtitle: 'Saved places',
      kind: 'my-places',
    });
  };

  return (
    <DockCardShell
      titleMode="sub"
      backLabel="Account"
      onBack={() => openAccount()}
      title="My Places"
      subtitle={handle ? `${handle} · home boundary records` : null}
    >
      {!account ? (
        <DockSection title="Home areas" subtitle="Sign in to see your home base.">
          <p className="px-0.5 text-[13px] text-foreground-muted">
            Your confirmed home stack and saved places live here.
          </p>
        </DockSection>
      ) : status == null ? (
        <DockSection title="Home areas" subtitle="Loading…">
          <DockSkeletonRows count={4} />
        </DockSection>
      ) : hasHome ? (
        <DockSection
          title="Home areas"
          subtitle={
            locked
              ? `Locked Lives here records · until ${formatHomeResetDate(status.homeResetAvailableAt)}`
              : 'Home base set · reset available from Map layers'
          }
        >
          <div
            className={`overflow-hidden rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} divide-y divide-[rgb(var(--map-ink-subtle))]`}
          >
            <button
              type="button"
              onClick={() => setHomeListOpen((v) => !v)}
              aria-expanded={homeListOpen}
              className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors active:bg-map-glass-hover"
            >
              <span className="min-w-0">
                <span className="block text-[15px] font-medium text-foreground">
                  Home boundary records
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-foreground-muted">
                  {homeJurisdictions.length} areas
                  {locked
                    ? ` · locked until ${formatHomeResetDate(status.homeResetAvailableAt)}`
                    : ''}
                </span>
              </span>
              <span
                aria-hidden
                className={`text-[15px] text-foreground-muted transition-transform ${
                  homeListOpen ? 'rotate-90' : ''
                }`}
              >
                ›
              </span>
            </button>
            {homeListOpen
              ? homeJurisdictions.map((j) => {
              const entity = homeEntity(j);
              const row = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-foreground">
                      {j.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-foreground-muted">
                      {j.kindLabel ?? j.kind}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                      locked
                        ? 'bg-amber-500/15 text-amber-800'
                        : 'bg-emerald-500/15 text-emerald-700'
                    }`}
                  >
                    {locked ? 'Locked' : 'Home'}
                  </span>
                </>
              );
              return entity ? (
                <button
                  key={`${j.kind}:${j.id}`}
                  type="button"
                  onClick={() => openTerritory(entity)}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors active:bg-map-glass-hover"
                >
                  {row}
                </button>
              ) : (
                <div
                  key={`${j.kind}:${j.id}`}
                  className="flex w-full items-center gap-3 px-3.5 py-3"
                >
                  {row}
                </div>
              );
            })
              : null}
          </div>
          <p className="px-0.5 pt-1 text-[11px] leading-snug text-foreground-muted">
            Set {formatHomeResetDate(status.homeSetAt)} · locked as Lives here
            places until {formatHomeResetDate(status.homeResetAvailableAt)}. Tap
            a record to open its area profile.
          </p>
        </DockSection>
      ) : (
        <DockSection title="Home areas" subtitle="No home base yet">
          <p className="px-0.5 text-[13px] text-foreground-muted">
            Turn on Find Me, then Areas around me from Map layers, then
            set as home to commit your home boundary records.
          </p>
          <ToolPrimaryButton onClick={() => openDockCard('controls')}>
            Open Map layers
          </ToolPrimaryButton>
        </DockSection>
      )}

      {account && passport ? (
        <DockSection
          title="Passport"
          subtitle={`Level ${passport.level.level} · ${passport.level.totalXp} XP · unlocked by visiting`}
        >
          <div
            className={`overflow-hidden rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} divide-y divide-[rgb(var(--map-ink-subtle))]`}
          >
            {passport.kinds.map((kind) => {
              const pct = kind.total > 0 ? Math.min(100, (kind.unlocked / kind.total) * 100) : 0;
              return (
                <div key={kind.unitKind} className="px-3.5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[14px] font-medium text-foreground">
                      {kind.label}
                    </span>
                    <span className="shrink-0 text-[12px] tabular-nums text-foreground-muted">
                      {kind.unlocked} of {kind.total}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.08]">
                    <span
                      className="block h-full rounded-full bg-lake-blue transition-[width] duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="px-0.5 pt-1 text-[11px] leading-snug text-foreground-muted">
            Turn on Find Me and travel to new counties, cities, and school districts
            to unlock them — every new one earns XP.
          </p>
        </DockSection>
      ) : null}

      {account ? (
        <DockSection
          title="Other areas"
          subtitle={
            otherTerritories.length > 0
              ? 'Saved with your relation · tap × to remove'
              : 'Areas you tag outside your home base'
          }
        >
          {placesLoading ? <DockSkeletonRows count={2} /> : null}
          {!placesLoading && otherTerritories.length === 0 ? (
            <p className="px-0.5 text-[13px] text-foreground-muted">
              Nothing saved yet — open an area on the map and tag how it
              relates to you (Work here, Grew up here, …).
            </p>
          ) : null}
          {!placesLoading
            ? otherTerritories.map((place) => {
                const removing = removingUnitId === place.territoryUnitId;
                const relation = place.kinds
                  .map((k) => accountTerritoryKindLabel(k))
                  .join(' · ');
                return (
                  <ToolResultRow
                    key={place.territoryUnitId}
                    title={place.entity.title}
                    subtitle={relation || (place.entity.subtitle ?? place.entity.kind)}
                    icon={<IconMapPin className="h-5 w-5" />}
                    onClick={() => openTerritory(place.entity)}
                    trailing={
                      <button
                        type="button"
                        disabled={removing}
                        onClick={(e) => {
                          e.stopPropagation();
                          void removeOther(place);
                        }}
                        aria-label={`Remove ${place.entity.title}`}
                        title="Remove from saved"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-map-ink-subtle text-foreground-muted transition hover:bg-red-500/10 hover:text-red-700 active:scale-95 disabled:opacity-40"
                      >
                        {removing ? (
                          <span className="text-[11px] font-bold">…</span>
                        ) : (
                          <IconX className="h-4 w-4" />
                        )}
                      </button>
                    }
                  />
                );
              })
            : null}
          {removeError ? (
            <p className="px-0.5 text-[12px] text-red-600">{removeError}</p>
          ) : null}
        </DockSection>
      ) : null}

      {account ? (
        <ToolPrimaryButton variant="secondary" onClick={openSavedPlaces}>
          All saved places
        </ToolPrimaryButton>
      ) : null}
    </DockCardShell>
  );
}
