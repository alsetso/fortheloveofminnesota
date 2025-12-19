'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { supabase } from '@/lib/supabase';
import type { ProfilePin } from '@/types/profile';
import { formatPinDate } from '@/types/profile';

interface ProfilePinsLayerProps {
  map: MapboxMapInstance;
  mapLoaded: boolean;
  pins: ProfilePin[];
  isOwnProfile: boolean;
  onPinDeleted?: (pinId: string) => void;
  onPopupOpen?: (pinId: string) => void;
  onPopupClose?: () => void;
  closePopup?: boolean;
}

const SOURCE_ID = 'profile-pins';
const LAYER_IDS = {
  points: 'profile-pins-point',
  labels: 'profile-pins-point-label',
} as const;
const PIN_IMAGE_ID = 'profile-pin-icon';
const PIN_PRIVATE_IMAGE_ID = 'profile-pin-private-icon';

export default function ProfilePinsLayer({ 
  map, 
  mapLoaded, 
  pins, 
  isOwnProfile, 
  onPinDeleted,
  onPopupOpen,
  onPopupClose,
  closePopup,
}: ProfilePinsLayerProps) {
  // Refs for current values (prevents stale closures)
  const pinsRef = useRef<ProfilePin[]>(pins);
  const isOwnProfileRef = useRef(isOwnProfile);
  const onPinDeletedRef = useRef(onPinDeleted);
  const onPopupOpenRef = useRef(onPopupOpen);
  const onPopupCloseRef = useRef(onPopupClose);
  
  // Update refs on each render
  pinsRef.current = pins;
  isOwnProfileRef.current = isOwnProfile;
  onPinDeletedRef.current = onPinDeleted;
  onPopupOpenRef.current = onPopupOpen;
  onPopupCloseRef.current = onPopupClose;

  // State refs
  const popupRef = useRef<any>(null);
  const clickHandlerRef = useRef<((e: any) => void) | null>(null);
  const initializedRef = useRef(false);
  const locationSelectedHandlerRef = useRef<(() => void) | null>(null);
  const styleChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHandlingStyleChangeRef = useRef<boolean>(false);

  // Close popup when parent signals
  useEffect(() => {
    if (closePopup && popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
      onPopupCloseRef.current?.();
    }
  }, [closePopup]);

  // Create a stable click handler that uses refs
  const handlePinClick = useCallback(async (e: any) => {
    const mapboxMap = map as any;
    if (!mapboxMap) return;

    const features = mapboxMap.queryRenderedFeatures(e.point, {
      layers: [LAYER_IDS.points, LAYER_IDS.labels],
    });

    if (features.length === 0) return;

    const feature = features[0];
    const pinId = feature.properties?.id;
    if (!pinId) return;

    const pin = pinsRef.current.find(p => p.id === pinId);
    if (!pin) {
      console.warn('[ProfilePinsLayer] Pin not found:', pinId);
      return;
    }

    // Fly to pin
    const currentZoom = mapboxMap.getZoom();
    mapboxMap.flyTo({
      center: [pin.lng, pin.lat],
      zoom: Math.max(currentZoom, 14),
      duration: 800,
      essential: true,
    });

    // Helper functions
    const escapeHtml = (text: string | null): string => {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    // Use shared formatPinDate utility
    const formatDate = formatPinDate;

    const isOwner = isOwnProfileRef.current;

    // Build popup HTML
    const popupContent = `
      <div class="map-pin-popup-content" style="min-width: 180px; max-width: 250px; padding: 10px; background: white; border: 1px solid #e5e7eb; border-radius: 6px; position: relative;">
        ${isOwner ? `
        <div style="position: absolute; top: 6px; right: 6px;">
          <button id="pin-menu-btn-${pin.id}" style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: none; background: transparent; cursor: pointer; border-radius: 4px; color: #6b7280;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2"></circle>
              <circle cx="12" cy="12" r="2"></circle>
              <circle cx="12" cy="19" r="2"></circle>
            </svg>
          </button>
          <div id="pin-menu-dropdown-${pin.id}" style="display: none; position: absolute; top: 28px; right: 0; min-width: 120px; background: white; border: 1px solid #e5e7eb; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 100; overflow: hidden;">
            <button id="pin-delete-btn-${pin.id}" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #dc2626; text-align: left;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Delete
            </button>
            <button id="pin-close-btn-${pin.id}" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #374151; text-align: left; border-top: 1px solid #e5e7eb;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              Close
            </button>
          </div>
        </div>
        ` : ''}
        ${pin.visibility === 'only_me' && isOwner ? `
          <div style="margin-bottom: 6px;${isOwner ? ' margin-right: 30px;' : ''}">
            <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; background: #f3f4f6; border-radius: 4px; font-size: 10px; color: #6b7280;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Private
            </span>
          </div>
        ` : ''}
        ${pin.description ? `<div style="font-size: 12px; color: #374151; line-height: 1.5; margin-bottom: 8px; word-wrap: break-word;${isOwner ? ' margin-right: 30px;' : ''}">${escapeHtml(pin.description)}</div>` : ''}
        ${pin.media_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? `<div style="margin-bottom: 8px;"><img src="${escapeHtml(pin.media_url)}" alt="Pin media" style="width: 100%; border-radius: 4px; max-height: 100px; object-fit: cover; display: block;" /></div>` : ''}
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #6b7280; padding-top: 6px; border-top: 1px solid #e5e7eb;">
          <span>${formatDate(pin.created_at)}</span>
          ${pin.view_count ? `<span style="display: flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>${pin.view_count}</span>` : ''}
        </div>
      </div>
    `;

    // Remove existing popup
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    // Dispatch event to notify any location sidebar to close location details
    window.dispatchEvent(new CustomEvent('pin-popup-opening', {
      detail: { pinId: pin.id }
    }));

    // Create popup
    const mapbox = await import('mapbox-gl');
    popupRef.current = new mapbox.default.Popup({
      offset: 25,
      closeButton: false,
      closeOnClick: false,
      className: 'map-pin-popup',
      maxWidth: '250px',
      anchor: 'bottom',
    })
      .setLngLat([pin.lng, pin.lat])
      .setHTML(popupContent)
      .addTo(mapboxMap);

    // Wire up popup event handlers
    setTimeout(() => {
      const menuBtn = document.getElementById(`pin-menu-btn-${pin.id}`);
      const dropdown = document.getElementById(`pin-menu-dropdown-${pin.id}`);
      const deleteBtn = document.getElementById(`pin-delete-btn-${pin.id}`);
      const closeBtn = document.getElementById(`pin-close-btn-${pin.id}`);

      menuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdown) {
          dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        }
      });

      deleteBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this pin? This cannot be undone.')) return;
        
        try {
          // Soft delete: set archived = true
          const { error } = await supabase
            .from('pins')
            .update({ archived: true })
            .eq('id', pin.id)
            .eq('archived', false); // Only archive pins that aren't already archived
          
          if (error) throw error;
          
          popupRef.current?.remove();
          popupRef.current = null;
          onPinDeletedRef.current?.(pin.id);
        } catch (err) {
          console.error('[ProfilePinsLayer] Delete failed:', err);
          alert('Failed to delete pin.');
        }
      });

      closeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        popupRef.current?.remove();
        popupRef.current = null;
      });

      // Close dropdown on outside click
      const closeDropdown = (e: MouseEvent) => {
        if (dropdown && !dropdown.contains(e.target as Node) && e.target !== menuBtn) {
          dropdown.style.display = 'none';
        }
      };
      document.addEventListener('click', closeDropdown, { once: true });
    }, 0);

    onPopupOpenRef.current?.(pin.id);

    popupRef.current.on('close', () => {
      popupRef.current = null;
      onPopupCloseRef.current?.();
    });
  }, [map]);

  // Main effect for pins layer
  useEffect(() => {
    if (!map || !mapLoaded) return;

    const mapboxMap = map as any;
    let mounted = true;

    const initializePinsLayer = async () => {
      if (!mapboxMap.isStyleLoaded()) {
        // Wait for style to load
        await new Promise<void>(resolve => {
          const checkStyle = () => {
            if (mapboxMap.isStyleLoaded()) {
              resolve();
            } else {
              requestAnimationFrame(checkStyle);
            }
          };
          checkStyle();
        });
      }

      if (!mounted) return;

      // Convert pins to GeoJSON
      const geoJSON = {
        type: 'FeatureCollection' as const,
        features: pins.map(pin => {
          return {
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [pin.lng, pin.lat] },
            properties: {
              id: pin.id,
              description: pin.description,
              media_url: pin.media_url,
              visibility: pin.visibility,
              view_count: pin.view_count,
              created_at: pin.created_at,
            },
          };
        }),
      };

      // Update existing source or create new one
      const existingSource = mapboxMap.getSource(SOURCE_ID);
      if (existingSource) {
        (existingSource as any).setData(geoJSON);
        return; // Layers and handlers already exist
      }

      // Only do full initialization once per component instance
      if (initializedRef.current) return;
      initializedRef.current = true;

      // Add source (with existence check for race conditions)
      if (!mapboxMap.getSource(SOURCE_ID)) {
        mapboxMap.addSource(SOURCE_ID, {
          type: 'geojson',
          data: geoJSON,
        });
      }

      // Load pin icons (public and private)
      const loadPinIcon = async (imageId: string, src: string) => {
        if (mapboxMap.hasImage(imageId)) return;
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = src;
          });
          
          const canvas = document.createElement('canvas');
          canvas.width = 32;
          canvas.height = 32;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, 32, 32);
            const imageData = ctx.getImageData(0, 0, 32, 32);
            
            // Double-check before adding (race condition protection)
            if (!mapboxMap.hasImage(imageId)) {
              mapboxMap.addImage(imageId, imageData, { pixelRatio: 2 });
            }
          }
        } catch (error) {
          // Ignore "image already exists" errors
          if (!(error instanceof Error && error.message.includes('already exists'))) {
            console.error(`[ProfilePinsLayer] Failed to load pin icon ${imageId}:`, error);
          }
        }
      };

      await Promise.all([
        loadPinIcon(PIN_IMAGE_ID, '/map_pin.svg'),
        loadPinIcon(PIN_PRIVATE_IMAGE_ID, '/map_pin_private.svg'),
      ]);

      // Add points layer with visibility-based icon selection
      if (!mapboxMap.getLayer(LAYER_IDS.points)) {
        mapboxMap.addLayer({
          id: LAYER_IDS.points,
          type: 'symbol',
          source: SOURCE_ID,
          layout: {
            'icon-image': [
              'case',
              ['==', ['get', 'visibility'], 'only_me'],
              PIN_PRIVATE_IMAGE_ID,
              PIN_IMAGE_ID,
            ],
            'icon-size': 0.8,
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
          },
        });
      }

      // Add labels layer
      if (!mapboxMap.getLayer(LAYER_IDS.labels)) {
        mapboxMap.addLayer({
          id: LAYER_IDS.labels,
          type: 'symbol',
          source: SOURCE_ID,
          layout: {
            'text-field': ['case', ['get', 'description'], ['get', 'description'], '📍'],
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12,
            'text-offset': [0, -2.5],
            'text-anchor': 'bottom',
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 2,
            'text-halo-blur': 1,
          },
        });
      }

      // Add click handlers (only once per component instance)
      if (!clickHandlerRef.current) {
        clickHandlerRef.current = handlePinClick;
        mapboxMap.on('click', LAYER_IDS.points, handlePinClick);
        mapboxMap.on('click', LAYER_IDS.labels, handlePinClick);
      }

      // Cursor handlers
      mapboxMap.on('mouseenter', LAYER_IDS.points, () => {
        mapboxMap.getCanvas().style.cursor = 'pointer';
      });
      mapboxMap.on('mouseleave', LAYER_IDS.points, () => {
        mapboxMap.getCanvas().style.cursor = '';
      });

      // Listen for location-selected-on-map event to close popup
      locationSelectedHandlerRef.current = () => {
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
          onPopupCloseRef.current?.();
        }
      };
      window.addEventListener('location-selected-on-map', locationSelectedHandlerRef.current);
    };

    initializePinsLayer();

    // Handle style changes (re-add layers after style reload)
    // 'styledata' fires multiple times during style change - debounce to handle only the final one
    const handleStyleData = () => {
      if (!mounted) return;
      
      // Clear any pending timeout to debounce multiple styledata events
      if (styleChangeTimeoutRef.current) {
        clearTimeout(styleChangeTimeoutRef.current);
      }
      
      // Debounce style change handling - wait 100ms after last styledata event
      styleChangeTimeoutRef.current = setTimeout(() => {
        if (!mounted) return;
        if (!mapboxMap.isStyleLoaded()) return;
        
        // Check if our source was removed by the style change
        const sourceExists = !!mapboxMap.getSource(SOURCE_ID);
        if (sourceExists) {
          // Source still exists, no need to re-add
          return;
        }
        
        // Prevent concurrent re-initialization
        if (isHandlingStyleChangeRef.current) return;
        isHandlingStyleChangeRef.current = true;
        
        // Style changed - layers are gone, need to reinitialize
        initializedRef.current = false;
        
        initializePinsLayer().finally(() => {
          isHandlingStyleChangeRef.current = false;
        });
      }, 100);
    };

    mapboxMap.on('styledata', handleStyleData);

    return () => {
      mounted = false;
      
      // Clear style change timeout
      if (styleChangeTimeoutRef.current) {
        clearTimeout(styleChangeTimeoutRef.current);
        styleChangeTimeoutRef.current = null;
      }
      
      // Remove window event listener
      if (locationSelectedHandlerRef.current) {
        window.removeEventListener('location-selected-on-map', locationSelectedHandlerRef.current);
        locationSelectedHandlerRef.current = null;
      }
      
      try {
        mapboxMap.off('styledata', handleStyleData);
        
        // Remove click handlers
        if (clickHandlerRef.current) {
          mapboxMap.off('click', LAYER_IDS.points, clickHandlerRef.current);
          mapboxMap.off('click', LAYER_IDS.labels, clickHandlerRef.current);
        }
        
        // Cleanup popup
        popupRef.current?.remove();
        popupRef.current = null;
        
        // Cleanup layers and source
        Object.values(LAYER_IDS).forEach(id => {
          if (mapboxMap.getLayer(id)) mapboxMap.removeLayer(id);
        });
        if (mapboxMap.getSource(SOURCE_ID)) {
          mapboxMap.removeSource(SOURCE_ID);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
      
      initializedRef.current = false;
    };
  }, [map, mapLoaded, pins, handlePinClick]);

  return null;
}
