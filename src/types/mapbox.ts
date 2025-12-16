/**
 * Type definitions for Mapbox-related data
 */

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
}




