'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Pin } from '@/features/pins/services/pinService';
import { Area } from '@/features/areas/services/areaService';
import type { Map as MapboxMap } from 'mapbox-gl';

export interface MapRenderingOptions {
  map: MapboxMap | null;
  mapLoaded: boolean;
  addMarker: (id: string, coordinates: { lat: number; lng: number }, options?: { element?: HTMLElement; color?: string; popupContent?: string }) => void;
  removeMarker: (id: string) => void;
  updateMarkerPopup: (id: string, popupContent: string) => void;
  createPinMarker?: (pin: Pin) => HTMLElement;
  createPinPopup?: (pin: Pin) => string;
  onPinClick?: (pin: Pin) => void;
  // Visibility filtering is now handled in useMapData, so no clientFilter needed
}

export interface UseMapRenderingReturn {
  renderPins: (pins: Pin[]) => void;
  renderAreas: (areas: Area[]) => void;
  clearAll: () => void;
  renderedPinIds: Set<string>;
}

/**
 * Unified hook for rendering pins and areas on the map
 * Prevents flashing by tracking rendered state and debouncing updates
 */
export function useMapRendering({
  map,
  mapLoaded,
  addMarker,
  removeMarker,
  updateMarkerPopup,
  createPinMarker,
  createPinPopup,
  onPinClick,
}: MapRenderingOptions): UseMapRenderingReturn {
  const renderedPinIdsRef = useRef<Set<string>>(new Set());
  const lastRenderedPinsKeyRef = useRef<string>('');
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  /**
   * Default pin marker creation
   */
  const defaultCreatePinMarker = useCallback((pin: Pin): HTMLElement => {
    const element = document.createElement('div');
    element.className = 'pin-marker';
    element.style.cssText = `
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: #EF4444;
      border: 2px solid #FFFFFF;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      cursor: pointer;
      display: block;
      position: relative;
      z-index: 1000;
    `;
    
    if (onPinClick) {
      element.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        onPinClick(pin);
      });
    }
    
    return element;
  }, [onPinClick]);
  
  /**
   * Default popup creation
   */
  const defaultCreatePinPopup = useCallback((pin: Pin): string => {
    const escapeHtml = (text: string): string => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };
    
    return `
      <div class="pin-popup">
        <div class="text-lg mb-1 font-bold text-white">${escapeHtml(pin.emoji || '📍')} ${escapeHtml(pin.name || 'Unnamed Pin')}</div>
        ${pin.description ? `<div class="text-sm text-white/80 mb-2">${escapeHtml(pin.description)}</div>` : ''}
        <div class="text-xs text-white/70 mb-3">${escapeHtml(pin.address || '')}</div>
      </div>
    `;
  }, []);
  
  /**
   * Render pins on map with debouncing to prevent flashing
   */
  const renderPins = useCallback((pins: Pin[]) => {
    if (!mapLoaded || !map) return;
    
    // Clear any pending render
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }
    
    // Debounce rendering to prevent rapid re-renders
    renderTimeoutRef.current = setTimeout(() => {
      // Pins are already filtered by visibility in useMapData
      // Just filter for valid coordinates
      const validPins = pins.filter(pin => {
        const lat = pin.lat;
        const lng = pin.lng ?? pin.long;
        return lat != null && lng != null && 
               typeof lat === 'number' && typeof lng === 'number' &&
               !isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng);
      });
      
      // Create stable key from pins to detect actual changes
      // Round coordinates to 6 decimal places (~0.1 meter precision) to prevent false positives
      const COORD_PRECISION = 6;
      const roundCoord = (n: number) => Math.round(n * Math.pow(10, COORD_PRECISION)) / Math.pow(10, COORD_PRECISION);
      
      const pinsKey = JSON.stringify(
        validPins.map(p => ({ 
          id: p.id, 
          lat: roundCoord(p.lat), 
          lng: roundCoord(p.lng ?? p.long) 
        }))
          .sort((a, b) => a.id.localeCompare(b.id))
      );
      
      // Skip if pins haven't actually changed
      if (pinsKey === lastRenderedPinsKeyRef.current) {
        return;
      }
      
      lastRenderedPinsKeyRef.current = pinsKey;
      
      const newMarkerIds = new Set<string>();
      const currentMarkerIds = renderedPinIdsRef.current;
      
      // First, identify which markers to keep, add, or remove
      validPins.forEach((pin) => {
        const pinId = `pin-${pin.id}`;
        newMarkerIds.add(pinId);
      });
      
      // Remove markers that are no longer needed (only if they're not in the new set)
      currentMarkerIds.forEach((markerId) => {
        if (!newMarkerIds.has(markerId)) {
          removeMarker(markerId);
        }
      });
      
      // Add or update markers - CRITICAL: Never recreate markers, only update popup
      validPins.forEach((pin) => {
        const pinId = `pin-${pin.id}`;
        const popupContent = createPinPopup ? createPinPopup(pin) : defaultCreatePinPopup(pin);
        
        if (currentMarkerIds.has(pinId)) {
          // Marker already exists - ONLY update popup, NEVER recreate element or coordinates
          // This preserves click handlers and prevents visual drift
          updateMarkerPopup(pinId, popupContent);
        } else {
          // Create new marker - only for pins that don't exist yet
          const markerElement = createPinMarker ? createPinMarker(pin) : defaultCreatePinMarker(pin);
          const pinLng = pin.lng ?? pin.long;
          if (pin.lat != null && pinLng != null) {
            // Pass element and popup - addMarker will handle coordinate precision
            addMarker(pinId, { lat: pin.lat, lng: pinLng }, {
              element: markerElement,
              popupContent,
            });
          }
        }
      });
      
      // Update the ref after all operations
      renderedPinIdsRef.current = newMarkerIds;
    }, 50); // 50ms debounce
  }, [
    mapLoaded,
    map,
    addMarker,
    removeMarker,
    updateMarkerPopup,
    createPinMarker,
    createPinPopup,
    defaultCreatePinMarker,
    defaultCreatePinPopup,
  ]);
  
  /**
   * Render areas on map (GeoJSON layers)
   */
  const renderAreas = useCallback((areas: Area[]) => {
    if (!mapLoaded || !map) return;
    
    try {
      if (areas.length > 0) {
        // Create GeoJSON FeatureCollection from areas
        const features = areas.map(area => ({
          type: 'Feature' as const,
          id: String(area.id),
          properties: {
            name: area.name,
            description: area.description,
            visibility: area.visibility,
            category: area.category || 'custom',
          },
          geometry: area.geometry,
        }));
        
        const geoJsonData: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features,
        };
        
        // Update or create source
        if (map.getSource('saved-areas')) {
          (map.getSource('saved-areas') as import('mapbox-gl').GeoJSONSource).setData(geoJsonData);
        } else {
          // Create source if it doesn't exist
          map.addSource('saved-areas', {
            type: 'geojson',
            data: geoJsonData,
            generateId: false,
          });
          
          // Add layers if they don't exist
          if (!map.getLayer('saved-areas-fill')) {
            map.addLayer({
              id: 'saved-areas-fill',
              type: 'fill',
              source: 'saved-areas',
              layout: {},
              paint: {
                'fill-color': '#D4AF37',
                'fill-opacity': [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false],
                  0.4,
                  0.2
                ],
              },
            });
          }
          
          if (!map.getLayer('saved-areas-outline')) {
            map.addLayer({
              id: 'saved-areas-outline',
              type: 'line',
              source: 'saved-areas',
              layout: {},
              paint: {
                'line-color': '#D4AF37',
                'line-width': 2,
              },
            });
          }
        }
      } else {
        // Remove layers and source if no areas
        if (map.getSource('saved-areas')) {
          if (map.getLayer('saved-areas-fill')) map.removeLayer('saved-areas-fill');
          if (map.getLayer('saved-areas-outline')) map.removeLayer('saved-areas-outline');
          if (map.getLayer('saved-areas-labels')) map.removeLayer('saved-areas-labels');
          map.removeSource('saved-areas');
        }
      }
    } catch (err) {
      console.error('Error rendering areas:', err);
    }
  }, [mapLoaded, map]);
  
  /**
   * Clear all rendered markers
   */
  const clearAll = useCallback(() => {
    renderedPinIdsRef.current.forEach((markerId) => {
      removeMarker(markerId);
    });
    renderedPinIdsRef.current.clear();
    lastRenderedPinsKeyRef.current = '';
    
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
      renderTimeoutRef.current = null;
    }
  }, [removeMarker]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    renderPins,
    renderAreas,
    clearAll,
    renderedPinIds: renderedPinIdsRef.current,
  };
}

