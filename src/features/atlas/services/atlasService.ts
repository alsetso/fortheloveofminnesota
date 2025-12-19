import { supabase } from '@/lib/supabase';
import { MAP_CONFIG } from '@/features/map/config';

// Types for atlas entities
export type AtlasEntityType = 'neighborhood' | 'school' | 'park' | 'lake' | 'watertower' | 'cemetery' | 'golf_course' | 'hospital' | 'airport' | 'church' | 'municipal' | 'road' | 'radio_and_news';

export interface AtlasNeighborhood {
  id?: string;
  name: string;
  slug: string;
  city_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  polygon?: object | null;
  population?: number | null;
  area_sq_mi?: number | null;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  website_url?: string | null;
  favorite?: boolean;
}

export interface AtlasSchool {
  id?: string;
  name: string;
  slug: string;
  city_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  polygon?: object | null;
  address?: string | null;
  school_type?: 'elementary' | 'middle' | 'high' | 'k12' | 'university' | 'college' | 'technical' | 'other' | null;
  is_public?: boolean;
  district?: string | null;
  enrollment?: number | null;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  website_url?: string | null;
  phone?: string | null;
  favorite?: boolean;
}

export interface AtlasPark {
  id?: string;
  name: string;
  slug: string;
  city_id?: string | null;
  county_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  polygon?: object | null;
  address?: string | null;
  park_type?: 'city' | 'county' | 'state' | 'national' | 'regional' | 'nature_reserve' | 'recreation' | 'other' | null;
  area_acres?: number | null;
  amenities?: string[] | null;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  website_url?: string | null;
  phone?: string | null;
  hours?: object | null;
  favorite?: boolean;
}

export interface AtlasLake {
  id?: string;
  name: string;
  slug?: string;
  city_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  polygon?: object | null;
}

export interface AtlasWatertower {
  id?: string;
  name: string;
  slug: string;
  city_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
}

export interface AtlasCemetery {
  id?: string;
  name: string;
  slug: string;
  city_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  website_url?: string | null;
  phone?: string | null;
}

export interface AtlasGolfCourse {
  id?: string;
  name: string;
  slug: string;
  city_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  course_type?: 'public' | 'private' | 'semi_private' | 'municipal' | 'resort' | 'other' | null;
  holes?: number | null;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  website_url?: string | null;
  phone?: string | null;
}

export interface AtlasHospital {
  id?: string;
  name: string;
  slug: string;
  city_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  hospital_type?: 'general' | 'specialty' | 'emergency' | 'children' | 'veterans' | 'teaching' | 'community' | 'other' | null;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  website_url?: string | null;
  phone?: string | null;
}

export interface AtlasAirport {
  id?: string;
  name: string;
  slug: string;
  city_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  airport_type?: 'commercial' | 'general_aviation' | 'private' | 'military' | 'regional' | 'international' | 'other' | null;
  iata_code?: string | null;
  icao_code?: string | null;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  website_url?: string | null;
  phone?: string | null;
}

export interface AtlasChurch {
  id?: string;
  name: string;
  slug: string;
  city_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  denomination?: string | null;
  church_type?: 'catholic' | 'protestant' | 'orthodox' | 'baptist' | 'methodist' | 'lutheran' | 'presbyterian' | 'episcopal' | 'non_denominational' | 'other' | null;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  website_url?: string | null;
  phone?: string | null;
}

export interface AtlasMunicipal {
  id?: string;
  name: string;
  slug: string;
  city_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  municipal_type?: 'city_hall' | 'courthouse' | 'police_station' | 'fire_station' | 'library' | 'community_center' | 'town_hall' | 'government_office' | 'other' | null;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  website_url?: string | null;
  phone?: string | null;
}

