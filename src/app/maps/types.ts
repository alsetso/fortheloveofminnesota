export interface MapTag {
  emoji: string;
  text: string;
}

export interface MapItem {
  id: string;
  title: string;
  description: string | null;
  visibility: 'public' | 'private' | 'shared';
  map_style: 'street' | 'satellite' | 'light' | 'dark';
  map_type?: 'community' | 'professional' | 'user' | 'atlas';
  type?: 'user' | 'community' | 'gov' | 'professional' | 'atlas' | 'user-generated' | null;
  custom_slug?: string | null;
  tags?: MapTag[] | null;
  thumbnail?: string;
  href?: string;
  requiresPro?: boolean;
  status?: 'active' | 'coming_soon' | 'unlisted';
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

