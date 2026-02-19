'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';

interface Vehicle {
  trip_id: string;
  direction_id: number;
  direction: string;
  location_time: number;
  route_id: string;
  latitude: number;
  longitude: number;
  bearing: number;
  speed: number;
}

const LIGHT_RAIL = [
  { id: '901', label: 'Blue Line', color: '#0055A4' },
  { id: '902', label: 'Green Line', color: '#00843D' },
];

const BRT = [
  { id: '921', label: 'A Line', color: '#E74C3C' },
  { id: '922', label: 'B Line', color: '#0097A7' },
  { id: '923', label: 'C Line', color: '#43A047' },
  { id: '924', label: 'D Line', color: '#7E57C2' },
  { id: '925', label: 'E Line', color: '#F06292' },
  { id: '905', label: 'Gold Line', color: '#CDA349' },
  { id: '904', label: 'Orange Line', color: '#F68A1F' },
  { id: '903', label: 'Red Line', color: '#D12229' },
];

const FEATURED_ROUTES = [...LIGHT_RAIL, ...BRT];
const FEATURED_ROUTE_IDS = new Set(FEATURED_ROUTES.map((r) => r.id));
const ROUTE_MAP = new Map(FEATURED_ROUTES.map((r) => [r.id, r]));

const POLL_INTERVAL = 14_000;

const ROUTE_CLASS_COLORS: Record<string, string> = {
  LRT: '#6366f1',
  BRT: '#f59e0b',
  CoreLoc: '#3b82f6',
  CommExpress: '#10b981',
  SuburbLoc: '#8b5cf6',
  SupportLoc: '#64748b',
  STALocal: '#ec4899',
  Special: '#a3a3a3',
};

interface NexTripRoute {
  route_id: string;
  agency_id: number;
  route_label: string;
}

function vehiclesToGeoJSON(vehicles: Vehicle[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: vehicles.map((v) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [v.longitude, v.latitude] },
      properties: {
        trip_id: v.trip_id,
        route_id: v.route_id,
        direction: v.direction,
        speed: v.speed,
        bearing: v.bearing,
        location_time: v.location_time,
      },
    })),
  };
}

interface TrackedVehicle {
  trip_id: string;
  route_id: string;
}

function computeBBox(geojson: GeoJSON.Feature): [number, number, number, number] | null {
  const coords: number[][] = [];
  const walk = (g: GeoJSON.Geometry) => {
    if (g.type === 'MultiLineString') {
      for (const line of g.coordinates) for (const c of line) coords.push(c);
    } else if (g.type === 'LineString') {
      for (const c of g.coordinates) coords.push(c);
    }
  };
  walk(geojson.geometry);
  if (!coords.length) return null;
  let [w, s, e, n] = [coords[0][0], coords[0][1], coords[0][0], coords[0][1]];
  for (const c of coords) {
    if (c[0] < w) w = c[0];
    if (c[0] > e) e = c[0];
    if (c[1] < s) s = c[1];
    if (c[1] > n) n = c[1];
  }
  return [w, s, e, n];
}

