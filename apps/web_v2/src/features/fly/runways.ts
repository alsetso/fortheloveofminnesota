import type { FeatureCollection, Geometry, Position } from 'geojson';

export type Runway = {
  id: string; name: string; coordinates: [number, number][];
  width: number; length: number; surface: string; heading: number;
};
const RAD = Math.PI / 180;
export function localMeters(point: Position, origin: Position): [number, number] {
  return [(point[0] - origin[0]) * 111320 * Math.cos(origin[1] * RAD), (point[1] - origin[1]) * 111320];
}
export function bearing(a: Position, b: Position): number {
  const [x, y] = localMeters(b, a);
  return (Math.atan2(x, y) / RAD + 360) % 360;
}
export function headingError(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}
export function runwayPosition(runway: Runway, point: Position) {
  let best = { distance: Infinity, along: 0, heading: runway.heading };
  let traveled = 0;
  for (let i = 1; i < runway.coordinates.length; i++) {
    const a = runway.coordinates[i - 1];
    const b = runway.coordinates[i];
    const [x, y] = localMeters(b, a);
    const [px, py] = localMeters(point, a);
    const length = Math.hypot(x, y);
    if (!length) continue;
    const t = Math.max(0, Math.min(1, (px * x + py * y) / (length * length)));
    const distance = Math.hypot(px - t * x, py - t * y);
    if (distance < best.distance) best = { distance, along: traveled + t * length, heading: bearing(a, b) };
    traveled += length;
  }
  return { ...best, length: traveled };
}

/** Only real line geometry and recorded runway widths qualify as landing surfaces. */
export function parseRunways(fc: FeatureCollection<Geometry>): Runway[] {
  const result: Runway[] = [];
  for (const feature of fc.features) {
    const p = feature.properties ?? {};
    const attrs = p.attrs ?? {};
    const width = Number(attrs.runway_width_ft) * 0.3048;
    if (!Number.isFinite(width) || width <= 0 || width > 300) continue;
    const lines = feature.geometry?.type === 'LineString' ? [feature.geometry.coordinates]
      : feature.geometry?.type === 'MultiLineString' ? feature.geometry.coordinates : [];
    lines.forEach((line, index) => {
      if (line.length < 2 || line.some((point) => point.length < 2 || !point.slice(0, 2).every(Number.isFinite) || point[0] < -97.5 || point[0] > -89.5 || point[1] < 43.5 || point[1] > 49.5)) return;
      const coordinates = line.map((point): [number, number] => [point[0], point[1]]);
      const runway: Runway = {
        id: `${feature.id ?? p.id}:${index}`, name: String(p.name ?? 'Runway'), coordinates,
        width, length: 0, surface: String(attrs.surface_type ?? 'Unknown surface'),
        heading: bearing(coordinates[0], coordinates[1]),
      };
      runway.length = runwayPosition(runway, coordinates[0]).length;
      if (runway.length >= 100) result.push(runway);
    });
  }
  return result;
}

export function runwayGeoJson(runways: Runway[]): FeatureCollection {
  return { type: 'FeatureCollection', features: runways.map((r) => ({
    type: 'Feature', id: r.id, properties: { id: r.id, name: r.name },
    geometry: { type: 'LineString', coordinates: r.coordinates },
  })) };
}

const landingFrames = new WeakMap<Runway, Map<boolean, { origin: [number, number]; heading: number; length: number; halfWidth: number; extension: number }>>();
// One cached runway-relative footprint shared by physics and the painted corridor.
export function landingFrame(runway: Runway, reverse = false) {
  const cached = landingFrames.get(runway)?.get(reverse);
  if (cached) return cached;
  const origin = runway.coordinates[reverse ? runway.coordinates.length - 1 : 0];
  const end = runway.coordinates[reverse ? 0 : runway.coordinates.length - 1];
  const heading = bearing(origin, end);
  const length = Math.hypot(...localMeters(end, origin));
  const halfWidth = Math.max(60, runway.width * 1.5);
  const frame = { origin, heading, length, halfWidth, extension: 1200 };
  const frames = landingFrames.get(runway) ?? new Map();
  frames.set(reverse, frame);
  landingFrames.set(runway, frames);
  return frame;
}

export function landingPosition(runway: Runway, point: Position, heading: number) {
  const forward = landingFrame(runway);
  const reverse = headingError(heading, forward.heading) > 90;
  const frame = reverse ? landingFrame(runway, true) : forward;
  const [x, y] = localMeters(point, frame.origin);
  const angle = frame.heading * RAD;
  const along = x * Math.sin(angle) + y * Math.cos(angle);
  const cross = Math.abs(x * Math.cos(angle) - y * Math.sin(angle));
  const width = frame.halfWidth + Math.max(0, -along) / frame.extension * 180;
  return { ...frame, along, cross, reverse, error: headingError(heading, frame.heading),
    inside: along >= -frame.extension && along <= frame.length && cross <= width,
    touchdown: along >= 0 && along <= frame.length && cross <= frame.halfWidth };
}

export function landingGeoJson(runway: Runway | undefined, reverse = false): FeatureCollection {
  if (!runway) return { type: 'FeatureCollection', features: [] };
  const f = landingFrame(runway, reverse);
  const angle = f.heading * RAD;
  const coordinates = [[-f.extension, -f.halfWidth - 180], [0, -f.halfWidth],
    [f.length, -f.halfWidth], [f.length, f.halfWidth], [0, f.halfWidth],
    [-f.extension, f.halfWidth + 180], [-f.extension, -f.halfWidth - 180]].map(([along, cross]) => {
      const x = along * Math.sin(angle) + cross * Math.cos(angle);
      const y = along * Math.cos(angle) - cross * Math.sin(angle);
      return [f.origin[0] + x / (111320 * Math.cos(f.origin[1] * RAD)), f.origin[1] + y / 111320];
    });
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coordinates] } }] };
}
