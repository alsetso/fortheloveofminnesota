'use client';

import { useRef, useReducer, useCallback, useEffect, useMemo } from 'react';
import { loadMapboxDraw } from '@/features/_archive/map/utils/mapboxLoader';
import type { GeoJSON } from 'geojson';
import { mapFeaturesReducer, initialMapFeaturesState } from '../reducers/mapFeaturesReducer';
import type { MapFeature, MapFeatureCollection } from '../types/featureCollection';
import { generateFeatureId } from '../utils/featureCollectionUtils';
import type { MapboxMouseEvent, MapboxDrawEvent } from '@/types/mapbox-events';

// Legacy interface for backward compatibility
export interface MapPageDrawingData {
  pin: { lng: number; lat: number } | null;
  polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
}

export interface UseMapPageDrawingOptions {
  map: import('mapbox-gl').Map | null;
  mapLoaded: boolean;
}

export interface UseMapPageDrawingReturn {
  // New FeatureCollection-based API
  featureCollection: MapFeatureCollection;
  selectedFeatureId: string | null;
  addFeature: (feature: Omit<MapFeature, 'id'>) => void;
  updateFeature: (featureId: string, updates: Partial<MapFeature>) => void;
  deleteFeature: (featureId: string) => void;
  selectFeature: (featureId: string | null) => void;
  
  // Legacy API (for backward compatibility)
  drawingData: MapPageDrawingData;
  isDrawingMode: 'idle' | 'pin' | 'area';
  startPinMode: () => void;
  startAreaMode: () => void;
  stopDrawing: () => void;
  clearAll: () => void;
  onSave: () => void;
}

// Unique source/layer IDs for map page drawing (separate from PostMapModal)
// Using single sources for all features (FeatureCollection)
const PIN_SOURCE_ID = 'map-page-pins-source';
const PIN_LAYER_ID = 'map-page-pins-layer';
const PIN_SHADOW_LAYER_ID = 'map-page-pins-shadow-layer';
const PIN_INNER_LAYER_ID = 'map-page-pins-inner-layer';
const AREA_SOURCE_ID = 'map-page-areas-source';
const AREA_LAYER_ID = 'map-page-areas-layer';
const AREA_OUTLINE_LAYER_ID = 'map-page-areas-outline-layer';

