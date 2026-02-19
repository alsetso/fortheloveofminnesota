'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import {
  fetchMinnesotaFlights,
  flightsToGeoJSON,
  type FlightState,
  type FlightsMeta,
  POSITION_SOURCES,
  AIRCRAFT_CATEGORIES,
  EMERGENCY_SQUAWKS,
} from '@/lib/flights/opensky';
import 'mapbox-gl/dist/mapbox-gl.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL = 30_000;
const MAX_API_CALLS = 10;

// ---------------------------------------------------------------------------
// Canvas icon
// ---------------------------------------------------------------------------

function addAirplaneIcon(map: mapboxgl.Map): void {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#38bdf8';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(size / 2, 2);
  ctx.lineTo(size - 4, size - 4);
  ctx.lineTo(size / 2, size - 10);
  ctx.lineTo(4, size - 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const imageData = ctx.getImageData(0, 0, size, size);
  map.addImage('airplane', { width: size, height: size, data: imageData.data });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FlightMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // All flights from last fetch (unfiltered)
  const [allFlights, setAllFlights] = useState<FlightState[]>([]);
  const [meta, setMeta] = useState<FlightsMeta | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [nextPollIn, setNextPollIn] = useState(POLL_INTERVAL / 1000);
  const [ready, setReady] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const apiCallCountRef = useRef(0);

  const [searchQuery, setSearchQuery] = useState('');

  // Derived: unique countries from current data
  const countries = Array.from(new Set(allFlights.map(f => f.country))).sort();
  const [selectedCountry, setSelectedCountry] = useState<string>('all');

  // ---------------------------------------------------------------------------
  // Filter pipeline
  // ---------------------------------------------------------------------------

  const applyFilters = useCallback(
    (flights: FlightState[]): FlightState[] => {
      return flights.filter(f => {
        if (selectedCountry !== 'all' && f.country !== selectedCountry) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (
            !f.callsign.toLowerCase().includes(q) &&
            !f.icao24.toLowerCase().includes(q) &&
            !(f.squawk ?? '').includes(q)
          ) return false;
        }
        return true;
      });
    },
    [selectedCountry, searchQuery],
  );

  // Push filtered GeoJSON to map whenever filters or data change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource('flights') as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(flightsToGeoJSON(applyFilters(allFlights)));
  }, [allFlights, applyFilters, ready]);

  // ---------------------------------------------------------------------------
  // Countdown ticker
  // ---------------------------------------------------------------------------

  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setNextPollIn(prev => (prev <= 1 ? POLL_INTERVAL / 1000 : prev - 1));
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  // ---------------------------------------------------------------------------
  // Map init + polling
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = await loadMapboxGL();
      if (cancelled || !containerRef.current) return;

      mapboxgl.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: MAP_CONFIG.STRATEGIC_STYLES.dark,
        center: [-94.6859, 46.7296],
        zoom: 6,
        minZoom: MAP_CONFIG.MIN_ZOOM_MN,
        maxBounds: [
          [MAP_CONFIG.MINNESOTA_VIEWPORT_BOUNDS.west, MAP_CONFIG.MINNESOTA_VIEWPORT_BOUNDS.south],
          [MAP_CONFIG.MINNESOTA_VIEWPORT_BOUNDS.east, MAP_CONFIG.MINNESOTA_VIEWPORT_BOUNDS.north],
        ],
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      mapRef.current = map;

      map.on('load', async () => {
        if (cancelled) return;

        addAirplaneIcon(map);

        // Seed source with empty data — will be filled by React state effect
        map.addSource('flights', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addLayer({
          id: 'flights-icons',
          type: 'symbol',
          source: 'flights',
          layout: {
            'icon-image': 'airplane',
            'icon-size': 0.9,
            'icon-rotate': ['get', 'heading'],
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        });

        map.addLayer({
          id: 'flights-labels',
          type: 'symbol',
          source: 'flights',
          minzoom: 7,
          layout: {
            'text-field': [
              'format',
              ['case', ['!=', ['get', 'callsign'], ''], ['get', 'callsign'], ['get', 'icao24']],
              {},
              '\n',
              ['case',
                ['all', ['>', ['coalesce', ['get', 'baroAltitudeFt'], 0], 0], ['!=', ['get', 'onGround'], 'true']],
                ['concat', ['to-string', ['round', ['get', 'baroAltitudeFt']]], ' ft'],
                'Ground',
              ],
            ],
            'text-size': 10,
            'text-offset': [0, 1.4],
            'text-anchor': 'top',
            'text-allow-overlap': false,
          },
          paint: {
            'text-color': '#e2e8f0',
            'text-halo-color': '#0f172a',
            'text-halo-width': 1,
          },
        });

        // Popup
        const popup = new mapboxgl.Popup({ closeButton: true, maxWidth: '280px' });

        map.on('click', 'flights-icons', (e) => {
          if (!e.features?.length) return;
          const p = e.features[0].properties!;
          const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];

          const baroAlt = p.baroAltitudeFt != null ? `${Number(p.baroAltitudeFt).toLocaleString()} ft` : '—';
          const geoAlt  = p.geoAltitudeFt  != null ? `${Number(p.geoAltitudeFt).toLocaleString()} ft` : '—';
          const spd     = p.speedKnots     != null ? `${p.speedKnots} kts` : '—';
          const hdg     = `${Math.round(Number(p.heading))}°`;
          const vr      = p.verticalRate   != null
            ? `${Number(p.verticalRate) > 0 ? '↑' : '↓'} ${Math.abs(Number(p.verticalRate)).toFixed(1)} m/s`
            : '—';

          const squawkVal = String(p.squawk ?? '');
          const emergency = EMERGENCY_SQUAWKS[squawkVal];
          const squawkDisplay = emergency
            ? `<span style="color:${emergency.color};font-weight:700">${squawkVal} ${emergency.label}</span>`
            : squawkVal || '—';

          const catNum = Number(p.category ?? 0);
          const category = AIRCRAFT_CATEGORIES[catNum] ?? 'Unknown';
          const source = POSITION_SOURCES[Number(p.positionSource ?? 0)] ?? 'Unknown';
          const onGround = String(p.onGround) === 'true';

          const staleSec = p.lastPosition
            ? Math.round(Date.now() / 1000 - Number(p.lastPosition))
            : null;
          const staleStr = staleSec != null
            ? (staleSec < 60 ? `${staleSec}s ago` : `${Math.round(staleSec / 60)}m ago`)
            : '—';

          const latStr = Number(coords[1]).toFixed(4);
          const lngStr = Number(coords[0]).toFixed(4);

          const row = (label: string, value: string) =>
            `<tr><td style="color:#94a3b8;padding-right:10px;white-space:nowrap">${label}</td><td style="color:#1e293b">${value}</td></tr>`;

          popup
            .setLngLat(coords)
            .setHTML(`
              <div style="font-family:ui-monospace,monospace;font-size:10px;line-height:1.6;color:#334155">
                ${emergency ? `<div style="background:${emergency.color}15;border:1px solid ${emergency.color}44;border-radius:3px;padding:2px 6px;margin-bottom:4px;color:${emergency.color};font-weight:700;font-size:10px;text-align:center">${emergency.label}</div>` : ''}
                <div style="font-size:13px;font-weight:700;margin-bottom:1px;color:#0f172a">
                  ${p.callsign || '—'}
                </div>
                <div style="color:#94a3b8;font-size:9px;margin-bottom:6px">${String(p.icao24).toUpperCase()} · ${p.country}</div>
                <table style="border-spacing:0;width:100%">
                  ${row('Status', onGround ? '<span style="color:#64748b">On ground</span>' : '<span style="color:#0284c7">Airborne</span>')}
                  ${row('Baro alt', baroAlt)}
                  ${row('GPS alt', geoAlt)}
                  ${row('Speed', spd)}
                  ${row('Heading', hdg)}
                  ${row('V/S', vr)}
                  ${row('Squawk', squawkDisplay)}
                  ${row('Category', category)}
                  ${row('Source', source)}
                  ${row('Position', `${latStr}, ${lngStr}`)}
                  ${row('Last pos', staleStr)}
                </table>
              </div>
            `)
            .addTo(map);
        });

        map.on('mouseenter', 'flights-icons', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'flights-icons', () => { map.getCanvas().style.cursor = ''; });

        setReady(true);

        // Initial fetch + strict rate limit: max MAX_API_CALLS then show break modal
        const doFetch = async () => {
          if (apiCallCountRef.current >= MAX_API_CALLS) {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            setShowBreakModal(true);
            return;
          }
          apiCallCountRef.current += 1;

          try {
            const result = await fetchMinnesotaFlights();
            setAllFlights(result.flights);
            setMeta(result.meta);
            setApiError(result.error ?? null);
            setLastUpdate(new Date());
            setNextPollIn(POLL_INTERVAL / 1000);
          } catch (err) {
            console.warn('[FlightMap] Fetch failed:', err);
            setApiError(err instanceof Error ? err.message : 'Failed to load flight data');
          }
        };

        await doFetch();

        pollRef.current = setInterval(doFetch, POLL_INTERVAL);
      });
    })();

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize observer
  useEffect(() => {
    if (!ready || !containerRef.current || !mapRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapRef.current && !(mapRef.current as unknown as { _removed: boolean })._removed) {
        mapRef.current.resize();
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [ready]);

  const filtered = applyFilters(allFlights);
  const airborne = allFlights.filter(f => !f.onGround).length;
  const onGround = allFlights.filter(f => f.onGround).length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="relative flex-1 min-h-0 rounded-md border border-gray-200 dark:border-white/10 overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      {apiError && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-md bg-amber-500/95 text-[11px] text-gray-900 font-medium shadow-lg max-w-[90%] text-center">
          Flight data unavailable. {apiError.includes('not configured') ? 'OpenSky credentials are not set for this environment.' : apiError}
        </div>
      )}

      {showBreakModal && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
          <div className="rounded-lg border border-white/10 bg-gray-900 px-6 py-5 shadow-xl text-center max-w-sm">
            <p className="text-sm font-medium text-white mb-1">Still here?</p>
            <p className="text-xs text-gray-400 mb-4">Let&apos;s take a break.</p>
            <Link
              href="/"
              className="inline-block px-4 py-2 rounded-md bg-white text-gray-900 text-xs font-medium hover:bg-gray-100 transition-colors"
            >
              Go to homepage
            </Link>
          </div>
        </div>
      )}

      {/* ── Top-left: Search + country filter ── */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Callsign / ICAO24 / Squawk"
            className="h-6 w-40 px-2 rounded-md bg-black/70 border border-white/10 text-[10px] text-white/80 placeholder:text-white/30 outline-none focus:border-sky-500/50"
          />
          <select
            value={selectedCountry}
            onChange={e => setSelectedCountry(e.target.value)}
            className="h-6 px-1.5 rounded-md bg-black/70 border border-white/10 text-[10px] text-white/80 outline-none focus:border-sky-500/50 appearance-none cursor-pointer"
          >
            <option value="all">All countries ({countries.length})</option>
            {countries.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Bottom: Status bar ── */}
      <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-black/70 text-[10px] text-white/80">
        {/* Live dot + total count */}
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-white">{allFlights.length}</span> tracked
        </span>

        <span className="text-white/20">|</span>

        {/* Airborne / ground split */}
        <span className="flex items-center gap-1">
          <span className="text-sky-400">{airborne}</span> airborne
          <span className="text-white/30">/</span>
          <span className="text-slate-400">{onGround}</span> ground
        </span>

        <span className="text-white/20">|</span>

        {/* Filtered count if different */}
        {filtered.length !== allFlights.length && (
          <>
            <span className="text-amber-400">{filtered.length} shown</span>
            <span className="text-white/20">|</span>
          </>
        )}

        {/* Countdown */}
        <span className="flex items-center gap-1">
          <span className="font-mono tabular-nums w-4 text-right">{nextPollIn}s</span>
          refresh
        </span>

        {/* Last update */}
        {lastUpdate && (
          <>
            <span className="text-white/20">|</span>
            <span>{lastUpdate.toLocaleTimeString()}</span>
          </>
        )}

        {/* Spacer pushes right-side items */}
        <span className="flex-1" />

        {/* Credit warning */}
        {meta && meta.creditsRemaining >= 0 && meta.creditsRemaining < 500 && (
          <span className="text-amber-400 font-medium">
            Low credits: {meta.creditsRemaining}
          </span>
        )}
      </div>
    </div>
  );
}
