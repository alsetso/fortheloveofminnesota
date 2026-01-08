# Congressional Districts Map Implementation Guide

## Overview
This guide explains how to display `civic.congressional_districts` polygons on the admin gov map page.

## Data Structure

The `civic.congressional_districts` table stores:
- `geometry` (JSONB): A GeoJSON FeatureCollection containing all voting precincts for that district
- `district_number` (1-8): The congressional district number
- `name`, `description`, `publisher`, `date`: Metadata

Each district's `geometry` is a FeatureCollection like:
```json
{
  "type": "FeatureCollection",
  "name": "precincts",
  "features": [
    {
      "type": "Feature",
      "properties": { "Precinct": "...", "CongDist": "1", ... },
      "geometry": {
        "type": "Polygon" | "MultiPolygon" | "GeometryCollection",
        "coordinates": [...]
      }
    }
  ]
}
```

## Implementation Steps

### 1. Create API Route

Create `/api/civic/congressional-districts/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    const { data, error } = await (supabase as any)
      .schema('civic')
      .from('congressional_districts')
      .select('id, district_number, name, geometry')
      .order('district_number', { ascending: true });
    
    if (error) {
      console.error('[Congressional Districts API] Error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch districts' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[Congressional Districts API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 2. Add Districts Layer to GovMapAdminClient

In `GovMapAdminClient.tsx`, add:

```typescript
// State for districts
const [districts, setDistricts] = useState<any[]>([]);
const [showDistricts, setShowDistricts] = useState(false);

// Fetch districts
useEffect(() => {
  if (!mapLoaded || !map) return;
  
  const fetchDistricts = async () => {
    try {
      const response = await fetch('/api/civic/congressional-districts');
      if (!response.ok) throw new Error('Failed to fetch districts');
      const data = await response.json();
      setDistricts(data);
    } catch (error) {
      console.error('[GovMapAdmin] Failed to fetch districts:', error);
    }
  };
  
  fetchDistricts();
}, [mapLoaded, map]);

// Add districts to map
useEffect(() => {
  if (!map || !mapLoaded || districts.length === 0 || !showDistricts) return;
  
  const mapboxMap = map as any;
  
  // Color palette for 8 districts
  const districtColors = [
    '#FF6B6B', // District 1 - Red
    '#4ECDC4', // District 2 - Teal
    '#45B7D1', // District 3 - Blue
    '#96CEB4', // District 4 - Green
    '#FFEAA7', // District 5 - Yellow
    '#DDA15E', // District 6 - Orange
    '#BC6C25', // District 7 - Brown
    '#6C5CE7', // District 8 - Purple
  ];
  
  districts.forEach((district) => {
    const districtNum = district.district_number;
    const sourceId = `congressional-district-${districtNum}-source`;
    const fillLayerId = `congressional-district-${districtNum}-fill`;
    const outlineLayerId = `congressional-district-${districtNum}-outline`;
    const color = districtColors[districtNum - 1] || '#888888';
    
    // Remove existing layers/sources if they exist
    try {
      if (mapboxMap.getLayer(fillLayerId)) mapboxMap.removeLayer(fillLayerId);
      if (mapboxMap.getLayer(outlineLayerId)) mapboxMap.removeLayer(outlineLayerId);
      if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);
    } catch (e) {
      // Ignore errors if layers don't exist
    }
    
    // The geometry column contains a FeatureCollection
    const featureCollection = district.geometry;
    
    // Validate it's a FeatureCollection
    if (!featureCollection || featureCollection.type !== 'FeatureCollection') {
      console.warn(`[GovMapAdmin] Invalid geometry for district ${districtNum}`);
      return;
    }
    
    // Add source with the FeatureCollection
    mapboxMap.addSource(sourceId, {
      type: 'geojson',
      data: featureCollection,
    });
    
    // Add fill layer
    mapboxMap.addLayer({
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': color,
        'fill-opacity': 0.2, // Semi-transparent
      },
    });
    
    // Add outline layer
    mapboxMap.addLayer({
      id: outlineLayerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': color,
        'line-width': 2,
        'line-opacity': 0.8,
      },
    });
  });
  
  // Cleanup function
  return () => {
    if (!map) return;
    const mapboxMap = map as any;
    districts.forEach((district) => {
      const districtNum = district.district_number;
      const fillLayerId = `congressional-district-${districtNum}-fill`;
      const outlineLayerId = `congressional-district-${districtNum}-outline`;
      const sourceId = `congressional-district-${districtNum}-source`;
      
      try {
        if (mapboxMap.getLayer(fillLayerId)) mapboxMap.removeLayer(fillLayerId);
        if (mapboxMap.getLayer(outlineLayerId)) mapboxMap.removeLayer(outlineLayerId);
        if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);
      } catch (e) {
        // Ignore cleanup errors
      }
    });
  };
}, [map, mapLoaded, districts, showDistricts]);
```

### 3. Add Toggle Control

Add a button to toggle districts visibility:

```typescript
// In the JSX, add a toggle button
<button
  onClick={() => setShowDistricts(!showDistricts)}
  className="absolute top-20 right-4 z-10 bg-white px-3 py-2 rounded-md shadow-md text-xs"
>
  {showDistricts ? 'Hide' : 'Show'} Districts
</button>
```

## Key Points

1. **FeatureCollection Structure**: The `geometry` column stores a complete GeoJSON FeatureCollection, not a single polygon. Mapbox can render this directly.

2. **Multiple Precincts**: Each district contains many precinct features. Mapbox will render all of them as a single layer.

3. **Layer Ordering**: Add district layers **before** building layers so buildings appear on top. Use `mapboxMap.addLayer()` with a `beforeId` parameter if needed.

4. **Performance**: For large FeatureCollections, consider:
   - Simplifying geometries at lower zoom levels
   - Using vector tiles instead of GeoJSON
   - Clustering or filtering precincts by zoom level

5. **Click Handlers**: To make districts clickable:
   ```typescript
   mapboxMap.on('click', fillLayerId, (e: any) => {
     const features = mapboxMap.queryRenderedFeatures(e.point, {
       layers: [fillLayerId],
     });
     if (features.length > 0) {
       const district = districts.find(d => d.district_number === districtNum);
       // Show district info
     }
   });
   ```

6. **Styling Options**:
   - Use different colors per district
   - Add hover effects with `fill-opacity` changes
   - Show district numbers as labels using a `symbol` layer

## Example: Adding Labels

To show district numbers on the map:

```typescript
// After adding the fill layer, add a label layer
mapboxMap.addLayer({
  id: `congressional-district-${districtNum}-label`,
  type: 'symbol',
  source: sourceId,
  layout: {
    'text-field': `CD ${districtNum}`,
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 14,
  },
  paint: {
    'text-color': color,
    'text-halo-color': '#ffffff',
    'text-halo-width': 2,
  },
});
```

Note: Labels work best when the source contains point geometries. For polygon-only FeatureCollections, you may need to calculate centroids for label placement.

