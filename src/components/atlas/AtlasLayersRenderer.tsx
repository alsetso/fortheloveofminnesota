'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { supabase } from '@/lib/supabase';

interface AtlasLayer {
  id: string;
  name: string;
  icon: string;
  visible: boolean;
  count?: number;
}

interface AtlasLayersRendererProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  layers: AtlasLayer[];
  onLayerCountUpdate?: (layerId: string, count: number) => void;
  onToggleLayer?: (layerId: string) => void;
}

// Layer configuration with table names and styling
const layerConfig: Record<string, {
  table: string;
  emoji: string;
  color: string;
  selectFields: string;
}> = {
  cities: {
    table: 'cities',
    emoji: '🏙️',
    color: '#3b82f6', // blue
    selectFields: 'id, name, slug, lat, lng',
  },
  counties: {
    table: 'counties',
    emoji: '🗺️',
    color: '#8b5cf6', // purple
    selectFields: 'id, name, slug, polygon',
  },
  neighborhoods: {
    table: 'neighborhoods',
    emoji: '🏘️',
    color: '#f59e0b', // amber
    selectFields: 'id, name, slug, lat, lng',
  },
  schools: {
    table: 'schools',
    emoji: '🎓',
    color: '#10b981', // emerald
    selectFields: 'id, name, slug, lat, lng, school_type',
  },
  parks: {
    table: 'parks',
    emoji: '🌳',
    color: '#22c55e', // green
    selectFields: 'id, name, slug, lat, lng, park_type',
  },
  lakes: {
    table: 'lakes',
    emoji: '💧',
    color: '#06b6d4', // cyan
    selectFields: 'id, name, lat, lng',
  },
  watertowers: {
    table: 'watertowers',
    emoji: '🗼',
    color: '#6366f1', // indigo
    selectFields: 'id, name, slug, lat, lng',
  },
  cemeteries: {
    table: 'cemeteries',
    emoji: '🪦',
    color: '#64748b', // slate
    selectFields: 'id, name, slug, lat, lng',
  },
  golf_courses: {
    table: 'golf_courses',
    emoji: '⛳',
    color: '#16a34a', // green
    selectFields: 'id, name, slug, lat, lng, course_type',
  },
  hospitals: {
    table: 'hospitals',
    emoji: '🏥',
    color: '#dc2626', // red
    selectFields: 'id, name, slug, lat, lng, hospital_type',
  },
  airports: {
    table: 'airports',
    emoji: '✈️',
    color: '#0ea5e9', // sky
    selectFields: 'id, name, slug, lat, lng, airport_type, iata_code',
  },
  churches: {
    table: 'churches',
    emoji: '⛪',
    color: '#a855f7', // purple
    selectFields: 'id, name, slug, lat, lng, church_type, denomination',
  },
  municipals: {
    table: 'municipals',
    emoji: '🏛️',
    color: '#f97316', // orange
    selectFields: 'id, name, slug, lat, lng, municipal_type',
  },
  roads: {
    table: 'roads',
    emoji: '🛣️',
    color: '#ef4444', // red
    selectFields: 'id, name, slug, lat, lng, road_type, route_number, direction',
  },
};

// Emoji image size - must be consistent
const EMOJI_SIZE = 32;

