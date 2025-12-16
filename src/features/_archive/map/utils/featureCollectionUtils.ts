/**
 * Utility functions for working with FeatureCollection and PostMapData
 * Handles conversion between old single-feature format and new multi-feature format
 */

import type { GeoJSON } from 'geojson';
import type { MapFeature, MapFeatureCollection } from '../types/featureCollection';

// Legacy interface for backward compatibility
export interface PostMapData {
  type: 'pin' | 'area' | 'both';
  geometry: GeoJSON.Point | GeoJSON.Polygon | GeoJSON.MultiPolygon;
  center?: [number, number];
  hidePin?: boolean;
  polygon?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  screenshot?: string;
}

/**
 * Generate a unique ID for a feature
 */
export function generateFeatureId(): string {
  return `feature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convert PostMapData (legacy single-feature format) to FeatureCollection
 */
export function postMapDataToFeatureCollection(
  postMapData: PostMapData | null
): MapFeatureCollection {
  if (!postMapData) {
    return { type: 'FeatureCollection', features: [] };
  }

  const features: MapFeature[] = [];

  // Handle 'pin' or 'both' type - add pin feature
  if (postMapData.type === 'pin' || postMapData.type === 'both') {
    const pinGeometry = postMapData.geometry.type === 'Point' 
      ? postMapData.geometry 
      : { type: 'Point' as const, coordinates: postMapData.center || [0, 0] };
    
    features.push({
      id: generateFeatureId(),
      type: 'Feature',
      geometry: pinGeometry,
      properties: {
        featureType: 'pin',
        hidePin: postMapData.hidePin || false,
        order: features.length,
      },
    });
  }

  // Handle 'area' or 'both' type - add area feature
  if (postMapData.type === 'area' || postMapData.type === 'both') {
    const areaGeometry = postMapData.polygon || 
      (postMapData.geometry.type !== 'Point' ? postMapData.geometry : null);
    
    if (areaGeometry && (areaGeometry.type === 'Polygon' || areaGeometry.type === 'MultiPolygon')) {
      features.push({
        id: generateFeatureId(),
        type: 'Feature',
        geometry: areaGeometry,
        properties: {
          featureType: 'area',
          order: features.length,
        },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

/**
 * Convert FeatureCollection to PostMapData (legacy format)
 * For backward compatibility - takes first pin and first area
 */
export function featureCollectionToPostMapData(
  featureCollection: MapFeatureCollection,
  screenshot?: string
): PostMapData | null {
  if (featureCollection.features.length === 0) {
    return null;
  }

  const pins = featureCollection.features.filter(f => f.properties.featureType === 'pin');
  const areas = featureCollection.features.filter(f => f.properties.featureType === 'area');

  // Determine type
  let type: 'pin' | 'area' | 'both';
  if (pins.length > 0 && areas.length > 0) {
    type = 'both';
  } else if (pins.length > 0) {
    type = 'pin';
  } else {
    type = 'area';
  }

  // Get first pin
  const firstPin = pins[0];
  const pinGeometry = firstPin?.geometry.type === 'Point' ? firstPin.geometry : undefined;
  const center = pinGeometry ? [pinGeometry.coordinates[0], pinGeometry.coordinates[1]] as [number, number] : undefined;
  const hidePin = firstPin?.properties.hidePin || false;

  // Get first area
  const firstArea = areas[0];
  const areaGeometry = firstArea?.geometry.type === 'Polygon' || firstArea?.geometry.type === 'MultiPolygon'
    ? firstArea.geometry
    : undefined;

  // Construct PostMapData
  if (type === 'both' && pinGeometry && areaGeometry) {
    return {
      type: 'both',
      geometry: pinGeometry,
      center,
      hidePin,
      polygon: areaGeometry,
      screenshot,
    };
  } else if (type === 'pin' && pinGeometry) {
    return {
      type: 'pin',
      geometry: pinGeometry,
      center,
      hidePin,
      screenshot,
    };
  } else if (type === 'area' && areaGeometry) {
    return {
      type: 'area',
      geometry: areaGeometry,
      screenshot,
    };
  }

  return null;
}

/**
 * Create a feature registry Map from a FeatureCollection
 */
export function createFeatureRegistry(
  featureCollection: MapFeatureCollection
): Map<string, MapFeature> {
  const registry = new Map<string, MapFeature>();
  featureCollection.features.forEach(feature => {
    registry.set(feature.id, feature);
  });
  return registry;
}

/**
 * Validate that a FeatureCollection has valid structure
 */
export function validateFeatureCollection(
  collection: unknown
): collection is MapFeatureCollection {
  if (!collection || typeof collection !== 'object') return false;
  const fc = collection as Record<string, unknown>;
  if (fc.type !== 'FeatureCollection') return false;
  if (!Array.isArray(fc.features)) return false;
  
  return fc.features.every((feature: unknown) => {
    if (!feature || typeof feature !== 'object') return false;
    const f = feature as Record<string, unknown>;
    return (
      typeof f.id === 'string' &&
      f.type === 'Feature' &&
      f.geometry &&
      f.properties &&
      typeof (f.properties as Record<string, unknown>).featureType === 'string'
    );
  });
}

