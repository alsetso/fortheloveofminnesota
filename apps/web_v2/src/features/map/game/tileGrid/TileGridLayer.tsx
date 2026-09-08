'use client';

/**
 * Tile grid feature — satellite ground plane + tile boundary overlay.
 *
 * Mount once inside GameDock alongside WorldModelsLayer. Origin and Scout
 * gating come from playerPresenceOrigin (not mapModeStore).
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { FeatureCollection, Polygon } from 'geojson';
import { useMapContext } from '@/map/MapProvider';
import { MAP_CONFIG } from '@/map/config';
import { waitForMapStyleReady } from '@/map/engine/mapStyleGuard';
import {
  surroundingTiles,
  tileBoundsGeoJson,
  lngLatToTile,
} from '@/map/geo/tileMath';
import {
  ensureTileGridLayers,
  removeTileGridLayers,
  syncTileGridData,
} from './ensureTileGridLayers';
import {
  getTileGridState,
  subscribeTileGrid,
} from './tileGridStore';
import {
  getVenueModeSnapshot,
  subscribeVenueMode,
} from '@/features/experienceZones/store/venueModeStore';
import {
  getPresenceOrigin,
  subscribePresenceOrigin,
} from '@/map/location/positionMode/playerPresenceOrigin';
import {
  getPositionModeSnapshot,
  getPositionModeServerSnapshot,
  subscribePositionMode,
} from '@/map/location/positionMode/positionModeStore';

function buildGridData(
  lng: number,
  lat: number,
  zoom: number,
  radius: number,
): FeatureCollection<Polygon> {
  const intZoom = Math.floor(zoom);
  const tiles = surroundingTiles(lng, lat, intZoom, radius);
  return tileBoundsGeoJson(tiles);
}

/**
 * Always centre the tile grid on Presence origin (avatar / Find Me), not the
 * viewport. Scout pans must not recentre the grid on the camera.
 */
function getGridOrigin(map: mapboxgl.Map): { lng: number; lat: number; zoom: number } {
  const zoom = map.getZoom();
  const origin = getPresenceOrigin();
  if (origin.hasFix) return { lng: origin.lng, lat: origin.lat, zoom };
  const c = map.getCenter();
  return { lng: c.lng, lat: c.lat, zoom };
}

export function TileGridLayer() {
  const { map, ready } = useMapContext();
  const tileState = useSyncExternalStore(
    subscribeTileGrid,
    getTileGridState,
    getTileGridState,
  );
  const venue = useSyncExternalStore(
    subscribeVenueMode,
    getVenueModeSnapshot,
    getVenueModeSnapshot,
  );
  const presence = useSyncExternalStore(
    subscribePositionMode,
    getPositionModeSnapshot,
    getPositionModeServerSnapshot,
  );
  const scout = presence.mode === 'scout'; // Scout

  const stateRef = useRef(tileState);
  stateRef.current = tileState;
  const venueActiveRef = useRef(venue.exploring);
  venueActiveRef.current = venue.exploring;
  const scoutRef = useRef(scout);
  scoutRef.current = scout;

  const token = MAP_CONFIG.MAPBOX_TOKEN;

  // Scout — remove grid (continent-sized tiles at low zoom thrash on pan).
  useEffect(() => {
    if (!map || !ready) return;
    if (scout) removeTileGridLayers(map);
  }, [map, ready, scout]);

  // Explore Zone — hide debug grid so the grounds stay immersive.
  useEffect(() => {
    if (!map || !ready) return;
    if (venue.exploring) removeTileGridLayers(map);
  }, [map, ready, venue.exploring]);

  // Mount / unmount — re-apply on style.load.
  useEffect(() => {
    if (!map || !ready) return;

    const apply = () => {
      if (venueActiveRef.current || scoutRef.current) {
        removeTileGridLayers(map);
        return;
      }
      const { lng, lat, zoom } = getGridOrigin(map);
      const s = stateRef.current;
      ensureTileGridLayers(map, {
        token,
        showSatellite: s.showSatellite,
        showGridLines: s.showGridLines,
        gridData: s.showGridLines
          ? buildGridData(lng, lat, zoom, s.radius)
          : { type: 'FeatureCollection', features: [] },
      });
    };

    void waitForMapStyleReady(map, { timeoutMs: 15_000 }).then(apply).catch(() => {});
    map.on('style.load', apply);

    return () => {
      map.off('style.load', apply);
      removeTileGridLayers(map);
    };
  }, [map, ready, token]);

  // Sync whenever store / presence changes.
  useEffect(() => {
    if (!map || !ready) return;
    if (venue.exploring || scout) {
      removeTileGridLayers(map);
      return;
    }
    const { lng, lat, zoom } = getGridOrigin(map);
    ensureTileGridLayers(map, {
      token,
      showSatellite: tileState.showSatellite,
      showGridLines: tileState.showGridLines,
      gridData: tileState.showGridLines
        ? buildGridData(lng, lat, zoom, tileState.radius)
        : { type: 'FeatureCollection', features: [] },
    });
  }, [map, ready, token, tileState, venue.exploring, scout]);

  // Recompute grid when Presence origin moves (player tile change only).
  useEffect(() => {
    if (!map || !ready) return;

    const onPresenceMove = () => {
      if (venueActiveRef.current || scoutRef.current) return;
      if (!stateRef.current.showGridLines) return;

      const { lng, lat, zoom } = getGridOrigin(map);
      const prev = lngLatToTile(lng, lat, Math.floor(zoom));
      if (
        lastTile.current &&
        lastTile.current.z === prev.z &&
        lastTile.current.x === prev.x &&
        lastTile.current.y === prev.y
      ) {
        return;
      }
      lastTile.current = prev;
      syncTileGridData(map, buildGridData(lng, lat, zoom, stateRef.current.radius));
    };

    // Map move still fires while Live follow tracks the player.
    map.on('move', onPresenceMove);
    map.on('zoom', onPresenceMove);
    const unsub = subscribePresenceOrigin(onPresenceMove);
    return () => {
      map.off('move', onPresenceMove);
      map.off('zoom', onPresenceMove);
      unsub();
    };
  }, [map, ready]);

  return null;
}

const lastTile = { current: null as ReturnType<typeof lngLatToTile> | null };
