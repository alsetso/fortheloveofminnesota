'use client';

import { useRef, useEffect, useState, useCallback, useReducer } from 'react';
import { loadMapboxGL, loadMapboxDraw } from '@/features/_archive/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/_archive/map/config';
import { XMarkIcon, MapPinIcon, PencilIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { AddressParser } from '@/features/_archive/map/services/addressParser';

// Inline helper function (was in mapHelpers.ts)
function calculateCenter(coordinates: number[][][]): { lng: number; lat: number } {
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  for (const ring of coordinates) {
    for (const [lng, lat] of ring) {
      sumLng += lng;
      sumLat += lat;
      count++;
    }
  }
  return { lng: sumLng / count, lat: sumLat / count };
}
import type { MapboxMapInstance, MapboxMouseEvent, MapboxDrawEvent, MapboxSuggestion, MapboxFeature } from '@/types/mapbox-events';

export interface PostMapData {
  type: 'pin' | 'area' | 'both';
  geometry: GeoJSON.Point | GeoJSON.Polygon | GeoJSON.MultiPolygon;
  center?: [number, number];
  hidePin?: boolean;
  polygon?: GeoJSON.Polygon | GeoJSON.MultiPolygon; // For 'both' type
  screenshot?: string; // Base64 PNG or URL
  // Address fields from reverse geocoding
  address?: string; // Full address string
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  // Debug info for address detection
  debugInfo?: {
    source: 'pin' | 'polygon_centroid' | 'manual';
    coordinates: [number, number];
    geocodingResponse?: Record<string, unknown>;
    timestamp: string;
    error?: string;
  };
}

type DrawingState = 'idle' | 'drawing' | 'completed';

class DrawingStateMachine {
  private state: DrawingState = 'idle';

  canStartDrawing(): boolean {
    return this.state === 'idle' || this.state === 'completed';
  }

  canCompleteDrawing(): boolean {
    return this.state === 'drawing';
  }

  canEditDrawing(): boolean {
    return this.state === 'completed';
  }

  startDrawing(): void {
    if (this.canStartDrawing()) {
      this.state = 'drawing';
    }
  }

  completeDrawing(): void {
    if (this.canCompleteDrawing()) {
      this.state = 'completed';
    }
  }

  reset(): void {
    this.state = 'idle';
  }

  getState(): DrawingState {
    return this.state;
  }

  setState(state: DrawingState): void {
    this.state = state;
  }
}

type MapState = {
  mapLoaded: boolean;
  isDrawing: boolean; // True when actively drawing polygon (adding points)
  mapData: PostMapData | null;
  hidePin: boolean;
  isCapturingScreenshot: boolean;
  drawingState: DrawingState;
};

type MapAction =
  | { type: 'SET_MAP_LOADED'; payload: boolean }
  | { type: 'SET_IS_DRAWING'; payload: boolean }
  | { type: 'SET_MAP_DATA'; payload: PostMapData | null }
  | { type: 'SET_HIDE_PIN'; payload: boolean }
  | { type: 'SET_IS_CAPTURING_SCREENSHOT'; payload: boolean }
  | { type: 'SET_DRAWING_STATE'; payload: DrawingState }
  | { type: 'RESET_STATE'; payload: { initialMapData?: PostMapData | null; initialMode?: 'pin' | 'area' } };

function mapReducer(state: MapState, action: MapAction): MapState {
  switch (action.type) {
    case 'SET_MAP_LOADED':
      return { ...state, mapLoaded: action.payload };
    
    case 'SET_IS_DRAWING':
      return { ...state, isDrawing: action.payload };
    
    case 'SET_MAP_DATA':
      return { ...state, mapData: action.payload };
    
    case 'SET_HIDE_PIN':
      return { ...state, hidePin: action.payload };
    
    case 'SET_IS_CAPTURING_SCREENSHOT':
      return { ...state, isCapturingScreenshot: action.payload };
    
    case 'SET_DRAWING_STATE':
      return { ...state, drawingState: action.payload };
    
    case 'RESET_STATE':
      const { initialMapData } = action.payload;
      
      return {
        mapLoaded: false,
        isDrawing: false,
        mapData: initialMapData || null,
        hidePin: initialMapData?.hidePin || false,
        isCapturingScreenshot: false,
        drawingState: initialMapData?.type === 'area' || initialMapData?.type === 'both' ? 'completed' : 'idle',
      };
    
    default:
      return state;
  }
}

interface PostMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMapData?: PostMapData | null;
  onSave: (mapData: PostMapData | null) => void;
  mode?: 'pin' | 'area';
}

