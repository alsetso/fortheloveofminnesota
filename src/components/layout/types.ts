/**
 * Type definitions for footer and live page components
 */

export interface MapInstance {
  getCenter: () => { lat: number; lng: number };
  getZoom: () => number;
  on: (event: string, handler: () => void) => void;
  off: (event: string, handler: () => void) => void;
}

export interface PinData {
  id: string;
  lat: number;
  lng: number;
  caption?: string | null;
  description?: string | null;
  full_address?: string | null;
  image_url?: string | null;
  media_url?: string | null;
  created_at: string;
  account?: {
    id: string;
    username?: string | null;
  } | null;
  mention_type?: {
    id: string;
    emoji: string | null;
    name: string;
  } | null;
  view_count?: number;
}

export interface NearbyPin {
  id: string;
  lat: number;
  lng: number;
  description?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  media_type?: 'image' | 'video' | 'none' | null;
  created_at?: string;
  account?: {
    id: string;
    username?: string | null;
    image_url?: string | null;
  } | null;
  accounts?: {
    image_url?: string | null;
  } | null;
  mention_type?: {
    id: string;
    emoji: string | null;
    name: string;
  } | null;
}
