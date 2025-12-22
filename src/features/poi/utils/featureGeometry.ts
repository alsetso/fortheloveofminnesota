/**
 * Utilities for extracting feature geometry and calculating centers/centroids
 * Handles Point, Polygon, MultiPolygon, LineString geometries from Mapbox features
 */

export interface FeatureGeometry {
  type: 'Point' | 'Polygon' | 'MultiPolygon' | 'LineString' | 'MultiLineString';
  coordinates: any;
  center?: { lat: number; lng: number };
}

/**
 * Calculate center/centroid from feature geometry
 * For buildings and areas, uses geometry center/centroid
 * For points, uses point coordinates
 */
export function getFeatureCenter(
  mapboxFeature: any,
  fallbackCoordinates?: { lat: number; lng: number }
): { lat: number; lng: number } | null {
  if (!mapboxFeature) return fallbackCoordinates || null;

  const geometry = mapboxFeature.geometry;
  if (!geometry) return fallbackCoordinates || null;

  try {
    // Point geometry - use coordinates directly
    if (geometry.type === 'Point' && geometry.coordinates) {
      const [lng, lat] = geometry.coordinates;
      return { lat, lng };
    }

    // Polygon - calculate centroid
    if (geometry.type === 'Polygon' && geometry.coordinates) {
      const coords = geometry.coordinates[0]; // Exterior ring
      return calculateCentroid(coords);
    }

    // MultiPolygon - calculate centroid from all polygons
    if (geometry.type === 'MultiPolygon' && geometry.coordinates) {
      const allCoords: number[][] = [];
      for (const polygon of geometry.coordinates) {
        if (polygon[0]) {
          allCoords.push(...polygon[0]);
        }
      }
      if (allCoords.length > 0) {
        return calculateCentroid(allCoords);
      }
    }

    // LineString - calculate midpoint
    if (geometry.type === 'LineString' && geometry.coordinates) {
      const coords = geometry.coordinates;
      if (coords.length > 0) {
        const midIndex = Math.floor(coords.length / 2);
        const [lng, lat] = coords[midIndex];
        return { lat, lng };
      }
    }

    // MultiLineString - calculate midpoint from first line
    if (geometry.type === 'MultiLineString' && geometry.coordinates) {
      const firstLine = geometry.coordinates[0];
      if (firstLine && firstLine.length > 0) {
        const midIndex = Math.floor(firstLine.length / 2);
        const [lng, lat] = firstLine[midIndex];
        return { lat, lng };
      }
    }

    // Fallback to provided coordinates
    return fallbackCoordinates || null;
  } catch (error) {
    console.error('[FeatureGeometry] Error calculating center:', error);
    return fallbackCoordinates || null;
  }
}

/**
 * Calculate centroid from array of coordinates
 */
function calculateCentroid(coords: number[][]): { lat: number; lng: number } {
  if (coords.length === 0) {
    throw new Error('Empty coordinates array');
  }

  let sumLng = 0;
  let sumLat = 0;
  let count = 0;

  for (const coord of coords) {
    if (Array.isArray(coord) && coord.length >= 2) {
      const [lng, lat] = coord;
      sumLng += lng;
      sumLat += lat;
      count++;
    }
  }

  if (count === 0) {
    throw new Error('No valid coordinates found');
  }

  return {
    lng: sumLng / count,
    lat: sumLat / count,
  };
}

/**
 * Extract full geometry from mapbox feature
 */
export function extractFeatureGeometry(mapboxFeature: any): FeatureGeometry | null {
  if (!mapboxFeature || !mapboxFeature.geometry) return null;

  const geometry = mapboxFeature.geometry;
  const center = getFeatureCenter(mapboxFeature);

  return {
    type: geometry.type,
    coordinates: geometry.coordinates,
    center: center || undefined,
  };
}
