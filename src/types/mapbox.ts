/**
 * Type definitions for Mapbox-related data
 */

import type { Map as MapboxMap } from 'mapbox-gl';

export type MapboxMapInstance = MapboxMap;

export interface MapboxMetadata {
  [key: string]: unknown;
}

export interface MapboxFeature {
  id?: string | number;
  type: string;
  properties: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  };
  context?: Array<{
    id: string;
    text: string;
    [key: string]: unknown;
  }>;
  place_name?: string;
  text?: string;
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}







