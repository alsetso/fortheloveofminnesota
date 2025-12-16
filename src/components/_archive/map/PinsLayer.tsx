'use client';

import { useEffect, useRef } from 'react';
import { PublicMapPinService } from '@/features/_archive/map-pins/services/publicMapPinService';
import type { MapPin } from '@/types/map-pin';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface PinsLayerProps {
  map: MapboxMapInstance;
  mapLoaded: boolean;
}

/**
 * PinsLayer component manages Mapbox pin visualization
 * Handles fetching, formatting, and real-time updates
 */
export default function PinsLayer({ map, mapLoaded }: PinsLayerProps) {
  const sourceId = 'map-pins';
  const layerId = 'map-pins-clusters';
  const clusterCountLayerId = 'map-pins-cluster-count';
  const unclusteredPointLayerId = 'map-pins-unclustered-point';
  const unclusteredPointLabelLayerId = 'map-pins-unclustered-point-label';
  
  const pinsRef = useRef<MapPin[]>([]);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const isAddingLayersRef = useRef<boolean>(false);
  const popupRef = useRef<any>(null); // Mapbox Popup instance
  const clickHandlersAddedRef = useRef<boolean>(false);

  // Fetch pins and add to map
  useEffect(() => {
    if (!map || !mapLoaded) return;

    let mounted = true;

    const loadPins = async () => {
      // Prevent concurrent calls
      if (isAddingLayersRef.current) return;
      
      try {
        const pins = await PublicMapPinService.getPins();
        if (!mounted) return;

        pinsRef.current = pins;
        const geoJSON = PublicMapPinService.pinsToGeoJSON(pins);
        
        // Log for debugging
        if (process.env.NODE_ENV === 'development') {
          console.log('[PinsLayer] Loaded pins:', pins.length);
        }

        isAddingLayersRef.current = true;

        // Cast to actual Mapbox Map type for methods not in interface
        const mapboxMap = map as any;

        // Check if source already exists - if so, just update the data
        try {
          const existingSource = map.getSource(sourceId);
          if (existingSource && existingSource.type === 'geojson') {
            // Update existing source data (no flash)
            existingSource.setData(geoJSON);
            isAddingLayersRef.current = false;
            return;
          }
        } catch (e) {
          // Source check failed - map may be in invalid state, continue with adding source
          if (process.env.NODE_ENV === 'development') {
            console.warn('[PinsLayer] Error checking existing source:', e);
          }
        }

        // Source doesn't exist - need to add source and layers
        // First, clean up any existing layers (shouldn't exist if source doesn't, but be safe)
        try {
          if (mapboxMap.getLayer(unclusteredPointLabelLayerId)) {
            mapboxMap.removeLayer(unclusteredPointLabelLayerId);
          }
          if (mapboxMap.getLayer(unclusteredPointLayerId)) {
            mapboxMap.removeLayer(unclusteredPointLayerId);
          }
          if (mapboxMap.getLayer(clusterCountLayerId)) {
            mapboxMap.removeLayer(clusterCountLayerId);
          }
          if (mapboxMap.getLayer(layerId)) {
            mapboxMap.removeLayer(layerId);
          }
          if (mapboxMap.getSource(sourceId)) {
            mapboxMap.removeSource(sourceId);
          }
        } catch (e) {
          // Source or layers may already be removed (e.g., during style change)
          // This is expected and safe to ignore
        }

        // Add source
        mapboxMap.addSource(sourceId, {
          type: 'geojson',
          data: geoJSON,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
        });

        // Add cluster circles
        mapboxMap.addLayer({
          id: layerId,
          type: 'circle',
          source: sourceId,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              '#51bbd6',
              10,
              '#f1f075',
              30,
              '#f28cb1',
            ],
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              20,
              10,
              30,
              30,
              40,
            ],
          },
        });

        // Add cluster count labels
        mapboxMap.addLayer({
          id: clusterCountLayerId,
          type: 'symbol',
          source: sourceId,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12,
          },
        });

        // Load pin icon image
        const pinImageId = 'map-pin-icon';
        
        // Check if image already exists
        if (!mapboxMap.hasImage(pinImageId)) {
          try {
            // Create an Image element and wait for it to load
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = '/map_pin.svg';
            });
            
            // Create a canvas to resize the image to 8x8
            const canvas = document.createElement('canvas');
            canvas.width = 8;
            canvas.height = 8;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              // Use high-quality image smoothing
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              
              // Draw the image scaled to 8x8 (SVG is already oriented correctly with tip down)
              ctx.drawImage(img, 0, 0, 8, 8);
              
              // Get ImageData and add to map
              const imageData = ctx.getImageData(0, 0, 8, 8);
              mapboxMap.addImage(pinImageId, imageData);
            }
          } catch (error) {
            console.error('[PinsLayer] Failed to load pin icon:', error);
            // Fallback: continue without icon (will show as missing image)
          }
        }

        // Add unclustered points as pin icons
        map.addLayer({
          id: unclusteredPointLayerId,
          type: 'symbol',
          source: sourceId,
          filter: ['!', ['has', 'point_count']],
          layout: {
            'icon-image': pinImageId,
            'icon-size': 1, // Image is already sized to 8px
            'icon-anchor': 'top', // Use 'top' anchor if SVG tip is at top
            'icon-allow-overlap': true,
          },
        });

        // Add labels for unclustered points (positioned above pin icon)
        mapboxMap.addLayer({
          id: unclusteredPointLabelLayerId,
          type: 'symbol',
          source: sourceId,
          filter: ['!', ['has', 'point_count']],
          layout: {
            'text-field': [
              'case',
              ['get', 'description'],
              ['get', 'description'],
              '📍',
            ],
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

        isAddingLayersRef.current = false;

        // Add click handlers for pin interactions (only once)
        if (!clickHandlersAddedRef.current) {
          const handlePinClick = async (e: any) => {
            if (!mounted) return;
            
            const features = mapboxMap.queryRenderedFeatures(e.point, {
              layers: [unclusteredPointLayerId, unclusteredPointLabelLayerId],
            });

            if (features.length === 0) return;

            const feature = features[0];
            const pinId = feature.properties?.id;
            
            if (!pinId) return;

            // Find the pin data
            const pin = pinsRef.current.find(p => p.id === pinId);
            if (!pin) return;

            // Fly to pin location
            const currentZoom = mapboxMap.getZoom();
            const targetZoom = Math.max(currentZoom, 14); // Ensure we zoom in at least to level 14
            
            mapboxMap.flyTo({
              center: [pin.lng, pin.lat],
              zoom: targetZoom,
              duration: 800,
              essential: true, // Animation is essential for accessibility
            });

            // Don't automatically open sidebar - only show popup
            // Sidebar will open when user clicks "See More" button

            // Helper functions
            const escapeHtml = (text: string | null): string => {
              if (!text) return '';
              const div = document.createElement('div');
              div.textContent = text;
              return div.innerHTML;
            };

            const formatDate = (dateString: string): string => {
              const date = new Date(dateString);
              const now = new Date();
              const diffMs = now.getTime() - date.getTime();
              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              
              if (diffDays === 0) {
                return 'Today';
              } else if (diffDays === 1) {
                return 'Yesterday';
              } else if (diffDays < 7) {
                return `${diffDays} days ago`;
              } else {
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
              }
            };

            const createPopupContent = (viewCount: number | null, isLoading: boolean = false) => {
              const accountInfo = pin.account ? `
                <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0;">
                  ${pin.account.image_url ? `
                    <img src="${escapeHtml(pin.account.image_url)}" alt="${escapeHtml(pin.account.username || 'User')}" style="width: 12px; height: 12px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />
                  ` : `
                    <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #f3f4f6; display: flex; align-items: center; justify-content: center; font-size: 7px; color: #6b7280; flex-shrink: 0; font-weight: 500;">
                      ${escapeHtml((pin.account.username || 'U')[0].toUpperCase())}
                    </div>
                  `}
                  <div style="font-size: 12px; color: #111827; font-weight: 500; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${escapeHtml(pin.account.username || 'Unknown User')}
                  </div>
                </div>
              ` : '';

              const viewCountDisplay = isLoading ? `
                <div style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6b7280;">
                  <div style="width: 12px; height: 12px; border: 2px solid #e5e7eb; border-top-color: #6b7280; border-radius: 50%; animation: spin 0.6s linear infinite; flex-shrink: 0;"></div>
                  <style>
                    @keyframes spin {
                      to { transform: rotate(360deg); }
                    }
                  </style>
                </div>
              ` : viewCount !== null && viewCount > 0 ? `
                <div style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6b7280;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  <span>${viewCount.toLocaleString()}</span>
                </div>
              ` : '';

              return `
                <div class="map-pin-popup-content" style="min-width: 200px; max-width: 280px; padding: 10px; background: white; border: 1px solid #e5e7eb; border-radius: 6px;">
                  <!-- Header with account info and close button -->
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    ${accountInfo || '<div></div>'}
                    <button class="mapboxgl-popup-close-button" style="width: 16px; height: 16px; padding: 0; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 14px; line-height: 1; flex-shrink: 0; transition: color 0.15s;" onmouseover="this.style.color='#111827'" onmouseout="this.style.color='#6b7280'" aria-label="Close popup">×</button>
                  </div>
                  
                  <!-- Content -->
                  <div style="margin-bottom: 8px;">
                    ${pin.description ? `
                      <div style="font-size: 12px; color: #374151; line-height: 1.5; margin-bottom: ${pin.media_url ? '8px' : '0'}; word-wrap: break-word;">
                        ${escapeHtml(pin.description)}
                      </div>
                    ` : ''}
                    ${pin.media_url ? `
                      <div style="margin-top: ${pin.description ? '8px' : '0'};">
                        ${pin.media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? `
                          <img src="${escapeHtml(pin.media_url)}" alt="Pin media" style="width: 100%; border-radius: 4px; max-height: 120px; object-fit: cover; display: block;" />
                        ` : pin.media_url.match(/\.(mp4|webm|ogg)$/i) ? `
                          <video src="${escapeHtml(pin.media_url)}" controls style="width: 100%; border-radius: 4px; max-height: 120px; display: block;" />
                        ` : ''}
                      </div>
                    ` : ''}
                  </div>
                  
                  <!-- Footer with date, view count, and See More button -->
                  <div style="padding-top: 8px; border-top: 1px solid #e5e7eb;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                      <div style="font-size: 12px; color: #6b7280;">
                        ${formatDate(pin.created_at)}
                      </div>
                      ${viewCountDisplay}
                    </div>
                    <button class="pin-see-more-button" data-pin-id="${pin.id}" data-pin-lat="${pin.lat}" data-pin-lng="${pin.lng}" style="width: 100%; padding: 6px 12px; font-size: 12px; font-weight: 500; color: #111827; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.background='#e5e7eb'; this.style.borderColor='#d1d5db';" onmouseout="this.style.background='#f3f4f6'; this.style.borderColor='#e5e7eb';">See More</button>
                  </div>
                </div>
              `;
            };

            // Remove existing popup
            if (popupRef.current) {
              popupRef.current.remove();
            }

            // Create popup immediately with loading state
            const mapbox = await import('mapbox-gl');
            popupRef.current = new mapbox.default.Popup({
              offset: 25,
              closeButton: false, // We're handling close button in the header
              closeOnClick: true,
              className: 'map-pin-popup',
              maxWidth: '280px',
              anchor: 'bottom',
            })
              .setLngLat([pin.lng, pin.lat])
              .setHTML(createPopupContent(null, true))
              .addTo(mapboxMap);

            // Add click handlers for close button and "See More" button after popup is added to DOM
            const setupPopupHandlers = () => {
              const popupElement = popupRef.current?.getElement();
              if (!popupElement) return;

              // Close button handler
              const closeButton = popupElement.querySelector('.mapboxgl-popup-close-button') as HTMLButtonElement;
              if (closeButton) {
                closeButton.addEventListener('click', (e: MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (popupRef.current) {
                    popupRef.current.remove();
                    popupRef.current = null;
                  }
                });
              }

              // "See More" button handler
              const seeMoreButton = popupElement.querySelector('.pin-see-more-button') as HTMLButtonElement;
              if (seeMoreButton) {
                seeMoreButton.addEventListener('click', (e: MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const pinId = seeMoreButton.getAttribute('data-pin-id');
                  
                  if (pinId && pin) {
                    // Dispatch event to open sidebar with pin details
                    window.dispatchEvent(new CustomEvent('open-pin-sidebar', {
                      detail: {
                        pin: {
                          id: pin.id,
                          name: pin.description || 'Unnamed Pin',
                          description: pin.description,
                          media_url: pin.media_url,
                          address: null, // Will be reverse geocoded in LocationSidebar
                          coordinates: { lat: pin.lat, lng: pin.lng },
                          created_at: pin.created_at,
                          view_count: pin.view_count || null,
                          account: pin.account ? {
                            id: pin.account.id,
                            username: pin.account.username,
                            image_url: pin.account.image_url,
                          } : null,
                        },
                        flyToLocation: true,
                      },
                    }));
                  }
                  
                  // Close popup
                  if (popupRef.current) {
                    popupRef.current.remove();
                    popupRef.current = null;
                  }
                });
              }
            };

            setTimeout(setupPopupHandlers, 0);

            // Cleanup popup ref when it closes
            popupRef.current.on('close', () => {
              popupRef.current = null;
            });

            // Track pin view and fetch updated count asynchronously
            (async () => {
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

              let viewCount: number | null = null;
              try {
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
                  // Dispatch event to notify sidebar to refetch stats
                  window.dispatchEvent(new CustomEvent('pin-view-tracked', {
                    detail: { pin_id: pin.id }
                  }));
                }

                // Fetch updated view count (includes the view we just tracked)
                const statsResponse = await fetch(`/api/analytics/pin-stats?pin_id=${pin.id}`);
                if (statsResponse.ok) {
                  const statsData = await statsResponse.json();
                  viewCount = statsData.stats?.total_views || 0;
                }
              } catch (error) {
                // Silently fail - use null as fallback (no view count shown)
                if (process.env.NODE_ENV === 'development') {
                  console.error('[PinsLayer] Failed to track/fetch pin view:', error);
                }
              }

              // Update popup content with view count (only if popup still exists)
              if (popupRef.current) {
                popupRef.current.setHTML(createPopupContent(viewCount, false));
                // Re-setup handlers after content update
                setTimeout(setupPopupHandlers, 0);
              }
            })();
          };

          // Add click handler to unclustered point layer
          // Cast to any for layer-specific event handlers (not in interface)
          (mapboxMap as any).on('click', unclusteredPointLayerId, handlePinClick);
          (mapboxMap as any).on('click', unclusteredPointLabelLayerId, handlePinClick);

          // Make pins cursor pointer
          (mapboxMap as any).on('mouseenter', unclusteredPointLayerId, () => {
            (mapboxMap as any).getCanvas().style.cursor = 'pointer';
          });
          (mapboxMap as any).on('mouseleave', unclusteredPointLayerId, () => {
            (mapboxMap as any).getCanvas().style.cursor = '';
          });

          clickHandlersAddedRef.current = true;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load map pins';
        console.error('[PinsLayer] Error loading map pins:', errorMessage, error);
        // Log full error details in development
        if (process.env.NODE_ENV === 'development') {
          console.error('[PinsLayer] Full error details:', {
            error,
            message: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
        isAddingLayersRef.current = false;
      }
    };

    loadPins();

    // Re-add pins when map style changes (e.g., switching to satellite)
    // 'styledata' fires when style loads, but we need to wait for it to be ready
    const handleStyleData = () => {
      if (!mounted) return;
      // Wait for next frame to ensure style is fully loaded
      requestAnimationFrame(() => {
        const mapboxMap = map as any;
        if (mounted && mapboxMap.isStyleLoaded()) {
          // Reset the flag and reload pins
          // Note: click handlers will be re-added when layers are recreated
          isAddingLayersRef.current = false;
          clickHandlersAddedRef.current = false;
          loadPins();
        }
      });
    };

    // Subscribe to style changes
    try {
      map.on('styledata', handleStyleData);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[PinsLayer] Error subscribing to styledata:', e);
      }
    }

    // Subscribe to real-time updates
    const subscription = PublicMapPinService.subscribeToPins((payload) => {
      if (!mounted) return;
      
      // Reload pins on any change
      loadPins();
    });

    subscriptionRef.current = subscription;

    return () => {
      mounted = false;
      
      // Unsubscribe from real-time updates
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      
      // Remove event listeners safely
      if (map && typeof map.off === 'function') {
        try {
          // Remove styledata listener
          map.off('styledata', handleStyleData);
        } catch (e) {
          // Event listener may not exist or map may be removed
          if (process.env.NODE_ENV === 'development') {
            console.warn('[PinsLayer] Error removing styledata listener:', e);
          }
        }
      }
      
      // Remove popup
      if (popupRef.current) {
        try {
          popupRef.current.remove();
        } catch (e) {
          // Popup may already be removed
        }
        popupRef.current = null;
      }
      
      // Cleanup layers and source - check if map exists and has required methods
      if (map && typeof map.getSource === 'function') {
        try {
          const mapboxMap = map as any;
          const existingSource = map.getSource(sourceId);
          
          if (existingSource) {
            // Remove layers in reverse order of creation
            if (typeof mapboxMap.getLayer === 'function') {
              try {
                if (mapboxMap.getLayer(unclusteredPointLabelLayerId)) {
                  mapboxMap.removeLayer(unclusteredPointLabelLayerId);
                }
              } catch (e) {
                // Layer may already be removed
              }
              
              try {
                if (mapboxMap.getLayer(unclusteredPointLayerId)) {
                  mapboxMap.removeLayer(unclusteredPointLayerId);
                }
              } catch (e) {
                // Layer may already be removed
              }
              
              try {
                if (mapboxMap.getLayer(clusterCountLayerId)) {
                  mapboxMap.removeLayer(clusterCountLayerId);
                }
              } catch (e) {
                // Layer may already be removed
              }
              
              try {
                if (mapboxMap.getLayer(layerId)) {
                  mapboxMap.removeLayer(layerId);
                }
              } catch (e) {
                // Layer may already be removed
              }
            }
            
            // Remove source
            if (typeof mapboxMap.removeSource === 'function') {
              try {
                mapboxMap.removeSource(sourceId);
              } catch (e) {
                // Source may already be removed
              }
            }
          }
        } catch (e) {
          // Map may be in an invalid state - ignore cleanup errors
          if (process.env.NODE_ENV === 'development') {
            console.warn('[PinsLayer] Error during cleanup:', e);
          }
        }
      }
      
      // Remove click handlers safely
      if (map && typeof (map as any).off === 'function') {
        const mapboxMap = map as any;
        try {
          mapboxMap.off('click', unclusteredPointLayerId);
          mapboxMap.off('click', unclusteredPointLabelLayerId);
          mapboxMap.off('mouseenter', unclusteredPointLayerId);
          mapboxMap.off('mouseleave', unclusteredPointLayerId);
        } catch (e) {
          // Handlers may not exist or map may be removed
        }
      }
    };
  }, [map, mapLoaded]);

  return null; // This component doesn't render anything
}
