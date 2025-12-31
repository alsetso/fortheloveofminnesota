/**
 * Type definitions for explore pages
 */

export interface CityListItem {
  id: string;
  name: string;
  slug: string;
  population: number | null;
  county: string | null;
  favorite: boolean | null;
  website_url: string | null;
}

export interface CountyListItem {
  id: string;
  name: string;
  slug: string | null;
  population: number;
  area_sq_mi: number | null;
  favorite: boolean | null;
}

export interface FavoriteCounty {
  name: string;
  slug: string | null;
  website_url: string | null;
  population: number;
  area_sq_mi: number | null;
}

export interface TopCity {
  name: string;
  slug: string | null;
  population: number;
  favorite: boolean | null;
  website_url: string | null;
}

export interface TopCounty {
  name: string;
  slug: string | null;
  population: number;
  area_sq_mi: number | null;
}

export interface LargestCounty {
  name: string;
  slug: string | null;
  area_sq_mi: number | null;
  population: number;
}

export interface AtlasEntity {
  id: string;
  name: string;
  slug: string | null;
  lat: number | null;
  lng: number | null;
  description: string | null;
}

export interface NeighborhoodEntity extends AtlasEntity {
  // No additional fields
}

export interface SchoolEntity extends AtlasEntity {
  school_type: string | null;
}

export interface ParkEntity extends AtlasEntity {
  park_type: string | null;
}

export interface WatertowerEntity extends AtlasEntity {
  // No additional fields
}

export interface CemeteryEntity extends AtlasEntity {
  // No additional fields
}

export interface GolfCourseEntity extends AtlasEntity {
  course_type: string | null;
  holes: number | null;
}

export interface HospitalEntity extends AtlasEntity {
  hospital_type: string | null;
}

export interface AirportEntity extends AtlasEntity {
  airport_type: string | null;
  iata_code: string | null;
  icao_code: string | null;
}

export interface ChurchEntity extends AtlasEntity {
  church_type: string | null;
  denomination: string | null;
}

export interface MunicipalEntity extends AtlasEntity {
  municipal_type: string | null;
}

