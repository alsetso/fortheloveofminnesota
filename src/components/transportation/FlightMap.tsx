'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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

const ALTITUDE_BANDS = [
  { id: 'ground', label: 'Ground', min: -Infinity, max: 0, color: '#94a3b8' },
  { id: 'low',    label: '< 10k ft', min: 0, max: 10_000, color: '#38bdf8' },
  { id: 'mid',    label: '10–25k ft', min: 10_000, max: 25_000, color: '#a78bfa' },
  { id: 'high',   label: '25–35k ft', min: 25_000, max: 35_000, color: '#f472b6' },
  { id: 'cruise', label: '35k+ ft', min: 35_000, max: Infinity, color: '#ffffff' },
] as const;

type AltBandId = (typeof ALTITUDE_BANDS)[number]['id'];

function getAltBand(flight: FlightState): AltBandId {
  if (flight.onGround) return 'ground';
  const alt = flight.baroAltitudeFt ?? 0;
  if (alt < 10_000) return 'low';
  if (alt < 25_000) return 'mid';
  if (alt < 35_000) return 'high';
  return 'cruise';
}

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
  const [totalApiCalls, setTotalApiCalls] = useState(0);

  // Filters
  const [activeBands, setActiveBands] = useState<Set<AltBandId>>(
    () => new Set(ALTITUDE_BANDS.map(b => b.id)),
  );
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
        if (!activeBands.has(getAltBand(f))) return false;
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
    [activeBands, selectedCountry, searchQuery],
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
              'case',
              ['!=', ['get', 'callsign'], ''], ['get', 'callsign'],
              ['get', 'icao24'],
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

        // Initial fetch
        const doFetch = async () => {
          try {
            const result = await fetchMinnesotaFlights();
            setAllFlights(result.flights);
            setMeta(result.meta);
            setLastUpdate(new Date());
            setNextPollIn(POLL_INTERVAL / 1000);
            setTotalApiCalls(prev => prev + 1);
          } catch (err) {
            console.warn('[FlightMap] Fetch failed:', err);
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

  // ---------------------------------------------------------------------------
  // Derived stats
  // ---------------------------------------------------------------------------

  const filtered = applyFilters(allFlights);
  const airborne = allFlights.filter(f => !f.onGround).length;
  const onGround = allFlights.filter(f => f.onGround).length;

  const bandCounts = new Map<AltBandId, number>();
  for (const f of allFlights) {
    const band = getAltBand(f);
    bandCounts.set(band, (bandCounts.get(band) ?? 0) + 1);
  }

  const toggleBand = (id: AltBandId) => {
    setActiveBands(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="relative flex-1 min-h-0 rounded-md border border-gray-200 dark:border-white/10 overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      {/* ── Top-left: Altitude band filters ── */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-1">
          {ALTITUDE_BANDS.map(band => {
            const on = activeBands.has(band.id);
            const count = bandCounts.get(band.id) ?? 0;
            return (
              <button
                key={band.id}
                type="button"
                onClick={() => toggleBand(band.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors border"
                style={{
                  backgroundColor: on ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.4)',
                  color: on ? band.color : '#64748b',
                  borderColor: on ? band.color + '66' : 'transparent',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: on ? band.color : '#475569' }}
                />
                {band.label}
                <span className="text-[9px] opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Search + country filter row */}
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

      {/* ── Top-right: API metrics panel ── */}
      <div className="absolute top-2 right-12 z-10">
        <div className="bg-black/75 border border-white/10 rounded-md px-2.5 py-1.5 space-y-1 min-w-[140px]">
          <div className="text-[9px] font-semibold text-white/50 uppercase tracking-wider">API Usage</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
            <span className="text-white/50">Credits</span>
            <span className="text-right font-mono text-white/80">
              {meta ? `${meta.creditsRemaining.toLocaleString()} / 4,000` : '—'}
            </span>
            <span className="text-white/50">Requests</span>
            <span className="text-right font-mono text-white/80">
              {meta ? `${meta.requestsRemaining.toLocaleString()} left` : '—'}
            </span>
            <span className="text-white/50">Session calls</span>
            <span className="text-right font-mono text-white/80">{totalApiCalls}</span>
            <span className="text-white/50">Cache</span>
            <span className="text-right font-mono text-white/80">
              {meta ? (meta.fromCache ? 'HIT' : 'MISS') : '—'}
            </span>
          </div>
          {meta && meta.creditsRemaining >= 0 && (
            <div className="mt-1">
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(0, (meta.creditsRemaining / 4000) * 100)}%`,
                    backgroundColor: meta.creditsRemaining > 1000 ? '#34d399' : meta.creditsRemaining > 200 ? '#fbbf24' : '#f87171',
                  }}
                />
              </div>
            </div>
          )}
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