export default function AtlasLayersRenderer({
  map,
  mapLoaded,
  layers,
  onLayerCountUpdate,
  onToggleLayer,
}: AtlasLayersRendererProps) {
  const loadedLayersRef = useRef<Set<string>>(new Set());
  const dataCache = useRef<Record<string, any[]>>({});
  const imagesAddedRef = useRef<Set<string>>(new Set());
  const styleChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHandlingStyleChangeRef = useRef<boolean>(false);

  // Create emoji ImageData for Mapbox (proper format)
  const createEmojiImageData = useCallback((emoji: string): ImageData | null => {
    if (typeof document === 'undefined') return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = EMOJI_SIZE;
    canvas.height = EMOJI_SIZE;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;
    
    // Clear canvas
    ctx.clearRect(0, 0, EMOJI_SIZE, EMOJI_SIZE);
    
    // Draw emoji
    ctx.font = `${EMOJI_SIZE * 0.75}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, EMOJI_SIZE / 2, EMOJI_SIZE / 2);
    
    // Get image data
    return ctx.getImageData(0, 0, EMOJI_SIZE, EMOJI_SIZE);
  }, []);

  // Convert data to GeoJSON
  const toGeoJSON = useCallback((data: any[], layerId: string) => {
    const config = layerConfig[layerId];
    
    // Filter out items without coordinates
    const validData = data.filter(item => {
      if (layerId === 'counties') {
        // Counties use polygon centroid
        return item.polygon;
      }
      return item.lat != null && item.lng != null;
    });

    return {
      type: 'FeatureCollection' as const,
      features: validData.map(item => {
        let coordinates: [number, number];
        
        if (layerId === 'counties' && item.polygon) {
          // Calculate centroid from polygon
          try {
            const coords = item.polygon.type === 'MultiPolygon' 
              ? item.polygon.coordinates[0][0] 
              : item.polygon.coordinates[0];
            const lngs = coords.map((c: number[]) => c[0]);
            const lats = coords.map((c: number[]) => c[1]);
            coordinates = [
              lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length,
              lats.reduce((a: number, b: number) => a + b, 0) / lats.length,
            ];
          } catch {
            return null;
          }
        } else {
          coordinates = [Number(item.lng), Number(item.lat)];
        }

        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates,
          },
          properties: {
            id: item.id,
            name: item.name,
            slug: item.slug,
            layerType: layerId,
            emoji: config.emoji,
            ...item,
          },
        };
      }).filter(Boolean),
    };
  }, []);

  // Fetch data for a layer
  const fetchLayerData = useCallback(async (layerId: string) => {
    const config = layerConfig[layerId];
    if (!config) return [];

    // Return cached data if available
    if (dataCache.current[layerId]) {
      return dataCache.current[layerId];
    }

    try {
      const { data, error } = await supabase
        .from(config.table)
        .select(config.selectFields);

      if (error) {
        console.error(`Error fetching ${layerId}:`, error);
        return [];
      }

      dataCache.current[layerId] = data || [];
      onLayerCountUpdate?.(layerId, data?.length || 0);
      return data || [];
    } catch (err) {
      console.error(`Error fetching ${layerId}:`, err);
      return [];
    }
  }, [onLayerCountUpdate]);

  // Add layer to map
  const addLayerToMap = useCallback(async (layerId: string) => {
    if (!map || !mapLoaded) return;
    
    const mapboxMap = map as any;
    const config = layerConfig[layerId];
    if (!config) return;

    const sourceId = `atlas-${layerId}`;
    const pointLayerId = `atlas-${layerId}-points`;
    const labelLayerId = `atlas-${layerId}-labels`;
    const imageId = `atlas-${layerId}-emoji`;

    // Check if already loaded
    if (loadedLayersRef.current.has(layerId)) {
      // Just show the layer
      try {
        if (mapboxMap.getLayer(pointLayerId)) {
          mapboxMap.setLayoutProperty(pointLayerId, 'visibility', 'visible');
        }
        if (mapboxMap.getLayer(labelLayerId)) {
          mapboxMap.setLayoutProperty(labelLayerId, 'visibility', 'visible');
        }
      } catch (e) {
        console.warn(`Error showing layer ${layerId}:`, e);
      }
      return;
    }

    // Fetch data
    const data = await fetchLayerData(layerId);
    if (data.length === 0) return;

    const geoJSON = toGeoJSON(data, layerId);
    
    // Update count to reflect only renderable features (those with coordinates)
    const renderableCount = geoJSON.features.length;
    if (renderableCount !== data.length) {
      onLayerCountUpdate?.(layerId, renderableCount);
      console.log(`${layerId}: ${renderableCount}/${data.length} have coordinates`);
    }

    try {
      // Add emoji image if not exists
      if (!mapboxMap.hasImage(imageId) && !imagesAddedRef.current.has(imageId)) {
        const imageData = createEmojiImageData(config.emoji);
        if (imageData) {
          mapboxMap.addImage(imageId, {
            width: EMOJI_SIZE,
            height: EMOJI_SIZE,
            data: imageData.data,
          });
          imagesAddedRef.current.add(imageId);
        }
      }

      // Add source if not exists
      if (!mapboxMap.getSource(sourceId)) {
        mapboxMap.addSource(sourceId, {
          type: 'geojson',
          data: geoJSON,
        });
      }

      // Add symbol layer for emoji markers
      if (!mapboxMap.getLayer(pointLayerId)) {
        mapboxMap.addLayer({
          id: pointLayerId,
          type: 'symbol',
          source: sourceId,
          layout: {
            'icon-image': imageId,
            'icon-size': 0.8,
            'icon-allow-overlap': true,
            'icon-ignore-placement': false,
          },
        });

        // Add click handler for this layer
        mapboxMap.on('click', pointLayerId, (e: any) => {
          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const properties = feature.properties;
            
            // Dispatch event with atlas entity details
            window.dispatchEvent(new CustomEvent('atlas-entity-click', {
              detail: {
                id: properties.id,
                name: properties.name,
                slug: properties.slug,
                layerType: properties.layerType,
                emoji: config.emoji,
                lat: feature.geometry.coordinates[1],
                lng: feature.geometry.coordinates[0],
                ...properties,
              }
            }));
          }
        });

        // Change cursor on hover
        mapboxMap.on('mouseenter', pointLayerId, () => {
          mapboxMap.getCanvas().style.cursor = 'pointer';
        });
        mapboxMap.on('mouseleave', pointLayerId, () => {
          mapboxMap.getCanvas().style.cursor = '';
        });
      }

      // Add label layer
      if (!mapboxMap.getLayer(labelLayerId)) {
        mapboxMap.addLayer({
          id: labelLayerId,
          type: 'symbol',
          source: sourceId,
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
            'text-size': 10,
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
            'text-max-width': 10,
            'text-optional': true,
          },
          paint: {
            'text-color': '#374151',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1,
          },
          minzoom: 10, // Only show labels when zoomed in
        });
      }

      loadedLayersRef.current.add(layerId);
    } catch (e) {
      console.error(`Error adding layer ${layerId}:`, e);
    }
  }, [map, mapLoaded, fetchLayerData, toGeoJSON, createEmojiImageData, onLayerCountUpdate]);

  // Remove/hide layer from map
  const hideLayerFromMap = useCallback((layerId: string) => {
    if (!map || !mapLoaded) return;
    
    const mapboxMap = map as any;
    const pointLayerId = `atlas-${layerId}-points`;
    const labelLayerId = `atlas-${layerId}-labels`;

    try {
      if (mapboxMap.getLayer(pointLayerId)) {
        mapboxMap.setLayoutProperty(pointLayerId, 'visibility', 'none');
      }
      if (mapboxMap.getLayer(labelLayerId)) {
        mapboxMap.setLayoutProperty(labelLayerId, 'visibility', 'none');
      }
    } catch (e) {
      console.warn(`Error hiding layer ${layerId}:`, e);
    }
  }, [map, mapLoaded]);

  // Refresh a specific layer (clear cache and re-fetch)
  const refreshLayer = useCallback(async (layerId: string) => {
    if (!map || !mapLoaded) return;
    
    const mapboxMap = map as any;
    const config = layerConfig[layerId];
    if (!config) return;

    const sourceId = `atlas-${layerId}`;

    // Clear cache for this layer
    delete dataCache.current[layerId];

    // Re-fetch data
    const data = await fetchLayerData(layerId);
    if (data.length === 0) return;

    const geoJSON = toGeoJSON(data, layerId);
    
    // Update count
    onLayerCountUpdate?.(layerId, geoJSON.features.length);

    // Update the source data if it exists
    try {
      const source = mapboxMap.getSource(sourceId);
      if (source) {
        source.setData(geoJSON);
        console.log(`[Atlas] Refreshed ${layerId} layer with ${geoJSON.features.length} features`);
      } else if (layers.find(l => l.id === layerId)?.visible) {
        // Source doesn't exist but layer should be visible - add it
        await addLayerToMap(layerId);
      }
    } catch (e) {
      console.error(`Error refreshing layer ${layerId}:`, e);
    }
  }, [map, mapLoaded, fetchLayerData, toGeoJSON, onLayerCountUpdate, layers, addLayerToMap]);

  // Listen for atlas layer refresh events
  useEffect(() => {
    const handleRefresh = (event: CustomEvent<{ layerId: string; autoEnable?: boolean }>) => {
      const { layerId, autoEnable } = event.detail;
      
      // If autoEnable is true and onToggleLayer is available, enable the layer first
      if (autoEnable && onToggleLayer) {
        const layer = layers.find(l => l.id === layerId);
        if (layer && !layer.visible) {
          onToggleLayer(layerId);
        }
      }
      
      refreshLayer(layerId);
    };

    window.addEventListener('atlas-layer-refresh', handleRefresh as EventListener);
    return () => {
      window.removeEventListener('atlas-layer-refresh', handleRefresh as EventListener);
    };
  }, [refreshLayer, layers, onToggleLayer]);

  // Sync layers with map based on visibility
  useEffect(() => {
    if (!map || !mapLoaded) return;

    layers.forEach(layer => {
      if (layer.visible) {
        addLayerToMap(layer.id);
      } else {
        hideLayerFromMap(layer.id);
      }
    });
  }, [map, mapLoaded, layers, addLayerToMap, hideLayerFromMap]);

  // Handle style changes - re-add layers when map style is swapped
  // 'styledata' fires multiple times during style change - debounce to handle only the final one
  useEffect(() => {
    if (!map || !mapLoaded) return;

    const mapboxMap = map as any;

    const handleStyleData = () => {
      // Clear any pending timeout to debounce multiple styledata events
      if (styleChangeTimeoutRef.current) {
        clearTimeout(styleChangeTimeoutRef.current);
      }
      
      // Debounce style change handling - wait 100ms after last styledata event
      styleChangeTimeoutRef.current = setTimeout(() => {
        if (!mapboxMap.isStyleLoaded()) return;
        
        // Check if any of our sources were removed by the style change
        const visibleLayers = layers.filter(l => l.visible);
        if (visibleLayers.length === 0) return;
        
        const firstVisibleLayer = visibleLayers[0];
        const sourceId = `atlas-${firstVisibleLayer.id}`;
        const sourceExists = !!mapboxMap.getSource(sourceId);
        
        // If our sources still exist, no need to re-add
        if (sourceExists && loadedLayersRef.current.has(firstVisibleLayer.id)) {
          return;
        }
        
        // Prevent concurrent re-initialization
        if (isHandlingStyleChangeRef.current) return;
        isHandlingStyleChangeRef.current = true;
        
        // Style change cleared all sources/layers/images - reset our tracking refs
        loadedLayersRef.current.clear();
        imagesAddedRef.current.clear();
        
        // Re-add all currently visible layers
        Promise.all(
          visibleLayers.map(layer => addLayerToMap(layer.id))
        ).finally(() => {
          isHandlingStyleChangeRef.current = false;
        });
      }, 100);
    };

    mapboxMap.on('styledata', handleStyleData);

    return () => {
      // Clear style change timeout
      if (styleChangeTimeoutRef.current) {
        clearTimeout(styleChangeTimeoutRef.current);
        styleChangeTimeoutRef.current = null;
      }
      
      try {
        mapboxMap.off('styledata', handleStyleData);
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [map, mapLoaded, layers, addLayerToMap]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!map || !mapLoaded) return;
      
      const mapboxMap = map as any;
      
      // Remove all atlas layers
      Object.keys(layerConfig).forEach(layerId => {
        const sourceId = `atlas-${layerId}`;
        const pointLayerId = `atlas-${layerId}-points`;
        const labelLayerId = `atlas-${layerId}-labels`;

        try {
          if (mapboxMap.getLayer(labelLayerId)) {
            mapboxMap.removeLayer(labelLayerId);
          }
          if (mapboxMap.getLayer(pointLayerId)) {
            mapboxMap.removeLayer(pointLayerId);
          }
          if (mapboxMap.getSource(sourceId)) {
            mapboxMap.removeSource(sourceId);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      });
    };
  }, [map, mapLoaded]);

  // This component doesn't render anything visible - it just manages map layers
  return null;
}

