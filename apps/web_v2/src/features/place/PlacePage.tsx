'use client';

/**
 * /directory/territory/:unitId — sharable territory unit record (Own scroll surface).
 *
 * Layout (inline, no floating map chrome):
 *   1. Map — boundary only
 *   2. Identity strip — kind · stamp · Open on map
 *   3. Your place — Live / Work / Follow (CTU)
 *   4. Passport + About + civic sections
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageScroll } from '@/features/appShell/PageScroll';
import { ShareHeaderButton } from '@/features/appShell/ShareHeaderButton';
import { useAuthSafe } from '@/features/auth';
import { PlaceBoundaryMap } from '@/features/place/PlaceBoundaryMap';
import { PlaceIdentityStrip } from '@/features/place/PlaceIdentityStrip';
import { PlaceRelationshipSection } from '@/features/place/PlaceRelationshipSection';
import { PlaceTerritoryDetails } from '@/features/place/PlaceTerritoryDetails';
import type { PlaceRecord } from '@/features/place/placeTypes';
import { IconArrowLeft } from '@/features/map/dockCore/core/icons';
import {
  showTerritorySelection,
  type SelectionKind,
} from '@/features/map/territory/territorySelection';
import {
  directoryTerritoryPath,
  DISCOVER_PATH,
  GAME_PATH,
} from '@/lib/routes/routePolicy';
import { territoryPresenceUiEnabledByDockKind } from '@/features/accountTerritories/store/passportKinds';
import { safePadTop } from '@/lib/despia/safeArea';

function isSelectionKind(kind: string): kind is SelectionKind {
  return (
    kind === 'county' ||
    kind === 'ctu' ||
    kind === 'school_district' ||
    kind === 'district' ||
    kind === 'senate_district' ||
    kind === 'house_district'
  );
}

export default function PlacePage() {
  const params = useParams<{ unitId?: string; id?: string }>();
  const idParam =
    typeof params?.unitId === 'string'
      ? params.unitId
      : typeof params?.id === 'string'
        ? params.id
        : '';
  const id = decodeURIComponent(idParam).trim();
  const router = useRouter();
  const { account } = useAuthSafe();

  const [place, setPlace] = useState<PlaceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setPlace(null);
      setError('Missing place');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/place/${encodeURIComponent(id)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.status === 404) {
        setPlace(null);
        setError('Place not found');
        return;
      }
      if (!res.ok) throw new Error('Failed to load');
      const body = (await res.json()) as PlaceRecord;
      setPlace(body);
    } catch (e: unknown) {
      setPlace(null);
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, account?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(DISCOVER_PATH);
  };

  const onOpenMap = () => {
    if (!place || !isSelectionKind(place.dockKind)) {
      router.push(GAME_PATH);
      return;
    }
    void showTerritorySelection(place.dockKind, place.id);
    router.push(GAME_PATH);
  };

  const visited = Boolean(place?.viewer.visited);
  const presenceUi = place ? territoryPresenceUiEnabledByDockKind(place.dockKind) : false;
  const sharePath = place ? directoryTerritoryPath(place.id) : '';

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f5f1]">
      <header
        className="sticky top-0 z-10 border-b border-black/[0.08] bg-[#f7f5f1]/95 backdrop-blur-md"
        style={{ paddingTop: safePadTop('0.15rem') }}
      >
        <div className="flex h-11 items-center gap-2 px-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="inline-flex items-center gap-0.5 py-1.5 pl-1 pr-2 text-[17px] text-lake-blue active:opacity-60"
          >
            <IconArrowLeft className="h-5 w-5" />
            Back
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-[17px] font-bold tracking-tight text-foreground">
              {place?.name ?? 'Place'}
            </p>
          </div>
          <ShareHeaderButton
            title={place?.name ?? 'Territory'}
            path={sharePath}
            disabled={!place}
          />
        </div>
      </header>

      <PageScroll>
        {loading ? (
          <p className="px-5 py-10 text-center text-[14px] text-foreground-muted">
            Loading…
          </p>
        ) : error || !place ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[16px] font-semibold text-foreground">
              {error ?? 'Place not found'}
            </p>
            <button
              type="button"
              onClick={() => router.push(DISCOVER_PATH)}
              className="mt-3 text-[15px] font-semibold text-lake-blue"
            >
              Back to Discover
            </button>
          </div>
        ) : (
          <div className="pb-12">
            <PlaceBoundaryMap
              placeId={place.id}
              name={place.name}
              geometry={place.geometry}
              visited={presenceUi ? visited : true}
            />

            <div className="space-y-0 px-5 pt-4">
              <PlaceIdentityStrip
                kindLabel={place.kindLabel}
                visited={visited}
                xpAmount={place.viewer.xpAmount}
                onOpenMap={onOpenMap}
                showPresence={presenceUi}
              />

              <PlaceRelationshipSection
                unitId={place.id}
                unitName={place.name}
                enabled={place.dockKind === 'ctu'}
              />

              <div className="border-t border-black/[0.06] pt-5">
                <PlaceTerritoryDetails place={place} presenceUi={presenceUi} />
              </div>
            </div>
          </div>
        )}
      </PageScroll>
    </div>
  );
}
