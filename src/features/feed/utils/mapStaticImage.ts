import { MAP_CONFIG } from '@/features/map/config';

interface MapData {
  type: 'pin' | 'area' | 'both';
  geometry: GeoJSON.Point | GeoJSON.Polygon | GeoJSON.MultiPolygon;
  center?: [number, number];
  hidePin?: boolean;
  polygon?: GeoJSON.Polygon | GeoJSON.MultiPolygon; // For 'both' type
}

/**
 * Generate a Mapbox Static Images API URL for post map previews
 * This avoids loading full Mapbox GL and reduces API calls significantly
 */
export function generateMapStaticImageUrl(
  mapData: MapData,
  options: {
    width?: number;
    height?: number;
    zoom?: number;
  } = {}
): string | null {
  if (!MAP_CONFIG.MAPBOX_TOKEN) {
    console.warn('Mapbox token not configured');
    return null;
  }

  const { width = 600, height = 300, zoom } = options;
  const token = MAP_CONFIG.MAPBOX_TOKEN;

  // Extract style ID from MAPBOX_STYLE
  // Format: mapbox://styles/mapbox/streets-v12
  const styleMatch = MAP_CONFIG.MAPBOX_STYLE.match(/mapbox\/styles\/mapbox\/([^/]+)/);
  const styleId = styleMatch ? styleMatch[1] : 'streets-v12';

  let center: [number, number];
  let overlay: string = '';

  if ((mapData.type === 'pin' || mapData.type === 'both') && mapData.geometry.type === 'Point') {
    const [lng, lat] = mapData.geometry.coordinates;
    center = [lng, lat];
    
    // Build overlay components
    const overlayParts: string[] = [];
    
    // Add pin marker overlay only if not hidden
    // Format: pin-l+ef4444(lng,lat) - l=large, ef4444=red color
    if (!mapData.hidePin) {
      overlayParts.push(`pin-l+ef4444(${lng},${lat})`);
    }
    
    // If type is 'both', add polygon overlay
    if (mapData.type === 'both' && mapData.polygon) {
      const polygon = mapData.polygon;
      const pathCoords: string[] = [];
      
      if (polygon.type === 'Polygon' && polygon.coordinates[0]) {
        polygon.coordinates[0].forEach(([lng, lat]) => {
          pathCoords.push(`${lng},${lat}`);
        });
      } else if (polygon.type === 'MultiPolygon' && polygon.coordinates[0]?.[0]) {
        polygon.coordinates[0][0].forEach(([lng, lat]) => {
          pathCoords.push(`${lng},${lat}`);
        });
      }

      if (pathCoords.length > 0) {
        // Create GeoJSON Feature for polygon
        const geojsonFeature = {
          type: 'Feature' as const,
          properties: {
            stroke: '#10b981', // Green stroke color for polygon
            'stroke-width': 2,
            'stroke-opacity': 1,
            fill: '#10b981', // Green fill color
            'fill-opacity': 0.15, // 15% opacity
          },
          geometry: polygon,
        };
        
        const encodedGeoJSON = encodeURIComponent(JSON.stringify(geojsonFeature));
        overlayParts.push(`geojson(${encodedGeoJSON})`);
      }
    }
    
    // Combine overlay parts with + separator
    overlay = overlayParts.join('+');
  } else if (
    mapData.type === 'area' &&
    (mapData.geometry.type === 'Polygon' || mapData.geometry.type === 'MultiPolygon')
  ) {
    // Calculate center from polygon bounds
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    const processCoordinates = (coords: number[][]) => {
      coords.forEach(([lng, lat]) => {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      });
    };

    if (mapData.geometry.type === 'Polygon') {
      mapData.geometry.coordinates.forEach(ring => processCoordinates(ring));
    } else {
      mapData.geometry.coordinates.forEach(polygon => {
        polygon.forEach(ring => processCoordinates(ring));
      });
    }

    center = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];

    // Add polygon path overlay
    // Format: path-5+3b82f6-0.2+3b82f6-2(lng1,lat1;lng2,lat2;...)
    const pathCoords: string[] = [];
    
    if (mapData.geometry.type === 'Polygon' && mapData.geometry.coordinates[0]) {
      // Use outer ring for path
      mapData.geometry.coordinates[0].forEach(([lng, lat]) => {
        pathCoords.push(`${lng},${lat}`);
      });
    } else if (mapData.geometry.type === 'MultiPolygon' && mapData.geometry.coordinates[0]?.[0]) {
      // Use first polygon's outer ring
      mapData.geometry.coordinates[0][0].forEach(([lng, lat]) => {
        pathCoords.push(`${lng},${lat}`);
      });
    }

    if (pathCoords.length > 0) {
      // Path format: path-{strokeWidth}+{strokeColor}-{fillOpacity}+{fillColor}(coords)
      // strokeWidth=5, strokeColor=3b82f6 (blue), fillOpacity=0.2, fillColor=3b82f6
      overlay = `path-5+3b82f6-0.2+3b82f6(${pathCoords.join(';')})`;
    }
  } else {
    return null;
  }

  // Calculate appropriate zoom level if not provided
  let finalZoom = zoom;
  if (!finalZoom) {
    if (mapData.type === 'pin' || mapData.type === 'both') {
        finalZoom = 14; // Good zoom for pin location
    } else {
      finalZoom = 12; // Good zoom for areas
    }
  }

  // Build static image URL
  // Format: https://api.mapbox.com/styles/v1/{username}/{style_id}/static/{overlay}/{lon},{lat},{zoom}/{width}x{height}?access_token={token}
  // For multiple overlays, use + to concatenate: overlay1+overlay2
  // Note: Mapbox uses + as a separator in the URL path, so it should NOT be URL encoded
  const baseUrl = `https://api.mapbox.com/styles/v1/mapbox/${styleId}/static`;
  
  let url: string;
  if (overlay) {
    // Mapbox Static Images API expects overlays in the path segment
    // The + separator between overlays should remain as + (not encoded)
    // GeoJSON is already encoded, pin format is safe (only contains coordinates and simple chars)
    // We encode the entire overlay path to handle any edge cases, but Mapbox should handle + correctly
    // Actually, let's try without encoding first since both parts should be safe
    url = `${baseUrl}/${overlay}/${center[0]},${center[1]},${finalZoom}/${width}x${height}@2x?access_token=${token}`;
  } else {
    url = `${baseUrl}/${center[0]},${center[1]},${finalZoom}/${width}x${height}@2x?access_token=${token}`;
  }

  return url;
}

