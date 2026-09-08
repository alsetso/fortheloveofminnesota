'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap, AnyLayer } from 'mapbox-gl';
import type { FeatureCollection } from 'geojson';
import { mapUsesMapboxStandard } from '@/map/buildings/applyMapBuildings3D';
import { mapDataStore } from '@/map/data/MapDataStore';
import {
  isMapStyleReady,
  safeGetLayer,
  safeGetSource,
} from '@/map/engine/mapStyleGuard';

export type GeoJsonLayerSpec = {
  sourceId: string;
  dataId?: string;
  layers: Omit<AnyLayer, 'source'>[];
  beforeId?: string;
  initialData?: FeatureCollection;
  generateId?: boolean;
  /** Promote a feature property as the Mapbox feature id (for feature-state). */
  promoteId?: string;
};

type GeoJsonLayerProps = {
  map: MapboxMap | null;
  ready: boolean;
  spec: GeoJsonLayerSpec;
  visible?: boolean;
};

type GeoJsonSource = {
  setData: (data: FeatureCollection) => void;
};

type LayerWithSlot = AnyLayer & { slot?: 'bottom' | 'middle' | 'top' };

/** Mapbox Standard needs an explicit slot or custom layers paint under/into the basemap. */
function withStandardSlot(map: MapboxMap, layer: AnyLayer): LayerWithSlot {
  if (!mapUsesMapboxStandard(map)) return layer as LayerWithSlot;
  if ('slot' in layer && (layer as LayerWithSlot).slot) return layer as LayerWithSlot;
  const slot = layer.type === 'symbol' || layer.type === 'line' ? 'top' : 'middle';
  return { ...(layer as LayerWithSlot), slot };
}

function applyVisibility(
  map: MapboxMap,
  layers: Omit<AnyLayer, 'source'>[],
  visible: boolean,
): void {
  const visibility = visible ? 'visible' : 'none';
  for (const layer of layers) {
    if (!safeGetLayer(map, layer.id)) continue;
    try {
      map.setLayoutProperty(layer.id, 'visibility', visibility);
    } catch {
      /* ignore mid-reload */
    }
  }
}

/**
 * One GeoJSON source + N layers, synced to MapDataStore.
 * Re-mounts after style reloads so sources survive setStyle().
 * On Mapbox Standard, assigns `slot` so territory fills/lines paint above the basemap.
 */
export function GeoJsonLayer({ map, ready, spec, visible = true }: GeoJsonLayerProps) {
  const mountedRef = useRef(false);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const [styleEpoch, setStyleEpoch] = useState(0);
  const {
    sourceId,
    dataId = sourceId,
    layers,
    beforeId,
    initialData,
    generateId = true,
    promoteId,
  } = spec;

  const layersRef = useRef(layers);
  layersRef.current = layers;

  useEffect(() => {
    if (!map) return;
    const bump = () => {
      mountedRef.current = false;
      setStyleEpoch((n) => n + 1);
    };
    map.on('style.load', bump);
    return () => {
      map.off('style.load', bump);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !ready) return;

    let cancelled = false;
    let retryAttached = false;

    const ensure = (): boolean => {
      if (cancelled || !isMapStyleReady(map)) return false;

      if (!safeGetSource(map, sourceId)) {
        try {
          map.addSource(sourceId, {
            type: 'geojson',
            data: initialData ?? mapDataStore.get(dataId),
            generateId: promoteId ? false : generateId,
            ...(promoteId ? { promoteId } : {}),
          });
        } catch (err) {
          console.warn(`[GeoJsonLayer] addSource ${sourceId}`, err);
          return false;
        }
      }

      let addedOrPresent = 0;
      for (const layer of layersRef.current) {
        if (safeGetLayer(map, layer.id)) {
          addedOrPresent += 1;
          continue;
        }
        const full = withStandardSlot(map, {
          ...layer,
          source: sourceId,
          layout: {
            ...(('layout' in layer && layer.layout) || {}),
            visibility: visibleRef.current ? 'visible' : 'none',
          },
        } as AnyLayer);

        try {
          if (beforeId && safeGetLayer(map, beforeId)) {
            map.addLayer(full, beforeId);
          } else {
            map.addLayer(full);
          }
          addedOrPresent += 1;
        } catch (err) {
          console.warn(`[GeoJsonLayer] addLayer ${layer.id}`, err);
        }
      }

      if (addedOrPresent > 0) {
        applyVisibility(map, layersRef.current, visibleRef.current);
        mountedRef.current = true;
        return true;
      }
      return false;
    };

    const run = () => {
      if (cancelled) return;
      if (!isMapStyleReady(map)) {
        if (!retryAttached) {
          retryAttached = true;
          map.once('style.load', () => {
            retryAttached = false;
            run();
          });
        }
        return;
      }
      ensure();
    };

    run();

    const unsub = mapDataStore.subscribe(dataId, (data) => {
      if (cancelled || !isMapStyleReady(map)) return;
      if (!safeGetSource(map, sourceId)) {
        ensure();
      }
      const src = safeGetSource(map, sourceId) as GeoJsonSource | undefined;
      try {
        src?.setData(data);
      } catch {
        /* ignore mid-reload */
      }
      // Data arrived while layers were off-canvas — force visibility sync.
      applyVisibility(map, layersRef.current, visibleRef.current);
    });

    return () => {
      cancelled = true;
      unsub();
      if (!isMapStyleReady(map)) {
        mountedRef.current = false;
        return;
      }
      try {
        for (const layer of [...layersRef.current].reverse()) {
          if (safeGetLayer(map, layer.id)) map.removeLayer(layer.id);
        }
        if (safeGetSource(map, sourceId)) map.removeSource(sourceId);
      } catch {
        /* map/style already torn down */
      }
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layers/initialData are stable constants
  }, [map, ready, sourceId, dataId, beforeId, generateId, promoteId, styleEpoch]);

  useEffect(() => {
    if (!map || !ready) return;
    if (!isMapStyleReady(map)) return;
    // Remount may lag one frame behind visible flip — ensure layers exist first.
    if (!mountedRef.current) {
      for (const layer of layersRef.current) {
        if (safeGetLayer(map, layer.id)) {
          mountedRef.current = true;
          break;
        }
      }
    }
    applyVisibility(map, layersRef.current, visible);
  }, [map, ready, visible, styleEpoch]);

  return null;
}
