'use client';

import { useEffect, useRef } from 'react';
import { PublicMapPinService } from '@/features/map-pins/services/publicMapPinService';
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

        // Load MN Pin SVG as image
        const imageId = 'mn-pin-cluster';
        let imageLoaded = false;
        try {
          // Check if image already exists
          if (!mapboxMap.hasImage(imageId)) {
            const response = await fetch('/map_pin.svg');
            const svgText = await response.text();
            const blob = new Blob([svgText], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            
            await new Promise<void>((resolve, reject) => {
              const img = new Image();
              img.onload = () => {
                mapboxMap.addImage(imageId, img);
                URL.revokeObjectURL(url);
                imageLoaded = true;
                resolve();
              };
              img.onerror = reject;
              img.src = url;
            });
          } else {
            imageLoaded = true;
          }
        } catch (error) {
          console.error('[PinsLayer] Failed to load MN Pin SVG:', error);
        }

        // Add cluster pin icons (or fallback to circles)
        if (imageLoaded) {
          mapboxMap.addLayer({
            id: layerId,
            type: 'symbol',
            source: sourceId,
            filter: ['has', 'point_count'],
            layout: {
              'icon-image': imageId,
              'icon-size': [
                'step',
                ['get', 'point_count'],
                0.0185, // 20px / 1080px
                10,
                0.0278, // 30px / 1080px
                30,
                0.037, // 40px / 1080px
              ],
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            },
          });
        } else {
          // Fallback to circles if image failed to load
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
        }

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
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 1,
            'text-halo-blur': 1,
          },
        });

        // Add unclustered points
        map.addLayer({
          id: unclusteredPointLayerId,
          type: 'circle',
          source: sourceId,
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': '#3b82f6', // Default blue
            'circle-radius': 8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          },
        });

        // Add labels for unclustered points
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
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
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

            // Dispatch custom event to notify LocationSidebar about pin click
            // This allows the sidebar to show pin details and remove temporary pin
            const pinClickEvent = new CustomEvent('map-pin-click', {
              detail: {
                pin: {
                  id: pin.id,
                  name: pin.description || 'Unnamed Pin',
                  description: pin.description,
                  media_url: pin.media_url,
                  address: null, // Will be reverse geocoded in LocationSidebar
                  coordinates: { lat: pin.lat, lng: pin.lng },
                  created_at: pin.created_at,
                  account: pin.account ? {
                    id: pin.account.id,
                    username: pin.account.username,
                    image_url: pin.account.image_url,
                  } : null,
                },
              },
            });
            window.dispatchEvent(pinClickEvent);

            // Create popup content
            const escapeHtml = (text: string | null): string => {
              if (!text) return '';
              const div = document.createElement('div');
              div.textContent = text;
              return div.innerHTML;
            };

            // Format date nicely
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

            const accountInfo = pin.account ? `
              <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0;">
                ${pin.account.image_url ? `
                  <img src="${escapeHtml(pin.account.image_url)}" alt="${escapeHtml(pin.account.username || 'User')}" style="width: 16px; height: 16px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />
                ` : `
                  <div style="width: 16px; height: 16px; border-radius: 50%; background-color: #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #6b7280; flex-shrink: 0; font-weight: 500;">
                    ${escapeHtml((pin.account.username || 'U')[0].toUpperCase())}
                  </div>
                `}
                <div style="font-size: 11px; color: #111827; font-weight: 500; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${escapeHtml(pin.account.username || 'Unknown User')}
                </div>
              </div>
            ` : '';

            const popupContent = `
              <div class="map-pin-popup-content" style="min-width: 200px; max-width: 280px; padding: 0;">
                <!-- Header with account info and close button -->
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  ${accountInfo || '<div></div>'}
                  <button class="mapboxgl-popup-close-button" style="width: 16px; height: 16px; padding: 0; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 16px; line-height: 1; flex-shrink: 0; transition: color 0.15s;" onmouseover="this.style.color='#111827'" onmouseout="this.style.color='#6b7280'" aria-label="Close popup">×</button>
                </div>
                
                <!-- Content -->
                <div>
                  ${pin.description ? `
                    <div style="font-size: 12px; color: #111827; line-height: 1.4; margin-bottom: ${pin.media_url ? '8px' : '0'}; word-wrap: break-word;">
                      ${escapeHtml(pin.description)}
                    </div>
                  ` : ''}
                  ${pin.media_url ? `
                    <div style="margin-top: ${pin.description ? '8px' : '0'};">
                      ${pin.media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? `
                        <img src="${escapeHtml(pin.media_url)}" alt="Pin media" style="width: 100%; border-radius: 4px; max-height: 150px; object-fit: cover; display: block;" />
                      ` : pin.media_url.match(/\.(mp4|webm|ogg)$/i) ? `
                        <video src="${escapeHtml(pin.media_url)}" controls style="width: 100%; border-radius: 4px; max-height: 150px; display: block;" />
                      ` : ''}
                    </div>
                  ` : ''}
                </div>
                
                <!-- Footer with date -->
                <div>
                  <div style="font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${formatDate(pin.created_at)}
                  </div>
                </div>
              </div>
            `;

            // Remove existing popup
            if (popupRef.current) {
              popupRef.current.remove();
            }

            // Create new popup
            const mapbox = await import('mapbox-gl');
            popupRef.current = new mapbox.default.Popup({
              offset: 25,
              closeButton: false, // We're handling close button in the header
              closeOnClick: true,
              className: 'map-pin-popup',
              maxWidth: '280px',
            })
              .setLngLat([pin.lng, pin.lat])
              .setHTML(popupContent)
              .addTo(mapboxMap);

            // Add click handler for custom close button after popup is added to DOM
            setTimeout(() => {
              const popupElement = popupRef.current?.getElement();
              if (popupElement) {
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
              }
            }, 0);

            // Track pin view when popup opens
            fetch('/api/analytics/view', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                entity_type: 'map_pin',
                entity_id: pin.id,
              }),
            }).catch((error) => {
              // Silently fail - don't break the popup
              if (process.env.NODE_ENV === 'development') {
                console.error('[PinsLayer] Failed to track pin view:', error);
              }
            });

            // Cleanup popup ref when it closes
            popupRef.current.on('close', () => {
              popupRef.current = null;
            });
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
