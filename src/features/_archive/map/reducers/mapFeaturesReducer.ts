/**
 * Reducer for managing multiple map features using FeatureCollection
 */

import type { MapFeaturesState, MapFeaturesAction, MapFeature } from '../types/featureCollection';
import { createFeatureRegistry, generateFeatureId } from '../utils/featureCollectionUtils';

/**
 * Initial state for map features
 */
export const initialMapFeaturesState: MapFeaturesState = {
  featureCollection: { type: 'FeatureCollection', features: [] },
  featureRegistry: new Map(),
  selectedFeatureId: null,
  drawingMode: 'idle',
  mapLoaded: false,
  isDrawing: false,
  screenshot: undefined,
};

/**
 * Reducer function for map features state
 */
export function mapFeaturesReducer(
  state: MapFeaturesState,
  action: MapFeaturesAction
): MapFeaturesState {
  switch (action.type) {
    case 'SET_MAP_LOADED':
      return { ...state, mapLoaded: action.payload };

    case 'SET_DRAWING_MODE':
      return { ...state, drawingMode: action.payload };

    case 'SET_IS_DRAWING':
      return { ...state, isDrawing: action.payload };

    case 'ADD_FEATURE': {
      const { feature } = action.payload;
      
      // Ensure feature has an ID
      const featureWithId: MapFeature = {
        ...feature,
        id: feature.id || generateFeatureId(),
        properties: {
          ...feature.properties,
          order: feature.properties.order ?? state.featureCollection.features.length,
        },
      };

      const newFeatures = [...state.featureCollection.features, featureWithId];
      const newCollection = {
        type: 'FeatureCollection' as const,
        features: newFeatures,
      };
      const newRegistry = createFeatureRegistry(newCollection);

      return {
        ...state,
        featureCollection: newCollection,
        featureRegistry: newRegistry,
        selectedFeatureId: featureWithId.id,
      };
    }

    case 'UPDATE_FEATURE': {
      const { featureId, updates } = action.payload;
      const existingFeature = state.featureRegistry.get(featureId);
      
      if (!existingFeature) {
        console.warn(`Feature ${featureId} not found for update`);
        return state;
      }

      const updatedFeature: MapFeature = {
        ...existingFeature,
        ...updates,
        id: featureId, // Ensure ID doesn't change
        properties: {
          ...existingFeature.properties,
          ...(updates.properties || {}),
        },
      };

      const newFeatures = state.featureCollection.features.map(f =>
        f.id === featureId ? updatedFeature : f
      );
      const newCollection = {
        type: 'FeatureCollection' as const,
        features: newFeatures,
      };
      const newRegistry = createFeatureRegistry(newCollection);

      return {
        ...state,
        featureCollection: newCollection,
        featureRegistry: newRegistry,
      };
    }

    case 'DELETE_FEATURE': {
      const { featureId } = action.payload;
      const newFeatures = state.featureCollection.features.filter(f => f.id !== featureId);
      const newCollection = {
        type: 'FeatureCollection' as const,
        features: newFeatures,
      };
      const newRegistry = createFeatureRegistry(newCollection);

      return {
        ...state,
        featureCollection: newCollection,
        featureRegistry: newRegistry,
        selectedFeatureId: state.selectedFeatureId === featureId ? null : state.selectedFeatureId,
      };
    }

    case 'REORDER_FEATURES': {
      const { featureIds } = action.payload;
      const featureMap = new Map(state.featureCollection.features.map(f => [f.id, f]));
      
      const reorderedFeatures = featureIds
        .map(id => featureMap.get(id))
        .filter((f): f is MapFeature => f !== undefined);
      
      // Add any features not in the reorder list
      const remainingFeatures = state.featureCollection.features.filter(
        f => !featureIds.includes(f.id)
      );
      
      const newFeatures = [...reorderedFeatures, ...remainingFeatures].map((f, index) => ({
        ...f,
        properties: {
          ...f.properties,
          order: index,
        },
      }));

      const newCollection = {
        type: 'FeatureCollection' as const,
        features: newFeatures,
      };
      const newRegistry = createFeatureRegistry(newCollection);

      return {
        ...state,
        featureCollection: newCollection,
        featureRegistry: newRegistry,
      };
    }

    case 'SELECT_FEATURE':
      return { ...state, selectedFeatureId: action.payload.featureId };

    case 'SET_SCREENSHOT':
      return { ...state, screenshot: action.payload.screenshot };

    case 'CLEAR_ALL':
      return {
        ...state,
        featureCollection: { type: 'FeatureCollection', features: [] },
        featureRegistry: new Map(),
        selectedFeatureId: null,
        drawingMode: 'idle',
        isDrawing: false,
      };

    case 'LOAD_FEATURE_COLLECTION': {
      const { featureCollection } = action.payload;
      const registry = createFeatureRegistry(featureCollection);
      
      return {
        ...state,
        featureCollection,
        featureRegistry: registry,
        selectedFeatureId: null,
      };
    }

    case 'RESET_STATE':
      return initialMapFeaturesState;

    default:
      return state;
  }
}

