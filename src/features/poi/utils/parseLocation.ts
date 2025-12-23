/**
 * Utility to parse PostGIS geography/geometry location data
 * Handles multiple formats:
 * - WKB hex string (e.g., "0101000020E610000000008053C55E57C064F6BC21FB904640")
 * - PostGIS text format (e.g., "POINT(lng lat)" or "SRID=4326;POINT(lng lat)")
 * - GeoJSON object (e.g., { type: 'Point', coordinates: [lng, lat] })
 * - Object with lng/lat properties
 */
export function parseLocation(location: any): { lng: number; lat: number } | null {
  if (!location) return null;

  // GeoJSON format
  if (typeof location === 'object' && location !== null) {
    if (location.coordinates && Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
      return {
        lng: parseFloat(location.coordinates[0]),
        lat: parseFloat(location.coordinates[1]),
      };
    }
    if (location.lng !== undefined && location.lat !== undefined) {
      return {
        lng: parseFloat(location.lng),
        lat: parseFloat(location.lat),
      };
    }
  }

  // String format
  if (typeof location === 'string') {
    // PostGIS text format: "POINT(lng lat)" or "SRID=4326;POINT(lng lat)"
    const pointMatch = location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
    if (pointMatch) {
      return {
        lng: parseFloat(pointMatch[1]),
        lat: parseFloat(pointMatch[2]),
      };
    }

    // WKB hex format (starts with "01" for little-endian Point)
    // Format: "0101000020E6100000..." where:
    // - "01" = little-endian
    // - "01000000" = Point type (1)
    // - "E6100000" = SRID 4326 in little-endian
    // - Rest is coordinates as double-precision floats
    if (location.startsWith('0101000020E6100000') && location.length >= 34) {
      try {
        // Extract hex bytes for coordinates (skip header: 01 01 00 00 20 E6 10 00 00 = 9 bytes = 18 hex chars)
        const coordHex = location.substring(18);
        if (coordHex.length >= 32) {
          // Each coordinate is 8 bytes (16 hex chars) as double-precision float
          const lngHex = coordHex.substring(0, 16);
          const latHex = coordHex.substring(16, 32);

          // Convert hex to Uint8Array and parse as double (little-endian)
          const lngBytes = new Uint8Array(8);
          const latBytes = new Uint8Array(8);
          
          for (let i = 0; i < 8; i++) {
            lngBytes[i] = parseInt(lngHex.substring(i * 2, i * 2 + 2), 16);
            latBytes[i] = parseInt(latHex.substring(i * 2, i * 2 + 2), 16);
          }

          // Create DataView to read as little-endian double
          const lngView = new DataView(lngBytes.buffer);
          const latView = new DataView(latBytes.buffer);
          
          const lng = lngView.getFloat64(0, true); // true = little-endian
          const lat = latView.getFloat64(0, true);

          // Validate coordinates are reasonable
          if (isFinite(lng) && isFinite(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
            return { lng, lat };
          }
        }
      } catch (e) {
        // WKB parsing failed, try other formats
        console.warn('[parseLocation] WKB parsing failed:', e);
      }
    }
  }

  return null;
}