export default function PostMapModal({
  isOpen,
  onClose,
  initialMapData,
  onSave,
  mode: initialMode,
}: PostMapModalProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const draw = useRef<import('@mapbox/mapbox-gl-draw').default | null>(null);
  const pinSourceIdRef = useRef<string | null>(null); // Track pin source for canvas-based pin
  const completedAreaSourceRef = useRef<string | null>(null);
  const completedAreaLayerRef = useRef<string | null>(null);
  const isDrawingRef = useRef(false);
  const mapInitializedRef = useRef(false);
  const initAttemptRef = useRef(false);
  const drawingStateMachineRef = useRef(new DrawingStateMachine());
  const debouncedUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingPinRef = useRef(false);

  // Core map state managed by reducer
  const [state, dispatch] = useReducer(mapReducer, {
    mapLoaded: false,
    isDrawing: false,
    mapData: initialMapData || null,
    hidePin: initialMapData?.hidePin || false,
    isCapturingScreenshot: false,
    drawingState: initialMapData?.type === 'area' || initialMapData?.type === 'both' ? 'completed' : 'idle',
  });

  // Initialize drawing state machine
  useEffect(() => {
    if (initialMapData?.type === 'area' || initialMapData?.type === 'both') {
      drawingStateMachineRef.current.setState('completed');
    } else {
      drawingStateMachineRef.current.setState('idle');
    }
  }, [initialMapData]);

  // Search UI state (kept separate as it's UI-specific)
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Calculate centroid of a polygon for reverse geocoding
  const calculatePolygonCentroid = useCallback((
    geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
  ): [number, number] | null => {
    try {
      let allCoords: Array<[number, number]> = [];
      
      if (geometry.type === 'Polygon') {
        // Get coordinates from first ring (exterior ring)
        allCoords = geometry.coordinates[0] as Array<[number, number]>;
      } else if (geometry.type === 'MultiPolygon') {
        // Get coordinates from all polygons' first rings
        allCoords = geometry.coordinates.flatMap(poly => poly[0] as Array<[number, number]>);
      }
      
      if (allCoords.length === 0) return null;
      
      const center = calculateCenter(allCoords);
      return [center.lng, center.lat];
    } catch (error) {
      console.error('Error calculating polygon centroid:', error);
      return null;
    }
  }, []);

  // Reverse geocode coordinates to get address information
  const reverseGeocodeCoordinates = useCallback(async (
    lng: number, 
    lat: number, 
    source: 'pin' | 'polygon_centroid' | 'manual'
  ): Promise<{
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    county?: string;
    debugInfo?: PostMapData['debugInfo'];
  }> => {
    const token = MAP_CONFIG.MAPBOX_TOKEN;
    const coordinates: [number, number] = [lng, lat];
    
    if (!token || token === 'your_mapbox_token_here') {
      return {
        debugInfo: {
          source,
          coordinates,
          timestamp: new Date().toISOString(),
          error: 'Mapbox token not configured',
        },
      };
    }

    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`;
      const params = new URLSearchParams({
        access_token: token,
        types: 'address',
        limit: '1',
      });

      const response = await fetch(`${url}?${params}`);
      if (!response.ok) {
        throw new Error(`Reverse geocoding failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.features || data.features.length === 0) {
        return {
          debugInfo: {
            source,
            coordinates,
            timestamp: new Date().toISOString(),
            error: 'No address found for coordinates',
          },
        };
      }

      const feature = data.features[0];
      const parsed = AddressParser.parseMapboxFeature(feature);
      
      // Extract county from context if available
      const countyContext = feature.context?.find((c: { id?: string | number }) => 
        String(c.id).startsWith('district') || String(c.id).startsWith('county')
      );
      const county = countyContext?.text || '';

      // Build full address string
      const addressParts = [
        parsed.street,
        parsed.city,
        parsed.state,
        parsed.zip,
      ].filter(Boolean);
      const fullAddress = addressParts.join(', ');

      return {
        address: fullAddress || feature.place_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        city: parsed.city,
        state: parsed.state,
        zip: parsed.zip,
        county: county,
        debugInfo: {
          source,
          coordinates,
          geocodingResponse: {
            place_name: feature.place_name,
            text: feature.text,
            properties: feature.properties,
            context: feature.context,
          },
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return {
        debugInfo: {
          source,
          coordinates,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Reverse geocoding failed',
        },
      };
    }
  }, []);

  const searchLocations = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      const token = MAP_CONFIG.MAPBOX_TOKEN;
      if (!token) throw new Error('Mapbox token not configured');

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`;
      const params = new URLSearchParams({
        access_token: token,
        country: 'us',
        bbox: `${MAP_CONFIG.MINNESOTA_BOUNDS.west},${MAP_CONFIG.MINNESOTA_BOUNDS.south},${MAP_CONFIG.MINNESOTA_BOUNDS.east},${MAP_CONFIG.MINNESOTA_BOUNDS.north}`,
        types: 'address,poi,place',
        limit: '8',
        proximity: `${MAP_CONFIG.DEFAULT_CENTER[0]},${MAP_CONFIG.DEFAULT_CENTER[1]}`,
      });

      const response = await fetch(`${url}?${params}`);
      if (!response.ok) throw new Error('Location search failed');

      const data = await response.json();
      const filteredFeatures = (data.features || []).filter((feature: MapboxFeature) => {
        const context = feature.context || [];
        const stateContext = context.find((c: { id?: string }) => c.id && c.id.startsWith('region.'));
        return stateContext && (
          stateContext.short_code === 'US-MN' || stateContext.text === 'Minnesota'
        );
      });

      setSuggestions(filteredFeatures);
      setShowSuggestions(filteredFeatures.length > 0);
    } catch (error) {
      console.error('Location search error:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchLocations(value);
    }, 300);
  }, [searchLocations]);

  // Helper function to add pin to canvas using native GL layers
  const addPinToCanvas = useCallback((mapInstance: import('mapbox-gl').Map, lng: number, lat: number, hidePin: boolean) => {
    const sourceId = 'pin-source';
    const layerId = 'pin-layer';
    const shadowLayerId = 'pin-shadow-layer';
    const innerLayerId = 'pin-inner-layer';

    // Remove existing pin layers
    try {
      if (mapInstance.getLayer(innerLayerId)) mapInstance.removeLayer(innerLayerId);
      if (mapInstance.getLayer(shadowLayerId)) mapInstance.removeLayer(shadowLayerId);
      if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
      if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);
    } catch (e) {
      // Layers might not exist, ignore
    }

    // Add source
    mapInstance.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        properties: {},
      },
    });

    pinSourceIdRef.current = sourceId;

    if (!hidePin) {
      // Add shadow layer (for depth effect)
      mapInstance.addLayer({
        id: shadowLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 12,
          'circle-color': '#000000',
          'circle-opacity': 0.2,
          'circle-blur': 0.5,
          'circle-translate': [0, 2], // Offset shadow
        },
      });

      // Add main pin layer
      mapInstance.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 10,
          'circle-color': '#EF4444', // Red color
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Add a smaller inner circle for better visibility
      mapInstance.addLayer({
        id: innerLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 4,
          'circle-color': '#ffffff',
        },
      });
    }
  }, []);

  // Helper function to make canvas pin draggable
  const setupPinDragging = useCallback((
    mapInstance: import('mapbox-gl').Map,
    sourceId: string,
    onDragEnd: (lng: number, lat: number) => void | Promise<void>
  ) => {
    // Remove existing handlers if any
    const existingHandler = (mapInstance as MapboxMapInstance)._pinDragHandler;
    if (existingHandler) {
      mapInstance.off('mousedown', sourceId, existingHandler.mousedown);
      mapInstance.off('mousemove', existingHandler.mousemove);
      mapInstance.off('mouseup', existingHandler.mouseup);
      mapInstance.off('mouseenter', sourceId, existingHandler.mouseenter);
      mapInstance.off('mouseleave', sourceId, existingHandler.mouseleave);
    }

    const mousedownHandler = (e: MapboxMouseEvent) => {
      e.preventDefault();
      isDraggingPinRef.current = true;
      mapInstance.getCanvas().style.cursor = 'grabbing';
    };

    const mousemoveHandler = (e: MapboxMouseEvent) => {
      if (!isDraggingPinRef.current) return;

      const source = mapInstance.getSource(sourceId) as import('mapbox-gl').GeoJSONSource;
      if (!source) return;

      source.setData({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [e.lngLat.lng, e.lngLat.lat],
        },
        properties: {},
      });
    };

    const mouseupHandler = async (e: MapboxMouseEvent) => {
      if (!isDraggingPinRef.current) return;
      isDraggingPinRef.current = false;
      mapInstance.getCanvas().style.cursor = '';
      await onDragEnd(e.lngLat.lng, e.lngLat.lat);
    };

    const mouseenterHandler = () => {
      if (!isDraggingPinRef.current) {
        mapInstance.getCanvas().style.cursor = 'pointer';
      }
    };

    const mouseleaveHandler = () => {
      if (!isDraggingPinRef.current) {
        mapInstance.getCanvas().style.cursor = '';
      }
    };

    mapInstance.on('mousedown', sourceId, mousedownHandler);
    mapInstance.on('mousemove', mousemoveHandler);
    mapInstance.on('mouseup', mouseupHandler);
    mapInstance.on('mouseenter', sourceId, mouseenterHandler);
    mapInstance.on('mouseleave', sourceId, mouseleaveHandler);

    // Store handlers for cleanup
    (mapInstance as MapboxMapInstance)._pinDragHandler = {
      mousedown: mousedownHandler,
      mousemove: mousemoveHandler,
      mouseup: mouseupHandler,
      mouseenter: mouseenterHandler,
      mouseleave: mouseleaveHandler,
    };
  }, []);

  // Helper function to update pin visibility
  const updatePinVisibility = useCallback((mapInstance: import('mapbox-gl').Map, hidePin: boolean) => {
    const layerId = 'pin-layer';
    const shadowLayerId = 'pin-shadow-layer';
    const innerLayerId = 'pin-inner-layer';

    try {
      if (mapInstance.getLayer(layerId)) {
        mapInstance.setLayoutProperty(layerId, 'visibility', hidePin ? 'none' : 'visible');
      }
      if (mapInstance.getLayer(shadowLayerId)) {
        mapInstance.setLayoutProperty(shadowLayerId, 'visibility', hidePin ? 'none' : 'visible');
      }
      if (mapInstance.getLayer(innerLayerId)) {
        mapInstance.setLayoutProperty(innerLayerId, 'visibility', hidePin ? 'none' : 'visible');
      }
    } catch (e) {
      // Layers might not exist, ignore
    }
  }, []);

  const handleSuggestionSelect = useCallback(async (suggestion: MapboxSuggestion) => {
    const [lng, lat] = suggestion.center;
    setSearchQuery(suggestion.place_name);
    setShowSuggestions(false);
    setSuggestions([]);

    if (!map.current) return;

    map.current.flyTo({
      center: [lng, lat],
      zoom: 15,
      duration: 1000,
    });

    if (!state.isDrawing && draw.current && draw.current.getMode() !== 'draw_polygon' && map.current) {
      // Preserve polygon if it exists
      const currentPolygon = state.mapData?.polygon || (state.mapData?.type === 'area' || state.mapData?.type === 'both' ? state.mapData.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon : undefined);

      // Add pin to canvas
      addPinToCanvas(map.current, lng, lat, state.hidePin);

      // Setup dragging
      setupPinDragging(map.current, 'pin-source', async (newLng, newLat) => {
        const newCenter: [number, number] = [newLng, newLat];
        const updatedPointGeometry: GeoJSON.Point = {
          type: 'Point',
          coordinates: [newLng, newLat],
        };

        // Perform reverse geocoding when pin is dragged
        const addressData = await reverseGeocodeCoordinates(newLng, newLat, 'pin');

        const updatedMapData: PostMapData = currentPolygon ? {
          type: 'both',
          geometry: updatedPointGeometry,
          center: newCenter,
          polygon: currentPolygon,
          hidePin: state.hidePin,
          ...addressData,
        } : {
          type: 'pin',
          geometry: updatedPointGeometry,
          center: newCenter,
          hidePin: state.hidePin,
          ...addressData,
        };
        
        dispatch({ type: 'SET_MAP_DATA', payload: updatedMapData });
      });

      // Update mapData
      const center: [number, number] = [lng, lat];
      const pointGeometry: GeoJSON.Point = {
        type: 'Point',
        coordinates: [lng, lat],
      };

      // Perform reverse geocoding to get address information
      const addressData = await reverseGeocodeCoordinates(lng, lat, 'pin');

      const newMapData: PostMapData = currentPolygon ? {
        type: 'both',
        geometry: pointGeometry,
        center,
        polygon: currentPolygon,
        hidePin: state.hidePin,
        ...addressData,
      } : {
        type: 'pin',
        geometry: pointGeometry,
        center,
        hidePin: state.hidePin,
        ...addressData,
      };
      
      dispatch({ type: 'SET_MAP_DATA', payload: newMapData });
    }
  }, [state.hidePin, state.mapData, state.isDrawing, addPinToCanvas, setupPinDragging, reverseGeocodeCoordinates]);

  useEffect(() => {
    // Reset initialization state when modal closes
    if (!isOpen) {
      mapInitializedRef.current = false;
      initAttemptRef.current = false;
      return;
    }

    // Prevent multiple initialization attempts
    if (!isOpen || !mapContainer.current || map.current || mapInitializedRef.current || initAttemptRef.current) return;

    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      console.error('Mapbox token missing');
      return;
    }

    initAttemptRef.current = true;

    const initMap = async () => {
      try {
        // @ts-ignore - CSS import
      await import('mapbox-gl/dist/mapbox-gl.css');
        // Always load draw CSS since we support drawing mode
          await import('@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css');

        const mapbox = await loadMapboxGL();
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!mapContainer.current) {
          initAttemptRef.current = false;
          return;
        }

        const container = mapContainer.current;
        
        // Wait for container to be visible with proper dimensions
        const waitForContainer = (): Promise<void> => {
          return new Promise((resolve) => {
            const checkDimensions = () => {
              if (container.offsetWidth > 0 && container.offsetHeight > 0) {
                resolve();
              } else {
                requestAnimationFrame(checkDimensions);
              }
            };
            requestAnimationFrame(checkDimensions);
          });
        };

        await waitForContainer();

        if (!mapContainer.current || map.current) {
          initAttemptRef.current = false;
          return;
        }

        const mapInstance = new mapbox.Map({
          container: container,
          style: MAP_CONFIG.MAPBOX_STYLE,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
          preserveDrawingBuffer: true, // REQUIRED for canvas.toDataURL()
        });

        mapInstance.on('load', async () => {
          if (mapInitializedRef.current) return;
          
          setTimeout(() => {
            if (mapInstance && !(mapInstance as MapboxMapInstance)._removed) {
              mapInstance.resize();
            }
          }, 100);
          
          mapInitializedRef.current = true;
          dispatch({ type: 'SET_MAP_LOADED', payload: true });

          // Initialize Mapbox Draw for polygon drawing (always available)
            const MapboxDraw = await loadMapboxDraw();
            const drawInstance = new MapboxDraw({
              displayControlsDefault: false,
              controls: {
                polygon: false,
                trash: false,
              },
              defaultMode: 'simple_select',
            });

            mapInstance.addControl(drawInstance);
          // Hide all draw controls immediately and on any future additions
          const hideDrawControls = () => {
              const container = mapInstance.getContainer();
            const drawControls = container.querySelectorAll('.mapboxgl-ctrl-group, .mapboxgl-ctrl-draw, [class*="mapbox-gl-draw"], .mapboxgl-ctrl-top-right');
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
          
          // Use MutationObserver to hide any draw controls that appear later
          const observer = new MutationObserver(hideDrawControls);
          observer.observe(mapInstance.getContainer(), { childList: true, subtree: true });
          (mapInstance as MapboxMapInstance)._drawObserver = observer;

            draw.current = drawInstance;

          // Load initial data
          if (initialMapData) {
            // Load pin if present
            if ((initialMapData.type === 'pin' || initialMapData.type === 'both') && initialMapData.geometry.type === 'Point') {
              const [lng, lat] = initialMapData.geometry.coordinates;
              
              // Add pin to canvas
              addPinToCanvas(mapInstance, lng, lat, initialMapData.hidePin || false);

              // Setup dragging
              setupPinDragging(mapInstance, 'pin-source', (newLng, newLat) => {
                const newCenter: [number, number] = [newLng, newLat];
                const updatedPointGeometry: GeoJSON.Point = {
                  type: 'Point',
                  coordinates: [newLng, newLat],
                };

                const currentPolygon = state.mapData?.polygon || (state.mapData?.type === 'area' || state.mapData?.type === 'both' ? state.mapData.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon : undefined);

                const updatedMapData: PostMapData = currentPolygon ? {
                  type: 'both',
                  geometry: updatedPointGeometry,
                  center: newCenter,
                  polygon: currentPolygon,
                  hidePin: state.mapData?.hidePin || false,
                } : {
                  type: 'pin',
                  geometry: updatedPointGeometry,
                  center: newCenter,
                  hidePin: state.mapData?.hidePin || false,
                };
                
                dispatch({ type: 'SET_MAP_DATA', payload: updatedMapData });
              });

              mapInstance.flyTo({ center: [lng, lat], zoom: 14 });
            }

            // Load polygon if present
            if ((initialMapData.type === 'area' || initialMapData.type === 'both') && 
                (initialMapData.geometry.type === 'Polygon' || initialMapData.geometry.type === 'MultiPolygon' || initialMapData.polygon)) {
              const polygon = initialMapData.polygon || (initialMapData.geometry.type !== 'Point' ? initialMapData.geometry : null);
              
              if (polygon) {
              const sourceId = 'completed-area-source';
              const layerId = 'completed-area-layer';

              try {
                if (mapInstance.getLayer(`${layerId}-outline`)) {
                  mapInstance.removeLayer(`${layerId}-outline`);
                }
                if (mapInstance.getLayer(layerId)) {
                  mapInstance.removeLayer(layerId);
                }
                if (mapInstance.getSource(sourceId)) {
                  mapInstance.removeSource(sourceId);
                }
              } catch (e) {}

              mapInstance.addSource(sourceId, {
                type: 'geojson',
                data: {
                  type: 'Feature',
                    geometry: polygon,
                    properties: {},
                },
              });

              mapInstance.addLayer({
                id: layerId,
                type: 'fill',
                source: sourceId,
                paint: {
                  'fill-color': '#10b981',
                  'fill-opacity': 0.15,
                },
              });

              mapInstance.addLayer({
                id: `${layerId}-outline`,
                type: 'line',
                source: sourceId,
                paint: {
                  'line-color': '#10b981',
                  'line-width': 2,
                },
              });

              completedAreaSourceRef.current = sourceId;
              completedAreaLayerRef.current = layerId;

                if (polygon.type === 'Polygon' && polygon.coordinates[0]) {
                  const coords = polygon.coordinates[0];
                  const firstCoord = coords[0] as [number, number];
                const bounds = coords.reduce(
                    (bounds, coord) => bounds.extend([coord[0], coord[1]] as [number, number]),
                    new mapbox.LngLatBounds(firstCoord, firstCoord)
                );
                mapInstance.fitBounds(bounds, { padding: 50, duration: 1000 });
                }
              }
              }
            }

          // Set up drawing event handlers
          let pendingPolygonCompletion: GeoJSON.Polygon | null = null;

            mapInstance.on('click', async (e) => {
            // Handle pin placement - always active unless in drawing mode
            if (!state.isDrawing && drawInstance.getMode() !== 'draw_polygon') {
              const { lng, lat } = e.lngLat;

              // Update mapData - preserve polygon if it exists
              const currentPolygon = state.mapData?.polygon || (state.mapData?.type === 'area' || state.mapData?.type === 'both' ? state.mapData.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon : undefined);
              
              // Add pin to canvas
              addPinToCanvas(mapInstance, lng, lat, state.hidePin);

              // Setup dragging
              setupPinDragging(mapInstance, 'pin-source', async (newLng, newLat) => {
                const newCenter: [number, number] = [newLng, newLat];
                const updatedPointGeometry: GeoJSON.Point = {
                  type: 'Point',
                  coordinates: [newLng, newLat],
                };

                // Perform reverse geocoding when pin is dragged
                const addressData = await reverseGeocodeCoordinates(newLng, newLat, 'pin');

                const updatedMapData: PostMapData = currentPolygon ? {
                  type: 'both',
                  geometry: updatedPointGeometry,
                  center: newCenter,
                  polygon: currentPolygon,
                  hidePin: state.hidePin,
                  ...addressData,
                } : {
                  type: 'pin',
                  geometry: updatedPointGeometry,
                  center: newCenter,
                  hidePin: state.hidePin,
                  ...addressData,
                };
                
                dispatch({ type: 'SET_MAP_DATA', payload: updatedMapData });
              });

              // Update mapData with reverse geocoding
              const center: [number, number] = [lng, lat];
              const pointGeometry: GeoJSON.Point = {
                type: 'Point',
                coordinates: [lng, lat],
              };
              
              // Perform reverse geocoding
              const addressData = await reverseGeocodeCoordinates(lng, lat, 'pin');
              
              const newMapData: PostMapData = currentPolygon ? {
                type: 'both',
                geometry: pointGeometry,
                center,
                polygon: currentPolygon,
                hidePin: state.hidePin,
                ...addressData,
              } : {
                type: 'pin',
                geometry: pointGeometry,
                center,
                hidePin: state.hidePin,
                ...addressData,
              };
              
              dispatch({ type: 'SET_MAP_DATA', payload: newMapData });
            }
          });

          // Load initial polygon data if present
          if (initialMapData && (initialMapData.type === 'area' || initialMapData.type === 'both')) {
            const polygon = initialMapData.polygon || (initialMapData.geometry.type !== 'Point' ? initialMapData.geometry : null);
            
            if (polygon) {
              const sourceId = 'completed-area-source';
              const layerId = 'completed-area-layer';

              try {
                if (mapInstance.getLayer(`${layerId}-outline`)) {
                  mapInstance.removeLayer(`${layerId}-outline`);
                }
                if (mapInstance.getLayer(layerId)) {
                  mapInstance.removeLayer(layerId);
                }
                if (mapInstance.getSource(sourceId)) {
                  mapInstance.removeSource(sourceId);
                }
              } catch (e) {}

              mapInstance.addSource(sourceId, {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  geometry: polygon,
                  properties: {},
                },
              });

              mapInstance.addLayer({
                id: layerId,
                type: 'fill',
                source: sourceId,
                paint: {
                  'fill-color': '#10b981',
                  'fill-opacity': 0.15,
                },
              });

              mapInstance.addLayer({
                id: `${layerId}-outline`,
                type: 'line',
                source: sourceId,
                paint: {
                  'line-color': '#10b981',
                  'line-width': 2,
                },
              });

              completedAreaSourceRef.current = sourceId;
              completedAreaLayerRef.current = layerId;

              if (polygon.type === 'Polygon' && polygon.coordinates[0]) {
                const coords = polygon.coordinates[0];
                const firstCoord = coords[0] as [number, number];
                const bounds = coords.reduce(
                  (bounds, coord) => bounds.extend([coord[0], coord[1]] as [number, number]),
                  new mapbox.LngLatBounds(firstCoord, firstCoord)
                );
                mapInstance.fitBounds(bounds, { padding: 50, duration: 1000 });
              }
            }
          }

          // Drawing event handlers
            mapInstance.on('draw.create', async (e) => {
              // Only process if actively drawing
              if (!state.isDrawing) return;
              
              const features = drawInstance.getAll();
              if (features.features.length > 0) {
                const geometry = features.features[0].geometry;
                if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
                  // Calculate centroid for reverse geocoding
                  const centroid = calculatePolygonCentroid(geometry);
                  let addressData: Partial<PostMapData> = {};
                  
                  if (centroid) {
                    addressData = await reverseGeocodeCoordinates(centroid[0], centroid[1], 'polygon_centroid');
                  }
                  
                  // Preserve pin if it exists
                  const currentPin = state.mapData?.type === 'pin' || state.mapData?.type === 'both' ? state.mapData.geometry : undefined;
                  const currentCenter = state.mapData?.center;
                  
                  const newMapData: PostMapData = currentPin ? {
                    type: 'both',
                    geometry: currentPin as GeoJSON.Point,
                    center: currentCenter,
                    polygon: geometry,
                    hidePin: state.mapData?.hidePin || false,
                    ...addressData,
                  } : {
                    type: 'area',
                    geometry,
                    ...addressData,
                  };
                  
                  dispatch({ type: 'SET_MAP_DATA', payload: newMapData });
                  drawingStateMachineRef.current.completeDrawing();
                  dispatch({ type: 'SET_IS_DRAWING', payload: false });
                  dispatch({ type: 'SET_DRAWING_STATE', payload: 'completed' });
                  isDrawingRef.current = false;
                  drawInstance.changeMode('simple_select');
                  
                  // Reset cursor to default
                  if (mapInstance) {
                    mapInstance.getCanvas().style.cursor = '';
                  }
                }
              }
            });

            mapInstance.on('draw.update', (e) => {
              // Only process if actively drawing
              if (!state.isDrawing) return;
              
              const currentMode = drawInstance.getMode();
              const isActuallyDrawing = isDrawingRef.current && currentMode === 'draw_polygon';

              if (isActuallyDrawing) {
                // Debounce polygon updates during drawing (100ms)
                if (debouncedUpdateRef.current) {
                  clearTimeout(debouncedUpdateRef.current);
                }
                
                debouncedUpdateRef.current = setTimeout(async () => {
                  const features = drawInstance.getAll();
                  if (features.features.length > 0) {
                    const geometry = features.features[0].geometry;
                    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
                      // Calculate centroid for reverse geocoding
                      const centroid = calculatePolygonCentroid(geometry);
                      let addressData: Partial<PostMapData> = {};
                      
                      if (centroid) {
                        addressData = await reverseGeocodeCoordinates(centroid[0], centroid[1], 'polygon_centroid');
                      }
                      
                      // Preserve pin if it exists
                      const currentPin = state.mapData?.type === 'pin' || state.mapData?.type === 'both' ? state.mapData.geometry : undefined;
                      const currentCenter = state.mapData?.center;
                      
                      const newMapData: PostMapData = currentPin ? {
                        type: 'both',
                        geometry: currentPin as GeoJSON.Point,
                        center: currentCenter,
                        polygon: geometry,
                        hidePin: state.mapData?.hidePin || false,
                        ...addressData,
                      } : {
                        type: 'area',
                        geometry,
                        ...addressData,
                      };
                      
                      dispatch({ type: 'SET_MAP_DATA', payload: newMapData });
                    }
                  }
                }, 100);
              } else {
                const polygon = state.mapData?.polygon || (state.mapData?.type === 'area' || state.mapData?.type === 'both' ? state.mapData.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon : null);
                if (polygon) {
                  if (currentMode !== 'simple_select') {
                    drawInstance.changeMode('simple_select');
                  }
                  setTimeout(() => {
                    drawInstance.deleteAll();
                    if (completedAreaSourceRef.current && mapInstance.getSource(completedAreaSourceRef.current)) {
                      const source = mapInstance.getSource(completedAreaSourceRef.current);
                      if (source) {
                        source.setData({
                          type: 'Feature',
                          geometry: polygon,
                        });
                      }
                    }
                  }, 10);
                }
              }
            });

            mapInstance.on('draw.delete', () => {
              // Only process if actively drawing
              if (!state.isDrawing) return;
              
              // Only remove polygon, preserve pin if it exists
              if (state.mapData?.type === 'both' && state.mapData.geometry.type === 'Point') {
                const newMapData: PostMapData = {
                  type: 'pin',
                  geometry: state.mapData.geometry,
                  center: state.mapData.center,
                  hidePin: state.mapData.hidePin,
                };
                dispatch({ type: 'SET_MAP_DATA', payload: newMapData });
              } else {
                dispatch({ type: 'SET_MAP_DATA', payload: null });
              }
              drawingStateMachineRef.current.reset();
              dispatch({ type: 'SET_IS_DRAWING', payload: false });
              dispatch({ type: 'SET_DRAWING_STATE', payload: 'idle' });
              isDrawingRef.current = false;
              
              // Reset cursor to default
              if (mapInstance) {
                mapInstance.getCanvas().style.cursor = '';
              }
            });

            mapInstance.on('draw.modechange', (e: MapboxDrawEvent) => {
              // If not actively drawing, prevent entering draw mode
              if (!state.isDrawing && e.mode === 'draw_polygon') {
                drawInstance.changeMode('simple_select');
                return;
              }
              
              // Only process if actively drawing
              if (!state.isDrawing) return;
              
              const hasExistingPolygon = state.mapData?.type === 'area' || state.mapData?.type === 'both';
              if (state.mapData && hasExistingPolygon && !isDrawingRef.current) {
                if (e.mode === 'draw_polygon' || e.mode === 'direct_select') {
                  setTimeout(() => {
                    if (drawInstance.getMode() !== 'simple_select') {
                      drawInstance.changeMode('simple_select');
                    }
                  }, 10);
                  return;
                }
              }

              const drawing = e.mode === 'draw_polygon';
              isDrawingRef.current = drawing;
              dispatch({ type: 'SET_IS_DRAWING', payload: drawing });

              if (e.mode === 'simple_select' && pendingPolygonCompletion) {
                const polygon = pendingPolygonCompletion;
                pendingPolygonCompletion = null;

                setTimeout(() => {
                  drawInstance.deleteAll();

                  const sourceId = 'completed-area-source';
                  const layerId = 'completed-area-layer';

                  try {
                    if (mapInstance.getLayer(`${layerId}-outline`)) {
                      mapInstance.removeLayer(`${layerId}-outline`);
                    }
                    if (mapInstance.getLayer(layerId)) {
                      mapInstance.removeLayer(layerId);
                    }
                    if (mapInstance.getSource(sourceId)) {
                      mapInstance.removeSource(sourceId);
                    }
                  } catch (err) {}

                  mapInstance.addSource(sourceId, {
                    type: 'geojson',
                    data: {
                      type: 'Feature',
                      geometry: polygon,
                      properties: {},
                    },
                  });

                  mapInstance.addLayer({
                    id: layerId,
                    type: 'fill',
                    source: sourceId,
                    paint: {
                      'fill-color': '#10b981',
                      'fill-opacity': 0.15,
                    },
                  });

                  mapInstance.addLayer({
                    id: `${layerId}-outline`,
                    type: 'line',
                    source: sourceId,
                    paint: {
                      'line-color': '#10b981',
                      'line-width': 2,
                    },
                  });

                  completedAreaSourceRef.current = sourceId;
                  completedAreaLayerRef.current = layerId;

                  // Preserve pin if it exists
                  const currentPin = state.mapData?.type === 'pin' || state.mapData?.type === 'both' ? state.mapData.geometry : undefined;
                  const currentCenter = state.mapData?.center;
                  
                  const newMapData: PostMapData = currentPin ? {
                    type: 'both',
                    geometry: currentPin as GeoJSON.Point,
                    center: currentCenter,
                    polygon: polygon,
                    hidePin: state.mapData?.hidePin || false,
                  } : {
                    type: 'area',
                    geometry: polygon,
                  };
                  
                  dispatch({ type: 'SET_MAP_DATA', payload: newMapData });
                  drawingStateMachineRef.current.completeDrawing();
                  dispatch({ type: 'SET_DRAWING_STATE', payload: 'completed' });

                  if (drawInstance.getMode() !== 'simple_select') {
                    drawInstance.changeMode('simple_select');
                  }

                  setTimeout(() => {
                    if (drawInstance.getMode() !== 'simple_select') {
                      drawInstance.changeMode('simple_select');
                    }
                    isDrawingRef.current = false;
                    dispatch({ type: 'SET_IS_DRAWING', payload: false });
                  }, 50);
                }, 20);
              }

              if (e.mode === 'direct_select' && state.mapData && hasExistingPolygon && !isDrawingRef.current) {
                drawInstance.changeMode('simple_select');
              }
            });

            const handleKeyDown = (e: KeyboardEvent) => {
              // Only process if actively drawing
              if (!state.isDrawing) return;
              
              // Escape key: Cancel drawing and clear points
              if (e.key === 'Escape' && drawInstance) {
                e.preventDefault();
                e.stopPropagation();
                
                drawInstance.deleteAll();
                drawingStateMachineRef.current.reset();
                dispatch({ type: 'SET_IS_DRAWING', payload: false });
                dispatch({ type: 'SET_DRAWING_STATE', payload: 'idle' });
                isDrawingRef.current = false;
                drawInstance.changeMode('simple_select');
                
                // Restore polygon if it existed before starting to draw
                if (state.mapData?.type === 'both' && state.mapData.polygon) {
                  const restoredMapData: PostMapData = {
                    type: 'both',
                    geometry: state.mapData.geometry,
                    center: state.mapData.center,
                    polygon: state.mapData.polygon,
                    hidePin: state.mapData.hidePin,
                  };
                  dispatch({ type: 'SET_MAP_DATA', payload: restoredMapData });
                } else if (state.mapData?.type === 'area') {
                  dispatch({ type: 'SET_MAP_DATA', payload: null });
                }
                return;
              }
              
              // Enter key: Complete polygon
              if (e.key === 'Enter' && drawInstance) {
                const currentMode = drawInstance.getMode();
                if (currentMode === 'draw_polygon') {
                  e.preventDefault();
                  e.stopPropagation();

                  isDrawingRef.current = false;
                  dispatch({ type: 'SET_IS_DRAWING', payload: false });

                  const allFeatures = drawInstance.getAll();
                  if (allFeatures.features.length > 0) {
                    const currentFeature = allFeatures.features[0];
                    if (currentFeature && currentFeature.geometry.type === 'LineString') {
                      const coords = (currentFeature.geometry as GeoJSON.LineString).coordinates;
                      if (coords.length >= 3) {
                        const closedCoords = [...coords, coords[0]];
                        const polygon: GeoJSON.Polygon = {
                          type: 'Polygon',
                          coordinates: [closedCoords],
                        };

                        pendingPolygonCompletion = polygon;
                        drawInstance.deleteAll();

                        setTimeout(() => {
                          drawInstance.changeMode('simple_select');
                        }, 10);
                      } else {
                        drawInstance.deleteAll();
                        drawInstance.changeMode('simple_select');
                      }
                    } else {
                      drawInstance.deleteAll();
                      drawInstance.changeMode('simple_select');
                    }
                  } else {
                    drawInstance.changeMode('simple_select');
                  }
                }
              }
            };

            document.addEventListener('keydown', handleKeyDown);
            (mapInstance as MapboxMapInstance)._keyboardHandler = handleKeyDown;
        });

        map.current = mapInstance;
      } catch (error) {
        console.error('Error initializing map:', error);
        mapInitializedRef.current = false;
        initAttemptRef.current = false;
        dispatch({ type: 'SET_MAP_LOADED', payload: false });
      }
    };

    initMap();

    return () => {
      if (map.current) {
        const handler = (map.current as MapboxMapInstance)._keyboardHandler;
        if (handler) {
          document.removeEventListener('keydown', handler);
        }
        const observer = (map.current as MapboxMapInstance)._drawObserver;
        if (observer) {
          observer.disconnect();
        }
        map.current.remove();
        map.current = null;
      }
      if (draw.current) {
        draw.current = null;
      }
      if (debouncedUpdateRef.current) {
        clearTimeout(debouncedUpdateRef.current);
        debouncedUpdateRef.current = null;
      }
      mapInitializedRef.current = false;
      initAttemptRef.current = false;
      dispatch({ type: 'SET_MAP_LOADED', payload: false });
    };
  }, [isOpen]);

  // No longer need activeModesRef or handleModeToggle - pins are always active unless drawing

  const handleHidePinToggle = useCallback((hidden: boolean) => {
    dispatch({ type: 'SET_HIDE_PIN', payload: hidden });

    // Update pin visibility on canvas
    if (map.current && pinSourceIdRef.current) {
      updatePinVisibility(map.current, hidden);
    }

    if (state.mapData && (state.mapData.type === 'pin' || state.mapData.type === 'both')) {
      const updatedMapData: PostMapData = {
        ...state.mapData,
        hidePin: hidden,
      };
      dispatch({ type: 'SET_MAP_DATA', payload: updatedMapData });
    }
  }, [state.mapData, updatePinVisibility]);

  // Fallback screenshot creation
  const createFallbackScreenshot = useCallback((mapData: PostMapData): string => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    canvas.width = 400;
    canvas.height = 300;
    
    // Draw simple representation
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, 400, 300);
    
    // Draw border
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 400, 300);
    
    // Draw text
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Map Preview', 200, 130);
    
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#6b7280';
    
    if (mapData.type === 'pin' && mapData.center) {
      ctx.fillText(`Location: ${mapData.center[1].toFixed(4)}, ${mapData.center[0].toFixed(4)}`, 200, 160);
    } else if (mapData.type === 'area' || mapData.type === 'both') {
      ctx.fillText('Area Selected', 200, 160);
    }
    
    ctx.font = '12px sans-serif';
    ctx.fillText('Screenshot unavailable', 200, 180);
    
    return canvas.toDataURL('image/png', 0.9);
  }, []);

  // Screenshot capture function with error handling
  const captureMapScreenshot = useCallback(async (): Promise<string | null> => {
    if (!map.current) {
      // Return fallback if no map
      if (state.mapData) {
        return createFallbackScreenshot(state.mapData);
      }
      return null;
    }

    dispatch({ type: 'SET_IS_CAPTURING_SCREENSHOT', payload: true });

    try {
      // Wait for map to finish rendering
      await new Promise<void>((resolve) => {
        if (map.current?.loaded()) {
          resolve();
        } else {
          map.current?.once('idle', () => resolve());
        }
      });

      // Small delay to ensure everything is rendered
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      const canvas = map.current.getCanvas();
      if (!canvas) {
        throw new Error('Canvas not available');
      }

      // Check if canvas is valid
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Canvas has invalid dimensions');
      }

      const dataUrl = canvas.toDataURL('image/png', 0.9);
      
      // Validate data URL
      if (!dataUrl || dataUrl === 'data:,') {
        throw new Error('Invalid screenshot data');
      }
      
      dispatch({ type: 'SET_IS_CAPTURING_SCREENSHOT', payload: false });
      return dataUrl;
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      dispatch({ type: 'SET_IS_CAPTURING_SCREENSHOT', payload: false });
      
      // Return fallback screenshot
      if (state.mapData) {
        return createFallbackScreenshot(state.mapData);
      }
      return null;
    }
  }, [state.mapData, createFallbackScreenshot]);

  const handleStartDrawing = useCallback(() => {
    if (!draw.current || !map.current) return;
    
    // Check state machine before starting
    if (!drawingStateMachineRef.current.canStartDrawing()) {
      return;
    }

    draw.current.deleteAll();

    if (completedAreaLayerRef.current && map.current) {
      try {
        if (map.current.getLayer(`${completedAreaLayerRef.current}-outline`)) {
          map.current.removeLayer(`${completedAreaLayerRef.current}-outline`);
        }
        if (map.current.getLayer(completedAreaLayerRef.current)) {
          map.current.removeLayer(completedAreaLayerRef.current);
        }
        if (completedAreaSourceRef.current && map.current.getSource(completedAreaSourceRef.current)) {
          map.current.removeSource(completedAreaSourceRef.current);
        }
      } catch (e) {}
      completedAreaSourceRef.current = null;
      completedAreaLayerRef.current = null;
    }

    // Only clear polygon, preserve pin if it exists
    if (state.mapData?.type === 'both' && state.mapData.geometry.type === 'Point') {
      const newMapData: PostMapData = {
        type: 'pin',
        geometry: state.mapData.geometry,
        center: state.mapData.center,
        hidePin: state.mapData.hidePin,
      };
      dispatch({ type: 'SET_MAP_DATA', payload: newMapData });
    } else {
      dispatch({ type: 'SET_MAP_DATA', payload: null });
    }
    
    // Immediately switch to drawing mode
    draw.current.changeMode('draw_polygon');
    isDrawingRef.current = true;
    drawingStateMachineRef.current.startDrawing();
    dispatch({ type: 'SET_IS_DRAWING', payload: true });
    dispatch({ type: 'SET_DRAWING_STATE', payload: 'drawing' });
    
    // Change cursor to crosshair for drawing
    if (map.current) {
      map.current.getCanvas().style.cursor = 'crosshair';
    }
  }, [state.mapData]);

  const handleClear = useCallback(() => {
    // Remove pin from canvas
    if (map.current && pinSourceIdRef.current) {
      try {
        if (map.current.getLayer('pin-inner-layer')) map.current.removeLayer('pin-inner-layer');
        if (map.current.getLayer('pin-shadow-layer')) map.current.removeLayer('pin-shadow-layer');
        if (map.current.getLayer('pin-layer')) map.current.removeLayer('pin-layer');
        if (map.current.getSource(pinSourceIdRef.current)) map.current.removeSource(pinSourceIdRef.current);
      } catch (e) {}
      pinSourceIdRef.current = null;
    }
    
    if (draw.current) {
      draw.current.deleteAll();
      draw.current.changeMode('simple_select');
    }
    if (completedAreaLayerRef.current && map.current) {
      try {
        if (map.current.getLayer(`${completedAreaLayerRef.current}-outline`)) {
          map.current.removeLayer(`${completedAreaLayerRef.current}-outline`);
        }
        if (map.current.getLayer(completedAreaLayerRef.current)) {
          map.current.removeLayer(completedAreaLayerRef.current);
        }
        if (completedAreaSourceRef.current && map.current.getSource(completedAreaSourceRef.current)) {
          map.current.removeSource(completedAreaSourceRef.current);
        }
      } catch (e) {}
      completedAreaSourceRef.current = null;
      completedAreaLayerRef.current = null;
    }
    drawingStateMachineRef.current.reset();
    dispatch({ type: 'SET_MAP_DATA', payload: null });
    dispatch({ type: 'SET_IS_DRAWING', payload: false });
    dispatch({ type: 'SET_DRAWING_STATE', payload: 'idle' });
    isDrawingRef.current = false;
  }, []);

  const handleSave = useCallback(async () => {
    if (!state.mapData) {
      onSave(null);
      onClose();
      return;
    }

    // Capture screenshot before saving
    const mapDataWithScreenshot: PostMapData = { ...state.mapData };
    
    try {
      const screenshot = await captureMapScreenshot();
      if (screenshot) {
        mapDataWithScreenshot.screenshot = screenshot;
      }
    } catch (error) {
      console.error('Failed to capture screenshot, saving without it:', error);
      // Continue without screenshot if capture fails
    }
    
    onSave(mapDataWithScreenshot);
    onClose();
  }, [state.mapData, onSave, onClose, captureMapScreenshot]);

  const getDebugInfo = useCallback(() => {
    if (!state.mapData) return null;

    if (state.mapData.type === 'pin' && state.mapData.geometry.type === 'Point') {
      const [lng, lat] = state.mapData.geometry.coordinates;
      return {
        type: 'pin',
        lat: lat.toFixed(6),
        lng: lng.toFixed(6),
        coordinates: [lng.toFixed(6), lat.toFixed(6)],
        hidePin: state.mapData.hidePin || false,
      };
    }

    if (state.mapData.type === 'both') {
      const pin = state.mapData.geometry.type === 'Point' ? state.mapData.geometry : null;
      const polygon = state.mapData.polygon;
      
      let polygonPoints: number[][] | null = null;
      if (polygon) {
        if (polygon.type === 'Polygon' && polygon.coordinates[0]) {
          // Remove last point if it's a duplicate of the first (closed polygon)
          const coords = polygon.coordinates[0];
          const isClosed = coords.length > 0 && 
            coords[0][0] === coords[coords.length - 1][0] && 
            coords[0][1] === coords[coords.length - 1][1];
          polygonPoints = (isClosed ? coords.slice(0, -1) : coords).map(coord => [
            parseFloat(coord[0].toFixed(6)),
            parseFloat(coord[1].toFixed(6))
          ]);
        } else if (polygon.type === 'MultiPolygon') {
          // Flatten all polygons into a single array
          polygonPoints = polygon.coordinates.flatMap(poly => 
            poly[0]?.map(coord => [
              parseFloat(coord[0].toFixed(6)),
              parseFloat(coord[1].toFixed(6))
            ]) || []
          );
        }
      }
      
      return {
        type: 'both',
        pin: pin ? {
          lat: pin.coordinates[1].toFixed(6),
          lng: pin.coordinates[0].toFixed(6),
          coordinates: [parseFloat(pin.coordinates[0].toFixed(6)), parseFloat(pin.coordinates[1].toFixed(6))],
          hidePin: state.mapData.hidePin || false,
        } : null,
        polygon: polygon ? {
          points: polygon.type === 'Polygon' ? (polygon.coordinates[0]?.length || 0) - 1 : undefined,
          polygons: polygon.type === 'MultiPolygon' ? polygon.coordinates.length : undefined,
          coordinates: polygonPoints,
        } : null,
      };
    }

    if (state.mapData.type === 'area') {
      if (state.mapData.geometry.type === 'Polygon') {
        const coords = state.mapData.geometry.coordinates[0] || [];
        const isClosed = coords.length > 0 && 
          coords[0][0] === coords[coords.length - 1][0] && 
          coords[0][1] === coords[coords.length - 1][1];
        const polygonPoints = (isClosed ? coords.slice(0, -1) : coords).map(coord => [
          parseFloat(coord[0].toFixed(6)),
          parseFloat(coord[1].toFixed(6))
        ]);
        
        const pointCount = coords.length;
        const bounds = coords.reduce((acc, coord) => {
          return {
            minLng: Math.min(acc.minLng, coord[0]),
            maxLng: Math.max(acc.maxLng, coord[0]),
            minLat: Math.min(acc.minLat, coord[1]),
            maxLat: Math.max(acc.maxLat, coord[1]),
          };
        }, { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity });

        return {
          type: 'area',
          points: pointCount - 1,
          coordinates: polygonPoints,
          bounds: bounds.minLng !== Infinity ? {
            sw: `${bounds.minLat.toFixed(4)}, ${bounds.minLng.toFixed(4)}`,
            ne: `${bounds.maxLat.toFixed(4)}, ${bounds.maxLng.toFixed(4)}`,
          } : null,
        };
      }

      if (state.mapData.geometry.type === 'MultiPolygon') {
        const allPoints = state.mapData.geometry.coordinates.flatMap(poly => 
          poly[0]?.map(coord => [
            parseFloat(coord[0].toFixed(6)),
            parseFloat(coord[1].toFixed(6))
          ]) || []
        );
        const totalPoints = state.mapData.geometry.coordinates.reduce((sum, poly) => {
          return sum + (poly[0]?.length || 0) - 1;
        }, 0);
        return {
          type: 'area',
          polygons: state.mapData.geometry.coordinates.length,
          totalPoints,
          coordinates: allPoints,
        };
      }
    }

    return null;
  }, [state.mapData]);

  if (!isOpen) return null;

  const debugInfo = getDebugInfo();

  return (
    <div className="fixed inset-0 z-[150] bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-4xl h-[50vh] bg-white rounded-lg shadow-xl overflow-hidden">
        <div ref={mapContainer} className="w-full h-full absolute inset-0" />
        
        {!state.mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
            <div className="flex flex-col items-center gap-3 text-gray-500">
              <MapPinIcon className="w-8 h-8 animate-pulse text-gold-600" />
              <span className="text-sm font-medium">Loading map...</span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          disabled={state.isDrawing}
          className="absolute top-2 right-2 z-30 p-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors disabled:opacity-50"
          aria-label="Close"
        >
          <XMarkIcon className="w-4 h-4 text-gray-700" />
        </button>

        {/* Controls */}
          <div className="absolute top-2 left-2 z-30 px-2 py-1.5 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-md shadow-lg space-y-1.5">
          <div className="text-xs font-semibold text-gray-700 mb-1">Map Controls</div>
          
          {/* Search Input */}
          <div className="relative mb-1.5">
            <MagnifyingGlassIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => setShowSuggestions(suggestions.length > 0)}
              placeholder="Search location..."
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gold-500 focus:border-transparent"
            />
            {isSearching && (
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <div className="w-2.5 h-2.5 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-40 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto"
              >
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={suggestion.id || idx}
                    type="button"
                    onClick={() => handleSuggestionSelect(suggestion)}
                    className="w-full px-3 py-1.5 text-left hover:bg-gray-100 transition-colors border-b border-gray-100 last:border-b-0 text-sm"
                  >
                    <div className="font-medium text-gray-900">{suggestion.place_name}</div>
                    {suggestion.context && (
                      <div className="text-xs text-gray-500">
                        {suggestion.context
                          .filter((c: { id?: string }) => c.id?.startsWith('place.') || c.id?.startsWith('region.'))
                          .map((c: { text?: string }) => c.text)
                          .join(', ')}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {(state.mapData?.type === 'pin' || state.mapData?.type === 'both') && (
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer pt-1 border-t border-gray-200">
                  <input
                    type="checkbox"
                    checked={state.hidePin}
                    onChange={(e) => handleHidePinToggle(e.target.checked)}
                    className="w-3.5 h-3.5 text-gold-600 border-gray-300 rounded focus:ring-gold-500"
                  />
                  <span>Hide pin</span>
                </label>
            )}
          </div>

        {state.mapLoaded && !state.mapData && !state.isDrawing && (
          <div className="absolute top-12 left-1/2 transform -translate-x-1/2 z-20 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-md shadow-md border border-gray-200">
            <div className="flex items-center gap-1.5 text-xs text-gray-700">
              <MapPinIcon className="w-4 h-4 text-gold-600" />
              <span className="font-medium">Click map to place pin</span>
            </div>
          </div>
        )}

        {state.mapLoaded && state.isDrawing && (
          <div className="absolute top-12 left-1/2 transform -translate-x-1/2 z-20 bg-blue-50 border-2 border-blue-300 px-3 py-1.5 rounded-md shadow-md">
            <div className="text-xs text-blue-900">
              <div className="font-semibold mb-0.5 flex items-center gap-1.5">
                <PencilIcon className="w-3.5 h-3.5" />
                Drawing Area
              </div>
              <div className="text-blue-700">
                Click to add points • Press <kbd className="px-1 py-0.5 bg-blue-100 rounded text-xs font-mono">Enter</kbd> to finish • <kbd className="px-1 py-0.5 bg-blue-100 rounded text-xs font-mono">Esc</kbd> to cancel
              </div>
            </div>
          </div>
        )}

        {state.mapLoaded && (state.mapData?.type === 'area' || state.mapData?.type === 'both') && !state.isDrawing && (
          <div className="absolute top-12 left-1/2 transform -translate-x-1/2 z-20 bg-green-50 border border-green-300 px-3 py-1.5 rounded-md shadow-sm">
            <div className="text-xs text-green-800 font-medium flex items-center gap-1.5">
              <PencilIcon className="w-3 h-3" />
              Area Complete
            </div>
          </div>
        )}

        {debugInfo && (
          <div className="absolute top-20 right-4 z-30 bg-black/80 backdrop-blur-sm text-white text-xs font-mono px-3 py-2 rounded-lg shadow-lg max-w-xs">
            <div className="space-y-1">
              <div className="font-semibold text-gold-400 mb-1">Debug</div>
              {debugInfo.type === 'pin' && (
                <>
                  <div>Type: Pin</div>
                  <div>Lat: {debugInfo.lat}</div>
                  <div>Lng: {debugInfo.lng}</div>
                  {'coordinates' in debugInfo && debugInfo.coordinates && (
                    <div>Coordinates: [{debugInfo.coordinates.join(', ')}]</div>
                  )}
                  <div>Hide Pin: {debugInfo.hidePin ? 'Yes' : 'No'}</div>
                </>
              )}
              {debugInfo.type === 'both' && (
                <>
                  <div>Type: Both</div>
                  {debugInfo.pin && (
                    <>
                      <div>Pin Lat: {debugInfo.pin.lat}</div>
                      <div>Pin Lng: {debugInfo.pin.lng}</div>
                      <div>Pin Coordinates: [{debugInfo.pin.coordinates.join(', ')}]</div>
                      <div>Hide Pin: {debugInfo.pin.hidePin ? 'Yes' : 'No'}</div>
                    </>
                  )}
                  {debugInfo.polygon && (
                    <>
                      {debugInfo.polygon.points !== undefined && (
                        <div>Polygon Points: {debugInfo.polygon.points}</div>
                      )}
                      {debugInfo.polygon.polygons !== undefined && (
                        <div>Polygons: {debugInfo.polygon.polygons}</div>
                      )}
                      {debugInfo.polygon.coordinates && (
                        <div className="mt-1">
                          <div className="text-gold-400">Polygon Coordinates:</div>
                          <div className="text-xs max-h-32 overflow-y-auto">
                            {JSON.stringify(debugInfo.polygon.coordinates, null, 2)}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
              {debugInfo.type === 'area' && (
                <>
                  <div>Type: Area</div>
                  {debugInfo.points !== undefined && (
                    <div>Points: {debugInfo.points}</div>
                  )}
                  {debugInfo.polygons !== undefined && (
                    <>
                      <div>Polygons: {debugInfo.polygons}</div>
                      <div>Total Points: {debugInfo.totalPoints}</div>
                    </>
                  )}
                  {debugInfo.bounds && (
                    <>
                      <div>SW: {debugInfo.bounds.sw}</div>
                      <div>NE: {debugInfo.bounds.ne}</div>
                    </>
                  )}
                  {'coordinates' in debugInfo && debugInfo.coordinates && (
                    <div className="mt-1">
                      <div className="text-gold-400">Polygon Coordinates:</div>
                      <div className="text-xs max-h-32 overflow-y-auto">
                        {JSON.stringify(debugInfo.coordinates, null, 2)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className="absolute bottom-2 right-2 z-30 flex items-center gap-2">
          {!state.isDrawing && (
            <button
              type="button"
              onClick={handleStartDrawing}
              className="px-4 py-2 text-sm bg-gold-600 text-white rounded-lg hover:bg-gold-700 flex items-center gap-1.5 font-medium transition-all shadow-lg"
            >
              <PencilIcon className="w-4 h-4" />
              Start Drawing
            </button>
          )}

          {state.isDrawing && (
            <button
              type="button"
              onClick={() => {
                if (draw.current) {
                  draw.current.changeMode('simple_select');
                  draw.current.deleteAll();
                  isDrawingRef.current = false;
                  dispatch({ type: 'SET_IS_DRAWING', payload: false });
                  dispatch({ type: 'SET_MAP_DATA', payload: null });
                }
              }}
              className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-all shadow-lg"
            >
              Cancel
            </button>
          )}

          {state.mapData && (
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1.5 font-medium transition-all shadow-lg"
            >
              <XMarkIcon className="w-4 h-4" />
              Clear
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 font-medium bg-white/90 backdrop-blur-sm hover:bg-white rounded-lg transition-colors shadow-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!state.mapData || state.isCapturingScreenshot}
            className="px-4 py-2 text-sm bg-gold-500 text-black font-semibold rounded-lg hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center gap-2"
          >
            {state.isCapturingScreenshot ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Capturing...</span>
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
