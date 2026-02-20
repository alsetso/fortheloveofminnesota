'use client';

import { useEffect, useRef, useState } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuthStateSafe } from '@/features/auth';
import GovBuildingModal, { type GovBuildingRecord } from '@/app/gov/components/GovBuildingModal';

interface BuildingPin {
  id: string;
  name: string | null;
  type: string | null;
  full_address: string | null;
  description: string | null;
  website: string | null;
  cover_images: string[] | null;
  lat: number;
  lng: number;
}

export default function GovMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('mapbox-gl').default | null>(null);
  const markersRef = useRef<import('mapbox-gl').Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<GovBuildingRecord | null>(null);
  const supabase = useSupabaseClient();
  const { account } = useAuthStateSafe();
  const isAdmin = account?.role === 'admin';

  useEffect(() => {
    if (!containerRef.current || !MAP_CONFIG.MAPBOX_TOKEN) return;

    let mounted = true;

    const fetchBuildings = async (): Promise<BuildingPin[]> => {
      try {
        const civic = typeof (supabase as any).schema === 'function'
          ? (supabase as any).schema('civic')
          : supabase;
        const { data } = await civic
          .from('buildings')
          .select('id, name, type, full_address, description, website, cover_images, lat, lng')
          .not('lat', 'is', null)
          .not('lng', 'is', null);
        return (data ?? []).filter(
          (b: any) => typeof b.lat === 'number' && typeof b.lng === 'number'
        ) as BuildingPin[];
      } catch {
        return [];
      }
    };

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

        map.on('load', async () => {
          if (!mounted || !mapRef.current) return;

          map.addControl(
            new mapbox.NavigationControl({ showCompass: true, showZoom: true }),
            'top-right'
          );

          const buildings = await fetchBuildings();

          if (mounted && mapRef.current) {
            for (const b of buildings) {
              const el = document.createElement('div');
              el.className = 'gov-map-pin';
              el.style.cssText = [
                'width:10px',
                'height:10px',
                'border-radius:50%',
                'background:#1d4ed8',
                'border:2px solid #fff',
                'box-shadow:0 1px 3px rgba(0,0,0,0.4)',
                'cursor:pointer',
              ].join(';');

              el.addEventListener('click', () => {
                setSelectedBuilding({
                  id: b.id,
                  name: b.name,
                  type: b.type,
                  full_address: b.full_address,
                  description: b.description,
                  website: b.website,
                  cover_images: b.cover_images,
                  lat: b.lat,
                  lng: b.lng,
                });
              });

              const marker = new mapbox.Marker({ element: el })
                .setLngLat([b.lng, b.lat])
                .addTo(map);

              markersRef.current.push(marker);
            }
          }

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (mounted && mapRef.current && !(mapRef.current as any).removed) {
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
        console.error('[GovMap] init failed', err);
        if (mounted) setReady(true);
      }
    };

    const t = setTimeout(init, 50);

    return () => {
      mounted = false;
      clearTimeout(t);
      for (const m of markersRef.current) {
        try { m.remove(); } catch { /* ignore */ }
      }
      markersRef.current = [];
      if (mapRef.current) {
        try {
          if (!(mapRef.current as any).removed) mapRef.current.remove();
        } catch { /* ignore */ }
        mapRef.current = null;
      }
      setReady(false);
    };
  }, [supabase]);

  return (
    <>
      <div
        ref={containerRef}
        className="w-full h-full min-h-[300px] bg-gray-100 dark:bg-surface-muted"
        aria-label="Government buildings map"
      />
      {selectedBuilding && (
        <GovBuildingModal
          record={selectedBuilding}
          onClose={() => setSelectedBuilding(null)}
          isAdmin={isAdmin}
        />
      )}
    </>
  );
}
