'use client';

import { useEffect, useRef, useState } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';

/**
 * Standalone map for the Real Estate page.
 * No pins, no layers, no shared /maps logic or services — independent lifecycle.
 * Uses only Mapbox loader and token/config to render a bare map.
 */
export default function RealEstateMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('mapbox-gl').Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !MAP_CONFIG.MAPBOX_TOKEN) return;

    let mounted = true;

    const init = async () => {
      const container = containerRef.current;
      if (!container || !mounted) return;

      const width = container.offsetWidth;
      const height = container.offsetHeight;
      if (width <= 0 || height <= 0) {
        requestAnimationFrame(init);
        return;
      }

      try {
        await import('mapbox-gl/dist/mapbox-gl.css');
        const mapbox = await loadMapboxGL();
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!containerRef.current || !mounted) return;

        const map = new mapbox.Map({
          container: containerRef.current,
          style: MAP_CONFIG.STRATEGIC_STYLES.streets,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
          pitch: 0,
          bearing: 0,
        });

        mapRef.current = map;

        map.on('load', () => {
          if (!mounted || !mapRef.current) return;
          map.addControl(new mapbox.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (mounted && mapRef.current && !(mapRef.current as { _removed?: boolean })._removed) {
                mapRef.current.resize();
              }
              setReady(true);
            });
          });
        });

        map.on('error', () => {
          if (mounted) setReady(true);
        });
      } catch (err) {
        console.error('[RealEstateMap] init failed', err);
        if (mounted) setReady(true);
      }
    };

    const t = setTimeout(init, 50);

    return () => {
      mounted = false;
      clearTimeout(t);
      if (mapRef.current) {
        try {
          const m = mapRef.current;
          if (!(m as { _removed?: boolean })._removed) m.remove();
        } catch {
          // ignore
        }
        mapRef.current = null;
      }
      setReady(false);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[300px] bg-gray-100 dark:bg-surface-muted"
      aria-label="Real estate map"
    />
  );
}
