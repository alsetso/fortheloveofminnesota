'use client';

/**
 * Objects pane — shared Object Radar map inside MinimapsShell.
 *
 * Always:
 *   - Active primary experience zones as violet polygons (name labels on this
 *     lightbox). MiniMap peek shares the same overlay without labels.
 *
 * In venue / experience-zone mode (opened from minimap while inside a zone):
 *   - Distinct purple wash / edge glow.
 *   - Controls carry violet accent (toggle / range / purpose).
 *   - Zone polygon painted; camera fitted to zone bounds.
 *   - ObjectLegend replaced by ZoneObjectList.
 *   - Note: leave the zone to see objects outside across Minnesota.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { LngLatBoundsLike } from 'mapbox-gl';
import {
  countNearbyByPurpose,
  countNearbyObjects,
  filterByPurpose,
} from '@/features/map/game/objectRadar/data/nearbyObjects';
import { bindObjectMarkerClicks } from '@/features/map/game/objectRadar/layers/objectMarkers';
import {
  objectRadarActions,
  useObjectRadarStore,
} from '@/features/map/game/objectRadar/objectRadarStore';
import { loadCollectedObjects } from '@/features/map/game/objectRadar/services/loadCollectedObjects';
import {
  readStillOutObjects,
  readZoneOtherObjects,
} from '@/features/map/game/objectRadar/services/loadStillOutObjects';
import {
  attachObjectRadarMap,
  ensureObjectRadarMap,
  getObjectRadarMap,
  parkObjectRadarMap,
  setObjectRadarMapInteractive,
  subscribeObjectRadarMapReady,
  syncObjectRadarCamera,
} from '@/features/map/game/objectRadar/services/objectRadarMapEngine';
import { paintObjectRadarScene } from '@/features/map/game/objectRadar/services/paintObjectRadarScene';
import {
  clearAllSubZonesOnRadar,
  clearRadarZoneCameraLock,
  clearZonePolygonOnRadar,
  clearSubZonePolygonOnRadar,
  lockRadarCameraToZoneBounds,
  syncAllSubZonesOnRadar,
  syncZonePolygonOnRadar,
  syncSubZonePolygonOnRadar,
} from '@/features/map/game/objectRadar/layers/zonePolygonOnRadar';
import { CollectToggle } from '@/features/map/game/objectRadar/ui/CollectToggle';
import { ObjectLegend } from '@/features/map/game/objectRadar/ui/ObjectLegend';
import { ZoneObjectList } from '@/features/map/game/objectRadar/ui/ZoneObjectList';
import { PurposeFilter } from '@/features/map/game/objectRadar/ui/PurposeFilter';
import { RangeControl } from '@/features/map/game/objectRadar/ui/RangeControl';
import type { ObjectRadarPurposeFilter } from '@/features/map/game/objectRadar/radarPurpose';
import { subscribeWorldPlacements } from '@/features/map/game/world/placementsStore';
import { EMPTY_OBJECT_RADAR_FC } from '@/features/map/game/objectRadar/types';
import type { ObjectRadarFeatureCollection } from '@/features/map/game/objectRadar/types';
import { handleWorldPlacementTap } from '@/features/map/game/world/handleWorldPlacementTap';
import { isWorldModelKind } from '@/features/map/game/world/catalog';
import { useVenueMode } from '@/features/experienceZones/store/venueModeStore';
import {
  getSavedAddressPins,
  subscribeSavedAddressPins,
} from '@/features/map/savedAddresses/savedAddressesStore';
import { syncSavedAddressMarkersOnRadar } from '@/features/map/game/objectRadar/layers/savedAddressMarkersOnRadar';
import { useRadarExperienceZonePreview } from '@/features/map/game/objectRadar/layers/useRadarExperienceZonePreview';
import { haptic } from '@/lib/despia/haptics';
import { distanceMeters } from '@/features/map/game/objectRadar/range';
import { safePadTop } from '@/lib/despia/safeArea';
import { MINIMAPS_NAV_CLEARANCE } from '@/features/map/game/minimaps/minimapsTabs';

export function ObjectMap() {
  const {
    rangeM,
    mode,
    purposeFilter,
    sheetOpen,
    selectedId,
    stillOut,
    collected,
    collectedLoaded,
    origin,
  } = useObjectRadarStore();

  const venue = useVenueMode();
  // Zone chrome / polygon / lock only while Explore Zone is opted in.
  const inZone = venue.exploring;
  const zoneId = inZone ? venue.zoneId : null;         // primary (parent) zone
  const subZoneId = inZone ? venue.subZoneId : null;   // sub-zone positional ring
  const zoneName = inZone ? venue.zoneName : null;
  const subZoneName = inZone ? venue.subZoneName : null;

  const hostRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(() => Boolean(getObjectRadarMap()));
  const prevRangeRef = useRef(rangeM);
  // Non-collectible "other" objects — shown as grey dots + named accordion when in zone.
  const [zoneOtherObjects, setZoneOtherObjects] = useState<ObjectRadarFeatureCollection>(EMPTY_OBJECT_RADAR_FC);

  // React to saved-address changes while the sheet is open.
  const savedPins = useSyncExternalStore(
    subscribeSavedAddressPins,
    getSavedAddressPins,
    getSavedAddressPins,
  );
  const lastZoneBoundsRef = useRef<LngLatBoundsLike | null>(null);
  const inZoneRef = useRef(inZone);
  inZoneRef.current = inZone;
  const subZoneIdRef = useRef(subZoneId);
  subZoneIdRef.current = subZoneId;

  useRadarExperienceZonePreview({
    mapReady,
    exploring: inZone,
    sheetOpen,
  });

  const baseFc = mode === 'collected' ? collected : stillOut;
  const activeFc = useMemo(
    () =>
      mode === 'still-out' ? filterByPurpose(baseFc, purposeFilter) : baseFc,
    [baseFc, mode, purposeFilter],
  );
  const nearbySlugCounts = useMemo(
    () => countNearbyObjects(activeFc, origin, rangeM),
    [activeFc, origin, rangeM],
  );
  const nearbyPurposeCounts = useMemo(
    () => countNearbyByPurpose(baseFc, origin, rangeM),
    [baseFc, origin, rangeM],
  );
  const availablePurposes = useMemo(() => {
    const set = new Set<ObjectRadarPurposeFilter>(['all']);
    for (const f of stillOut.features) {
      if (f.properties?.purpose) set.add(f.properties.purpose);
    }
    return set;
  }, [stillOut]);

  useEffect(() => {
    void ensureObjectRadarMap().then((m) => {
      if (m) setMapReady(true);
    });
    return subscribeObjectRadarMapReady(() => setMapReady(true));
  }, []);

  // Zone Object Map is zone-scoped — lock to still-out (no collected / range UI).
  useEffect(() => {
    if (!sheetOpen || !inZone) return;
    if (mode !== 'still-out') objectRadarActions.setMode('still-out');
  }, [sheetOpen, inZone, mode]);

  // Take the shared map while the sheet is open; park on release.
  useEffect(() => {
    if (!sheetOpen || !mapReady) return;
    const host = hostRef.current;
    if (!host) return;
    attachObjectRadarMap(host);
    setObjectRadarMapInteractive(true);
    const map = getObjectRadarMap();
    if (!map) return;
    paintObjectRadarScene(map, {
      origin,
      rangeM,
      objects: activeFc,
      surface: 'object-map',
      selectedId,
      fit: !inZoneRef.current,
      showRangeRing: !inZoneRef.current,
      otherObjects: inZoneRef.current ? zoneOtherObjects : EMPTY_OBJECT_RADAR_FC,
    });
    return () => {
      parkObjectRadarMap();
    };
  // Paint only on open/ready transitions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, mapReady]);

  // ── Zone polygon + camera lock (sheet) ─────────────────────────────────────
  useEffect(() => {
    if (!sheetOpen || !mapReady) return;
    const map = getObjectRadarMap();
    if (!map) return;

    if (!inZone || !zoneId) {
      clearZonePolygonOnRadar(map);
      clearSubZonePolygonOnRadar(map);
      clearAllSubZonesOnRadar(map);
      clearRadarZoneCameraLock(map);
      lastZoneBoundsRef.current = null;
      // Leaving zone while sheet is open — restore the range ring.
      paintObjectRadarScene(map, {
        origin,
        rangeM,
        objects: activeFc,
        surface: 'object-map',
        selectedId,
        fit: false,
        showRangeRing: true,
        otherObjects: EMPTY_OBJECT_RADAR_FC,
      });
      return;
    }

    // Entering / staying in zone — hide range ring (zone polygon owns the frame).
    paintObjectRadarScene(map, {
      origin,
      rangeM,
      objects: activeFc,
      surface: 'object-map',
      selectedId,
      fit: false,
      showRangeRing: false,
      otherObjects: zoneOtherObjects,
    });

    const ac = new AbortController();
    void (async () => {
      // Primary zone — camera lock + outer boundary.
      const bounds = await syncZonePolygonOnRadar(map, zoneId, ac.signal);
      if (ac.signal.aborted) return;
      lastZoneBoundsRef.current = bounds;
      if (bounds) {
        lockRadarCameraToZoneBounds(map, bounds, {
          animate: true,
          duration: 420,
          padding: 56,
        });
      }
      // All sub-zones — labeled zone map so the player can see the full layout.
      void syncAllSubZonesOnRadar(map, zoneId, ac.signal);
      // Current sub-zone — bright positional ring showing where the player stands.
      if (subZoneIdRef.current) {
        void syncSubZonePolygonOnRadar(map, subZoneIdRef.current, ac.signal);
      } else {
        clearSubZonePolygonOnRadar(map);
      }
    })();

    return () => {
      ac.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, mapReady, inZone, zoneId]);

  // Re-assert zone outlines after marker paints (keep lock, don't re-fit).
  useEffect(() => {
    if (!sheetOpen || !mapReady || !inZone || !zoneId) return;
    const map = getObjectRadarMap();
    if (!map) return;
    const ac = new AbortController();
    void (async () => {
      const bounds = await syncZonePolygonOnRadar(map, zoneId, ac.signal);
      if (ac.signal.aborted || !bounds) return;
      lastZoneBoundsRef.current = bounds;
      lockRadarCameraToZoneBounds(map, bounds, { fit: false });
      // Re-assert all sub-zone labels (geometries are cached — no extra network).
      void syncAllSubZonesOnRadar(map, zoneId, ac.signal);
      if (subZoneId) {
        void syncSubZonePolygonOnRadar(map, subZoneId, ac.signal);
      } else {
        clearSubZonePolygonOnRadar(map);
      }
    })();
    return () => ac.abort();
  }, [sheetOpen, mapReady, inZone, zoneId, subZoneId, activeFc]);

  // Unlock free camera when the Object Map sheet closes.
  useEffect(() => {
    if (sheetOpen) return;
    const map = getObjectRadarMap();
    if (!map) return;
    clearRadarZoneCameraLock(map);
  }, [sheetOpen]);

  // The store is kept fresh by PlacementStreamService (owned by WorldModelsLayer).
  useEffect(() => {
    if (!sheetOpen || !mapReady || mode !== 'still-out') return;
    const apply = () => {
      objectRadarActions.setStillOut(readStillOutObjects());
      setZoneOtherObjects(readZoneOtherObjects());
    };
    apply();
    return subscribeWorldPlacements(apply);
  }, [sheetOpen, mapReady, mode]);

  useEffect(() => {
    if (!sheetOpen || !mapReady || mode !== 'collected') return;
    if (collectedLoaded) return;
    let cancelled = false;
    void (async () => {
      const fc = await loadCollectedObjects();
      if (!cancelled) objectRadarActions.setCollected(fc);
    })();
    return () => {
      cancelled = true;
    };
  }, [sheetOpen, mapReady, mode, collectedLoaded]);

  useEffect(() => {
    if (!sheetOpen || !mapReady) return;
    const map = getObjectRadarMap();
    if (!map) return;
    paintObjectRadarScene(map, {
      origin,
      rangeM,
      objects: activeFc,
      surface: 'object-map',
      selectedId,
      fit: false,
      showRangeRing: !inZoneRef.current,
      otherObjects: inZoneRef.current ? zoneOtherObjects : EMPTY_OBJECT_RADAR_FC,
    });
  }, [sheetOpen, mapReady, origin, rangeM, activeFc, selectedId, zoneOtherObjects]);

  // Lightweight refresh when saved addresses change — only re-syncs that layer.
  useEffect(() => {
    if (!sheetOpen || !mapReady) return;
    const map = getObjectRadarMap();
    if (!map) return;
    syncSavedAddressMarkersOnRadar(map, savedPins, 'object-map', origin, rangeM);
  }, [sheetOpen, mapReady, savedPins, origin, rangeM]);

  useEffect(() => {
    if (!sheetOpen || !mapReady) return;
    const changed = prevRangeRef.current !== rangeM;
    prevRangeRef.current = rangeM;
    const map = getObjectRadarMap();
    if (!map) return;

    paintObjectRadarScene(map, {
      origin,
      rangeM,
      objects: activeFc,
      surface: 'object-map',
      selectedId,
      fit: false,
      showRangeRing: !inZoneRef.current,
      otherObjects: inZoneRef.current ? zoneOtherObjects : EMPTY_OBJECT_RADAR_FC,
    });

    // In zone mode keep camera on the zone; in range mode animate to range.
    if (inZoneRef.current && lastZoneBoundsRef.current) {
      lockRadarCameraToZoneBounds(map, lastZoneBoundsRef.current, {
        animate: changed,
        duration: changed ? 320 : 0,
        padding: 56,
        fit: true,
      });
    } else if (!inZoneRef.current) {
      syncObjectRadarCamera(origin, rangeM, { duration: changed ? 320 : 0 });
    }
  }, [rangeM]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sheetOpen || !mapReady) return;
    const map = getObjectRadarMap();
    if (!map) return;
    return bindObjectMarkerClicks(
      map,
      (id, lngLat) => {
        objectRadarActions.setSelectedId(id);
        try {
          map.easeTo({
            center: [lngLat.lng, lngLat.lat],
            duration: 380,
            essential: true,
          });
        } catch {
          /* ignore */
        }

        if (mode !== 'still-out') return;
        const d = distanceMeters(origin, { lat: lngLat.lat, lng: lngLat.lng });
        if (d <= rangeM) return;
        const feature = stillOut.features.find((f) => String(f.id) === id);
        const kindRaw = String(feature?.properties?.slug ?? '');
        if (!isWorldModelKind(kindRaw)) return;
        haptic.toggle();
        handleWorldPlacementTap(kindRaw, id, {
          lat: lngLat.lat,
          lng: lngLat.lng,
        });
      },
      () => objectRadarActions.setSelectedId(null),
    );
  }, [sheetOpen, mapReady, mode, origin, rangeM, stillOut]);

  if (!sheetOpen) return null;

  return (
    <div
      data-object-radar="object-map"
      data-zone-mode={inZone ? 'true' : undefined}
      className="relative flex min-h-0 flex-1 flex-col"
    >
      {/* Zone atmosphere — purple wash + edge glow */}
      {inZone ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background:
                'radial-gradient(ellipse 90% 55% at 50% -10%, rgba(124,58,237,0.38) 0%, transparent 58%), radial-gradient(ellipse 70% 40% at 50% 110%, rgba(91,33,182,0.22) 0%, transparent 55%)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[3px]"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, #7C3AED 22%, #A78BFA 50%, #7C3AED 78%, transparent 100%)',
              boxShadow: '0 0 18px 2px rgba(139,92,246,0.55)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[2px]"
            style={{
              background:
                'linear-gradient(180deg, #7C3AED 0%, transparent 40%, transparent 60%, #7C3AED 100%)',
              opacity: 0.55,
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-20 w-[2px]"
            style={{
              background:
                'linear-gradient(180deg, #7C3AED 0%, transparent 40%, transparent 60%, #7C3AED 100%)',
              opacity: 0.55,
            }}
            aria-hidden
          />
        </>
      ) : null}

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 px-3"
        style={{ paddingTop: safePadTop('3.75rem') }}
      >
        <div className="flex min-w-0 flex-col items-start gap-2">
          {inZone && zoneName ? (
            <>
              {subZoneName ? (
                <p className="text-[11px] font-medium text-violet-200/65">
                  In {subZoneName}
                </p>
              ) : null}
              <PurposeFilter
                value={purposeFilter}
                onChange={(p) => objectRadarActions.setPurposeFilter(p)}
                available={availablePurposes}
                zoneAccent
              />
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <CollectToggle
                  mode={mode}
                  onChange={(m) => objectRadarActions.setMode(m)}
                />
                <RangeControl
                  rangeM={rangeM}
                  onChange={(m) => objectRadarActions.setRangeM(m)}
                />
              </div>
              {mode === 'still-out' ? (
                <PurposeFilter
                  value={purposeFilter}
                  onChange={(p) => objectRadarActions.setPurposeFilter(p)}
                  available={availablePurposes}
                />
              ) : null}
            </>
          )}
        </div>
        {inZone && activeFc.features.length > 0 ? (
          <span className="pointer-events-none rounded-full border border-violet-400/30 bg-violet-950/70 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-violet-200/90 backdrop-blur-sm">
            {activeFc.features.length}{' '}
            {activeFc.features.length === 1 ? 'object' : 'objects'}
          </span>
        ) : null}
      </div>

      <div
        ref={hostRef}
        className={`relative min-h-0 flex-1 ${
          inZone ? 'ring-1 ring-inset ring-violet-500/20' : ''
        }`}
      />

      {/* Bottom panel — zone object list in venue mode, legend otherwise */}
      {inZone && zoneName ? (
        <ZoneObjectList
          objects={activeFc}
          otherObjects={zoneOtherObjects}
          origin={origin}
          zoneName={zoneName}
          bottomClearance={MINIMAPS_NAV_CLEARANCE}
        />
      ) : (
        <ObjectLegend
          purposeCounts={nearbyPurposeCounts}
          slugCounts={nearbySlugCounts}
          mode={mode}
          modeLabel={
            mode === 'collected'
              ? `Collected · ${rangeM} m range`
              : purposeFilter === 'all'
                ? `Still out · ${rangeM} m range`
                : `${purposeFilter} · ${rangeM} m range`
          }
          bottomClearance={MINIMAPS_NAV_CLEARANCE}
        />
      )}
    </div>
  );
}
