'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MAP_CONFIG } from '@/features/map/config';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import type { EntityTypeConfig } from '@/features/explore/config/entityRegistry';
import { entityUrl } from '@/features/explore/config/entityRegistry';

interface PointRecord {
  id: string;
  slug?: string;
  name: string;
  lat: number;
  lng: number;
}

interface DirectoryMapViewProps {
  config: EntityTypeConfig;
  records: PointRecord[];
}

const SOURCE = 'directory-points';
const CLUSTER_SRC = 'directory-points';
const UNCLUSTERED = 'directory-unclustered';
const UNCLUSTERED_LABEL = 'directory-unclustered-label';
const CLUSTER_CIRCLES = 'directory-clusters';
const CLUSTER_COUNT = 'directory-cluster-count';

export default function DirectoryMapView({ config, records }: DirectoryMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();

  const handleClick = useCallback(
    (id: string, slug?: string) => {
      const key = config.schema === 'atlas' && slug ? slug : id;
      router.push(entityUrl(config, key));
    },
    [config, router]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (records.length === 0) return;
    if (!MAP_CONFIG.MAPBOX_TOKEN) return;

    let mounted = true;

    (async () => {
      await import('mapbox-gl/dist/mapbox-gl.css');
      const mapbox = await loadMapboxGL();
      mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

      if (!mounted || !containerRef.current) return;

      const map = new mapbox.Map({
        container: containerRef.current,
        style: MAP_CONFIG.STRATEGIC_STYLES.light,
        center: MAP_CONFIG.DEFAULT_CENTER,
        zoom: 6,
        maxBounds: [
          [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
          [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
        ],
        attributionControl: false,
      });

      mapRef.current = map;

      map.on('load', () => {
        if (!mounted) return;

        const fc: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: records.map((r) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [r.lng, r.lat] },
            properties: { id: r.id, slug: r.slug ?? '', name: r.name },
          })),
        };

        map.addSource(SOURCE, {
          type: 'geojson',
          data: fc,
          cluster: true,
          clusterMaxZoom: 12,
          clusterRadius: 40,
        });

        map.addLayer({
          id: CLUSTER_CIRCLES,
          type: 'circle',
          source: CLUSTER_SRC,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#3B82F6',
            'circle-radius': ['step', ['get', 'point_count'], 14, 20, 18, 100, 24],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
          },
        });

        map.addLayer({
          id: CLUSTER_COUNT,
          type: 'symbol',
          source: CLUSTER_SRC,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-size': 11,
          },
          paint: {
            'text-color': '#ffffff',
          },
        });

        map.addLayer({
          id: UNCLUSTERED,
          type: 'circle',
          source: CLUSTER_SRC,
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': '#3B82F6',
            'circle-radius': 5,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1.5,
          },
        });

        // Name labels on unclustered points
        map.addLayer({
          id: UNCLUSTERED_LABEL,
          type: 'symbol',
          source: CLUSTER_SRC,
          filter: ['!', ['has', 'point_count']],
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 10,
            'text-offset': [0, 1.4],
            'text-anchor': 'top',
            'text-max-width': 10,
            'text-optional': true,
          },
          paint: {
            'text-color': '#1f2937',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1,
          },
          minzoom: 10,
        });

        // Click unclustered → navigate
        map.on('click', UNCLUSTERED, (e: any) => {
          const props = e.features?.[0]?.properties;
          if (props?.id) {
            handleClick(props.id, props.slug || undefined);
          }
        });

        // Click cluster → zoom in
        map.on('click', CLUSTER_CIRCLES, (e: any) => {
          const features = map.queryRenderedFeatures(e.point, { layers: [CLUSTER_CIRCLES] });
          const clusterId = features[0]?.properties?.cluster_id;
          if (clusterId == null) return;
          (map.getSource(SOURCE) as any).getClusterExpansionZoom(clusterId, (_: any, zoom: number) => {
            map.easeTo({ center: e.lngLat, zoom: Math.min(zoom, 14) });
          });
        });

        // Pointer cursor
        const canvas = map.getCanvas();
        map.on('mouseenter', UNCLUSTERED, () => { canvas.style.cursor = 'pointer'; });
        map.on('mouseleave', UNCLUSTERED, () => { canvas.style.cursor = ''; });
        map.on('mouseenter', CLUSTER_CIRCLES, () => { canvas.style.cursor = 'pointer'; });
        map.on('mouseleave', CLUSTER_CIRCLES, () => { canvas.style.cursor = ''; });

        setLoaded(true);
      });

      map.on('error', () => {});
    })();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [records, handleClick]);

  return (
    <div className="w-full rounded-md border border-border overflow-hidden bg-surface-accent relative" style={{ height: 'calc(100vh - 280px)', minHeight: 400 }}>
      <div ref={containerRef} className="w-full h-full" />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-foreground-muted bg-surface-accent">
          Loading map…
        </div>
      )}
    </div>
  );
}
