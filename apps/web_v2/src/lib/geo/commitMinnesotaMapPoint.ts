'use client';

import type { Map as MapboxMap } from 'mapbox-gl';
import { MAP_CONFIG } from '@/map/config';
import { useMapContext } from '@/map/MapProvider';
import {
  clearSelectedPointCoords,
  setSelectedPointCoords,
} from '@/map/location/camera/selectedPointCoordsStore';
import {
  gateMinnesotaLocation,
  OUTSIDE_MN_MESSAGE,
} from '@/map/location/device/minnesotaGate';
import type { UserCoords } from '@/map/location/device/geolocation';
import {
  MAP_STATUS_ERROR_LINGER_MS,
  MAP_STATUS_SUCCESS_LINGER_MS,
  MAP_STATUS_TOAST_IDS,
  publishMapStatus,
} from '@/features/map/toast/mapStatusToastStore';
import { fetchReverseGeocodeDetailed } from '@/lib/geo/fetch/fetchReverseGeocode';
import { selectedPointFocusPadding } from '@/lib/geo/selectedPointFocusPadding';
import { resolveMapClickZoom } from '@/map/location/camera/mapClickZoom';
import { acquireExclusiveCameraIntent } from '@/map/location/camera/cameraIntentStore';
import { fetchTerritoryAtPoint } from '@/lib/territory/fetchTerritoryAtPoint';
import type { TerritoryAtPointItem } from '@/lib/territory/territoryAtPointTypes';
import {
  clearPointAtLocationCache,
  pointAtLocationCacheKey,
  setPointAtLocationCache,
} from '@/features/map/dockCore/store/pointAtLocationCache';
import { clearMapSurface } from '@/map/surface/mapSurfaceStore';
import { clearMapGeoFeatures } from '@/map/geo/mapGeoFeaturesStore';

export type CommitMapPointSource = 'mapClick' | 'mapSearch';

export type CommitMapPointOk = {
  ok: true;
  address: string | null;
  jurisdictions: TerritoryAtPointItem[];
};

export type CommitMapPointFail = { ok: false; message: string };

async function warmPointAtLocationCache(
  coords: UserCoords,
  signal?: AbortSignal,
): Promise<{
  address: string | null;
  jurisdictions: TerritoryAtPointItem[];
  outsideMinnesota: boolean;
  error: string | null;
}> {
  const [reverse, atPoint] = await Promise.all([
    fetchReverseGeocodeDetailed(coords.lat, coords.lng, signal),
    fetchTerritoryAtPoint(coords.lat, coords.lng, signal),
  ]);

  if (signal?.aborted) {
    return {
      address: null,
      jurisdictions: [],
      outsideMinnesota: false,
      error: 'Aborted',
    };
  }

  if (reverse.outsideMinnesota) {
    return {
      address: null,
      jurisdictions: [],
      outsideMinnesota: true,
      error: OUTSIDE_MN_MESSAGE,
    };
  }

  const jurisdictions = atPoint?.jurisdictions ?? [];
  const address = reverse.address?.trim() || null;
  const bothFailed = !address && atPoint == null;
  const error = bothFailed
    ? reverse.error?.trim() || 'Could not look up this location.'
    : null;

  setPointAtLocationCache({
    key: pointAtLocationCacheKey(coords.lat, coords.lng),
    address,
    jurisdictions,
    error,
  });

  return { address, jurisdictions, outsideMinnesota: false, error };
}

/**
 * Shared commit path for empty-map click + universal search place hits.
 *
 * Map click — MN gate → drop pin + return immediately (no status toast).
 * Address warms in the background for the dock pill / pane.
 *
 * Search — keeps toast + awaits lookups before the caller opens the pane.
 */
