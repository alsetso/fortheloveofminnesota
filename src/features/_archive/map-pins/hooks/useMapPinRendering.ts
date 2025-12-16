'use client';

import { useCallback, useRef, useEffect } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { MapPin } from '../services/mapPinService';

export interface UseMapPinRenderingOptions {
  map: MapboxMap | null;
  mapLoaded: boolean;
  addMarker: (id: string, coordinates: { lat: number; lng: number }, options?: { element?: HTMLElement; popupContent?: string }) => void;
  removeMarker: (id: string) => void;
  updateMarkerPopup: (id: string, popupContent: string) => void;
  onPinClick?: (pin: MapPin) => void;
}

export interface UseMapPinRenderingReturn {
  renderPins: (pins: MapPin[]) => void;
  clearAll: () => void;
}

/**
 * Simple hook for rendering pins on the map
 * Dead simple: remove all markers, add all pins at their exact coordinates
 */
export function useMapPinRendering({
  map,
  mapLoaded,
  addMarker,
  removeMarker,
  updateMarkerPopup,
  onPinClick,
}: UseMapPinRenderingOptions): UseMapPinRenderingReturn {
  const renderedPinIdsRef = useRef<Set<string>>(new Set());

  /**
   * Create pin marker element with 2000s style Google Maps pin icon
   */
  const createPinMarker = useCallback((pin: MapPin): HTMLElement => {
    const element = document.createElement('div');
    element.className = 'map-pin-marker';
    element.setAttribute('data-pin-id', pin.id);
    // Position pin so the bottom point (tip) aligns with coordinates
    // Since Mapbox Marker uses 'center' anchor by default, we offset upward by half height
    element.style.cssText = `
      width: 8px;
      height: 8px;
      cursor: pointer;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      transform: translateY(-50%);
    `;
    
    // Create img element for pin icon
    const img = document.createElement('img');
    img.src = '/map_pin.svg';
    img.alt = 'Map pin';
    img.style.cssText = `
      width: 8px;
      height: 8px;
      display: block;
      pointer-events: none;
    `;
    
    element.appendChild(img);
    
    if (onPinClick) {
      element.addEventListener('click', (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        onPinClick(pin);
      }, true); // Use capture phase to intercept early
    }
    
    return element;
  }, [onPinClick]);

  /**
   * Create popup content
   */
  const createPopupContent = useCallback((pin: MapPin): string => {
    const escapeHtml = (text: string): string => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };
    
    return `
      <div class="map-pin-popup">
        <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(pin.emoji || '📍')} ${escapeHtml(pin.name || 'Unnamed Pin')}</div>
        ${pin.description ? `<div style="font-size: 12px; margin-bottom: 4px;">${escapeHtml(pin.description)}</div>` : ''}
        ${pin.address ? `<div style="font-size: 11px; color: #666;">${escapeHtml(pin.address)}</div>` : ''}
      </div>
    `;
  }, []);

  /**
   * Render pins - simplest possible approach
   */
  const renderPins = useCallback((pins: MapPin[]) => {
    if (!mapLoaded || !map) return;
    
    // Filter valid pins
    const validPins = pins.filter(pin => {
      return pin.lat != null && pin.lng != null && 
             typeof pin.lat === 'number' && typeof pin.lng === 'number' &&
             !isNaN(pin.lat) && !isNaN(pin.lng) && isFinite(pin.lat) && isFinite(pin.lng);
    });
    
    // Get current marker IDs
    const currentMarkerIds = new Set(renderedPinIdsRef.current);
    const newMarkerIds = new Set<string>();
    
    // Remove all existing markers first (clean slate)
    currentMarkerIds.forEach((markerId) => {
      removeMarker(markerId);
    });
    renderedPinIdsRef.current.clear();
    
    // Add all pins at their exact coordinates
    validPins.forEach((pin) => {
      const pinId = `pin-${pin.id}`;
      newMarkerIds.add(pinId);
      
      const markerElement = createPinMarker(pin);
      const popupContent = createPopupContent(pin);
      
      addMarker(pinId, { lat: pin.lat!, lng: pin.lng! }, {
        element: markerElement,
        popupContent,
      });
    });
    
    // Update ref
    renderedPinIdsRef.current = newMarkerIds;
  }, [
    mapLoaded,
    map,
    addMarker,
    removeMarker,
    createPinMarker,
    createPopupContent,
  ]);

  /**
   * Clear all rendered markers
   */
  const clearAll = useCallback(() => {
    renderedPinIdsRef.current.forEach((markerId) => {
      removeMarker(markerId);
    });
    renderedPinIdsRef.current.clear();
  }, [removeMarker]);

  return {
    renderPins,
    clearAll,
  };
}
