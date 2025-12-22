import { supabase } from '@/lib/supabase';
import { MAP_CONFIG } from '@/features/map/config';
import { AddressParser } from '@/features/map/services/addressParser';

interface ReverseGeocodeResult {
  city?: string;
  county?: string;
  cityId?: string;
  countyId?: string;
  error?: string;
  debug?: any;
}

/**
 * Service for looking up city and county information from coordinates
 */
export class LocationLookupService {
  /**
   * Reverse geocode coordinates to get city and county names from Mapbox address
   */
  static async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
    const token = MAP_CONFIG.MAPBOX_TOKEN;
    
    if (!token || token === 'your_mapbox_token_here') {
      return {
        error: 'Mapbox token not configured',
        debug: { coordinates: [lng, lat] },
      };
    }

    try {
      const url = `${MAP_CONFIG.GEOCODING_BASE_URL}/${lng},${lat}.json`;
      const params = new URLSearchParams({
        access_token: token,
        types: 'address',
        limit: '1',
      });

      const response = await fetch(`${url}?${params}`);
      if (!response.ok) {
        throw new Error(`Reverse geocoding failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.features || data.features.length === 0) {
        return {
          error: 'No address found for coordinates',
          debug: { coordinates: [lng, lat], response: data },
        };
      }

      const feature = data.features[0];
      
      // Use AddressParser to extract city from address
      const parsed = AddressParser.parseMapboxFeature(feature);
      const cityName = parsed.city || undefined;

      // Extract county from context if available
      const countyContext = feature.context?.find((c: { id?: string | number }) => 
        String(c.id).startsWith('district') || String(c.id).startsWith('county')
      );
      const countyName = countyContext?.text || undefined;

      return {
        city: cityName,
        county: countyName,
        debug: {
          coordinates: [lng, lat],
          feature: {
            text: feature.text,
            place_name: feature.place_name,
            place_type: feature.place_type,
            context: feature.context,
          },
          parsed: parsed,
        },
      };
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return {
        error: error instanceof Error ? error.message : 'Reverse geocoding failed',
        debug: { coordinates: [lng, lat] },
      };
    }
  }

  /**
   * Find city by name in database
   */
  static async findCityByName(cityName: string): Promise<string | null> {
    if (!cityName) return null;

    try {
      // Try exact match first (case-insensitive)
      const { data, error } = await supabase
        .from('cities')
        .select('id')
        .ilike('name', cityName)
        .limit(1)
        .single();

      if (!error && data) {
        return data.id;
      }

      // Try fuzzy match - remove common suffixes
      const cleanName = cityName.replace(/\s+(City|Town|Village)$/i, '').trim();
      const { data: fuzzyData } = await supabase
        .from('cities')
        .select('id')
        .ilike('name', cleanName)
        .limit(1)
        .single();

      if (!fuzzyData) {
        // Try partial match
        const { data: partialData } = await supabase
          .from('cities')
          .select('id')
          .ilike('name', `%${cleanName}%`)
          .limit(1)
          .single();

        return partialData?.id || null;
      }

      return fuzzyData.id;
    } catch (error) {
      console.error('Error finding city:', error);
      return null;
    }
  }

  /**
   * Find county by name in database
   */
  static async findCountyByName(countyName: string): Promise<string | null> {
    if (!countyName) return null;

    try {
      // Remove "County" suffix if present
      const cleanName = countyName.replace(/\s+County$/i, '').trim();

      // Try exact match with "County" suffix
      const { data: withSuffix, error: error1 } = await supabase
        .from('counties')
        .select('id')
        .ilike('name', `${cleanName} County`)
        .limit(1)
        .single();

      if (!error1 && withSuffix) {
        return withSuffix.id;
      }

      // Try without "County" suffix
      const { data, error } = await supabase
        .from('counties')
        .select('id')
        .ilike('name', cleanName)
        .limit(1)
        .single();

      if (!error && data) {
        return data.id;
      }

      // Try partial match
      const { data: partialData } = await supabase
        .from('counties')
        .select('id')
        .ilike('name', `%${cleanName}%`)
        .limit(1)
        .single();

      return partialData?.id || null;
    } catch (error) {
      console.error('Error finding county:', error);
      return null;
    }
  }

  /**
   * Get county_id from city_id (using city_counties junction table)
   */
  static async getCountyFromCity(cityId: string): Promise<string | null> {
    if (!cityId) return null;

    try {
      // First try to get county_id directly from cities table
      const { data: cityData } = await supabase
        .from('cities')
        .select('county_id')
        .eq('id', cityId)
        .single();

      if (cityData?.county_id) {
        return cityData.county_id;
      }

      // If not found, try junction table (get primary county)
      const { data: junctionData } = await supabase
        .from('city_counties')
        .select('county_id')
        .eq('city_id', cityId)
        .eq('is_primary', true)
        .limit(1)
        .single();

      return junctionData?.county_id || null;
    } catch (error) {
      console.error('Error getting county from city:', error);
      return null;
    }
  }

  /**
   * Find nearest city by coordinates (using lat/lng distance)
   */
  static async findNearestCity(lat: number, lng: number): Promise<string | null> {
    try {
      // Use PostGIS if available, otherwise use simple distance calculation
      const { data, error } = await supabase
        .rpc('find_nearest_city', {
          p_lat: lat,
          p_lng: lng,
        });

      if (!error && data) {
        return data;
      }

      // Fallback: simple distance calculation
      const { data: cities } = await supabase
        .from('cities')
        .select('id, lat, lng')
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (!cities || cities.length === 0) return null;

      let nearestCity: { id: string; distance: number } | null = null;

      for (const city of cities) {
        if (city.lat && city.lng) {
          const distance = Math.sqrt(
            Math.pow(lat - Number(city.lat), 2) + 
            Math.pow(lng - Number(city.lng), 2)
          );

          if (!nearestCity || distance < nearestCity.distance) {
            nearestCity = { id: city.id, distance };
          }
        }
      }

      return nearestCity?.id || null;
    } catch (error) {
      console.error('Error finding nearest city:', error);
      return null;
    }
  }

  /**
   * Main method: Get city_id and county_id from coordinates
   */
  static async getLocationIds(lat: number, lng: number): Promise<{
    cityId: string | null;
    countyId: string | null;
    cityName?: string;
    countyName?: string;
    debug?: any;
  }> {
    // Step 1: Reverse geocode to get city and county names
    const geocodeResult = await this.reverseGeocode(lat, lng);

    let cityId: string | null = null;
    let countyId: string | null = null;

    // Step 2: Find city by name
    if (geocodeResult.city) {
      cityId = await this.findCityByName(geocodeResult.city);
    }

    // If city not found by name, try nearest city by coordinates
    if (!cityId) {
      cityId = await this.findNearestCity(lat, lng);
    }

    // Step 3: Find county
    // Priority: 1) From geocoded county name, 2) From city's county_id, 3) From city_counties junction
    if (geocodeResult.county) {
      countyId = await this.findCountyByName(geocodeResult.county);
    }

    // If county not found by name but we have a city, try to get county from city
    if (!countyId && cityId) {
      countyId = await this.getCountyFromCity(cityId);
    }

    return {
      cityId,
      countyId,
      cityName: geocodeResult.city,
      countyName: geocodeResult.county,
      debug: geocodeResult.debug,
    };
  }
}
