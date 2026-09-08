'use client';

/**
 * Object MiniMap — dial peek of the shared Object Radar map.
 *
 * Container: `data-object-radar="minimap"` (mounted by GameMinimapRail).
 *
 * Live:
 *   Pins inside Range → circle dots on the map.
 *   Pins outside Range → rim ticks on the border (direction only).
 *   Basemap stays north-up. Wedge = camera-forward direction (mapBearing).
 *   Camera follows the player's live position (range circle frame).
 *
 * Scout:
 *   Surface-down peek of the main map viewport footprint — no player cursor,
 *   no range boundary. Camera fits `mainMap.getBounds()` at pitch 0 / north-up.
 *   Rim ticks stay off (they encode player-range, not viewport).
 *
 * Venue / experience-zone mode (Live):
 *   Same live-position camera — dial stays locked on the player.
 *   Zone polygon painted as a violet fill+line overlay.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  OBJECT_RADAR_MINIMAP_CLIP_PAD,
  OBJECT_RADAR_MINIMAP_SIZE_PX,
} from '@/features/map/game/objectRadar/constants';
import {
  clipInRangeObjects,
  clipObjectsInBounds,
} from '@/features/map/game/objectRadar/data/clipObjectsForRadar';
import {
  objectRadarActions,
  useObjectRadarStore,
} from '@/features/map/game/objectRadar/objectRadarStore';
import {
  attachObjectRadarMap,
  ensureObjectRadarMap,
  getObjectRadarMap,
  setObjectRadarMapInteractive,
  subscribeObjectRadarMapReady,
  syncObjectRadarCamera,
  syncObjectRadarViewportCamera,
} from '@/features/map/game/objectRadar/services/objectRadarMapEngine';
import { paintObjectRadarScene } from '@/features/map/game/objectRadar/services/paintObjectRadarScene';
import {
  clearZonePolygonOnRadar,
  clearSubZonePolygonOnRadar,
  syncZonePolygonOnRadar,
  syncSubZonePolygonOnRadar,
} from '@/features/map/game/objectRadar/layers/zonePolygonOnRadar';
import {
  ZoneMiniLegend,
} from '@/features/map/game/objectRadar/ui/ZoneObjectList';
import { readZoneOtherObjects } from '@/features/map/game/objectRadar/services/loadStillOutObjects';
import { EMPTY_OBJECT_RADAR_FC } from '@/features/map/game/objectRadar/types';
import { CompassOverlay } from '@/features/map/game/objectRadar/ui/CompassOverlay';
import {
  buildRimTicks,
  RimTicks,
} from '@/features/map/game/objectRadar/ui/RimTicks';
import type { ObjectRadarOrigin } from '@/features/map/game/objectRadar/types';
import { useVenueMode } from '@/features/experienceZones/store/venueModeStore';
import {
  getSavedAddressPins,
  subscribeSavedAddressPins,
} from '@/features/map/savedAddresses/savedAddressesStore';
import { useMapContext } from '@/map/MapProvider';
import { usePresence } from '@/map/location/positionMode/usePositionMode';

/** Minimap GL camera — always north-up; chrome reads `origin.bearing` separately. */
function northUpOrigin(origin: ObjectRadarOrigin): ObjectRadarOrigin {
  return { lng: origin.lng, lat: origin.lat, bearing: 0 };
}

function readMainViewportBounds(map: mapboxgl.Map | null): {
  west: number;
  south: number;
  east: number;
  north: number;
} | null {
  if (!map) return null;
  try {
    const b = map.getBounds();
    if (!b) return null;
    return {
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    };
  } catch {
    return null;
  }
}

