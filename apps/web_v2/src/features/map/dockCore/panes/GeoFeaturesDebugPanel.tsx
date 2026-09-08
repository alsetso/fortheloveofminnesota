'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { getMapGeoFeaturesSnapshot, subscribeMapGeoFeatures } from '@/map/geo/mapGeoFeaturesStore';
import { deduplicateGeoFeatures } from '@/map/geo/appGeoFeature';
import { useSelectedPointCoords } from '@/map/location/camera/useSelectedPointCoords';
import { pointAtLocationCacheKey } from '@/features/map/dockCore/store/pointAtLocationCache';

export function GeoFeaturesDebugPanel() {
  const [open, setOpen] = useState(false);
  const { coords } = useSelectedPointCoords();

  const store = useSyncExternalStore(
    subscribeMapGeoFeatures,
    getMapGeoFeaturesSnapshot,
    () => ({ key: null, features: [] }),
  );

  const features = useMemo(() => {
    if (!store.key) return [];
    if (!coords) return deduplicateGeoFeatures(store.features);
    const key = pointAtLocationCacheKey(coords.lat, coords.lng);
    if (store.key !== key) return deduplicateGeoFeatures(store.features);
    return deduplicateGeoFeatures(store.features);
  }, [coords, store]);

  const json = useMemo(() => JSON.stringify(features, null, 2), [features]);

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl bg-black/[0.06] px-3 py-1.5 font-mono text-[10px] font-semibold text-foreground-muted transition hover:bg-black/10 active:bg-black/15"
        >
          {open ? 'hide' : 'debug'} mapbox{features.length > 0 ? ` (${features.length})` : ''}
        </button>
        {open && features.length > 0 && (
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(json)}
            className="rounded-xl bg-black/[0.06] px-3 py-1.5 font-mono text-[10px] font-semibold text-foreground-muted transition hover:bg-black/10 active:bg-black/15"
          >
            copy json
          </button>
        )}
      </div>

      {open && (
        <pre className="mt-2 overflow-x-auto rounded-2xl bg-black/[0.04] p-3 font-mono text-[9px] leading-relaxed text-foreground/70 whitespace-pre-wrap break-all">
          {features.length === 0
            ? store.key === null
              ? 'Click the map to capture features.'
              : 'No features at this point.'
            : json}
        </pre>
      )}
    </div>
  );
}
