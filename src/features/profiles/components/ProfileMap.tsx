'use client';

import { useEffect, useRef, useState } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import type { ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';

interface ProfileMapProps {
  pins: ProfilePin[];
  accountId: string;
  isOwnProfile: boolean;
  accountUsername?: string | null;
  accountImageUrl?: string | null;
  selectedCollectionId?: string | null;
  collections?: Collection[];
}

const SOURCE_ID = 'profile-mentions';
const LAYER_IDS = {
  points: 'profile-mentions-point',
  labels: 'profile-mentions-point-label',
} as const;

export default function ProfileMap({ 
  pins = [], 
  accountId, 
  isOwnProfile, 
  accountUsername, 
  accountImageUrl,
  selectedCollectionId = null,
  collections = [],
}: ProfileMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showCollectionToast, setShowCollectionToast] = useState(false);
  const [collectionToastData, setCollectionToastData] = useState<{ emoji: string; title: string; count: number } | null>(null);
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);
  const popupRef = useRef<any>(null);
  const clickHandlersAddedRef = useRef<boolean>(false);
  const pinsRef = useRef<ProfilePin[]>(pins);

  // Convert pins to GeoJSON
  const pinsToGeoJSON = (pins: ProfilePin[]) => {
    const features = pins.map((pin) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [pin.lng, pin.lat] as [number, number],
      },
      properties: {
        id: pin.id,
        description: pin.description || '',
      },
    }));

    return {
      type: 'FeatureCollection' as const,
      features,
    };
  };

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainer.current) return;

    let mounted = true;

    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      return;
    }

    const initMap = async () => {
      if (!mounted || !mapContainer.current) return;

      try {
        await import('mapbox-gl/dist/mapbox-gl.css');
        const mapbox = await loadMapboxGL();
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!mapContainer.current || !mounted) return;

        const mapInstance = new mapbox.Map({
          container: mapContainer.current,
          style: MAP_CONFIG.MAPBOX_STYLE,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
          maxZoom: MAP_CONFIG.MAX_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
        });

        mapInstanceRef.current = mapInstance as MapboxMapInstance;

        mapInstance.on('load', () => {
          if (mounted) {
            setMapLoaded(true);
            // Trigger resize after a short delay to ensure container is fully rendered
            setTimeout(() => {
              if (mapInstance && !(mapInstance as MapboxMapInstance)._removed) {
                mapInstance.resize();
              }
            }, 100);
          }
        });

        // Fit bounds to pins if available (only on initial load)
        if (pins.length > 0) {
          mapInstance.once('load', () => {
            if (!mounted) return;
            
            const lngs = pins.map((p) => p.lng);
            const lats = pins.map((p) => p.lat);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);

            mapInstance.fitBounds(
              [
                [minLng, minLat],
                [maxLng, maxLat],
              ],
              {
                padding: 50,
                maxZoom: 14,
              }
            );
          });
        }
      } catch (error) {
        console.error('[ProfileMap] Error initializing map:', error);
      }
    };

    initMap();

    return () => {
      mounted = false;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          // Map may already be removed
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle map resize when container size changes
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !mapContainer.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current && !(mapInstanceRef.current as MapboxMapInstance)._removed) {
        setTimeout(() => {
          if (mapInstanceRef.current && !(mapInstanceRef.current as MapboxMapInstance)._removed) {
            mapInstanceRef.current.resize();
          }
        }, 100);
      }
    });

    resizeObserver.observe(mapContainer.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [mapLoaded]);

  // Update pins ref when pins change
  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);

  // Add pins to map
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    const mapboxMap = mapInstanceRef.current as any;
    const geoJSON = pinsToGeoJSON(pins);

    const setupLayers = async () => {
      try {
        // Check if source already exists - if so, just update the data
        try {
          const existingSource = mapboxMap.getSource(SOURCE_ID);
          if (existingSource && existingSource.type === 'geojson') {
            // Update existing source data (no flash)
            existingSource.setData(geoJSON);
            return;
          }
        } catch (e) {
          // Source check failed - map may be in invalid state, continue with adding source
        }

        // Source doesn't exist - need to add source and layers
        // First, clean up any existing layers (shouldn't exist if source doesn't, but be safe)
        // IMPORTANT: Remove layers BEFORE removing source to avoid "source not found" errors
        try {
          // Remove layers first (they depend on the source)
          if (mapboxMap.getLayer(LAYER_IDS.labels)) {
            try {
              mapboxMap.removeLayer(LAYER_IDS.labels);
            } catch (e) {
              // Layer may already be removed or source missing - ignore
            }
          }
          if (mapboxMap.getLayer(LAYER_IDS.points)) {
            try {
              mapboxMap.removeLayer(LAYER_IDS.points);
            } catch (e) {
              // Layer may already be removed or source missing - ignore
            }
          }
          // Then remove source (only if it exists)
          if (mapboxMap.getSource(SOURCE_ID)) {
            try {
              mapboxMap.removeSource(SOURCE_ID);
            } catch (e) {
              // Source may already be removed - ignore
            }
          }
        } catch (e) {
          // Source or layers may already be removed (e.g., during style change)
          // This is expected and safe to ignore
        }

        // Add source (no clustering)
        // Ensure source doesn't already exist before adding
        try {
          if (!mapboxMap.getSource(SOURCE_ID)) {
            mapboxMap.addSource(SOURCE_ID, {
              type: 'geojson',
              data: geoJSON,
            });
          } else {
            // Source exists, just update data
            const existingSource = mapboxMap.getSource(SOURCE_ID) as any;
            if (existingSource && existingSource.setData) {
              existingSource.setData(geoJSON);
            }
          }
        } catch (e) {
          console.error('[ProfileMap] Error adding/updating source:', e);
          return;
        }

        // Load mention icon image
        const mentionImageId = 'profile-mention-icon';
        
        // Check if image already exists
        if (!mapboxMap.hasImage(mentionImageId)) {
          try {
            // Create an Image element and wait for it to load
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = '/heart.png';
            });
            
            // Create a canvas to resize the image to 64x64 for high quality
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              // Use high-quality image smoothing
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              
              // Draw the image scaled to 64x64
              ctx.drawImage(img, 0, 0, 64, 64);
              
              // Get ImageData and add to map with pixelRatio for retina displays
              const imageData = ctx.getImageData(0, 0, 64, 64);
              mapboxMap.addImage(mentionImageId, imageData, { pixelRatio: 2 });
            }
          } catch (error) {
            console.error('[ProfileMap] Failed to load mention icon:', error);
            // Fallback: continue without icon (will show as missing image)
          }
        }

        // Verify source exists before adding layers
        if (!mapboxMap.getSource(SOURCE_ID)) {
          console.error('[ProfileMap] Source does not exist before adding layer');
          return;
        }

        // Add points as mention icons with zoom-based sizing
        try {
          mapboxMap.addLayer({
            id: LAYER_IDS.points,
            type: 'symbol',
            source: SOURCE_ID,
            layout: {
              'icon-image': mentionImageId,
              'icon-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, 0.15,   // At zoom 0, size is 0.15 (small for overview)
                5, 0.25,   // At zoom 5, size is 0.25
                10, 0.4,   // At zoom 10, size is 0.4
                12, 0.5,   // At zoom 12, size is 0.5
                14, 0.65,  // At zoom 14, size is 0.65
                16, 0.8,   // At zoom 16, size is 0.8
                18, 1.0,   // At zoom 18, size is 1.0 (full size)
                20, 1.2,   // At zoom 20, size is 1.2 (larger when zoomed in)
              ],
              'icon-anchor': 'center',
              'icon-allow-overlap': true,
            },
          });
        } catch (e) {
          console.error('[ProfileMap] Error adding point layer:', e);
          return;
        }

        // Add labels for points (positioned above mention icon)
        try {
          mapboxMap.addLayer({
            id: LAYER_IDS.labels,
            type: 'symbol',
            source: SOURCE_ID,
            layout: {
              'text-field': [
                'case',
                ['has', 'description'],
                [
                  'case',
                  ['>', ['length', ['get', 'description']], 20],
                  ['concat', ['slice', ['get', 'description'], 0, 20], '...'],
                  ['get', 'description']
                ],
                '📍',
              ],
              'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
              'text-size': 12,
              'text-offset': [0, 1.2],
              'text-anchor': 'top',
            },
            paint: {
              'text-color': '#000000',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2,
              'text-halo-blur': 1,
            },
          });
        } catch (e) {
          console.error('[ProfileMap] Error adding label layer:', e);
          // Try to remove the point layer if label layer failed
          try {
            if (mapboxMap.getLayer(LAYER_IDS.points)) {
              mapboxMap.removeLayer(LAYER_IDS.points);
            }
          } catch (removeError) {
            // Ignore removal errors
          }
          return;
        }

        // Fit bounds to filtered pins when they change (if map is already loaded)
        if (pins.length > 0) {
          const lngs = pins.map((p) => p.lng);
          const lats = pins.map((p) => p.lat);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);

          if (minLng !== Infinity && maxLng !== -Infinity && minLat !== Infinity && maxLat !== -Infinity) {
            mapboxMap.fitBounds(
              [
                [minLng, minLat],
                [maxLng, maxLat],
              ],
              {
                padding: 50,
                maxZoom: 14,
                duration: 500,
              }
            );
          }
        }

        // Add click handlers for mention interactions (only once)
        if (!clickHandlersAddedRef.current) {
          const handleMentionClick = async (e: any) => {
            if (!mapboxMap || !e || !e.point || typeof e.point.x !== 'number' || typeof e.point.y !== 'number' || typeof mapboxMap.queryRenderedFeatures !== 'function') return;
            
            // Stop event propagation
            if (e.originalEvent) {
              e.originalEvent.stopPropagation();
            }
            
            const features = mapboxMap.queryRenderedFeatures(e.point, {
              layers: [LAYER_IDS.points, LAYER_IDS.labels],
            });

            if (features.length === 0) return;

            const feature = features[0];
            const mentionId = feature.properties?.id;
            
            if (!mentionId) return;

            // Find the pin data
            const pin = pinsRef.current.find(p => p.id === mentionId);
            if (!pin) return;

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

            const createPopupContent = (viewCount: number | null = null) => {
              const profileSlug = accountUsername;
              const profileUrl = profileSlug ? `/profile/${encodeURIComponent(profileSlug)}` : null;
              const displayName = accountUsername || 'User';
              
              return `
                <div class="map-mention-popup-content" style="min-width: 200px; max-width: 280px; padding: 10px; background: white; border-radius: 6px;">
                  <!-- Header with account info and close button -->
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px;">
                    <a href="${profileUrl || '#'}" style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; text-decoration: none; cursor: ${profileUrl ? 'pointer' : 'default'};" ${profileUrl ? '' : 'onclick="event.preventDefault()"'}>
                      ${accountImageUrl ? `
                        <img src="${escapeHtml(accountImageUrl)}" alt="${escapeHtml(displayName)}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid #e5e7eb;" />
                      ` : `
                        <div style="width: 20px; height: 20px; border-radius: 50%; background-color: #f3f4f6; border: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #6b7280; flex-shrink: 0; font-weight: 500;">
                          ${escapeHtml(displayName[0].toUpperCase())}
                        </div>
                      `}
                      <div style="display: flex; align-items: center; gap: 4px; overflow: hidden; min-width: 0;">
                        <span style="font-size: 13px; color: #111827; font-weight: 600; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: color 0.15s;" onmouseover="this.style.color='#2563eb'" onmouseout="this.style.color='#111827'">
                          ${escapeHtml(displayName)}
                        </span>
                      </div>
                    </a>
                    <button class="mapboxgl-popup-close-button" style="width: 16px; height: 16px; padding: 0; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 14px; line-height: 1; flex-shrink: 0; transition: color 0.15s;" onmouseover="this.style.color='#111827'" onmouseout="this.style.color='#6b7280'" aria-label="Close popup">×</button>
                  </div>
                  
                  <!-- Content -->
                  <div style="margin-bottom: 8px;">
                    ${pin.description ? `
                      <div style="font-size: 12px; color: #374151; line-height: 1.5; word-wrap: break-word;">
                        ${escapeHtml(pin.description)}
                      </div>
                    ` : ''}
                  </div>
                  
                  <!-- Footer with date and view count -->
                  <div style="padding-top: 8px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                      <div style="font-size: 12px; color: #6b7280;">
                        ${formatDate(pin.created_at)}
                      </div>
                      ${viewCount !== null ? `
                        <div style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6b7280;">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                          <span>${viewCount}</span>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                </div>
              `;
            };

            // Remove existing popup
            if (popupRef.current) {
              popupRef.current.remove();
            }

            // Track mention view (only for non-owners)
            if (!isOwnProfile) {
              const trackMentionView = () => {
                const referrer = typeof document !== 'undefined' ? document.referrer : null;
                const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
                
                let deviceId: string | null = null;
                if (typeof window !== 'undefined') {
                  deviceId = localStorage.getItem('analytics_device_id');
                  if (!deviceId) {
                    deviceId = crypto.randomUUID();
                    localStorage.setItem('analytics_device_id', deviceId);
                  }
                }

                fetch('/api/analytics/pin-view', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    pin_id: pin.id,
                    referrer_url: referrer || null,
                    user_agent: userAgent || null,
                    session_id: deviceId,
                  }),
                  keepalive: true,
                }).catch((error) => {
                  if (process.env.NODE_ENV === 'development') {
                    console.error('[ProfileMap] Failed to track mention view:', error);
                  }
                });
              };

              if ('requestIdleCallback' in window) {
                requestIdleCallback(trackMentionView, { timeout: 2000 });
              } else {
                setTimeout(trackMentionView, 1000);
              }
            }
            
            // Fetch view stats
            const fetchViewStats = async (): Promise<number | null> => {
              try {
                const response = await fetch(`/api/analytics/pin-stats?pin_id=${pin.id}`);
                if (!response.ok) return null;
                const data = await response.json();
                return data.stats?.total_views || 0;
              } catch (error) {
                if (process.env.NODE_ENV === 'development') {
                  console.error('[ProfileMap] Failed to fetch view stats:', error);
                }
                return null;
              }
            };

            // Create popup immediately (without view count initially)
            const mapbox = await import('mapbox-gl');
            popupRef.current = new mapbox.default.Popup({
              offset: 25,
              closeButton: false,
              closeOnClick: true,
              className: 'map-mention-popup',
              maxWidth: '280px',
              anchor: 'bottom',
            })
              .setLngLat([pin.lng, pin.lat])
              .setHTML(createPopupContent())
              .addTo(mapboxMap);

            // Add close button handler
            const setupPopupHandlers = () => {
              const popupElement = popupRef.current?.getElement();
              if (!popupElement) return;

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
            };

            setTimeout(setupPopupHandlers, 0);

            // Fetch and update view count
            const viewCount = await fetchViewStats();
            if (popupRef.current && viewCount !== null) {
              popupRef.current.setHTML(createPopupContent(viewCount));
              setTimeout(setupPopupHandlers, 0);
            }
          };

          // Add click handlers
          mapboxMap.on('click', LAYER_IDS.points, handleMentionClick);
          mapboxMap.on('click', LAYER_IDS.labels, handleMentionClick);
          
          // Add cursor styles
          mapboxMap.on('mouseenter', LAYER_IDS.points, () => {
            mapboxMap.getCanvas().style.cursor = 'pointer';
          });
          mapboxMap.on('mouseleave', LAYER_IDS.points, () => {
            mapboxMap.getCanvas().style.cursor = '';
          });
          mapboxMap.on('mouseenter', LAYER_IDS.labels, () => {
            mapboxMap.getCanvas().style.cursor = 'pointer';
          });
          mapboxMap.on('mouseleave', LAYER_IDS.labels, () => {
            mapboxMap.getCanvas().style.cursor = '';
          });

          clickHandlersAddedRef.current = true;
        }
      } catch (error) {
        console.error('[ProfileMap] Error setting up layers:', error);
      }
    };

    setupLayers();

    // Cleanup handlers on unmount
    return () => {
      if (mapInstanceRef.current && clickHandlersAddedRef.current) {
        const mapboxMap = mapInstanceRef.current as any;
        try {
          mapboxMap.off('click', LAYER_IDS.points);
          mapboxMap.off('click', LAYER_IDS.labels);
          mapboxMap.off('mouseenter', LAYER_IDS.points);
          mapboxMap.off('mouseleave', LAYER_IDS.points);
          mapboxMap.off('mouseenter', LAYER_IDS.labels);
          mapboxMap.off('mouseleave', LAYER_IDS.labels);
        } catch (e) {
          // Handlers may not exist
        }
        clickHandlersAddedRef.current = false;
      }
      if (popupRef.current) {
        try {
          popupRef.current.remove();
        } catch (e) {
          // Popup may already be removed
        }
        popupRef.current = null;
      }
    };
  }, [mapLoaded, pins, accountId, isOwnProfile, accountUsername, accountImageUrl]);

  // Show toast when a collection is selected (not on initial load)
  useEffect(() => {
    if (selectedCollectionId && collections.length > 0) {
      const collection = collections.find(c => c.id === selectedCollectionId);
      if (collection) {
        const count = pins.filter(pin => pin.collection_id === selectedCollectionId).length;
        setCollectionToastData({
          emoji: collection.emoji,
          title: collection.title,
          count,
        });
        setShowCollectionToast(true);
        
        // Auto-hide after 3 seconds
        const timer = setTimeout(() => {
          setShowCollectionToast(false);
        }, 3000);
        
        return () => clearTimeout(timer);
      }
    }
    setShowCollectionToast(false);
    return undefined;
  }, [selectedCollectionId, collections, pins]);

  return (
    <div className="relative w-full h-full bg-gray-100 overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      {/* Floating Collection Toast */}
      {showCollectionToast && collectionToastData && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-slate-500 text-white px-3 py-2 rounded-md shadow-lg border border-slate-400 flex items-center gap-2 text-xs">
          <span>{collectionToastData.emoji}</span>
          <span className="font-medium">{collectionToastData.title}</span>
          <span className="text-slate-200">
            {collectionToastData.count} mention{collectionToastData.count !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}


