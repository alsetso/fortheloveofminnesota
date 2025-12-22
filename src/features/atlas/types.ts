/**
 * Shared types for atlas feature
 */

// Re-export entity type from service
export type { AtlasEntityType } from './services/atlasService';

// Entity interfaces (extracted from atlasService for reuse)
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
}

export interface AtlasGolfCourse {
  id?: string;
  name: string;
  slug: string;
  city_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  course_type?: string | null;
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
  hospital_type?: string | null;
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
  airport_type?: string | null;
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
  church_type?: string | null;
  denomination?: string | null;
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
  municipal_type?: string | null;
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
  geometry?: object | null;
  road_type?: string | null;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
}

export interface AtlasRadioAndNews {
  id?: string;
  name: string;
  slug: string;
  city_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  station_type?: string | null;
  frequency?: string | null;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  website_url?: string | null;
  phone?: string | null;
}

// Union type for all atlas entities
export type AtlasEntity =
  | AtlasNeighborhood
  | AtlasSchool
  | AtlasPark
  | AtlasLake
  | AtlasWatertower
  | AtlasCemetery
  | AtlasGolfCourse
  | AtlasHospital
  | AtlasAirport
  | AtlasChurch
  | AtlasMunicipal
  | AtlasRoad
  | AtlasRadioAndNews;
