'use client';


import type { FlightState } from './flightPhysics';
import { localMeters, runwayPosition, type Runway } from './runways';
import styles from './flight.module.css';

export default function RunwayRadar({ flight, runways, selected, onSelect, onLineUp, onRetry, status }: {
  flight: FlightState; runways: Runway[]; selected: Runway | null;
  onSelect: (runway: Runway) => void; onLineUp: (reverse: boolean) => void; onRetry: () => void; status: string;
}) {

  const nearby = runways.map((r) => ({ runway: r, distance: runwayPosition(r, [flight.lng, flight.lat]).distance }))
    .sort((a, b) => a.distance - b.distance);
  const plot = (point: [number, number]) => {
    const [east, north] = localMeters(point, [flight.lng, flight.lat]);
    return `${120 + east / 300},${120 - north / 300}`;
  };
  return <aside className={styles.radar}>
      <svg viewBox="0 0 240 240" role="img" aria-label="North-up radar map: nearby runways within 30 kilometers">
        <defs><clipPath id="fly-radar-clip"><circle cx="120" cy="120" r="100" /></clipPath></defs>
        <circle cx="120" cy="120" r="100" fill="#19382e" />
        <circle cx="120" cy="120" r="50" fill="none" stroke="#477565" />
        <path d="M120 20V220M20 120H220" stroke="#477565" />
        <text x="120" y="14" textAnchor="middle" fill="#19382e" fontSize="10">N / 30 KM</text>
        <g clipPath="url(#fly-radar-clip)">{runways.map((r) => <polyline key={r.id} points={r.coordinates.map(plot).join(' ')} fill="none" stroke={(r.id === flight.activeRunwayId || r.id === selected?.id) ? '#ffd36e' : '#69efc1'} strokeWidth={(r.id === flight.activeRunwayId || r.id === selected?.id) ? 5 : 3}><title>{r.name}</title></polyline>)}</g>
        <path d="M120 112L125 126L120 123L115 126Z" fill="white" transform={`rotate(${flight.heading},120,120)`} />
      </svg>
    <details className={styles.radarOptions}>
      <summary>Runways <span aria-hidden="true">⌃</span></summary>
      <div className={styles.radarPanel}>
      <p role="status">{status || `${runways.length} atlas runways in this area`}</p>
      <button type="button" onClick={onRetry}>Refresh nearby runways</button>
      <div className={styles.runwayList}>{nearby.slice(0, 8).map(({ runway, distance }) => <button type="button" key={runway.id} aria-pressed={selected?.id === runway.id} onClick={() => onSelect(runway)}>
        <b>{runway.name}</b><span>{(distance / 1000).toFixed(1)} km · {Math.round(runway.length)} m</span>
      </button>)}</div>
      {selected && <div className={styles.runwayDetail}>
        <b>{selected.name}</b>
        <p>{selected.surface} · {Math.round(selected.width)} m wide</p>
        <p>Select a direction to move the plane to the runway and pause.</p>
        <div><button type="button" onClick={() => onLineUp(false)}>Line up {Math.round(selected.heading)}°</button><button type="button" onClick={() => onLineUp(true)}>Reverse {Math.round((selected.heading + 180) % 360)}°</button></div>
      </div>}
    </div>
    </details>
  </aside>;
}
