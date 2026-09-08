'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { TopBar } from '@/features/appShell/TopBar';
import { MAP_CONFIG } from '@/map/config';
import { createAircraftLayer } from './aircraftLayer';
import { clamp, isGrounded, createFlight, createRunwayFlight, FLIGHT_LOCATIONS, offsetPosition, stepFlight } from './flightPhysics';
import { headingError, localMeters, runwayPosition, type Runway } from './runways';
import { paintLandingCorridor, paintRunways } from './runwayLayers';
import RunwayRadar from './RunwayRadar';
import styles from './flight.module.css';

const KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyQ', 'KeyE', 'Space', 'KeyR', 'KeyL', 'KeyB']);
type Control = 'brake';

export default function FlightSimulator() {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const flight = useRef(createFlight());
  const initialLineUp = useRef(false);
  const awaitingDeparture = useRef(true);
  const [preparingDeparture, setPreparingDeparture] = useState(true);
  const keys = useRef(new Set<string>());
  const touches = useRef(new Map<number, Control>());
  const stick = useRef({ x: 0, y: 0, pointer: null as number | null });
  const [stickPosition, setStickPosition] = useState({ x: 0, y: 0 });
  const pausedRef = useRef(true);
  const throttleRef = useRef(0.4);
  const locationRef = useRef(0);
  const [hud, setHud] = useState(createFlight);
  const [paused, setPaused] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [throttle, setThrottle] = useState(0.4);
  const [location, setLocation] = useState(0);
  const [boundary, setBoundary] = useState(false);
  const runwayRef = useRef<Runway[]>([]);
  const selectedRef = useRef<Runway | null>(null);
  const pendingLineUp = useRef<{ runway: Runway; reverse: boolean; started: number } | null>(null);
  const [runways, setRunways] = useState<Runway[]>([]);
  const [selected, setSelected] = useState<Runway | null>(null);
  const [runwayStatus, setRunwayStatus] = useState('Loading nearby runways...');
  const [refresh, setRefresh] = useState(0);
  const lastFetch = useRef<[number, number] | null>(null);
  const [queryCenter, setQueryCenter] = useState<[number, number]>([hud.lng, hud.lat]);
  const [groundAltitude, setGroundAltitude] = useState<number | null>(null);
  const targetRunway = runways.find((r) => r.id === hud.activeRunwayId) ?? selected;
  const targetPosition = targetRunway ? runwayPosition(targetRunway, [hud.lng, hud.lat]) : null;
  const alignment = targetPosition ? Math.min(headingError(hud.heading, targetPosition.heading), headingError(hud.heading, (targetPosition.heading + 180) % 360)) : null;

  useEffect(() => {
    if (!lastFetch.current || Math.hypot(...localMeters([hud.lng, hud.lat], lastFetch.current)) > 8000) {
      lastFetch.current = [hud.lng, hud.lat];
      setQueryCenter([hud.lng, hud.lat]);
    }
  }, [hud.lng, hud.lat]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setRunwayStatus('Loading nearby runways...');
    void fetch(`/api/fly/runways?lng=${queryCenter[0]}&lat=${queryCenter[1]}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Runway lookup unavailable. Sign in and refresh the radar.');
        const body = await response.json() as { runways: Runway[] };
        if (!Array.isArray(body.runways)) throw new Error('Invalid runway response.');
        if (controller.signal.aborted) return;
        const retained = selectedRef.current;
        const next = retained && !body.runways.some((r) => r.id === retained.id) ? [...body.runways, retained] : body.runways;
        runwayRef.current = next;
        setRunways(next);
        setRunwayStatus(body.runways.length ? '' : 'No published runway centerlines nearby. Try another departure.');
      })
      .catch(() => { if (!disposed) setRunwayStatus('Runway lookup failed. Refresh the radar to retry.'); })
      .finally(() => window.clearTimeout(timeout));
    let disposed = false;
    return () => { disposed = true; controller.abort(); window.clearTimeout(timeout); };
  }, [queryCenter, refresh]);

  useEffect(() => {
    const map = mapRef.current;
    if (ready && map) paintRunways(map, runways, selected?.id ?? null);
  }, [ready, runways, selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (ready && map) paintLandingCorridor(map,
      hud.landingArmed && (hud.phase === 'approach' || hud.phase === 'landing') ? runways.find((r) => r.id === hud.activeRunwayId) : undefined,
      hud.runwayReverse);
  }, [ready, runways, hud.activeRunwayId, hud.runwayReverse, hud.phase, hud.landingArmed]);

  useEffect(() => {
    if (!ready || !runways.length || initialLineUp.current) return;
    initialLineUp.current = true;
    const position: [number, number] = [flight.current.lng, flight.current.lat];
    const runway = runways.reduce((nearest, candidate) =>
      runwayPosition(candidate, position).distance < runwayPosition(nearest, position).distance ? candidate : nearest);
    selectedRef.current = runway;
    setSelected(runway);
    flight.current = createRunwayFlight(runway, 900);
    flight.current.message = 'Loading departure runway elevation...';
    pendingLineUp.current = { runway, reverse: false, started: performance.now() };
    throttleRef.current = 1;
    setThrottle(1);
    setHud({ ...flight.current });
  }, [ready, runways]);

  function armLanding() {
    if (isGrounded(flight.current)) return;
    flight.current.landingArmed = !flight.current.landingArmed;
    flight.current.message = flight.current.landingArmed ? 'Landing armed. Align with a runway, slow to 49-117 KT, and descend gently.' : 'Landing cancelled. Cruise clearance restored.';
    setHud({ ...flight.current });
  }

  function lineUp(reverse: boolean) {
    const runway = selectedRef.current;
    if (!runway || !mapRef.current) return;
    setFlightPaused(true);
    throttleRef.current = 0;
    setThrottle(0);
    flight.current = createRunwayFlight(runway, 900, reverse);
    pendingLineUp.current = { runway, reverse, started: performance.now() };
    flight.current.message = 'Loading runway elevation...';
    setHud({ ...flight.current });
  }

  function setFlightPaused(value: boolean) {
    if (!value && (pendingLineUp.current || awaitingDeparture.current)) return;
    pausedRef.current = value;
    setPaused(value);
    keys.current.clear();
    touches.current.clear();
    resetStick();
  }

  function resetFlight(index = locationRef.current) {
    initialLineUp.current = true;
    awaitingDeparture.current = false;
    setPreparingDeparture(false);
    pendingLineUp.current = null;
    flight.current = createFlight(index);
    setHud(flight.current);
    setBoundary(false);
    setFlightPaused(true);
  }

  useEffect(() => {
    const heldKeys = keys.current;
    const heldTouches = touches.current;
    let disposed = false;
    let frame = 0;
    let resize: ResizeObserver | undefined;
    let map: MapboxMap | undefined;
    let last = 0;
    let lastHud = 0;
    let boundaryUntil = 0;
    let loaded = false;

    function pause() {
      pausedRef.current = true;
      setPaused(true);
      keys.current.clear();
      touches.current.clear();
      resetStick();
    }
    function onVisibility() { if (document.hidden) pause(); }
    function keyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && (event.target.closest('input, select, textarea, [contenteditable="true"]') || (event.code === 'Space' && event.target.closest('button, a')))) return;
      if (!KEYS.has(event.code) || !loaded) return;
      event.preventDefault();
      keys.current.add(event.code);
      if (event.repeat) return;
      if (event.code === 'Space') {
        if (pendingLineUp.current || awaitingDeparture.current) return;
        resetStick();
        pausedRef.current = !pausedRef.current;
        setPaused(pausedRef.current);
      }
      if (event.code === 'KeyR') {
        initialLineUp.current = true;
        awaitingDeparture.current = false;
        setPreparingDeparture(false);
        pendingLineUp.current = null;
        flight.current = createFlight(locationRef.current);
        pause();
      }
      if (event.code === 'KeyL' && !isGrounded(flight.current)) {
        flight.current.landingArmed = !flight.current.landingArmed;
        flight.current.message = flight.current.landingArmed ? 'Landing armed. Align with a runway and descend gently.' : 'Landing cancelled.';
      }
    }
    function keyUp(event: KeyboardEvent) { keys.current.delete(event.code); }

    async function boot() {
      if (!host.current) return;
      if (!MAP_CONFIG.MAPBOX_TOKEN) {
        setError('The map needs a Mapbox access token. Configure NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN and restart the app.');
        return;
      }
      try {
        const { default: mapboxgl } = await import('mapbox-gl');
        if (disposed || !host.current) return;
        const b = MAP_CONFIG.MINNESOTA_BOUNDS;
        map = new mapboxgl.Map({
          container: host.current,
          accessToken: MAP_CONFIG.MAPBOX_TOKEN,
          style: MAP_CONFIG.STYLE,
          projection: 'mercator',
          center: [flight.current.lng, flight.current.lat],
          zoom: 13, pitch: 65, bearing: flight.current.heading,
          maxPitch: 85, minZoom: 5, maxZoom: 20,
          maxBounds: [[b.west, b.south], [b.east, b.north]],
          interactive: false, antialias: true, renderWorldCopies: false,
          attributionControl: false,
        });
        mapRef.current = map;
        map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
        map.on('error', (event) => {
          if (!loaded && !disposed) setError(`The map could not load. Check your connection and Mapbox configuration. ${event.error?.message ?? ''}`);
        });
        map.on('webglcontextlost', () => {
          pause();
          setError('The 3D graphics session was interrupted. Reload the page to resume flying.');
        });
        map.on('load', () => {
          if (disposed || !map) return;
          try {
            map.addSource('fly-dem', {
              type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14,
            });
            map.setTerrain({ source: 'fly-dem', exaggeration: 1 });
            map.setFog({ color: '#d8e6e9', 'high-color': '#8eb7d3', 'space-color': '#c5dce9', 'horizon-blend': 0.12 });
            map.addLayer(createAircraftLayer(() => flight.current));
            paintRunways(map, runwayRef.current, selectedRef.current?.id ?? null);
            loaded = true;
            setError('');
            setReady(true);
            frame = requestAnimationFrame(tick);
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to initialize the flight map.');
          }
        });
        resize = new ResizeObserver(() => map?.resize());
        resize.observe(host.current);

        function tick(now: number) {
          if (disposed || !map) return;
          const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
          last = now;
          const pending = pendingLineUp.current;
          const terrain = map.queryTerrainElevation([flight.current.lng, flight.current.lat], { exaggerated: false });
          if (pending && terrain != null && map.areTilesLoaded()) {
            flight.current = createRunwayFlight(pending.runway, terrain, pending.reverse);
            pendingLineUp.current = null;
            awaitingDeparture.current = false;
            setPreparingDeparture(false);
          } else if (pending && now - pending.started > 20000) {
            pendingLineUp.current = null;
            flight.current.message = 'Runway elevation unavailable. Select Line up in the radar to retry.';
            awaitingDeparture.current = true;
            setPreparingDeparture(true);
          }
          if (!pausedRef.current) {
            const active = new Set(touches.current.values());
            const held = (...codes: string[]) => codes.some((code) => keys.current.has(code));
            throttleRef.current = clamp(throttleRef.current + ((held('KeyE') ? 1 : 0) - (held('KeyQ') ? 1 : 0)) * dt * 0.3, 0, 1);
            if (terrain == null && (flight.current.landingArmed || isGrounded(flight.current))) {
              pause();
              flight.current.message = 'Terrain is still loading. Resume when the map has loaded.';
            }
            const ground = terrain ?? 0;
            const wasGrounded = isGrounded(flight.current);
            if (!pausedRef.current) flight.current = stepFlight(flight.current, {
              turn: clamp(Number(held('ArrowRight', 'KeyD')) - Number(held('ArrowLeft', 'KeyA')) + stick.current.x, -1, 1),
              climb: clamp(Number(held('ArrowUp', 'KeyW')) - Number(held('ArrowDown', 'KeyS')) - stick.current.y, -1, 1),
              throttle: throttleRef.current,
              brake: held('KeyB') || active.has('brake'),
            }, dt, ground, runwayRef.current);
            if (!wasGrounded && isGrounded(flight.current)) throttleRef.current = 0;
            if (flight.current.boundary) boundaryUntil = now + 3500;
          }
          const state = flight.current;
          const behind = offsetPosition(state.lng, state.lat, state.heading, -100);
          const ahead = offsetPosition(state.lng, state.lat, state.heading, 80);
          const camera = map.getFreeCameraOptions();
          camera.position = mapboxgl.MercatorCoordinate.fromLngLat(behind, state.altitude + 55);
          camera.lookAtPoint(ahead, undefined, state.altitude);
          map.setFreeCameraOptions(camera);
          if (now - lastHud > 100) {
            setGroundAltitude(terrain ?? null);
            setHud({ ...state });
            setThrottle(throttleRef.current);
            setBoundary(now < boundaryUntil);
            lastHud = now;
          }
          frame = requestAnimationFrame(tick);
        }
      } catch (reason) {
        if (!disposed) setError(reason instanceof Error ? reason.message : 'Unable to start the flight simulator.');
      }
    }

    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', onVisibility);
    void boot();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize?.disconnect();
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', onVisibility);
      heldKeys.clear();
      heldTouches.clear();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  function resetStick() {
    stick.current = { x: 0, y: 0, pointer: null };
    setStickPosition({ x: 0, y: 0 });
  }

  function moveStick(event: PointerEvent<HTMLButtonElement>) {
    if (stick.current.pointer !== event.pointerId) return;
    if (pausedRef.current) { resetStick(); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) / 34;
    const y = (event.clientY - rect.top - rect.height / 2) / 34;
    const length = Math.hypot(x, y);
    const scale = Math.max(1, length);
    // A small dead zone prevents thumb jitter; the rest is proportional input.
    const strength = Math.max(0, (Math.min(1, length) - 0.08) / 0.92);
    stick.current.x = length ? x / length * strength : 0;
    stick.current.y = length ? y / length * strength : 0;
    setStickPosition({ x: x / scale, y: y / scale });
  }

  function releaseStick(event: PointerEvent<HTMLButtonElement>) {
    if (stick.current.pointer === event.pointerId) resetStick();
  }

  function press(event: PointerEvent<HTMLButtonElement>, control: Control) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    touches.current.set(event.pointerId, control);
  }
  function release(event: PointerEvent<HTMLButtonElement>) { touches.current.delete(event.pointerId); }

  return (
    <section className={styles.flight} aria-label="Minnesota flight simulator">
      <TopBar
        title={<div className={styles.heading} aria-label={`Plane heading ${Math.round(hud.heading)} degrees`}><span>FLY / HDG</span><strong>{String(Math.round(hud.heading) % 360).padStart(3, '0')}°</strong></div>}
        trailing={<div className={styles.headerActions}>
          <button type="button" disabled={!ready || !!error || preparingDeparture} onClick={() => setFlightPaused(!pausedRef.current)}>{paused ? 'Fly' : 'Pause'}</button>
          <details className={styles.flightMenu}>
            <summary aria-label="Flight options">•••</summary>
            <div className={styles.menuPanel}>
              <b>Flight options</b>
          <label className={styles.destination}>
            <span>DEPARTURE</span>
            <select aria-label="Departure location" value={location} onChange={(event) => {
              const index = Number(event.target.value);
              locationRef.current = index;
              setLocation(index);
              resetFlight(index);
            }}>
              {FLIGHT_LOCATIONS.map((place, index) => <option value={index} key={place.name}>{place.name}</option>)}
            </select>
          </label>

              <button type="button" onClick={() => resetFlight()}>Reset flight</button>
              <p>Drag the stick up to climb, down to descend, and left or right to bank. Hold B to brake on the ground.</p>
              <p>Keyboard: W/S climb and descend · A/D bank · Q/E throttle · L landing · B brakes · Space pause.</p>
              <Link href="/game" className={styles.exit}>Back to map</Link>
            </div>
          </details>
        </div>}
        belowCollapsed={false}
        below={<div className={styles.telemetry}>
          <div className={styles.instruments}>
            <div><span>AIRSPEED</span><strong>{Math.round(hud.speed * 1.94384)}<small> KT</small></strong></div>
            <div><span>ALTITUDE MSL</span><strong>{Math.round(hud.altitude * 3.28084).toLocaleString()}<small> FT</small></strong></div>
            <div><span>DISTANCE</span><strong>{(hud.distance / 1609.344).toFixed(1)}<small> MI</small></strong></div>
          </div>

          <div className={styles.flightDetails}>
            <span>AGL <b>{groundAltitude == null ? '—' : Math.max(0, Math.round((hud.altitude - groundAltitude) * 3.28084))} <small>FT</small></b></span>
            <span>SINK <b>{Math.max(0, -hud.speed * Math.sin(hud.pitch * Math.PI / 180)).toFixed(1)} <small>m/s</small></b></span>
            <span>BANK <b>{Math.round(Math.abs(hud.bank))}°</b></span>
            <span>ALIGN <b>{alignment == null ? '—' : `${Math.round(alignment)}°`}</b></span>
          </div>
        </div>}
      />
      <div ref={host} className={styles.map} aria-label="Third-person flight map of Minnesota" />
      <div className={styles.overlay}>
        <div className={styles.notice} role="status">{boundary ? 'Minnesota boundary reached. Turning back into the flight area.' : ''}</div>
        <RunwayRadar flight={hud} runways={runways} selected={selected} status={runwayStatus}
          onSelect={(runway) => { selectedRef.current = runway; setSelected(runway); }}
          onLineUp={lineUp} onRetry={() => setRefresh((n) => n + 1)} />
        <div className={styles.landingStatus}>
          <button type="button" disabled={!ready || isGrounded(hud)} aria-pressed={hud.landingArmed} onClick={armLanding}>{!isGrounded(hud) ? hud.landingArmed ? 'Landing armed' : 'Arm landing' : hud.phase === 'takeoff' ? 'Taking off' : 'On runway'}</button>
          <details className={styles.statusDetail}>
            <summary>{hud.phase.toUpperCase()} <span aria-hidden="true">ⓘ</span></summary>
            <p>{hud.message || 'Explore Minnesota from the air.'}</p>
          </details>
          <span className={styles.srOnly} role="status">{hud.message}</span>

        </div>
        {(paused || !ready || error) && (
          <div className={styles.intro}>
            <span className={styles.eyebrow}>MINNESOTA / FREE FLIGHT</span>
            <h1>{error ? 'Flight unavailable' : !ready || preparingDeparture ? 'Preparing your runway' : isGrounded(hud) ? 'Ready on the runway.' : hud.distance > 0 ? 'Take a breath.' : 'A different view of home.'}</h1>
            <p>{error || (!ready ? 'Loading the map and aircraft...' : preparingDeparture ? 'Finding a nearby runway and loading its elevation. If loading fails, refresh the runway radar or choose Line up to retry.' : isGrounded(hud) ? 'Throttle up, then push the stick up to lift off above 68 KT.' : 'Drag the stick to bank, climb and descend. Release to center it.')}</p>
            {!error && ready && !preparingDeparture && <button type="button" className={styles.launch} onClick={() => setFlightPaused(false)}>{hud.distance > 0 ? 'Resume flight' : isGrounded(hud) ? 'Start takeoff' : 'Start flying'} <span aria-hidden="true">&rarr;</span></button>}
            {!!error && <button type="button" className={styles.launch} onClick={() => window.location.reload()}>Retry</button>}

          </div>
        )}
        <div className={styles.bottom}>
          <div className={styles.controls}>
            <label className={styles.throttle}>
              <span>THROTTLE <b>{Math.round(throttle * 100)}%</b></span>
              <span className={styles.lever}>
                <span className={styles.leverTicks} aria-hidden="true" />
                <span className={styles.leverSlot} aria-hidden="true" />
                <span className={styles.leverGrip} aria-hidden="true" style={{ top: `calc(${(1 - throttle) * 100}% - ${(1 - throttle) * 44}px)` }}><span /></span>
              <input aria-label="Throttle" aria-valuetext={`${Math.round(throttle * 100)} percent power`} type="range" min="0" max="1" step="0.01" value={throttle} onChange={(event) => {
                throttleRef.current = Number(event.target.value);
                setThrottle(throttleRef.current);
              }} />
              </span>
              <span className={styles.leverLegend} aria-hidden="true">IDLE <span>↑</span> FULL</span>
            </label>
            <div className={styles.pad} aria-label="Flight controls">
              <button className={styles.brake} type="button" aria-label="Hold brakes" disabled={paused || !isGrounded(hud)} onPointerDown={(event) => press(event, 'brake')} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>B</button>
              <button type="button" className={styles.joystick}
                aria-label="Flight joystick: drag up to climb, down to descend, left or right to bank. Keyboard arrows also control flight."
                disabled={paused || !ready || !!error}
                onPointerDown={(event) => {
                  if (stick.current.pointer !== null || event.button !== 0) return;
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  stick.current.pointer = event.pointerId;
                  moveStick(event);
                }}
                onPointerMove={moveStick}
                onPointerUp={releaseStick} onPointerCancel={releaseStick} onLostPointerCapture={releaseStick}
                onBlur={resetStick}>
                <span className={styles.stickAxis} aria-hidden="true" />
                <span className={styles.stickKnob} aria-hidden="true" style={{ transform: `translate(${stickPosition.x * 34}px, ${stickPosition.y * 34}px)` }} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
