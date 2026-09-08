'use client';

import { useEffect } from 'react';
import { applyMapBuildings3D } from '@/map/buildings/applyMapBuildings3D';
import { useMapContext } from '@/map/MapProvider';

/**
 * Keeps extruded / Standard 3D buildings on after every style load
 * (streets Standard + outdoors classic extrusions).
 */
export function useMapBuildings3D(enabled = true) {
  const { map, ready } = useMapContext();

  useEffect(() => {
    if (!map || !ready) return;

    const apply = () => applyMapBuildings3D(map, enabled);
    apply();
    map.on('style.load', apply);
    return () => {
      map.off('style.load', apply);
    };
  }, [map, ready, enabled]);
}
