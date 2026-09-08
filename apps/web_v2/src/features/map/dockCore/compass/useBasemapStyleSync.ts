'use client';

import { useEffect, useRef } from 'react';
import { useBasemap } from '@/features/map/dockCore/compass/useBasemap';
import { MAP_CONFIG, type MapStyleId } from '@/map/config';
import { useMapContext } from '@/map/MapProvider';

/**
 * Applies Mapbox `setStyle` when the shared basemap id changes.
 * Must stay mounted (shell) so Controls can switch styles without Compass open.
 */
export function useBasemapStyleSync() {
  const { map, ready } = useMapContext();
  const { basemap } = useBasemap();
  const basemapAppliedRef = useRef(false);

  useEffect(() => {
    if (!map || !ready) return;
    if (!basemapAppliedRef.current) {
      basemapAppliedRef.current = true;
      return;
    }

    const styleUrl = MAP_CONFIG.STYLES[basemap as MapStyleId] ?? MAP_CONFIG.STYLES.streets;
    try {
      const camera = {
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      };
      map.once('style.load', () => {
        try {
          map.jumpTo(camera);
        } catch {
          /* style mid-teardown */
        }
      });
      map.setStyle(styleUrl);
    } catch (err) {
      console.warn('[basemap] setStyle failed', err);
    }
  }, [basemap, map, ready]);
}
