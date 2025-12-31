export interface MapItem {
  id: string;
  title: string;
  description: string | null;
  visibility: 'public' | 'private' | 'shared';
  map_style: 'street' | 'satellite' | 'light' | 'dark';
  map_type?: 'community' | 'professional' | 'user';
  thumbnail?: string;
  href?: string;
  requiresPro?: boolean;
  view_count?: number;
  meta?: {
    screenshot_url?: string;
    buildingsEnabled?: boolean;
    pitch?: number;
    terrainEnabled?: boolean;
    center?: [number, number]; // [lng, lat]
    zoom?: number;
  } | null;
  account?: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  } | null;
}