export function useMapPageDrawing({
  map,
  mapLoaded,
}: UseMapPageDrawingOptions): UseMapPageDrawingReturn {
  // Use reducer for FeatureCollection-based state management
  const [state, dispatch] = useReducer(mapFeaturesReducer, {
    ...initialMapFeaturesState,
    mapLoaded,
  });

  // Update mapLoaded when it changes
  useEffect(() => {
    dispatch({ type: 'SET_MAP_LOADED', payload: mapLoaded });
  }, [mapLoaded]);
  
  const draw = useRef<import('@mapbox/mapbox-gl-draw').default | null>(null);
  const isDraggingPinRef = useRef(false);
  const isDrawingRef = useRef(false);
  const drawInitializedRef = useRef(false);
  
  // Track which feature is being dragged (for pin updates)
  const draggingFeatureIdRef = useRef<string | null>(null);

  // Update pin layers with FeatureCollection (all pins)
  const updatePinLayers = useCallback((mapInstance: import('mapbox-gl').Map, pins: MapFeature[]) => {
    const pinFeatures = pins.filter(f => f.properties.featureType === 'pin' && !f.properties.hidePin);
    
    // Remove existing layers if they exist
    try {
      if (mapInstance.getLayer(PIN_INNER_LAYER_ID)) mapInstance.removeLayer(PIN_INNER_LAYER_ID);
      if (mapInstance.getLayer(PIN_SHADOW_LAYER_ID)) mapInstance.removeLayer(PIN_SHADOW_LAYER_ID);
      if (mapInstance.getLayer(PIN_LAYER_ID)) mapInstance.removeLayer(PIN_LAYER_ID);
      if (mapInstance.getSource(PIN_SOURCE_ID)) mapInstance.removeSource(PIN_SOURCE_ID);
    } catch (e) {
      // Layers might not exist, ignore
    }

    if (pinFeatures.length === 0) return;

    // Create FeatureCollection for pins (include feature ID in properties for dragging)
    const pinCollection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: pinFeatures.map(f => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          id: f.id, // Store feature ID for dragging identification
        },
      })),
    };

    // Add source
    mapInstance.addSource(PIN_SOURCE_ID, {
      type: 'geojson',
      data: pinCollection,
    });

    // Add shadow layer
    mapInstance.addLayer({
      id: PIN_SHADOW_LAYER_ID,
      type: 'circle',
      source: PIN_SOURCE_ID,
      paint: {
        'circle-radius': 12,
        'circle-color': '#000000',
        'circle-opacity': 0.2,
        'circle-blur': 0.5,
        'circle-translate': [0, 2],
      },
    });

    // Add main pin layer
    mapInstance.addLayer({
      id: PIN_LAYER_ID,
      type: 'circle',
      source: PIN_SOURCE_ID,
      paint: {
        'circle-radius': 10,
        'circle-color': '#EF4444',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });

    // Add inner circle
    mapInstance.addLayer({
      id: PIN_INNER_LAYER_ID,
      type: 'circle',
      source: PIN_SOURCE_ID,
      paint: {
        'circle-radius': 4,
        'circle-color': '#ffffff',
      },
    });
  }, []);


  // Update area layers with FeatureCollection (all areas)
  const updateAreaLayers = useCallback((mapInstance: import('mapbox-gl').Map, areas: MapFeature[]) => {
    const areaFeatures = areas.filter(f => f.properties.featureType === 'area');
    
    // Remove existing layers
    try {
      if (mapInstance.getLayer(AREA_OUTLINE_LAYER_ID)) mapInstance.removeLayer(AREA_OUTLINE_LAYER_ID);
      if (mapInstance.getLayer(AREA_LAYER_ID)) mapInstance.removeLayer(AREA_LAYER_ID);
      if (mapInstance.getSource(AREA_SOURCE_ID)) mapInstance.removeSource(AREA_SOURCE_ID);
    } catch (e) {
      // Ignore errors
    }

    if (areaFeatures.length === 0) return;

    // Create FeatureCollection for areas
    const areaCollection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: areaFeatures.map(f => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: {},
      })),
    };

    mapInstance.addSource(AREA_SOURCE_ID, {
      type: 'geojson',
      data: areaCollection,
    });

    mapInstance.addLayer({
      id: AREA_LAYER_ID,
      type: 'fill',
      source: AREA_SOURCE_ID,
      paint: {
        'fill-color': '#10b981',
        'fill-opacity': 0.15,
      },
    });

    mapInstance.addLayer({
      id: AREA_OUTLINE_LAYER_ID,
      type: 'line',
      source: AREA_SOURCE_ID,
      paint: {
        'line-color': '#10b981',
        'line-width': 2,
      },
    });
  }, []);

  // Sync map layers with current FeatureCollection state
  useEffect(() => {
    if (!map || !state.mapLoaded) return;

    const pins = state.featureCollection.features.filter(f => f.properties.featureType === 'pin');
    const areas = state.featureCollection.features.filter(f => f.properties.featureType === 'area');

    updatePinLayers(map, pins);
    updateAreaLayers(map, areas);

    // Setup dragging for all pins (using source-level handler)
    // Note: We'll identify which pin by querying features at the drag point
    if (pins.length > 0 && !pins.some(p => p.properties.hidePin)) {
      // Remove existing handlers
      const existingHandler = (map as { _mapPagePinDragHandler?: { mousedown: (e: MapboxMouseEvent) => void; mousemove: (e: MapboxMouseEvent) => void; mouseup: (e: MapboxMouseEvent) => void; mouseenter: (e: MapboxMouseEvent) => void; mouseleave: (e: MapboxMouseEvent) => void } })._mapPagePinDragHandler;
      if (existingHandler) {
        map.off('mousedown', PIN_SOURCE_ID, existingHandler.mousedown);
        map.off('mousemove', existingHandler.mousemove);
        map.off('mouseup', existingHandler.mouseup);
        map.off('mouseenter', PIN_SOURCE_ID, existingHandler.mouseenter);
        map.off('mouseleave', PIN_SOURCE_ID, existingHandler.mouseleave);
      }

      const mousedownHandler = (e: MapboxMouseEvent) => {
        e.preventDefault();
        isDraggingPinRef.current = true;
        map.getCanvas().style.cursor = 'grabbing';
        
        // Find which feature was clicked
        const clickedFeatures = map.queryRenderedFeatures(e.point, { layers: [PIN_LAYER_ID] });
        if (clickedFeatures.length > 0) {
          const featureId = clickedFeatures[0].properties?.id as string | undefined;
          if (featureId) {
            draggingFeatureIdRef.current = featureId;
          }
        }
      };

      const mousemoveHandler = (e: MapboxMouseEvent) => {
        if (!isDraggingPinRef.current || !draggingFeatureIdRef.current) return;

        const source = map.getSource(PIN_SOURCE_ID) as import('mapbox-gl').GeoJSONSource;
        if (!source) return;

        // Update the specific feature in the source
        const currentData = source._data as GeoJSON.FeatureCollection;
        const updatedFeatures = currentData.features.map(f => {
          if ((f.properties as { id?: string })?.id === draggingFeatureIdRef.current) {
            return {
              ...f,
              geometry: {
                type: 'Point',
                coordinates: [e.lngLat.lng, e.lngLat.lat],
              },
            };
          }
          return f;
        });

        source.setData({
          type: 'FeatureCollection',
          features: updatedFeatures,
        });
      };

      const mouseupHandler = (e: MapboxMouseEvent) => {
        if (!isDraggingPinRef.current || !draggingFeatureIdRef.current) return;
        
        const featureId = draggingFeatureIdRef.current;
        isDraggingPinRef.current = false;
        map.getCanvas().style.cursor = '';
        
        // Update feature in state
        dispatch({
          type: 'UPDATE_FEATURE',
          payload: {
            featureId,
            updates: {
              geometry: {
                type: 'Point',
                coordinates: [e.lngLat.lng, e.lngLat.lat],
              },
            },
          },
        });
        
        draggingFeatureIdRef.current = null;
      };

      const mouseenterHandler = () => {
        if (!isDraggingPinRef.current) {
          map.getCanvas().style.cursor = 'pointer';
        }
      };

      const mouseleaveHandler = () => {
        if (!isDraggingPinRef.current) {
          map.getCanvas().style.cursor = '';
        }
      };

      map.on('mousedown', PIN_SOURCE_ID, mousedownHandler);
      map.on('mousemove', mousemoveHandler);
      map.on('mouseup', mouseupHandler);
      map.on('mouseenter', PIN_SOURCE_ID, mouseenterHandler);
      map.on('mouseleave', PIN_SOURCE_ID, mouseleaveHandler);

      // Store handlers for cleanup
      (map as { _mapPagePinDragHandler?: { mousedown: (e: MapboxMouseEvent) => void; mousemove: (e: MapboxMouseEvent) => void; mouseup: (e: MapboxMouseEvent) => void; mouseenter: (e: MapboxMouseEvent) => void; mouseleave: (e: MapboxMouseEvent) => void } })._mapPagePinDragHandler = {
        mousedown: mousedownHandler,
        mousemove: mousemoveHandler,
        mouseup: mouseupHandler,
        mouseenter: mouseenterHandler,
        mouseleave: mouseleaveHandler,
      };
    }
  }, [map, state.mapLoaded, state.featureCollection, updatePinLayers, updateAreaLayers]);

  // Initialize Mapbox Draw
  useEffect(() => {
    if (!map || !state.mapLoaded || drawInitializedRef.current) return;

    const initDraw = async () => {
      try {
        const MapboxDraw = await loadMapboxDraw();
        const drawInstance = new MapboxDraw({
          displayControlsDefault: false,
          controls: {
            polygon: false,
            trash: false,
          },
          defaultMode: 'simple_select',
        });

        map.addControl(drawInstance);
        
        // Hide draw controls
        const hideDrawControls = () => {
          const container = map.getContainer();
          const drawControls = container.querySelectorAll('.mapboxgl-ctrl-group, .mapboxgl-ctrl-draw, [class*="mapbox-gl-draw"]');
          drawControls.forEach((ctrl) => {
            const element = ctrl as HTMLElement;
            element.style.display = 'none';
            element.style.visibility = 'hidden';
            element.style.opacity = '0';
            element.style.pointerEvents = 'none';
          });
        };

        hideDrawControls();
        setTimeout(hideDrawControls, 50);
        setTimeout(hideDrawControls, 200);

        const observer = new MutationObserver(hideDrawControls);
        observer.observe(map.getContainer(), { childList: true, subtree: true });
        (map as { _mapPageDrawObserver?: MutationObserver })._mapPageDrawObserver = observer;

        draw.current = drawInstance;
        drawInitializedRef.current = true;

        // Set up draw event handlers
        map.on('draw.create', (e) => {
          if (!isDrawingRef.current) return;
          
          const features = drawInstance.getAll();
          if (features.features.length > 0) {
            const geometry = features.features[0].geometry;
            if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
              const polygon = geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
              
              // Add area feature to collection
              const newFeature: MapFeature = {
                id: generateFeatureId(),
                type: 'Feature',
                geometry: polygon,
                properties: {
                  featureType: 'area',
                  order: state.featureCollection.features.length,
                },
              };
              
              dispatch({ type: 'ADD_FEATURE', payload: { feature: newFeature } });
              
              isDrawingRef.current = false;
              dispatch({ type: 'SET_IS_DRAWING', payload: false });
              drawInstance.changeMode('simple_select');
              
              // Remove draw feature (our layer will update via useEffect)
              setTimeout(() => {
                drawInstance.deleteAll();
              }, 10);
              
              map.getCanvas().style.cursor = '';
            }
          }
        });

        map.on('draw.update', (e) => {
          if (!isDrawingRef.current) return;
          
          const features = drawInstance.getAll();
          if (features.features.length > 0) {
            const geometry = features.features[0].geometry;
            if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
              // Update the last area feature (the one being drawn)
              const areaFeatures = state.featureCollection.features.filter(
                f => f.properties.featureType === 'area'
              );
              const lastArea = areaFeatures[areaFeatures.length - 1];
              
              if (lastArea) {
                dispatch({
                  type: 'UPDATE_FEATURE',
                  payload: {
                    featureId: lastArea.id,
                    updates: { geometry },
                  },
                });
              }
            }
          }
        });

        map.on('draw.delete', () => {
          if (!isDrawingRef.current) return;
          
          // Delete the last area feature
          const areaFeatures = state.featureCollection.features.filter(
            f => f.properties.featureType === 'area'
          );
          const lastArea = areaFeatures[areaFeatures.length - 1];
          
          if (lastArea) {
            dispatch({ type: 'DELETE_FEATURE', payload: { featureId: lastArea.id } });
          }
          
          isDrawingRef.current = false;
          dispatch({ type: 'SET_IS_DRAWING', payload: false });
          map.getCanvas().style.cursor = '';
        });

        map.on('draw.modechange', (e: MapboxDrawEvent) => {
          const drawing = e.mode === 'draw_polygon';
          isDrawingRef.current = drawing;
          dispatch({ type: 'SET_IS_DRAWING', payload: drawing });
        });
      } catch (error) {
        console.error('Failed to initialize Mapbox Draw:', error);
      }
    };

    initDraw();

    return () => {
      // Cleanup
      if (map) {
        if ((map as { _mapPageDrawObserver?: MutationObserver })._mapPageDrawObserver) {
          (map as { _mapPageDrawObserver?: MutationObserver })._mapPageDrawObserver.disconnect();
        }
        // Remove event listeners
        map.off('draw.create');
        map.off('draw.update');
        map.off('draw.delete');
        map.off('draw.modechange');
      }
    };
  }, [map, state.mapLoaded, state.featureCollection]);

  // Handle map clicks for pin placement
  useEffect(() => {
    if (!map || !state.mapLoaded || state.drawingMode !== 'pin') return;

    const handleMapClick = (e: MapboxMouseEvent) => {
      // Only handle if we're in pin mode
      if (state.drawingMode !== 'pin' || !draw.current) return;
      
      // Don't place pin if in drawing mode
      if (draw.current.getMode() === 'draw_polygon') return;
      
      // Check if click is on a marker or popup (existing map functionality)
      const originalEvent = e.originalEvent;
      if (originalEvent) {
        const target = originalEvent.target as HTMLElement;
        const isMarkerClick = target.closest('.mapboxgl-marker') !== null || 
                             target.closest('.map-pin-marker') !== null ||
                             target.closest('.pin-marker') !== null;
        const isPopupClick = target.closest('.mapboxgl-popup') !== null;
        if (isMarkerClick || isPopupClick) {
          return; // Let existing handlers deal with this
        }
      }
      
      // Check if click is on our own drawing pin (allow dragging)
      const features = map.queryRenderedFeatures(e.point);
      if (features.length > 0) {
        const clickedLayer = features[0].layer.id;
        if (clickedLayer === PIN_LAYER_ID || clickedLayer === PIN_SHADOW_LAYER_ID || clickedLayer === PIN_INNER_LAYER_ID) {
          return; // Allow dragging to handle this
        }
        // If clicking on other rendered features (not our area layers), skip
        // This prevents interference with existing map markers/features
        if (clickedLayer !== AREA_LAYER_ID && clickedLayer !== AREA_OUTLINE_LAYER_ID) {
          return;
        }
      }
      
      const { lng, lat } = e.lngLat;
      
      // Add pin feature to collection
      const newFeature: MapFeature = {
        id: generateFeatureId(),
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        properties: {
          featureType: 'pin',
          hidePin: false,
          order: state.featureCollection.features.length,
        },
      };
      
      dispatch({ type: 'ADD_FEATURE', payload: { feature: newFeature } });
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, state.mapLoaded, state.drawingMode, state.featureCollection]);

  const startPinMode = useCallback(() => {
    if (!map || !draw.current) return;
    
    dispatch({ type: 'SET_DRAWING_MODE', payload: 'pin' });
    draw.current.changeMode('simple_select');
    map.getCanvas().style.cursor = 'crosshair';
  }, [map]);

  const startAreaMode = useCallback(() => {
    if (!map || !draw.current) return;
    
    dispatch({ type: 'SET_DRAWING_MODE', payload: 'area' });
    isDrawingRef.current = true;
    dispatch({ type: 'SET_IS_DRAWING', payload: true });
    draw.current.changeMode('draw_polygon');
    map.getCanvas().style.cursor = 'crosshair';
  }, [map]);

  const stopDrawing = useCallback(() => {
    if (!map || !draw.current) return;
    
    dispatch({ type: 'SET_DRAWING_MODE', payload: 'idle' });
    isDrawingRef.current = false;
    dispatch({ type: 'SET_IS_DRAWING', payload: false });
    draw.current.changeMode('simple_select');
    map.getCanvas().style.cursor = '';
  }, [map]);

  const clearAll = useCallback(() => {
    if (!map || !draw.current) return;
    
    // Clear all features
    dispatch({ type: 'CLEAR_ALL' });
    
    // Clear draw
    draw.current.deleteAll();
    isDrawingRef.current = false;
    draw.current.changeMode('simple_select');
    map.getCanvas().style.cursor = '';
  }, [map]);

  const onSave = useCallback(() => {
    // This will trigger the "coming soon" modal
    // The actual save logic will be handled by the component using this hook
  }, []);

  // Helper functions for FeatureCollection API
  const addFeature = useCallback((feature: Omit<MapFeature, 'id'>) => {
    const featureWithId: MapFeature = {
      ...feature,
      id: feature.id || generateFeatureId(),
    };
    dispatch({ type: 'ADD_FEATURE', payload: { feature: featureWithId } });
  }, []);

  const updateFeature = useCallback((featureId: string, updates: Partial<MapFeature>) => {
    dispatch({ type: 'UPDATE_FEATURE', payload: { featureId, updates } });
  }, []);

  const deleteFeature = useCallback((featureId: string) => {
    dispatch({ type: 'DELETE_FEATURE', payload: { featureId } });
  }, []);

  const selectFeature = useCallback((featureId: string | null) => {
    dispatch({ type: 'SELECT_FEATURE', payload: { featureId } });
  }, []);

  // Legacy drawingData for backward compatibility
  const drawingData = useMemo<MapPageDrawingData>(() => {
    const pins = state.featureCollection.features.filter(f => f.properties.featureType === 'pin');
    const areas = state.featureCollection.features.filter(f => f.properties.featureType === 'area');
    
    const firstPin = pins[0];
    const firstArea = areas[0];
    
    return {
      pin: firstPin && firstPin.geometry.type === 'Point'
        ? { lng: firstPin.geometry.coordinates[0], lat: firstPin.geometry.coordinates[1] }
        : null,
      polygon: firstArea && (firstArea.geometry.type === 'Polygon' || firstArea.geometry.type === 'MultiPolygon')
        ? firstArea.geometry
        : null,
    };
  }, [state.featureCollection]);

  return {
    // New FeatureCollection API
    featureCollection: state.featureCollection,
    selectedFeatureId: state.selectedFeatureId,
    addFeature,
    updateFeature,
    deleteFeature,
    selectFeature,
    
    // Legacy API (for backward compatibility)
    drawingData,
    isDrawingMode: state.drawingMode,
    startPinMode,
    startAreaMode,
    stopDrawing,
    clearAll,
    onSave,
  };
}

