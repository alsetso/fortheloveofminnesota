/**
 * Atlas Queries (Cities, Counties, POIs)
 * Geographic reference data - cached aggressively (rarely changes)
 */

export interface City {
  id: string;
  name: string;
  slug: string | null;
  population: number | null;
  county: string | null;
  lat?: number;
  lng?: number;
}

export interface County {
  id: string;
  name: string;
  slug: string | null;
  population: number | null;
  area_sq_mi?: number | null;
  lat?: number;
  lng?: number;
}

export const atlasQueries = {
  /**
   * All cities (from layers.cities_and_towns)
   * Cached for 24 hours - reference data rarely changes
   */
  cities: () => ({
    queryKey: ['atlas', 'cities'],
    queryFn: async (): Promise<City[]> => {
      // Use API endpoint if available, otherwise direct Supabase
      try {
        const res = await fetch('/api/civic/ctu-boundaries?limit=1000', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          // Transform layers.cities_and_towns format to City format
          return (Array.isArray(data) ? data : []).map((item: any) => ({
            id: item.id,
            name: item.feature_name || item.name,
            slug: item.slug || null,
            population: item.population || null,
            county: item.county_name || null,
            lat: item.geometry?.coordinates?.[1],
            lng: item.geometry?.coordinates?.[0],
          }));
        }
      } catch (error) {
        console.warn('[Atlas Queries] API endpoint failed, falling back to Supabase');
      }

      // Fallback to direct Supabase query
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await (supabase as any)
        .schema('layers')
        .from('cities_and_towns')
        .select('id, feature_name, county_name, population, geometry')
        .order('ctu_class', { ascending: true })
        .order('feature_name', { ascending: true })
        .limit(1000);

      if (error) {
        throw new Error(`Failed to fetch cities: ${error.message}`);
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        name: item.feature_name,
        slug: null, // Will need to generate if needed
        population: item.population || null,
        county: item.county_name || null,
        lat: item.geometry?.coordinates?.[1],
        lng: item.geometry?.coordinates?.[0],
      }));
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - cities rarely change
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days - keep in cache for a week
  }),

  /**
   * All counties
   * Cached for 24 hours
   */
  counties: () => ({
    queryKey: ['atlas', 'counties'],
    queryFn: async (): Promise<County[]> => {
      // Try API endpoint first
      try {
        const res = await fetch('/api/civic/county-boundaries', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          return Array.isArray(data) ? data : [];
        }
      } catch (error) {
        console.warn('[Atlas Queries] API endpoint failed, falling back to Supabase');
      }

      // Fallback to direct Supabase query
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase
        .from('counties')
        .select('id, name, slug, population, area_sq_mi')
        .order('name', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch counties: ${error.message}`);
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        slug: item.slug || null,
        population: item.population || null,
        area_sq_mi: item.area_sq_mi || null,
      }));
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  }),

  /**
   * Cities and counties together (for feed sidebar)
   */
  locations: () => ({
    queryKey: ['atlas', 'locations'],
    queryFn: async () => {
      const [cities, counties] = await Promise.all([
        atlasQueries.cities().queryFn(),
        atlasQueries.counties().queryFn(),
      ]);
      return { cities, counties };
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  }),
};
