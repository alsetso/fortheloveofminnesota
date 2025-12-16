/**
 * Type definitions for post data
 */

export interface Post {
  id: string;
  account_id: string;
  title: string | null;
  content: string;
  visibility: string;
  created_at: string;
  updated_at: string;
  view_count: number;
  map_data?: unknown;
  map_geometry?: unknown;
  map_type?: string | null;
  accounts?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    username: string | null;
  } | null;
  [key: string]: unknown;
}

export interface AccountInfo {
  id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  username: string | null;
  [key: string]: unknown;
}




