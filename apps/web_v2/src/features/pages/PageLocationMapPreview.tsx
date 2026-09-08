'use client';

import { useMemo, useRef, useEffect } from 'react';
import { MAP_CONFIG } from '@/map/config';
import { loadMapboxGL } from '@/map/engine/mapboxLoader';

/**
 * Compact read-only Mapbox preview for a page pin (public page details).
 */
export function PageLocationMapPreview({
  lat,
  lng,
  className = '',
}: {
  lat: number;
  lng: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const token = MAP_CONFIG.MAPBOX_TOKEN;
  const valid = useMemo(
    () => Number.isFinite(lat) && Number.isFinite(lng),
    [lat, lng],
  );

  useEffect(() => {
    if (!valid || !token || !containerRef.current) return;
    let cancelled = false;
    let map: import('mapbox-gl').Map | null = null;
    let marker: import('mapbox-gl').Marker | null = null;

    void (async () => {
      const mapbox = await loadMapboxGL();
      if (cancelled || !containerRef.current) return;
      mapbox.accessToken = token;
      map = new mapbox.Map({
        container: containerRef.current,
        style: MAP_CONFIG.STYLES.streets,
        center: [lng, lat],
        zoom: 14.5,
        pitch: 40,
        bearing: -20,
        interactive: false,
        attributionControl: false,
      });
      marker = new mapbox.Marker({ color: '#2a6f8f' })
        .setLngLat([lng, lat])
        .addTo(map);
      map.once('load', () => map?.resize());
    })();

    return () => {
      cancelled = true;
      marker?.remove();
      map?.remove();
    };
  }, [lat, lng, token, valid]);

  if (!valid || !token) return null;

  return (
    <div
      className={`overflow-hidden rounded-[12px] border border-black/[0.08] bg-black/[0.03] ${className}`}
    >
      <div ref={containerRef} className="h-40 w-full" />
    </div>
  );
}
