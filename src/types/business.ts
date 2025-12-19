// Business types shared across the application

export interface Business {
  id: string;
  name: string;
  category_id?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  hours?: string | null;
  lat?: number | null;
  lng?: number | null;
  service_areas?: string[] | null;
}

export interface BusinessWithCities extends Business {
  category: {
    id: string;
    name: string;
  } | null;
  cities: {
    id: string;
    name: string;
  }[] | null;
}
