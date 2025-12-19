/**
 * Type definitions for pages/businesses API
 */

export interface Page {
  id: string;
  name: string;
  service_areas?: string[] | null;
  category_id?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  [key: string]: unknown;
}

export interface PageUpdateData {
  name?: string;
  category_id?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  [key: string]: unknown;
}





