/**
 * Location Search Service
 * Simple service for tracking location searches
 */

export interface LocationSearchData {
  place_name: string;
  coordinates: { lat: number; lng: number };
  mapbox_data: any; // Full Mapbox geocoding feature
  search_query?: string;
  page_source?: 'map' | 'my-homes';
}

/**
 * Save a location search (non-blocking, fire-and-forget)
 * Only saves when user is authenticated
 */
export async function saveLocationSearch(data: LocationSearchData): Promise<void> {
  try {
    // Fire and forget - don't await
    fetch('/api/location-searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        place_name: data.place_name,
        coordinates: data.coordinates,
        mapbox_data: data.mapbox_data,
        search_query: data.search_query || null,
        page_source: data.page_source || 'map',
      }),
    }).catch((err) => {
      // Silently fail - background operation
      console.debug('Location search save failed (non-critical):', err);
    });
  } catch (error) {
    // Silently fail - background operation
    console.debug('Location search save error:', error);
  }
}


