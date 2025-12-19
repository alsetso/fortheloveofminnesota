'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
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
}: ProfilePinsLayerProps) {
  const searchParams = useSearchParams();
  
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
  const currentOpenPinIdRef = useRef<string | null>(null);
  const urlProcessedRef = useRef<string | null>(null);
  const isUpdatingUrlRef = useRef<boolean>(false);

  // Helper function to create popup HTML
  const createPopupHTML = useCallback((pin: ProfilePin, viewCount: number | null = null): string => {
    const escapeHtml = (text: string | null): string => {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    const formatDate = formatPinDate;
    const isOwner = isOwnProfileRef.current;

    return `
      <div class="map-pin-popup-content" style="min-width: 180px; max-width: 250px; padding: 10px; background: white; border: 1px solid #e5e7eb; border-radius: 6px; position: relative;">
        ${isOwner ? `
        <div style="position: absolute; top: 6px; right: 6px;">
          <button id="pin-menu-btn-${pin.id}" style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: none; background: transparent; cursor: pointer; border-radius: 4px; color: #6b7280; transition: all 0.15s;" onmouseover="this.style.background='#f3f4f6'; this.style.color='#111827';" onmouseout="this.style.background='transparent'; this.style.color='#6b7280';">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2"></circle>
              <circle cx="12" cy="12" r="2"></circle>
              <circle cx="12" cy="19" r="2"></circle>
            </svg>
          </button>
          <div id="pin-menu-dropdown-${pin.id}" style="display: none; position: absolute; top: 28px; right: 0; min-width: 120px; background: white; border: 1px solid #e5e7eb; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 100; overflow: hidden;">
            <button id="pin-delete-btn-${pin.id}" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #dc2626; text-align: left; transition: background 0.15s;" onmouseover="this.style.background='#fef2f2';" onmouseout="this.style.background='transparent';">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Delete
            </button>
            <button id="pin-close-btn-${pin.id}" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #374151; text-align: left; border-top: 1px solid #e5e7eb; transition: background 0.15s;" onmouseover="this.style.background='#f3f4f6';" onmouseout="this.style.background='transparent';">
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
          ${viewCount !== null ? `<span style="display: flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>${viewCount}</span>` : ''}
        </div>
      </div>
    `;
  }, []);

  // Helper function to clear URL params
  const clearUrlParams = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.has('sel') || url.searchParams.has('pinId')) {
      isUpdatingUrlRef.current = true;
      url.searchParams.delete('sel');
      url.searchParams.delete('pinId');
      window.history.replaceState({}, '', url.pathname + (url.search || ''));
      urlProcessedRef.current = null;
      // Reset flag after a brief delay
      setTimeout(() => {
        isUpdatingUrlRef.current = false;
      }, 100);
    }
  }, []);

  // Helper function to update URL params
  const updateUrlParams = useCallback((pinId: string) => {
    if (typeof window === 'undefined') return;
    isUpdatingUrlRef.current = true;
    const url = new URL(window.location.href);
    url.searchParams.set('sel', 'pin');
    url.searchParams.set('pinId', pinId);
    window.history.replaceState({}, '', url.pathname + url.search);
    urlProcessedRef.current = `pin-${pinId}`;
    // Reset flag after a longer delay to ensure URL effect doesn't interfere
    setTimeout(() => {
      isUpdatingUrlRef.current = false;
    }, 500);
  }, []);

  // Handle URL parameters on mount/change (for shareable links)
  useEffect(() => {
    if (!mapLoaded || !map || !clickHandlerRef.current) return;
    
    // Skip if we just updated the URL ourselves
    if (isUpdatingUrlRef.current) {
      return;
    }

    const sel = searchParams.get('sel');
    const pinId = searchParams.get('pinId');
    
    // Create unique key for this URL state
    const urlKey = `${sel}-${pinId}`;
    
    // Skip if we've already processed this exact URL state
    if (urlKey === urlProcessedRef.current) {
      return;
    }
    
    // Process pin selection from URL (for shareable links)
    if (sel === 'pin' && pinId) {
      // Don't reopen if already open for this pin
      if (currentOpenPinIdRef.current === pinId && popupRef.current) {
        urlProcessedRef.current = urlKey;
        return;
      }
      
      // Mark as processed before opening to prevent loops
      urlProcessedRef.current = urlKey;
      
      // Find pin and trigger click handler (which will open popup)
      const pin = pinsRef.current.find(p => p.id === pinId);
      if (pin && clickHandlerRef.current) {
        const mapboxMap = map as any;
        const mockEvent = {
          point: mapboxMap.project([pin.lng, pin.lat]),
        };
        // Trigger the click handler to open popup
        clickHandlerRef.current(mockEvent);
      }
    } else if (urlProcessedRef.current && (!sel || sel !== 'pin' || !pinId)) {
      // URL cleared - close popup if open
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
        currentOpenPinIdRef.current = null;
        onPopupCloseRef.current?.();
      }
      urlProcessedRef.current = null;
    }
  }, [mapLoaded, map, searchParams]);

  // Create stable click handler
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

    // Don't reopen if already open
    if (currentOpenPinIdRef.current === pinId && popupRef.current) {
      return;
    }

    // Close existing popup
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    // Mark as current pin
    currentOpenPinIdRef.current = pin.id;
    
    // Update URL (mark as processed immediately to prevent effect loop)
    updateUrlParams(pin.id);

    // Dispatch event to notify any location sidebar to close location details
    window.dispatchEvent(new CustomEvent('pin-popup-opening', {
      detail: { pinId: pin.id }
    }));

    // Fly to pin
    const currentZoom = mapboxMap.getZoom();
    const targetZoom = Math.max(currentZoom, 14);
    mapboxMap.flyTo({
      center: [pin.lng, pin.lat],
      zoom: targetZoom,
      duration: 800,
      essential: true,
    });

    // Create popup immediately (like homepage) - Mapbox handles positioning during flyTo
    const mapbox = await import('mapbox-gl');
    
    // Remove any existing popup first
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
    
    popupRef.current = new mapbox.default.Popup({
      offset: 25,
      closeButton: false,
      closeOnClick: false,
      className: 'map-pin-popup',
      maxWidth: '250px',
      anchor: 'bottom',
    })
      .setLngLat([pin.lng, pin.lat])
      .setHTML(createPopupHTML(pin, null))
      .addTo(mapboxMap);

    // Setup handlers immediately after popup is created
    setTimeout(() => {
      setupPopupHandlers(pin.id);
    }, 0);

    onPopupOpenRef.current?.(pin.id);

    // Handle popup close
    popupRef.current.on('close', () => {
      popupRef.current = null;
      currentOpenPinIdRef.current = null;
      onPopupCloseRef.current?.();
      
      // Clear URL when popup closes
      clearUrlParams();
    });

    // Setup popup handlers function (needs to be accessible in moveend callback)
    const setupPopupHandlers = (pinId: string) => {
      const menuBtn = document.getElementById(`pin-menu-btn-${pinId}`);
      const dropdown = document.getElementById(`pin-menu-dropdown-${pinId}`);
      const deleteBtn = document.getElementById(`pin-delete-btn-${pinId}`);
      const closeBtn = document.getElementById(`pin-close-btn-${pinId}`);

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
          const { error } = await supabase
            .from('pins')
            .update({ archived: true })
            .eq('id', pinId)
            .eq('archived', false);
          
          if (error) throw error;
          
          if (popupRef.current) {
            popupRef.current.remove();
            popupRef.current = null;
          }
          currentOpenPinIdRef.current = null;
          onPinDeletedRef.current?.(pinId);
          
          // Clear URL
          clearUrlParams();
        } catch (err) {
          console.error('[ProfilePinsLayer] Delete failed:', err);
          alert('Failed to delete pin.');
        }
      });

      closeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
        currentOpenPinIdRef.current = null;
        onPopupCloseRef.current?.();
        
        // Clear URL
        clearUrlParams();
      });

      // Close dropdown on outside click
      const closeDropdown = (e: MouseEvent) => {
        if (dropdown && !dropdown.contains(e.target as Node) && e.target !== menuBtn) {
          dropdown.style.display = 'none';
        }
      };
      document.addEventListener('click', closeDropdown, { once: true });
    };

    // Track pin view for non-owners (async, don't block popup)
    const isOwner = isOwnProfileRef.current;
    if (!isOwner) {
      (async () => {
        try {
          const referrer = typeof document !== 'undefined' ? document.referrer : null;
          const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
          let sessionId: string | null = null;
          if (typeof window !== 'undefined') {
            sessionId = sessionStorage.getItem('analytics_session_id');
            if (!sessionId) {
              sessionId = crypto.randomUUID();
              sessionStorage.setItem('analytics_session_id', sessionId);
            }
          }

          // Track the view
          const trackResponse = await fetch('/api/analytics/pin-view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pin_id: pin.id,
              referrer_url: referrer || null,
              user_agent: userAgent || null,
              session_id: sessionId,
            }),
            keepalive: true,
          });

          if (trackResponse.ok) {
            // Dispatch event to notify any components to refetch stats
            window.dispatchEvent(new CustomEvent('pin-view-tracked', {
              detail: { pin_id: pin.id }
            }));

            // Fetch updated view count
            const statsResponse = await fetch(`/api/analytics/pin-stats?pin_id=${pin.id}`);
            if (statsResponse.ok) {
              const statsData = await statsResponse.json();
              const viewCount = statsData.stats?.total_views || 0;
              
              // Update popup content with view count (only if popup still exists and is for this pin)
              if (popupRef.current && currentOpenPinIdRef.current === pin.id) {
                popupRef.current.setHTML(createPopupHTML(pin, viewCount));
                // Re-setup handlers after content update
                setTimeout(() => {
                  setupPopupHandlers(pin.id);
                }, 0);
              }
            }
          }
        } catch (error) {
          // Silently fail - don't break the page
          if (process.env.NODE_ENV === 'development') {
            console.error('[ProfilePinsLayer] Failed to track/fetch pin view:', error);
          }
        }
      })();
    }
  }, [map, createPopupHTML, updateUrlParams, clearUrlParams]);

  // Main effect for pins layer
  useEffect(() => {
    if (!map || !mapLoaded) return;

    const mapboxMap = map as any;
    let mounted = true;

    const initializePinsLayer = async () => {
      if (!mapboxMap.isStyleLoaded()) {
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
        return;
      }

      // Only do full initialization once per component instance
      if (initializedRef.current) return;
      initializedRef.current = true;

      // Add source
      if (!mapboxMap.getSource(SOURCE_ID)) {
        mapboxMap.addSource(SOURCE_ID, {
          type: 'geojson',
          data: geoJSON,
        });
      }

      // Load pin icons
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
            
            if (!mapboxMap.hasImage(imageId)) {
              mapboxMap.addImage(imageId, imageData, { pixelRatio: 2 });
            }
          }
        } catch (error) {
          if (!(error instanceof Error && error.message.includes('already exists'))) {
            console.error(`[ProfilePinsLayer] Failed to load pin icon ${imageId}:`, error);
          }
        }
      };

      await Promise.all([
        loadPinIcon(PIN_IMAGE_ID, '/map_pin.svg'),
        loadPinIcon(PIN_PRIVATE_IMAGE_ID, '/map_pin_private.svg'),
      ]);

      // Add points layer
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

      // Add click handlers (only once)
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
          currentOpenPinIdRef.current = null;
          onPopupCloseRef.current?.();
          clearUrlParams();
        }
      };
      window.addEventListener('location-selected-on-map', locationSelectedHandlerRef.current);
    };

    initializePinsLayer();

    // Handle style changes
    const handleStyleData = () => {
      if (!mounted) return;
      
      if (styleChangeTimeoutRef.current) {
        clearTimeout(styleChangeTimeoutRef.current);
      }
      
      styleChangeTimeoutRef.current = setTimeout(() => {
        if (!mounted) return;
        if (!mapboxMap.isStyleLoaded()) return;
        
        const sourceExists = !!mapboxMap.getSource(SOURCE_ID);
        if (sourceExists) return;
        
        if (isHandlingStyleChangeRef.current) return;
        isHandlingStyleChangeRef.current = true;
        
        initializedRef.current = false;
        
        initializePinsLayer().finally(() => {
          isHandlingStyleChangeRef.current = false;
        });
      }, 100);
    };

    mapboxMap.on('styledata', handleStyleData);

    return () => {
      mounted = false;
      
      if (styleChangeTimeoutRef.current) {
        clearTimeout(styleChangeTimeoutRef.current);
        styleChangeTimeoutRef.current = null;
      }
      
      if (locationSelectedHandlerRef.current) {
        window.removeEventListener('location-selected-on-map', locationSelectedHandlerRef.current);
        locationSelectedHandlerRef.current = null;
      }
      
      try {
        mapboxMap.off('styledata', handleStyleData);
        
        if (clickHandlerRef.current) {
          mapboxMap.off('click', LAYER_IDS.points, clickHandlerRef.current);
          mapboxMap.off('click', LAYER_IDS.labels, clickHandlerRef.current);
        }
        
        popupRef.current?.remove();
        popupRef.current = null;
        currentOpenPinIdRef.current = null;
        
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
  }, [map, mapLoaded, pins, handlePinClick, clearUrlParams]);

  return null;
}
