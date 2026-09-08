/**
 * Derive WGS84 lng/lat bounds from GeoJSON geometry (Polygon / MultiPolygon / Feature).
 */

function walkCoords(
  coords: unknown,
  visit: (lng: number, lat: number) => void,
): void {
  if (!Array.isArray(coords)) return;
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    const lng = coords[0] as number;
    const lat = coords[1] as number;
    if (Number.isFinite(lng) && Number.isFinite(lat)) visit(lng, lat);
    return;
  }
  for (const c of coords) walkCoords(c, visit);
}

export type LngLatBoundsBox = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

export function geometryLngLatBounds(geometry: unknown): LngLatBoundsBox | null {
  if (!geometry || typeof geometry !== 'object') return null;
  const g = geometry as { type?: string; coordinates?: unknown; geometry?: unknown };

  if (g.type === 'Feature' && g.geometry) return geometryLngLatBounds(g.geometry);
  if (g.type === 'FeatureCollection') {
    const features = (geometry as { features?: unknown[] }).features;
    if (!Array.isArray(features)) return null;
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (const f of features) {
      const box = geometryLngLatBounds((f as { geometry?: unknown })?.geometry);
      if (!box) continue;
      minLng = Math.min(minLng, box.minLng);
      minLat = Math.min(minLat, box.minLat);
      maxLng = Math.max(maxLng, box.maxLng);
      maxLat = Math.max(maxLat, box.maxLat);
    }
    if (!Number.isFinite(minLng)) return null;
    return { minLng, minLat, maxLng, maxLat };
  }

  if (g.coordinates == null) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  walkCoords(g.coordinates, (lng, lat) => {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  });

  if (!Number.isFinite(minLng)) return null;

  // Degenerate point — pad so fitBounds is valid
  if (Math.abs(maxLng - minLng) < 1e-9 && Math.abs(maxLat - minLat) < 1e-9) {
    const pad = 0.02;
    return {
      minLng: minLng - pad,
      maxLng: maxLng + pad,
      minLat: minLat - pad,
      maxLat: maxLat + pad,
    };
  }

  return { minLng, minLat, maxLng, maxLat };
}

export function boundsToMapbox(
  bounds: LngLatBoundsBox,
): [[number, number], [number, number]] {
  return [
    [bounds.minLng, bounds.minLat],
    [bounds.maxLng, bounds.maxLat],
  ];
}

/** Merge multiple WGS84 boxes into one envelope (skips null). */
export function unionLngLatBounds(
  ...boxes: Array<LngLatBoundsBox | null | undefined>
): LngLatBoundsBox | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const box of boxes) {
    if (!box) continue;
    minLng = Math.min(minLng, box.minLng);
    minLat = Math.min(minLat, box.minLat);
    maxLng = Math.max(maxLng, box.maxLng);
    maxLat = Math.max(maxLat, box.maxLat);
  }
  if (!Number.isFinite(minLng)) return null;
  return { minLng, minLat, maxLng, maxLat };
}
