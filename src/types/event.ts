/**
 * Event types for the events calendar system
 */

export interface Event {
  id: string;
  title: string;
  description: string | null;
  start_date: string; // ISO timestamp
  end_date: string | null; // ISO timestamp
  location_name: string | null;
  location_address: string | null;
  lat: number | null;
  lng: number | null;
  account_id: string;
  visibility: 'public' | 'only_me';
  archived: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  accounts?: {
    id: string;
    username: string | null;
    first_name: string | null;
    image_url: string | null;
  };
}

export interface CreateEventData {
  title: string;
  description?: string | null;
  start_date: string; // ISO timestamp
  end_date?: string | null; // ISO timestamp
  location_name?: string | null;
  location_address?: string | null;
  lat?: number | null;
  lng?: number | null;
  visibility?: 'public' | 'only_me';
  account_id?: string; // Optional, will use current user's account if not provided
}

export interface UpdateEventData {
  title?: string;
  description?: string | null;
  start_date?: string;
  end_date?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  lat?: number | null;
  lng?: number | null;
  visibility?: 'public' | 'only_me';
  archived?: boolean;
}

export interface EventFilters {
  account_id?: string;
  start_date?: string; // Filter events starting from this date
  end_date?: string; // Filter events ending before this date
  visibility?: 'public' | 'only_me';
  archived?: boolean;
}

