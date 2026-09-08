'use client';

/**
 * WorldModelsLayer — thin React mount wrapper for game world rendering.
 *
 * Delegates all rendering lifecycle to GameRenderService and all placement
 * streaming to PlacementStreamService. This component is responsible only for:
 *   - Mounting / unmounting the services on map lifecycle changes
 *   - Wiring catalog & store subscriptions into service patch calls
 *   - Re-applying layers when the Mapbox style reloads
 *   - Rendering the collect / route modals (pure UI, no Mapbox coupling)
 */

import { useEffect, useRef, useSyncExternalStore, useCallback } from 'react';
import { waitForMapStyleReady } from '@/map/engine/mapStyleGuard';
import { getFindMeCoordsSnapshot } from '@/map/location/camera/findMeCoordsStore';
import { getPresenceOrigin } from '@/map/location/positionMode/playerPresenceOrigin';
import { useFindMeCoords } from '@/map/location/camera/useFindMeCoords';
import { useMapContext } from '@/map/MapProvider';
import {
  getVenueModeSnapshot,
  subscribeVenueMode,
} from '@/features/experienceZones/store/venueModeStore';
import { loadWorldCatalog } from '@/features/map/game/world/catalogPersist';
import {
  subscribeWorldCatalog,
  getWorldCatalog,
} from '@/features/map/game/world/catalogStore';
import { loadElementTypes } from '@/features/map/game/world/elementTypesPersist';
import {
  getElementTypes,
  subscribeElementTypes,
} from '@/features/map/game/world/elementTypesStore';
import {
  applyElementTypeColorsToMap,
  ensureWorldPlacementLayers,
} from '@/features/map/game/world/ensurePlacementLayers';
import { PlacementFoundModal } from '@/features/map/game/world/PlacementFoundModal';
import { PlacementRouteModal } from '@/features/map/game/world/PlacementRouteModal';
import { PostDetailCard } from '@/features/community/PostDetailCard';
import {
  getWorldPlacementsSnapshot,
  getWorldPlacementsRaw,
  rebuildWorldPlacementFeatures,
  subscribeWorldPlacements,
} from '@/features/map/game/world/placementsStore';
import { useWorldPlacementHover } from '@/features/map/game/world/useWorldPlacementHover';
import {
  createGameRenderService,
  createPlacementStreamService,
} from '@/services/game';
import {
  subscribeWorldRefresh,
  getWorldRefreshCount,
} from '@/features/map/game/world/worldRefreshSignal';
export function WorldModelsLayer() {
  const { map, ready } = useMapContext();
  const { coords: liveCoords, lookupCoords } = useFindMeCoords();

  // Live subscriptions — values used as useEffect deps to trigger patch/rebuild
  const data = useSyncExternalStore(
    subscribeWorldPlacements,
    getWorldPlacementsSnapshot,
    getWorldPlacementsSnapshot,
  );
  const catalog = useSyncExternalStore(
    subscribeWorldCatalog,
    getWorldCatalog,
    getWorldCatalog,
  );
  const elementTypes = useSyncExternalStore(
    subscribeElementTypes,
    getElementTypes,
    getElementTypes,
  );

  const refreshCount = useSyncExternalStore(
    subscribeWorldRefresh,
    getWorldRefreshCount,
    getWorldRefreshCount,
  );

  useWorldPlacementHover();

  // Stable service refs — one instance per map mount, replaced on teardown
  const renderSvcRef = useRef(createGameRenderService());
  const streamSvcRef = useRef(createPlacementStreamService());
  /** Tracks venue explore/zone so we skip the mount-time forceRefresh. */
  const venueKeyRef = useRef<string | null>(null);

  // ─── Mount / unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !ready) return;

    const renderSvc = renderSvcRef.current;
    const streamSvc = streamSvcRef.current;

    const apply = () => {
      renderSvc.init(map, getWorldCatalog());
    };
    apply();
    map.on('style.load', apply);

    const stopStream = streamSvc.start(map);

    return () => {
      map.off('style.load', apply);
      stopStream();
      renderSvc.teardown();
      renderSvcRef.current = createGameRenderService();
      streamSvcRef.current = createPlacementStreamService();
    };
  }, [map, ready]);

  // ─── Catalog change → rebuild features + re-init layers ────────────────────
  useEffect(() => {
    if (!map || !ready) return;
    rebuildWorldPlacementFeatures();
    renderSvcRef.current.init(map, catalog);
  }, [map, ready, catalog]);

  // ─── Element type colors → live pulse / LOD rings ──────────────────────────
  useEffect(() => {
    if (!map || !ready) return;
    applyElementTypeColorsToMap(map);
  }, [map, ready, elementTypes]);

  // ─── Placement store change → patch renderer ────────────────────────────────
  useEffect(() => {
    if (!map || !ready) return;
    renderSvcRef.current.patch(getWorldPlacementsRaw());
  }, [map, ready, data]);

  // ─── Move-based stream refresh ──────────────────────────────────────────────
  const coords = liveCoords ?? lookupCoords;
  const coordLat = coords?.lat;
  const coordLng = coords?.lng;
  useEffect(() => {
    if (!Number.isFinite(coordLat) || !Number.isFinite(coordLng)) return;
    void streamSvcRef.current.refresh(coordLat as number, coordLng as number);
  }, [coordLat, coordLng]);

  // ─── Manual cube-button force refresh ──────────────────────────────────────
  const forceRefresh = useCallback(async () => {
    if (!map || !ready) return;
    await streamSvcRef.current.forceRefresh();
  }, [map, ready]);

  useEffect(() => {
    if (refreshCount === 0) return;
    void forceRefresh();
  }, [refreshCount, forceRefresh]);

  // ─── Venue mode → re-stream with/without zone scope ─────────────────────────
  // When the user opts into Explore Zone, all cached tiles must be re-fetched
  // with `experienceZoneId` so zone-specific placements appear on the game map.
  // When they leave / decline, tiles re-fetch without the zone filter to restore
  // the normal world. We key on `exploring + zoneId` so zone switches also
  // trigger a fresh load.
  const venueKey = useSyncExternalStore(
    subscribeVenueMode,
    () => {
      const s = getVenueModeSnapshot();
      return `${s.exploring ? '1' : '0'}|${s.zoneId ?? ''}`;
    },
    () => {
      const s = getVenueModeSnapshot();
      return `${s.exploring ? '1' : '0'}|${s.zoneId ?? ''}`;
    },
  );

  useEffect(() => {
    // Skip initial mount — hydrate already force-loads current tiles.
    // Only re-stream when explore/zone actually changes after first paint.
    if (!map || !ready) return;
    const prev = venueKeyRef.current;
    venueKeyRef.current = venueKey;
    if (prev === null) return;
    if (prev === venueKey) return;
    void streamSvcRef.current.forceRefresh();
  }, [map, ready, venueKey]);

  // ─── Single-flight hydrate on mount ────────────────────────────────────────
  useEffect(() => {
    if (!map || !ready) return;

    let cancelled = false;
    let seq = 0;

    const hydrate = () => {
      const my = ++seq;
      void (async () => {
        try {
          await waitForMapStyleReady(map, { timeoutMs: 15_000 });
          if (cancelled || my !== seq) return;

          await Promise.all([loadWorldCatalog(), loadElementTypes()]);
          if (cancelled || my !== seq) return;

          rebuildWorldPlacementFeatures();

          // PlacementStreamService will fetch on its first tile subscription.
          // Force a refresh with current coords for immediate cold-start load.
          const fix =
            (() => {
              const o = getPresenceOrigin();
              return o.hasFix ? { lat: o.lat, lng: o.lng } : null;
            })() ??
            getFindMeCoordsSnapshot().coords ??
            getFindMeCoordsSnapshot().lookupCoords;
          if (fix) {
            await streamSvcRef.current.refresh(fix.lat, fix.lng);
          }
          if (cancelled || my !== seq) return;

          renderSvcRef.current.init(map, getWorldCatalog());
          applyElementTypeColorsToMap(map);

          // One extra pass after Mapbox settles (models often attach on idle)
          await new Promise<void>((resolve) => {
            const done = () => { map.off('idle', done); resolve(); };
            map.once('idle', done);
            window.setTimeout(done, 800);
          });
          if (cancelled || my !== seq) return;
          ensureWorldPlacementLayers(map, getWorldPlacementsSnapshot());
          applyElementTypeColorsToMap(map);

          if (process.env.NODE_ENV !== 'production') {
            const n = getWorldPlacementsSnapshot().features.length;
            console.info(
              `[world] hydrated ${getWorldCatalog().length} models, ${n} placements, ${getElementTypes().length} element types`,
            );
          }
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[world] hydrate failed', err);
          }
        }
      })();
    };

    hydrate();
    map.on('style.load', hydrate);
    return () => {
      cancelled = true;
      map.off('style.load', hydrate);
    };
  }, [map, ready]);

  return (
    <>
      <PlacementFoundModal />
      <PlacementRouteModal />
      <PostDetailCard />
    </>
  );
}