export async function commitMinnesotaMapPoint(
  coords: UserCoords,
  opts: {
    source: CommitMapPointSource;
    map: MapboxMap | null;
    fly?: boolean;
    label?: string;
    signal?: AbortSignal;
  },
): Promise<CommitMapPointOk | CommitMapPointFail> {
  const isMapClick = opts.source === 'mapClick';
  const toastId = isMapClick
    ? MAP_STATUS_TOAST_IDS.mapClick
    : MAP_STATUS_TOAST_IDS.mapSearch;
  const parentLabel = opts.label ?? 'Map point';

  const gate = gateMinnesotaLocation(coords);
  if (gate.ok === false) {
    const gateMessage = gate.message;
    // Map click skips the loading toast — still surface out-of-state errors.
    publishMapStatus(
      {
        id: toastId,
        label: parentLabel,
        status: 'error',
        detail: gateMessage,
      },
      { title: OUTSIDE_MN_MESSAGE, lingerMs: MAP_STATUS_ERROR_LINGER_MS },
    );
    return { ok: false, message: gateMessage };
  }

  clearPointAtLocationCache();
  clearMapSurface();
  clearMapGeoFeatures();
  setSelectedPointCoords(coords);

  if (opts.fly && opts.map) {
    const padding = selectedPointFocusPadding(opts.map);
    // Hold 'pinned' intent for the flyTo duration to prevent GPS follow-tick jank.
    acquireExclusiveCameraIntent('pinned', 2000);
    // Map clicks step in toward max zoom; search still lands at SELECTED_POINT_ZOOM.
    const zoom = isMapClick
      ? resolveMapClickZoom(opts.map)
      : MAP_CONFIG.SELECTED_POINT_ZOOM;
    opts.map.flyTo({
      center: [coords.lng, coords.lat],
      zoom,
      padding,
      speed: 0.85,
      curve: 1.55,
      essential: true,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    });
  }

  // Map click: open the dock immediately — warm address cache in the background.
  if (isMapClick) {
    void (async () => {
      const warmed = await warmPointAtLocationCache(coords, opts.signal);
      if (opts.signal?.aborted) return;
      if (warmed.outsideMinnesota) {
        clearSelectedPointCoords();
        clearPointAtLocationCache();
        publishMapStatus(
          {
            id: toastId,
            label: parentLabel,
            status: 'error',
            detail: OUTSIDE_MN_MESSAGE,
          },
          { title: OUTSIDE_MN_MESSAGE, lingerMs: MAP_STATUS_ERROR_LINGER_MS },
        );
      }
    })();
    return { ok: true, address: null, jurisdictions: [] };
  }

  publishMapStatus(
    { id: toastId, label: parentLabel, status: 'loading' },
    { title: 'Search' },
  );

  const warmed = await warmPointAtLocationCache(coords, opts.signal);

  if (opts.signal?.aborted) {
    return { ok: false, message: 'Aborted' };
  }

  if (warmed.outsideMinnesota) {
    clearSelectedPointCoords();
    clearPointAtLocationCache();
    publishMapStatus(
      {
        id: toastId,
        label: parentLabel,
        status: 'error',
        detail: OUTSIDE_MN_MESSAGE,
      },
      { title: OUTSIDE_MN_MESSAGE, lingerMs: MAP_STATUS_ERROR_LINGER_MS },
    );
    return { ok: false, message: OUTSIDE_MN_MESSAGE };
  }

  if (warmed.error && !warmed.address && warmed.jurisdictions.length === 0) {
    publishMapStatus(
      {
        id: toastId,
        label: parentLabel,
        status: 'error',
        detail: warmed.error,
      },
      { title: 'Location error', lingerMs: MAP_STATUS_ERROR_LINGER_MS },
    );
    return { ok: false, message: warmed.error };
  }

  const addressOk = Boolean(warmed.address);
  const territoriesOk = warmed.jurisdictions.length > 0;

  publishMapStatus(
    {
      id: toastId,
      label: parentLabel,
      status: 'success',
      detail:
        warmed.address ??
        `${coords.lat.toFixed(5)}°, ${coords.lng.toFixed(5)}°`,
    },
    {
      title: addressOk && territoriesOk ? 'Location ready' : 'Location found',
      lingerMs: MAP_STATUS_SUCCESS_LINGER_MS,
    },
  );

  return {
    ok: true,
    address: warmed.address,
    jurisdictions: warmed.jurisdictions,
  };
}

/** Hook-friendly wrapper that reads the live map from context. */
export function useCommitMinnesotaMapPoint() {
  const { map } = useMapContext();
  return {
    commit: (
      coords: UserCoords,
      opts: Omit<Parameters<typeof commitMinnesotaMapPoint>[1], 'map'> & {
        map?: MapboxMap | null;
      },
    ) =>
      commitMinnesotaMapPoint(coords, {
        ...opts,
        map: opts.map ?? map,
      }),
  };
}