export default function GTFSMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const routeGeoJsonRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const [ready, setReady] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activeRoutes, setActiveRoutes] = useState<Set<string>>(() => new Set(FEATURED_ROUTES.map((r) => r.id)));
  const activeRoutesRef = useRef(activeRoutes);
  activeRoutesRef.current = activeRoutes;

  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const selectedRouteRef = useRef(selectedRoute);
  selectedRouteRef.current = selectedRoute;

  const [trackedVehicle, setTrackedVehicle] = useState<TrackedVehicle | null>(null);
  const trackedVehicleRef = useRef(trackedVehicle);
  trackedVehicleRef.current = trackedVehicle;

  const [allRoutes, setAllRoutes] = useState<NexTripRoute[]>([]);
  const [routeSearch, setRouteSearch] = useState('');
  const [showRoutePanel, setShowRoutePanel] = useState(false);

  const filteredNexTripRoutes = useMemo(() => {
    const base = allRoutes.filter((r) => !FEATURED_ROUTE_IDS.has(r.route_id));
    if (!base.length) return [];
    const q = routeSearch.toLowerCase().trim();
    if (!q) return base;
    return base.filter((r) =>
      r.route_label.toLowerCase().includes(q) || r.route_id.includes(q)
    );
  }, [allRoutes, routeSearch]);

  const vehiclePopupRef = useRef<mapboxgl.Popup | null>(null);
  const routePopupRef = useRef<mapboxgl.Popup | null>(null);

  const applyRouteHighlight = useCallback((routeNumber: string | null) => {
    const map = mapRef.current;
    if (!map || (map as any)._removed) return;
    if (!map.getLayer('route-lines-layer')) return;

    if (routeNumber) {
      map.setPaintProperty('route-lines-layer', 'line-opacity', [
        'case', ['==', ['get', 'route'], routeNumber], 0.9, 0.1,
      ]);
      map.setPaintProperty('route-lines-casing', 'line-opacity', [
        'case', ['==', ['get', 'route'], routeNumber], 0.25, 0.03,
      ]);
      map.setPaintProperty('route-lines-casing', 'line-width', [
        'case',
        ['==', ['get', 'route'], routeNumber],
        ['interpolate', ['linear'], ['zoom'], 8, 6, 12, 12, 16, 20],
        ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 6, 16, 10],
      ]);
    } else {
      map.setPaintProperty('route-lines-layer', 'line-opacity', 0.65);
      map.setPaintProperty('route-lines-casing', 'line-opacity', 0.1);
      map.setPaintProperty('route-lines-casing', 'line-width',
        ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 6, 16, 10],
      );
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRoute(null);
    setTrackedVehicle(null);
    applyRouteHighlight(null);
  }, [applyRouteHighlight]);

  const fetchVehicles = useCallback(async () => {
    const ids = Array.from(activeRoutesRef.current);
    if (!ids.length) {
      if (mapRef.current?.getSource('vehicles')) {
        (mapRef.current.getSource('vehicles') as mapboxgl.GeoJSONSource).setData(vehiclesToGeoJSON([]));
      }
      setVehicles([]);
      return;
    }

    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          const res = await fetch(`https://svc.metrotransit.org/nextrip/vehicles/${id}`);
          if (!res.ok) return [];
          return (await res.json()) as Vehicle[];
        }),
      );
      const all = results.flat();
      setVehicles(all);
      setLastUpdate(new Date());

      const map = mapRef.current;
      if (map && !(map as any)._removed) {
        if (map.getSource('vehicles')) {
          (map.getSource('vehicles') as mapboxgl.GeoJSONSource).setData(vehiclesToGeoJSON(all));
        }
        map.resize();
        map.triggerRepaint();

        const tv = trackedVehicleRef.current;
        if (tv) {
          const match = all.find((v) => v.trip_id === tv.trip_id && v.route_id === tv.route_id);
          if (match) {
            map.easeTo({ center: [match.longitude, match.latitude], duration: 1000 });
          }
        }
      }
    } catch {
      // next poll will retry
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    let mounted = true;

    const init = async () => {
      const mapboxgl = await loadMapboxGL();
      if (!mounted || !containerRef.current || !MAP_CONFIG.MAPBOX_TOKEN) return;

      mapboxgl.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: MAP_CONFIG.STRATEGIC_STYLES.light,
        center: [-93.27, 44.97],
        zoom: 11,
        minZoom: 8,
        maxZoom: 18,
      });

      mapRef.current = map;

      map.once('load', async () => {
        if (!mounted) return;

        map.resize();

        // Fetch and render transit route line geometries
        try {
          const res = await fetch('/api/transportation/route-lines');
          if (res.ok) {
            const geojson = await res.json() as GeoJSON.FeatureCollection;
            routeGeoJsonRef.current = geojson;
            map.addSource('route-lines', { type: 'geojson', data: geojson });

            const classColorExpr: mapboxgl.Expression = [
              'match',
              ['get', 'route_class'],
              ...Object.entries(ROUTE_CLASS_COLORS).flat(),
              '#d1d5db',
            ];

            map.addLayer({
              id: 'route-lines-casing',
              type: 'line',
              source: 'route-lines',
              paint: {
                'line-color': classColorExpr,
                'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 6, 16, 10],
                'line-opacity': 0.1,
              },
            });

            map.addLayer({
              id: 'route-lines-layer',
              type: 'line',
              source: 'route-lines',
              paint: {
                'line-color': classColorExpr,
                'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 2.5, 16, 5],
                'line-opacity': 0.65,
              },
              layout: {
                'line-cap': 'round',
                'line-join': 'round',
              },
            });

            // Invisible wide hit-target layer for easier clicking
            map.addLayer({
              id: 'route-lines-hit',
              type: 'line',
              source: 'route-lines',
              paint: {
                'line-color': 'transparent',
                'line-width': 12,
              },
            });

            const routePopup = new mapboxgl.Popup({ closeButton: true, closeOnClick: false, offset: 4, maxWidth: '220px' });
            routePopupRef.current = routePopup;

            routePopup.on('close', () => {
              setSelectedRoute(null);
              applyRouteHighlight(null);
            });

            map.on('mouseenter', 'route-lines-hit', () => {
              map.getCanvas().style.cursor = 'pointer';
            });

            map.on('mouseleave', 'route-lines-hit', () => {
              map.getCanvas().style.cursor = '';
            });

            map.on('click', 'route-lines-hit', (e) => {
              e.originalEvent.stopPropagation();
              const f = e.features?.[0];
              if (!f) return;
              const p = f.properties!;
              const routeNum = p.route as string;
              const color = ROUTE_CLASS_COLORS[p.route_class] ?? '#888';

              setTrackedVehicle(null);
              setSelectedRoute(routeNum);
              applyRouteHighlight(routeNum);
              setActiveRoutes((prev) => new Set(prev).add(routeNum));
              setShowRoutePanel(false);

              const fullFeature = routeGeoJsonRef.current?.features.find(
                (ft) => ft.properties?.route === routeNum,
              );
              if (fullFeature) {
                const bbox = computeBBox(fullFeature as GeoJSON.Feature);
                if (bbox) {
                  map.fitBounds(
                    [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
                    { padding: 60, duration: 1200, maxZoom: 15 },
                  );
                }
              }

              routePopup
                .setLngLat(e.lngLat)
                .setHTML(
                  `<div style="font-size:11px;line-height:1.5;font-family:system-ui">
                    <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px">
                      <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
                      <strong>Route ${p.route}</strong>
                    </div>
                    <div style="color:#555">${p.route_description}</div>
                    <div style="margin-top:3px;font-size:10px;color:#888">
                      ${p.route_class} · ${p.route_operator === 'M' ? 'Metro Transit' : 'Contract'}
                    </div>
                  </div>`,
                )
                .addTo(map);
            });
          }
        } catch {
          // route lines are non-critical
        }

        map.addSource('vehicles', {
          type: 'geojson',
          data: vehiclesToGeoJSON([]),
        });

        const routeColorExpr: mapboxgl.Expression = [
          'match',
          ['get', 'route_id'],
          ...FEATURED_ROUTES.flatMap((r) => [r.id, r.color]),
          '#888888',
        ];

        map.addLayer({
          id: 'vehicles-glow',
          type: 'circle',
          source: 'vehicles',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 8, 14, 16],
            'circle-color': routeColorExpr,
            'circle-opacity': 0.2,
            'circle-blur': 1,
          },
        });

        map.addLayer({
          id: 'vehicles-border',
          type: 'circle',
          source: 'vehicles',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 6, 14, 12],
            'circle-color': routeColorExpr,
            'circle-opacity': 1,
          },
        });

        map.addLayer({
          id: 'vehicles-fill',
          type: 'circle',
          source: 'vehicles',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 5, 14, 10],
            'circle-color': '#ffffff',
            'circle-opacity': 0.1,
            'circle-blur': 0.05,
          },
        });

        const vehiclePopup = new mapboxgl.Popup({ closeButton: true, closeOnClick: false, offset: 10, maxWidth: '240px' });
        vehiclePopupRef.current = vehiclePopup;

        vehiclePopup.on('close', () => {
          setTrackedVehicle(null);
        });

        map.on('mouseenter', 'vehicles-fill', () => {
          map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', 'vehicles-fill', () => {
          map.getCanvas().style.cursor = '';
        });

        map.on('click', 'vehicles-fill', (e) => {
          e.originalEvent.stopPropagation();
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties!;
          const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
          const route = ROUTE_MAP.get(p.route_id);
          const color = route?.color ?? '#888';
          const speedText = p.speed > 0 ? `${p.speed} mph` : 'Stopped';
          const timeText = p.location_time
            ? new Date(p.location_time * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })
            : '';
          const bearingText = p.bearing != null ? `${Math.round(p.bearing)}°` : '';

          setTrackedVehicle({ trip_id: p.trip_id, route_id: p.route_id });
          setSelectedRoute(null);
          applyRouteHighlight(null);

          map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 14), duration: 1200 });

          vehiclePopup
            .setLngLat(coords)
            .setHTML(
              `<div style="font-size:11px;line-height:1.6;font-family:system-ui">
                <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">
                  <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
                  <strong>${route?.label ?? `Route ${p.route_id}`}</strong>
                  <span style="font-size:9px;background:#f0f0f0;border-radius:3px;padding:1px 4px;color:#666">TRACKING</span>
                </div>
                <div style="color:#555">Trip ${p.trip_id}</div>
                <div style="color:#555">${p.direction}</div>
                <div style="margin-top:4px;display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;font-size:10px;color:#777">
                  <span>Speed</span><span style="color:#333;font-weight:500">${speedText}</span>
                  ${bearingText ? `<span>Bearing</span><span style="color:#333;font-weight:500">${bearingText}</span>` : ''}
                  ${timeText ? `<span>Last ping</span><span style="color:#333;font-weight:500">${timeText}</span>` : ''}
                </div>
              </div>`,
            )
            .addTo(map);
        });

        map.on('click', (e) => {
          setShowRoutePanel(false);
          const hasHitLayers = map.getLayer('route-lines-hit');
          const vehicleFeats = map.queryRenderedFeatures(e.point, { layers: ['vehicles-fill'] });
          const routeFeats = hasHitLayers
            ? map.queryRenderedFeatures(e.point, { layers: ['route-lines-hit'] })
            : [];
          if (!vehicleFeats.length && !routeFeats.length) {
            clearSelection();
            vehiclePopupRef.current?.remove();
            routePopupRef.current?.remove();
          }
        });

        setReady(true);
        fetchVehicles();
        intervalRef.current = setInterval(fetchVehicles, POLL_INTERVAL);
      });

      // Additional resize after layout settles
      setTimeout(() => {
        if (mounted && map && !(map as any)._removed) {
          map.resize();
        }
      }, 200);
    };

    init();

    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [fetchVehicles]);

  // Resize map when container dimensions change
  useEffect(() => {
    if (!ready || !containerRef.current || !mapRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapRef.current && !(mapRef.current as any)._removed) {
        mapRef.current.resize();
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [ready]);

  useEffect(() => {
    if (ready) fetchVehicles();
  }, [activeRoutes, ready, fetchVehicles]);

  useEffect(() => {
    fetch('/api/transportation/nextrip?type=routes')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setAllRoutes(data.routes ?? []))
      .catch(() => {});
  }, []);

  const toggleRoute = (id: string) => {
    setActiveRoutes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="relative flex-1 min-h-0 rounded-md border border-gray-200 dark:border-white/10 overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      {/* Route controls */}
      <div className="absolute top-2 left-2 z-10 space-y-1" style={{ maxWidth: 'calc(100% - 16px)' }}>
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-white bg-black/50 px-1.5 py-0.5 rounded">Rail</span>
          {LIGHT_RAIL.map((r) => {
            const on = activeRoutes.has(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleRoute(r.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors border"
                style={{
                  backgroundColor: on ? r.color : 'rgba(255,255,255,0.9)',
                  color: on ? '#fff' : '#666',
                  borderColor: on ? r.color : '#d1d5db',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: on ? '#fff' : r.color }}
                />
                {r.label}
              </button>
            );
          })}
          <span className="text-[9px] font-semibold uppercase tracking-wider text-white bg-black/50 px-1.5 py-0.5 rounded ml-1">BRT</span>
          {BRT.map((r) => {
            const on = activeRoutes.has(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleRoute(r.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors border"
                style={{
                  backgroundColor: on ? r.color : 'rgba(255,255,255,0.9)',
                  color: on ? '#fff' : '#666',
                  borderColor: on ? r.color : '#d1d5db',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: on ? '#fff' : r.color }}
                />
                {r.label}
              </button>
            );
          })}
        </div>

        {Array.from(activeRoutes).filter((id) => !FEATURED_ROUTE_IDS.has(id)).length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-white bg-black/50 px-1.5 py-0.5 rounded">Bus</span>
            {Array.from(activeRoutes)
              .filter((id) => !FEATURED_ROUTE_IDS.has(id))
              .map((id) => {
                const route = allRoutes.find((r) => r.route_id === id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleRoute(id)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-white/90 text-gray-700 border border-gray-300 transition-colors hover:bg-white"
                  >
                    {route?.route_label ?? `#${id}`}
                    <span className="text-gray-400 ml-0.5">×</span>
                  </button>
                );
              })}
            <button
              type="button"
              onClick={() => setShowRoutePanel((p) => !p)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-white/90 text-gray-600 border border-gray-300 hover:bg-white transition-colors"
            >
              +
            </button>
          </div>
        )}

        {Array.from(activeRoutes).filter((id) => !FEATURED_ROUTE_IDS.has(id)).length === 0 && (
          <div className="flex">
            <button
              type="button"
              onClick={() => setShowRoutePanel((p) => !p)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-white/90 text-gray-600 border border-gray-300 hover:bg-white transition-colors"
            >
              + Bus Routes
            </button>
          </div>
        )}

        {showRoutePanel && (
          <div className="w-64 rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden">
            <div className="p-1.5 border-b border-gray-100">
              <input
                type="text"
                value={routeSearch}
                onChange={(e) => setRouteSearch(e.target.value)}
                placeholder="Search routes..."
                className="w-full px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder:text-gray-400"
                autoFocus
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {filteredNexTripRoutes.length === 0 && (
                <p className="px-3 py-2 text-[10px] text-gray-400">
                  {allRoutes.length === 0 ? 'Loading routes...' : 'No matches'}
                </p>
              )}
              {filteredNexTripRoutes.map((route) => {
                const on = activeRoutes.has(route.route_id);
                return (
                  <button
                    key={route.route_id}
                    type="button"
                    onClick={() => toggleRoute(route.route_id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                      on ? 'bg-blue-50 text-gray-900' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center text-[8px] ${
                        on ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'
                      }`}
                    >
                      {on && '✓'}
                    </span>
                    <span className="text-[10px] text-gray-400 w-6 text-right flex-shrink-0">{route.route_id}</span>
                    <span className="truncate">{route.route_label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="absolute bottom-2 left-2 z-10 flex items-center gap-2 px-2 py-1 rounded-md bg-black/70 text-[10px] text-white/80">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {vehicles.length} vehicles
        </span>
        {lastUpdate && (
          <>
            <span className="text-white/30">|</span>
            <span>{lastUpdate.toLocaleTimeString()}</span>
          </>
        )}
        <span className="text-white/30">|</span>
        <span>14s refresh</span>
        {(trackedVehicle || selectedRoute) && (
          <>
            <span className="text-white/30">|</span>
            <button
              type="button"
              onClick={clearSelection}
              className="flex items-center gap-1 text-white/90 hover:text-white transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {trackedVehicle ? `Tracking ${trackedVehicle.trip_id}` : `Route ${selectedRoute}`}
              <span className="ml-0.5 text-white/50">✕</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