export interface AtlasRoad {
  id?: string;
  name: string;
  slug: string;
  city_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  road_type?: 'interstate' | 'us_highway' | 'state_highway' | 'county_road' | 'local_road' | 'township_road' | 'private_road' | 'trail' | 'bridge' | 'tunnel' | 'other' | null;
  route_number?: string | null;
  direction?: 'north' | 'south' | 'east' | 'west' | 'northbound' | 'southbound' | 'eastbound' | 'westbound' | null;
  segment_name?: string | null;
  start_point?: string | null;
  end_point?: string | null;
  mile_marker?: number | null;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  wikipedia_url?: string | null;
}

export interface AtlasRadioAndNews {
  id?: string;
  name: string;
  slug: string;
  city_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  media_type: 'am_radio' | 'fm_radio' | 'television' | 'newspaper' | 'online_news' | 'podcast' | 'magazine' | 'wire_service' | 'other';
  call_sign?: string | null;
  frequency?: string | null;
  channel_number?: string | null;
  format?: string | null;
  address?: string | null;
  phone?: string | null;
  website_url?: string | null;
  parent_company?: string | null;
  network_affiliation?: string | null;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  wikipedia_url?: string | null;
}

// Helper to generate slug from name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Neighborhood CRUD
export async function createNeighborhood(data: AtlasNeighborhood) {
  const slug = data.slug || generateSlug(data.name);
  
  // Auto-match city_id from coordinates if not provided
  let cityId = data.city_id;
  if (!cityId && data.lat && data.lng) {
    cityId = await findCityByCoordinates(data.lat, data.lng);
  }
  
  const { data: result, error } = await supabase
    .from('neighborhoods')
    .insert({
      ...data,
      slug,
      city_id: cityId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function getNeighborhoods() {
  const { data, error } = await supabase
    .from('neighborhoods')
    .select('*')
    .order('name');

  if (error) throw error;
  return data;
}

export async function getNeighborhoodBySlug(slug: string) {
  const { data, error } = await supabase
    .from('neighborhoods')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) throw error;
  return data;
}

// School CRUD
export async function createSchool(data: AtlasSchool) {
  const slug = data.slug || generateSlug(data.name);
  
  // Auto-match city_id from coordinates if not provided
  let cityId = data.city_id;
  if (!cityId && data.lat && data.lng) {
    cityId = await findCityByCoordinates(data.lat, data.lng);
  }
  
  const { data: result, error } = await supabase
    .from('schools')
    .insert({
      ...data,
      slug,
      city_id: cityId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function getSchools() {
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .order('name');

  if (error) throw error;
  return data;
}

export async function getSchoolBySlug(slug: string) {
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) throw error;
  return data;
}

// Park CRUD
export async function createPark(data: AtlasPark) {
  const slug = data.slug || generateSlug(data.name);

  // Auto-match city_id from coordinates if not provided
  let cityId = data.city_id;
  if (!cityId && data.lat && data.lng) {
    try {
      cityId = await findCityByCoordinates(data.lat, data.lng);
    } catch (error) {
      console.warn('Failed to find city for park coordinates:', error);
    }
  }

  const { data: result, error } = await supabase
    .from('parks')
    .insert({
      ...data,
      slug,
      city_id: cityId || null,
    })
    .select()
    .single();

  if (error) {
    // Check if error is about unique constraint violation
    if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate')) {
      throw new Error(
        `A park with the name "${data.name}" already exists in this city. ` +
        `Please use a different name or edit the existing park.`
      );
    }
    
    // Enhance error message
    const errorMessage = error.message || 'Failed to create park';
    const enhancedError = new Error(errorMessage);
    (enhancedError as any).originalError = error;
    (enhancedError as any).details = error.details;
    (enhancedError as any).hint = error.hint;
    (enhancedError as any).code = error.code;
    throw enhancedError;
  }
  return result;
}

export async function getParks() {
  const { data, error } = await supabase
    .from('parks')
    .select('*')
    .order('name');

  if (error) throw error;
  return data;
}

export async function getParkBySlug(slug: string) {
  const { data, error } = await supabase
    .from('parks')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) throw error;
  return data;
}

// Lake CRUD
export async function createLake(data: AtlasLake) {
  // Auto-match city_id from coordinates if not provided
  let cityId = data.city_id;
  if (!cityId && data.lat && data.lng) {
    try {
      cityId = await findCityByCoordinates(data.lat, data.lng);
    } catch (error) {
      // If city lookup fails, continue with null city_id
      console.warn('Failed to find city for lake coordinates:', error);
    }
  }

  // Build insert data - only include city_id if it exists in schema
  // This handles the case where migration hasn't been applied yet
  const insertData: any = {
    name: data.name,
    lat: data.lat,
    lng: data.lng,
    polygon: data.polygon || null,
  };

  // Only add city_id if we have a value (migration should add the column)
  // If column doesn't exist, this will fail gracefully with a clear error
  if (cityId !== undefined) {
    insertData.city_id = cityId;
  }

  const { data: result, error } = await supabase
    .from('lakes')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    // Check if error is about missing column
    if (error.message?.includes('city_id') || error.message?.includes('schema cache')) {
      throw new Error(
        'The city_id column does not exist. Please run migration 240_comprehensive_atlas_city_id_and_unique_constraints.sql first. ' +
        `Original error: ${error.message}`
      );
    }
    
    // Enhance error message with more context
    const errorMessage = error.message || 'Failed to create lake';
    const enhancedError = new Error(errorMessage);
    (enhancedError as any).originalError = error;
    (enhancedError as any).details = error.details;
    (enhancedError as any).hint = error.hint;
    (enhancedError as any).code = error.code;
    throw enhancedError;
  }
  return result;
}

export async function getLakes() {
  const { data, error } = await supabase
    .from('lakes')
    .select('*')
    .order('name');

  if (error) throw error;
  return data;
}

export async function getLakeByName(name: string) {
  const { data, error } = await supabase
    .from('lakes')
    .select('*')
    .eq('name', name)
    .single();

  if (error) throw error;
  return data;
}

// Check if a lake with the given name already exists
export async function checkLakeExists(name: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('lakes')
    .select('id')
    .eq('name', name)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

// Update functions
export async function updateNeighborhood(id: string, data: Partial<AtlasNeighborhood>) {
  const updateData = { ...data };
  if (data.name && !data.slug) {
    updateData.slug = generateSlug(data.name);
  }
  
  const { data: result, error } = await supabase
    .from('neighborhoods')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function updateSchool(id: string, data: Partial<AtlasSchool>) {
  const updateData = { ...data };
  if (data.name && !data.slug) {
    updateData.slug = generateSlug(data.name);
  }
  
  const { data: result, error } = await supabase
    .from('schools')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function updatePark(id: string, data: Partial<AtlasPark>) {
  const updateData = { ...data };
  if (data.name && !data.slug) {
    updateData.slug = generateSlug(data.name);
  }
  
  const { data: result, error } = await supabase
    .from('parks')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function updateLake(id: string, data: Partial<AtlasLake>) {
  const { data: result, error } = await supabase
    .from('lakes')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

// Delete functions
export async function deleteNeighborhood(id: string) {
  const { error } = await supabase
    .from('neighborhoods')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function deleteSchool(id: string) {
  const { error } = await supabase
    .from('schools')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function deletePark(id: string) {
  const { error } = await supabase
    .from('parks')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function deleteLake(id: string) {
  const { error } = await supabase
    .from('lakes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function deleteWatertower(id: string) {
  const { error } = await supabase
    .from('watertowers')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function deleteCemetery(id: string) {
  const { error } = await supabase
    .from('cemeteries')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function deleteGolfCourse(id: string) {
  const { error } = await supabase
    .from('golf_courses')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function deleteHospital(id: string) {
  const { error } = await supabase
    .from('hospitals')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function deleteAirport(id: string) {
  const { error } = await supabase
    .from('airports')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Church CRUD
export async function createChurch(data: AtlasChurch) {
  const slug = data.slug || generateSlug(data.name);
  
  // Auto-match city_id from coordinates if not provided
  let cityId = data.city_id;
  if (!cityId && data.lat && data.lng) {
    cityId = await findCityByCoordinates(data.lat, data.lng);
  }
  
  const { data: result, error } = await supabase
    .from('churches')
    .insert({
      ...data,
      slug,
      city_id: cityId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

// Municipal CRUD
export async function createMunicipal(data: AtlasMunicipal) {
  const slug = data.slug || generateSlug(data.name);
  
  // Auto-match city_id from coordinates if not provided
  let cityId = data.city_id;
  if (!cityId && data.lat && data.lng) {
    cityId = await findCityByCoordinates(data.lat, data.lng);
  }
  
  const { data: result, error } = await supabase
    .from('municipals')
    .insert({
      ...data,
      slug,
      city_id: cityId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

// Update functions for new entity types
export async function updateWatertower(id: string, data: Partial<AtlasWatertower>) {
  const updateData = { ...data };
  if (data.name && !data.slug) {
    updateData.slug = generateSlug(data.name);
  }
  
  const { data: result, error } = await supabase
    .from('watertowers')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function updateCemetery(id: string, data: Partial<AtlasCemetery>) {
  const updateData = { ...data };
  if (data.name && !data.slug) {
    updateData.slug = generateSlug(data.name);
  }
  
  const { data: result, error } = await supabase
    .from('cemeteries')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function updateGolfCourse(id: string, data: Partial<AtlasGolfCourse>) {
  const updateData = { ...data };
  if (data.name && !data.slug) {
    updateData.slug = generateSlug(data.name);
  }
  
  const { data: result, error } = await supabase
    .from('golf_courses')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function updateHospital(id: string, data: Partial<AtlasHospital>) {
  const updateData = { ...data };
  if (data.name && !data.slug) {
    updateData.slug = generateSlug(data.name);
  }
  
  const { data: result, error } = await supabase
    .from('hospitals')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function updateAirport(id: string, data: Partial<AtlasAirport>) {
  const updateData = { ...data };
  if (data.name && !data.slug) {
    updateData.slug = generateSlug(data.name);
  }
  
  const { data: result, error } = await supabase
    .from('airports')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function updateChurch(id: string, data: Partial<AtlasChurch>) {
  const updateData = { ...data };
  if (data.name && !data.slug) {
    updateData.slug = generateSlug(data.name);
  }
  
  const { data: result, error } = await supabase
    .from('churches')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function updateMunicipal(id: string, data: Partial<AtlasMunicipal>) {
  const updateData = { ...data };
  if (data.name && !data.slug) {
    updateData.slug = generateSlug(data.name);
  }
  
  const { data: result, error } = await supabase
    .from('municipals')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function deleteChurch(id: string) {
  const { error } = await supabase
    .from('churches')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function deleteMunicipal(id: string) {
  const { error } = await supabase
    .from('municipals')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Road CRUD
export async function createRoad(data: AtlasRoad) {
  const slug = data.slug || generateSlug(data.name);
  
  // Auto-match city_id from coordinates if not provided
  let cityId = data.city_id;
  if (!cityId && data.lat && data.lng) {
    cityId = await findCityByCoordinates(data.lat, data.lng);
  }
  
  const { data: result, error } = await supabase
    .from('roads')
    .insert({
      ...data,
      slug,
      city_id: cityId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function updateRoad(id: string, data: Partial<AtlasRoad>) {
  const updateData = { ...data };
  if (data.name && !data.slug) {
    updateData.slug = generateSlug(data.name);
  }
  
  const { data: result, error } = await supabase
    .from('roads')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function deleteRoad(id: string) {
  const { error } = await supabase
    .from('roads')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Get cities for dropdown
export async function getCities() {
  const { data, error } = await supabase
    .from('cities')
    .select('id, name, slug')
    .order('name');

  if (error) throw error;
  return data;
}

// Find city by name (case-insensitive search)
export async function findCityByName(name: string) {
  const { data, error } = await supabase
    .from('cities')
    .select('id, name, slug, lat, lng, county')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Smart city lookup from coordinates - reverse geocodes and matches to existing city
export async function findCityByCoordinates(lat: number, lng: number): Promise<string | null> {
  if (!lat || !lng) return null;

  try {
    // Step 1: Reverse geocode to get city name
    const token = MAP_CONFIG.MAPBOX_TOKEN;
    if (!token || token === 'your_mapbox_token_here') {
      // Fallback to nearest city by coordinates if no token
      return await findNearestCityByCoordinates(lat, lng);
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`;
    const params = new URLSearchParams({
      access_token: token,
      types: 'place',
      limit: '1',
    });

    const response = await fetch(`${url}?${params}`);
    if (!response.ok) {
      return await findNearestCityByCoordinates(lat, lng);
    }

    const data = await response.json();
    if (!data.features || data.features.length === 0) {
      return await findNearestCityByCoordinates(lat, lng);
    }

    // Extract city name from geocoding result
    let cityName: string | null = null;
    const feature = data.features[0];
    
    // Check context for place (city)
    if (feature.context && Array.isArray(feature.context)) {
      for (const ctx of feature.context) {
        if (ctx.id?.startsWith('place.')) {
          cityName = ctx.text || null;
          break;
        }
      }
    }

    // If no city in context, check if the feature itself is a place
    if (!cityName && feature.place_type?.includes('place')) {
      cityName = feature.text || null;
    }

    // Step 2: Find city by name (with fuzzy matching)
    if (cityName) {
      // Try exact match first
      const { data: exactMatch } = await supabase
        .from('cities')
        .select('id')
        .ilike('name', cityName)
        .limit(1)
        .maybeSingle();

      if (exactMatch) return exactMatch.id;

      // Try without common suffixes
      const cleanName = cityName.replace(/\s+(City|Town|Village)$/i, '').trim();
      const { data: fuzzyMatch } = await supabase
        .from('cities')
        .select('id')
        .ilike('name', cleanName)
        .limit(1)
        .maybeSingle();

      if (fuzzyMatch) return fuzzyMatch.id;

      // Try partial match
      const { data: partialMatch } = await supabase
        .from('cities')
        .select('id')
        .ilike('name', `%${cleanName}%`)
        .limit(1)
        .maybeSingle();

      if (partialMatch) return partialMatch.id;
    }

    // Step 3: Fallback to nearest city by coordinates
    return await findNearestCityByCoordinates(lat, lng);
  } catch (error) {
    console.error('Error in findCityByCoordinates:', error);
    // Fallback to nearest city
    return await findNearestCityByCoordinates(lat, lng);
  }
}

// Find nearest city by coordinates using distance calculation
async function findNearestCityByCoordinates(lat: number, lng: number): Promise<string | null> {
  try {
    const { data: cities, error } = await supabase
      .from('cities')
      .select('id, lat, lng')
      .not('lat', 'is', null)
      .not('lng', 'is', null);

    if (error || !cities || cities.length === 0) return null;

    let nearestCity: { id: string; distance: number } | null = null;

    for (const city of cities) {
      if (city.lat && city.lng) {
        // Simple distance calculation (Haversine would be better but this works for relative distance)
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

// Update city coordinates (calls admin API)
export async function updateCityCoordinates(cityId: string, lat: number, lng: number) {
  const response = await fetch(`/api/admin/cities/${cityId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to update city' }));
    throw new Error(errorData.error || 'Failed to update city coordinates');
  }

  return response.json();
}

// Get counties for dropdown
export async function getCounties() {
  const { data, error } = await supabase
    .from('counties')
    .select('id, name, slug')
    .order('name');

  if (error) throw error;
  return data;
}

// Watertower CRUD
export async function createWatertower(data: AtlasWatertower) {
  const slug = data.slug || generateSlug(data.name);
  
  // Auto-match city_id from coordinates if not provided
  let cityId = data.city_id;
  if (!cityId && data.lat && data.lng) {
    cityId = await findCityByCoordinates(data.lat, data.lng);
  }
  
  const { data: result, error } = await supabase
    .from('watertowers')
    .insert({
      ...data,
      slug,
      city_id: cityId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

// Cemetery CRUD
export async function createCemetery(data: AtlasCemetery) {
  const slug = data.slug || generateSlug(data.name);
  
  // Auto-match city_id from coordinates if not provided
  let cityId = data.city_id;
  if (!cityId && data.lat && data.lng) {
    cityId = await findCityByCoordinates(data.lat, data.lng);
  }
  
  const { data: result, error } = await supabase
    .from('cemeteries')
    .insert({
      ...data,
      slug,
      city_id: cityId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

// Golf Course CRUD
export async function createGolfCourse(data: AtlasGolfCourse) {
  const slug = data.slug || generateSlug(data.name);
  
  // Auto-match city_id from coordinates if not provided
  let cityId = data.city_id;
  if (!cityId && data.lat && data.lng) {
    cityId = await findCityByCoordinates(data.lat, data.lng);
  }
  
  const { data: result, error } = await supabase
    .from('golf_courses')
    .insert({
      ...data,
      slug,
      city_id: cityId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

// Hospital CRUD
export async function createHospital(data: AtlasHospital) {
  const slug = data.slug || generateSlug(data.name);
  
  // Auto-match city_id from coordinates if not provided
  let cityId = data.city_id;
  if (!cityId && data.lat && data.lng) {
    cityId = await findCityByCoordinates(data.lat, data.lng);
  }
  
  const { data: result, error } = await supabase
    .from('hospitals')
    .insert({
      ...data,
      slug,
      city_id: cityId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

// Airport CRUD
export async function createAirport(data: AtlasAirport) {
  const slug = data.slug || generateSlug(data.name);
  
  // Auto-match city_id from coordinates if not provided
  let cityId = data.city_id;
  if (!cityId && data.lat && data.lng) {
    cityId = await findCityByCoordinates(data.lat, data.lng);
  }
  
  const { data: result, error } = await supabase
    .from('airports')
    .insert({
      ...data,
      slug,
      city_id: cityId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

// Radio & News CRUD
export async function createRadioAndNews(data: AtlasRadioAndNews) {
  const slug = data.slug || generateSlug(data.name);
  
  // Auto-match city_id from coordinates if not provided
  let cityId = data.city_id;
  if (!cityId && data.lat && data.lng) {
    cityId = await findCityByCoordinates(data.lat, data.lng);
  }
  
  const { data: result, error } = await supabase
    .from('radio_and_news')
    .insert({
      ...data,
      slug,
      city_id: cityId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function updateRadioAndNews(id: string, data: Partial<AtlasRadioAndNews>) {
  const updateData = { ...data };
  if (data.name && !data.slug) {
    updateData.slug = generateSlug(data.name);
  }
  
  const { data: result, error } = await supabase
    .from('radio_and_news')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function deleteRadioAndNews(id: string) {
  const { error } = await supabase
    .from('radio_and_news')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Find county by name - returns id, name, slug for display/linking
export async function findCountyByName(name: string) {
  if (!name) return null;
  
  // Remove "County" suffix if present for matching
  const cleanName = name.replace(/\s+County$/i, '').trim();
  
  // Try exact match with "County" suffix (most counties stored as "X County")
  const { data: withSuffix } = await supabase
    .from('counties')
    .select('id, name, slug')
    .ilike('name', `${cleanName} County`)
    .limit(1)
    .maybeSingle();

  if (withSuffix) return withSuffix;

  // Try without suffix
  const { data } = await supabase
    .from('counties')
    .select('id, name, slug')
    .ilike('name', cleanName)
    .limit(1)
    .maybeSingle();

  return data;
}