export function ObjectMiniMap() {
  const { map: mainMap, ready: mainMapReady } = useMapContext();
  const { mode: presenceMode } = usePresence();
  const scout = presenceMode === 'scout';
  const { rangeM, sheetOpen, stillOut, origin } = useObjectRadarStore();
  const venue = useVenueMode();
  // No zone polygon / purple chrome until the user opts into Explore Zone.
  const inZone = venue.exploring;
  const zoneId = inZone ? venue.zoneId : null;         // primary (parent) zone
  const subZoneId = inZone ? venue.subZoneId : null;   // inner positional ring
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(() => Boolean(getObjectRadarMap()));
  const lastPaintKeyRef = useRef('');
  /**
   * Tracks whether the sheet was open on the last render so we can detect the
   * sheet→minimap host transfer and always force a full repaint on that tick.
   */
  const wasSheetOpenRef = useRef(false);

  // Trigger repaint whenever saved addresses change (new saves/unsaves).
  const savedPins = useSyncExternalStore(
    subscribeSavedAddressPins,
    getSavedAddressPins,
    getSavedAddressPins,
  );

  const viewportBounds = useMemo(() => {
    if (!scout || !mainMapReady) return null;
    return readMainViewportBounds(mainMap);
    // origin updates on every main-map move while Scout — cheap bounds refresh signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: origin ticks viewport
  }, [scout, mainMap, mainMapReady, origin.lng, origin.lat, origin.bearing]);

  // Live: clip to player range. Scout: clip to main-map viewport footprint.
  const inRangeObjects = useMemo(() => {
    if (scout && viewportBounds) {
      return clipObjectsInBounds(stillOut, viewportBounds);
    }
    return clipInRangeObjects(stillOut, origin, rangeM, OBJECT_RADAR_MINIMAP_CLIP_PAD);
  }, [scout, viewportBounds, stillOut, origin, rangeM]);

  // Outside Range only — Live. Scout has no player-range rim.
  const rimTicks = useMemo(() => {
    if (scout) return [];
    return buildRimTicks({
      origin,
      mapBearing: 0,
      rangeM,
      objects: stillOut,
    });
  }, [scout, origin, rangeM, stillOut]);

  useEffect(() => {
    void ensureObjectRadarMap().then((m) => {
      if (m) setReady(true);
    });
    return subscribeObjectRadarMapReady(() => setReady(true));
  }, []);

  // ── Zone polygon overlay (Live player-centered dial) ──────────────────────
  useEffect(() => {
    const map = getObjectRadarMap();
    if (sheetOpen || !ready || !map || scout) {
      if (map && scout) {
        clearZonePolygonOnRadar(map);
        clearSubZonePolygonOnRadar(map);
      }
      return;
    }

    if (!inZone || !zoneId) {
      clearZonePolygonOnRadar(map);
      clearSubZonePolygonOnRadar(map);
      return;
    }

    const ac = new AbortController();
    void (async () => {
      await syncZonePolygonOnRadar(map, zoneId, ac.signal);
      if (ac.signal.aborted) return;
      if (subZoneId) {
        void syncSubZonePolygonOnRadar(map, subZoneId, ac.signal);
      } else {
        clearSubZonePolygonOnRadar(map);
      }
    })();
    return () => {
      ac.abort();
    };
  }, [sheetOpen, ready, scout, inZone, zoneId, subZoneId]);

  // ── Marker repaint + camera (Live = player range, Scout = viewport) ───────
  const originLng = origin.lng;
  const originLat = origin.lat;
  const boundsKey = viewportBounds
    ? [
        viewportBounds.west.toFixed(5),
        viewportBounds.south.toFixed(5),
        viewportBounds.east.toFixed(5),
        viewportBounds.north.toFixed(5),
      ].join(',')
    : '';

  useEffect(() => {
    if (sheetOpen || !ready) {
      wasSheetOpenRef.current = sheetOpen;
      return;
    }

    const host = hostRef.current;
    if (!host) return;

    const returningFromSheet = wasSheetOpenRef.current;
    wasSheetOpenRef.current = false;

    attachObjectRadarMap(host);
    setObjectRadarMapInteractive(false);

    const dialOrigin = northUpOrigin({ lng: originLng, lat: originLat, bearing: 0 });

    const paintKey = [
      scout ? 'scout' : 'live',
      originLng.toFixed(6),
      originLat.toFixed(6),
      scout ? boundsKey : String(rangeM),
      inRangeObjects.features.length,
      savedPins.length,
      !scout && inZone ? zoneId ?? 'zone' : 'out',
      !scout && inZone ? subZoneId ?? '' : '',
    ].join('|');

    const needsFullPaint = returningFromSheet || paintKey !== lastPaintKeyRef.current;
    if (needsFullPaint) lastPaintKeyRef.current = paintKey;

    const repaint = () => {
      const m = getObjectRadarMap();
      if (!m) return;
      m.resize();
      // Always hide player marker + range ring on the dial.
      paintObjectRadarScene(m, {
        origin: dialOrigin,
        rangeM,
        objects: inRangeObjects,
        surface: 'minimap',
        fit: false,
        showRangeRing: false,
        otherObjects: !scout && inZone ? readZoneOtherObjects() : EMPTY_OBJECT_RADAR_FC,
      });

      if (scout) {
        const bounds = readMainViewportBounds(mainMap) ?? viewportBounds;
        if (bounds) {
          syncObjectRadarViewportCamera(bounds);
        } else {
          // Cold Scout before main map bounds — center only, no range disc.
          syncObjectRadarCamera(dialOrigin, rangeM);
        }
      } else {
        syncObjectRadarCamera(dialOrigin, rangeM);
        if (inZone && zoneId) {
          void syncZonePolygonOnRadar(m, zoneId, new AbortController().signal);
        }
        if (inZone && subZoneId) {
          void syncSubZonePolygonOnRadar(m, subZoneId, new AbortController().signal);
        }
      }
      try {
        m.triggerRepaint();
      } catch {
        /* ignore */
      }
    };

    if (needsFullPaint) {
      repaint();
    } else if (!scout && inZone && zoneId) {
      const m = getObjectRadarMap();
      if (m) {
        void syncZonePolygonOnRadar(m, zoneId, new AbortController().signal);
        if (subZoneId) void syncSubZonePolygonOnRadar(m, subZoneId, new AbortController().signal);
      }
    }

    const t1 = window.setTimeout(repaint, 60);
    const t2 = window.setTimeout(repaint, 220);
    const t3 = returningFromSheet ? window.setTimeout(repaint, 500) : null;

    const m = getObjectRadarMap();
    const onIdle = () => repaint();
    m?.once('idle', onIdle);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      if (t3 != null) window.clearTimeout(t3);
      m?.off('idle', onIdle);
    };
  }, [
    sheetOpen,
    ready,
    scout,
    originLng,
    originLat,
    boundsKey,
    rangeM,
    inRangeObjects,
    savedPins,
    inZone,
    zoneId,
    subZoneId,
    mainMap,
    viewportBounds,
  ]);

  const borderClass = inZone && !scout
    ? 'border-violet-500 shadow-[0_4px_18px_rgba(139,92,246,0.35)] ring-1 ring-inset ring-violet-900/30'
    : 'border-white/85 shadow-[0_4px_18px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-black/40';

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div
        data-object-radar="minimap"
        className={`relative shrink-0 transition-opacity ${
          sheetOpen
            ? 'pointer-events-none opacity-0'
            : 'pointer-events-auto opacity-100'
        }`}
        style={{
          width: OBJECT_RADAR_MINIMAP_SIZE_PX,
          height: OBJECT_RADAR_MINIMAP_SIZE_PX,
        }}
      >
        <div
          ref={hostRef}
          className="absolute inset-0 z-0 overflow-hidden rounded-2xl bg-[#050608]"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <CompassOverlay mapBearing={origin.bearing} />
          {!scout ? <RimTicks ticks={rimTicks} /> : null}
        </div>
        <span
          className={`pointer-events-none absolute inset-0 z-[2] rounded-2xl border-[2.5px] transition-colors duration-300 ${borderClass}`}
          aria-hidden
        />
        <button
          type="button"
          className="absolute inset-0 z-10 rounded-2xl transition active:scale-95"
          aria-label="Open minimaps"
          aria-hidden={sheetOpen}
          tabIndex={sheetOpen ? -1 : 0}
          onClick={() => objectRadarActions.openSheet()}
        />
      </div>
      {inZone && !scout ? (
        <ZoneMiniLegend objects={stillOut} />
      ) : null}
    </div>
  );
}
