/**
 * Types for FeatureCollection-based map state management
 * Supports multiple pins and areas in a single map session
 */

import type { GeoJSON } from 'geojson';

/**
 * Extended GeoJSON Feature with additional properties for map features
 */
export interface MapFeature extends GeoJSON.Feature {
  id: string; // Required unique identifier
  type: 'Feature';
  geometry: GeoJSON.Point | GeoJSON.Polygon | GeoJSON.MultiPolygon;
  properties: {
    featureType: 'pin' | 'area';
    label?: string;
    color?: string;
    order?: number;
    hidePin?: boolean; // For pins only
    [key: string]: unknown; // Allow additional properties
  };
}

/**
 * FeatureCollection with type safety for map features
 */
export interface MapFeatureCollection extends GeoJSON.FeatureCollection {
  type: 'FeatureCollection';
  features: MapFeature[];
}

/**
 * Drawing mode state
 */
export type DrawingMode = 'idle' | 'pin' | 'area';

/**
 * State for managing multiple map features
 */
export interface MapFeaturesState {
  // FeatureCollection is the source of truth
  featureCollection: MapFeatureCollection;
  
  // Feature registry for quick lookups (id -> feature)
  featureRegistry: Map<string, MapFeature>;
  
  // Currently selected feature (for editing/deletion)
  selectedFeatureId: string | null;
  
  // Current drawing mode
  drawingMode: DrawingMode;
  
  // Map loading state
  mapLoaded: boolean;
  
  // Whether actively drawing (adding points to polygon)
  isDrawing: boolean;
  
  // Screenshot for the entire map
  screenshot?: string;
}

/**
 * Actions for the map features reducer
 */
export type MapFeaturesAction =
  | { type: 'SET_MAP_LOADED'; payload: boolean }
  | { type: 'SET_DRAWING_MODE'; payload: DrawingMode }
  | { type: 'SET_IS_DRAWING'; payload: boolean }
  | { type: 'ADD_FEATURE'; payload: { feature: MapFeature } }
  | { type: 'UPDATE_FEATURE'; payload: { featureId: string; updates: Partial<MapFeature> } }
  | { type: 'DELETE_FEATURE'; payload: { featureId: string } }
  | { type: 'REORDER_FEATURES'; payload: { featureIds: string[] } }
  | { type: 'SELECT_FEATURE'; payload: { featureId: string | null } }
  | { type: 'SET_SCREENSHOT'; payload: { screenshot?: string } }
  | { type: 'CLEAR_ALL' }
  | { type: 'LOAD_FEATURE_COLLECTION'; payload: { featureCollection: MapFeatureCollection } }
  | { type: 'RESET_STATE' };

