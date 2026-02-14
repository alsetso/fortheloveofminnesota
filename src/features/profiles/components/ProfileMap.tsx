'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import {
  mentionsLayerStyles,
  buildMentionsLabelLayout,
  buildMentionsLabelPaint,
} from '@/features/map/config/layerStyles';
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
  onPinSelect?: (pinId: string | null) => void;
  /** When true, map click on empty space calls onMapClick (for drop-pin flow). */
  dropPinMode?: boolean;
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  /** Called when map instance is ready (for temp pin marker). */
  onMapInstanceReady?: (map: MapboxMapInstance) => void;
  /** When set, fly to this pin and open its popup (e.g. from sidebar click). */
  focusPin?: ProfilePin | null;
  /** Incremented on each focus request; use in effect deps so same-pin reclick retriggers. */
  focusTrigger?: number;
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
  onPinSelect,
  dropPinMode = false,
  onMapClick,
  onMapInstanceReady,
  focusPin,
  focusTrigger = 0,
}: ProfileMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showCollectionToast, setShowCollectionToast] = useState(false);
  const [collectionToastData, setCollectionToastData] = useState<{ emoji: string; title: string; count: number } | null>(null);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(selectedCollectionId);
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);
  const popupRef = useRef<any>(null);
  const clickHandlersAddedRef = useRef<boolean>(false);
  const pinsRef = useRef<ProfilePin[]>(pins);
  const mapClickHandlerRef = useRef<((e: any) => void) | null>(null);

  // Convert pins to GeoJSON (includes mention_type for emoji icons)
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
        mention_type_id: pin.mention_type?.id || null,
        mention_type_emoji: pin.mention_type?.emoji || null,
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
          style: MAP_CONFIG.STRATEGIC_STYLES.streets,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
          minZoom: MAP_CONFIG.MIN_ZOOM_MN,
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
            onMapInstanceReady?.(mapInstance as MapboxMapInstance);
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

  // Sync selectedCollectionId from parent (sidebar) to local filter state
  useEffect(() => {
    setActiveCollectionId(selectedCollectionId ?? null);
  }, [selectedCollectionId]);

  // Listen for filter-by-collection event
  useEffect(() => {
    const handleFilterByCollection = (event: Event) => {
      const customEvent = event as CustomEvent<{ collectionId: string }>;
      const collectionId = customEvent.detail?.collectionId;
      if (collectionId) {
        setActiveCollectionId(collectionId);
      }
    };

    window.addEventListener('filter-by-collection', handleFilterByCollection);
    return () => {
      window.removeEventListener('filter-by-collection', handleFilterByCollection);
    };
  }, []);

  // Shared popup HTML generator (same format as /maps)
  const escapeHtml = useCallback((text: string | null): string => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }, []);

  const formatDate = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  }, []);

  const createPinPopupHtml = useCallback((pin: ProfilePin, vc: number | null = null) => {
    const profileUrl = accountUsername ? `/${encodeURIComponent(accountUsername)}` : null;
    const displayName = accountUsername || 'User';
    const description = pin.description ?? '';
    const descTruncated = description ? String(description).slice(0, 80) + (String(description).length > 80 ? '…' : '') : '';
    const imageUrl = pin.image_url ?? null;
    const typeEmoji = pin.mention_type?.emoji ?? null;
    const typeName = pin.mention_type?.name ?? null;
    const dateStr = formatDate(pin.created_at);
    const viewSlot = vc != null
      ? `<span style="font-size: 10px; color: #6b7280; display: flex; align-items: center; gap: 2px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${vc.toLocaleString()}</span>`
      : '';
    return `
    <div class="map-mention-popup-content" style="min-width: 220px; max-width: 280px; background: white; border-radius: 8px; overflow: hidden;">
      ${imageUrl ? `<a href="/mention/${escapeHtml(pin.id)}" style="display: block; width: 100%; height: 120px; overflow: hidden; background: #f3f4f6;"><img src="${escapeHtml(imageUrl)}" alt="" style="width: 100%; height: 100%; object-fit: cover;" /></a>` : ''}
      <div style="padding: ${imageUrl ? '8px' : '15px 8px 8px 8px'};">
        ${descTruncated ? `<p style="margin: 0 0 6px; font-size: 12px; color: #374151; line-height: 1.4;">${escapeHtml(descTruncated)}</p>` : ''}
        ${typeName ? `<div style="font-size: 11px; color: #6b7280;">${typeEmoji ? `<span style="margin-right: 4px;">${escapeHtml(String(typeEmoji))}</span>` : ''}<span>${escapeHtml(typeName)}</span></div>` : ''}
      </div>
      <div style="padding: 8px; border-top: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <a href="${profileUrl || '#'}" style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; text-decoration: none; color: inherit;" ${profileUrl ? '' : 'onclick="event.preventDefault()"'}>
          ${accountImageUrl ? `<img src="${escapeHtml(accountImageUrl)}" alt="" style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />` : `<div style="width: 18px; height: 18px; border-radius: 50%; background: #f3f4f6; flex-shrink: 0; font-size: 9px; color: #6b7280; display: flex; align-items: center; justify-content: center;">${escapeHtml((displayName[0] || '?').toUpperCase())}</div>`}
          <span style="font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(displayName)}</span>
        </a>
        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
          ${viewSlot}
          <span style="font-size: 10px; color: #6b7280;">${dateStr}</span>
          ${isOwnProfile ? `<a href="/mention/${escapeHtml(pin.id)}/edit" style="font-size: 11px; font-weight: 500; color: #2563eb;">Edit</a>` : ''}
          <a href="/mention/${escapeHtml(pin.id)}" style="font-size: 11px; font-weight: 500; color: #2563eb;">View</a>
        </div>
      </div>
    </div>
    `;
  }, [accountUsername, accountImageUrl, isOwnProfile, escapeHtml, formatDate]);

  // Track pin view (non-blocking, for non-owners only)
  const trackPinView = useCallback((pinId: string) => {
    if (isOwnProfile) return;
    const run = () => {
      let deviceId: string | null = null;
      if (typeof window !== 'undefined') {
        deviceId = localStorage.getItem('analytics_device_id');
        if (!deviceId) { deviceId = crypto.randomUUID(); localStorage.setItem('analytics_device_id', deviceId); }
      }
      fetch('/api/analytics/pin-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin_id: pinId,
          referrer_url: typeof document !== 'undefined' ? document.referrer : null,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          session_id: deviceId,
        }),
        keepalive: true,
      }).catch(() => {});
    };
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 2000 });
    else setTimeout(run, 1000);
  }, [isOwnProfile]);

  // When focusPin is set (e.g. from sidebar click), fly to it and open popup
  const showPopupForPin = useCallback(
    async (map: MapboxMapInstance & { _removed?: boolean }, pin: ProfilePin) => {
      if (popupRef.current) popupRef.current.remove();
      trackPinView(pin.id);
      let viewCount: number | null = null;
      try {
        const res = await fetch(`/api/analytics/pin-stats?pin_id=${pin.id}`);
        if (res.ok) { const data = await res.json(); viewCount = data.stats?.total_views ?? null; }
      } catch { /* ignore */ }
      const mapbox = await import('mapbox-gl');
      const popupContainer = mapWrapperRef.current || mapContainer.current?.parentElement || mapContainer.current;
      popupRef.current = new mapbox.default.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        className: 'map-mention-popup',
        maxWidth: '280px',
        anchor: 'bottom',
        ...(popupContainer ? { container: popupContainer } : {}),
      })
        .setLngLat([pin.lng, pin.lat])
        .setHTML(createPinPopupHtml(pin, viewCount))
        .addTo(map as any);
    },
    [createPinPopupHtml, trackPinView]
  );

  useEffect(() => {
    if (!focusPin || !mapLoaded || !mapInstanceRef.current || (mapInstanceRef.current as MapboxMapInstance & { _removed?: boolean })._removed) return;
    const map = mapInstanceRef.current as MapboxMapInstance & { _removed?: boolean };
    map.flyTo({
      center: [focusPin.lng, focusPin.lat],
      zoom: 14,
      duration: 600,
    });
    const run = async () => {
      await showPopupForPin(map, focusPin);
    };
    run();
  }, [focusPin?.id, focusTrigger, mapLoaded, showPopupForPin]);

  // Add pins to map
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    const mapboxMap = mapInstanceRef.current as any;
    
    // Filter pins by collection if one is selected
    const filteredPins = activeCollectionId 
      ? pins.filter(pin => pin.collection_id === activeCollectionId)
      : pins;
    
    const geoJSON = pinsToGeoJSON(filteredPins);

    const setupLayers = async () => {
      try {
        // Ensure map is still available and fully ready
        if (!mapInstanceRef.current) return;
        const currentMap = mapInstanceRef.current as any;
        
        // Check if map is fully loaded and style is ready
        if (!currentMap.loaded() || !currentMap.isStyleLoaded()) {
          // Map not ready yet, wait and retry
          setTimeout(() => {
            if (mapInstanceRef.current) {
              setupLayers();
            }
          }, 100);
          return;
        }
        // Check if source already exists - if so, just update the data
        try {
          const existingSource = currentMap.getSource(SOURCE_ID);
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
          if (currentMap.getLayer(LAYER_IDS.labels)) {
            try {
              currentMap.removeLayer(LAYER_IDS.labels);
            } catch (e) {
              // Layer may already be removed or source missing - ignore
            }
          }
          if (currentMap.getLayer(LAYER_IDS.points)) {
            try {
              currentMap.removeLayer(LAYER_IDS.points);
            } catch (e) {
              // Layer may already be removed or source missing - ignore
            }
          }
          // Then remove source (only if it exists)
          if (currentMap.getSource(SOURCE_ID)) {
            try {
              currentMap.removeSource(SOURCE_ID);
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
        let sourceAdded = false;
        try {
          const existingSource = currentMap.getSource(SOURCE_ID);
          if (existingSource && existingSource.type === 'geojson') {
            // Source exists and is valid, just update data
            const geojsonSource = existingSource as any;
            if (geojsonSource.setData) {
              geojsonSource.setData(geoJSON);
              sourceAdded = true;
            } else {
              // Source exists but doesn't have setData - remove and re-add
              try {
                if (currentMap.getLayer(LAYER_IDS.labels)) {
                  currentMap.removeLayer(LAYER_IDS.labels);
                }
                if (currentMap.getLayer(LAYER_IDS.points)) {
                  currentMap.removeLayer(LAYER_IDS.points);
                }
                currentMap.removeSource(SOURCE_ID);
              } catch (e) {
                // Ignore cleanup errors
              }
            }
          }
          
          if (!sourceAdded) {
            // Add new source
            currentMap.addSource(SOURCE_ID, {
              type: 'geojson',
              data: geoJSON,
            });
            sourceAdded = true;
          }
        } catch (e) {
          console.error('[ProfileMap] Error adding/updating source:', e);
          return;
        }

        // Verify source exists and is valid before proceeding
        const source = currentMap.getSource(SOURCE_ID);
        if (!source || source.type !== 'geojson') {
          console.error('[ProfileMap] Source does not exist or is invalid before adding layer');
          return;
        }

        // Render emoji to transparent canvas (same approach as MentionsLayer)
        const PIN_ICON_SIZE = 40;
        const EMOJI_FONT_SIZE = 30;
        const renderEmojiToImageData = (emoji: string): ImageData | null => {
          const size = PIN_ICON_SIZE;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;
          ctx.clearRect(0, 0, size, size);
          ctx.font = `${EMOJI_FONT_SIZE}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(emoji, size / 2, size / 2 + size * 0.03);
          return ctx.getImageData(0, 0, size, size);
        };

        // Load mention_type emoji icons
        const mentionTypeImageIds = new Map<string, string>();
        const uniqueTypes = new Map<string, string>();
        geoJSON.features.forEach((f: any) => {
          const typeId = f.properties?.mention_type_id;
          const emoji = f.properties?.mention_type_emoji;
          if (typeId && emoji && !uniqueTypes.has(typeId)) uniqueTypes.set(typeId, emoji);
        });
        for (const [typeId, emoji] of uniqueTypes.entries()) {
          const imageId = `profile-mention-type-${typeId.replace(/[^a-zA-Z0-9-]/g, '_')}`;
          if (!currentMap.hasImage(imageId)) {
            const imageData = renderEmojiToImageData(emoji);
            if (imageData) {
              try {
                currentMap.addImage(imageId, imageData, { pixelRatio: 2 });
              } catch (e: any) {
                if (!e?.message?.includes('already exists')) console.warn('[ProfileMap] Failed to add type icon:', typeId, e);
              }
            }
          }
          mentionTypeImageIds.set(typeId, imageId);
        }

        // Load fallback heart icon
        const fallbackImageId = 'profile-mention-heart-fallback';
        if (!currentMap.hasImage(fallbackImageId)) {
          try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = '/heart.png'; });
            const canvas = document.createElement('canvas');
            canvas.width = PIN_ICON_SIZE;
            canvas.height = PIN_ICON_SIZE;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, 0, 0, PIN_ICON_SIZE, PIN_ICON_SIZE);
              const imageData = ctx.getImageData(0, 0, PIN_ICON_SIZE, PIN_ICON_SIZE);
              if (!currentMap.hasImage(fallbackImageId)) {
                currentMap.addImage(fallbackImageId, imageData, { pixelRatio: 2 });
              }
            }
          } catch (error) {
            console.error('[ProfileMap] Failed to load fallback icon:', error);
          }
        }

        // Build icon expression: mention_type emoji → fallback heart
        const iconExpressionParts: any[] = [];
        mentionTypeImageIds.forEach((imageId, typeId) => {
          iconExpressionParts.push(['==', ['get', 'mention_type_id'], typeId]);
          iconExpressionParts.push(imageId);
        });
        const iconExpression: any =
          iconExpressionParts.length === 0 ? fallbackImageId : ['case', ...iconExpressionParts, fallbackImageId];

        // Final verification: source must still exist before adding layers
        if (!currentMap.getSource(SOURCE_ID)) {
          console.error('[ProfileMap] Source does not exist before adding layer');
          return;
        }

        // Add points layer (shared styles from layerStyles.ts)
        const { icon } = mentionsLayerStyles.point;
        try {
          currentMap.addLayer({
            id: LAYER_IDS.points,
            type: 'symbol',
            source: SOURCE_ID,
            layout: {
              'icon-image': iconExpression,
              'icon-size': icon.size,
              'icon-anchor': icon.anchor,
              'icon-allow-overlap': icon.allowOverlap,
            },
          });
        } catch (e) {
          console.error('[ProfileMap] Error adding point layer:', e);
          return;
        }

        // Add labels layer (shared styles from layerStyles.ts)
        try {
          currentMap.addLayer({
            id: LAYER_IDS.labels,
            type: 'symbol',
            source: SOURCE_ID,
            layout: buildMentionsLabelLayout(),
            paint: buildMentionsLabelPaint(),
          });
        } catch (e) {
          console.error('[ProfileMap] Error adding label layer:', e);
          try {
            if (currentMap.getLayer(LAYER_IDS.points)) currentMap.removeLayer(LAYER_IDS.points);
          } catch { /* ignore */ }
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
            currentMap.fitBounds(
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
            if (!currentMap || !e || !e.point || typeof e.point.x !== 'number' || typeof e.point.y !== 'number' || typeof currentMap.queryRenderedFeatures !== 'function') return;
            
            // Stop event propagation
            if (e.originalEvent) {
              e.originalEvent.stopPropagation();
            }
            
            const features = currentMap.queryRenderedFeatures(e.point, {
              layers: [LAYER_IDS.points, LAYER_IDS.labels],
            });

            if (features.length === 0) return;

            const feature = features[0];
            const mentionId = feature.properties?.id;
            
            if (!mentionId) return;

            // Find the pin data
            const pin = pinsRef.current.find(p => p.id === mentionId);
            if (!pin) return;

            // Notify parent of pin selection (for collection assignment)
            if (onPinSelect) {
              onPinSelect(mentionId);
            }

            // Remove existing popup
            if (popupRef.current) {
              popupRef.current.remove();
            }

            // Track view
            trackPinView(pin.id);

            // Show popup immediately (no view count yet)
            const mapbox = await import('mapbox-gl');
            const popupContainer = mapWrapperRef.current || mapContainer.current?.parentElement || mapContainer.current;
            popupRef.current = new mapbox.default.Popup({
              offset: 25,
              closeButton: true,
              closeOnClick: false,
              className: 'map-mention-popup',
              maxWidth: '280px',
              anchor: 'bottom',
              ...(popupContainer ? { container: popupContainer } : {}),
            })
              .setLngLat([pin.lng, pin.lat])
              .setHTML(createPinPopupHtml(pin))
              .addTo(currentMap);

            // Fetch and update view count
            try {
              const response = await fetch(`/api/analytics/pin-stats?pin_id=${pin.id}`);
              if (response.ok) {
                const data = await response.json();
                const vc = data.stats?.total_views ?? null;
                if (popupRef.current && vc != null) {
                  popupRef.current.setHTML(createPinPopupHtml(pin, vc));
                }
              }
            } catch { /* ignore */ }
          };

          // Add click handlers
          currentMap.on('click', LAYER_IDS.points, handleMentionClick);
          currentMap.on('click', LAYER_IDS.labels, handleMentionClick);
          
          // Map click: drop-pin flow (when dropPinMode) or clear pin selection
          const handleMapClick = (e: any) => {
            const features = currentMap.queryRenderedFeatures(e.point, {
              layers: [LAYER_IDS.points, LAYER_IDS.labels],
            });
            if (features.length > 0) return;
            if (dropPinMode && onMapClick) {
              const { lat, lng } = e.lngLat;
              onMapClick({ lat, lng });
              return;
            }
            if (onPinSelect) onPinSelect(null);
          };
          mapClickHandlerRef.current = handleMapClick;
          currentMap.on('click', handleMapClick);
          
          // Add cursor styles
          currentMap.on('mouseenter', LAYER_IDS.points, () => {
            const canvas = currentMap.getCanvas();
            if (canvas) {
              canvas.style.cursor = 'pointer';
            }
          });
          currentMap.on('mouseleave', LAYER_IDS.points, () => {
            const canvas = currentMap.getCanvas();
            if (canvas) {
              canvas.style.cursor = '';
            }
          });
          currentMap.on('mouseenter', LAYER_IDS.labels, () => {
            const canvas = currentMap.getCanvas();
            if (canvas) {
              canvas.style.cursor = 'pointer';
            }
          });
          currentMap.on('mouseleave', LAYER_IDS.labels, () => {
            const canvas = currentMap.getCanvas();
            if (canvas) {
              canvas.style.cursor = '';
            }
          });

          clickHandlersAddedRef.current = true;
        }
      } catch (error) {
        console.error('[ProfileMap] Error setting up layers:', error);
      }
    };

    // Check if map is ready before calling setupLayers
    if (mapboxMap.loaded() && mapboxMap.isStyleLoaded()) {
      setupLayers();
    } else {
      // Wait for map to be ready, then call setupLayers
      const checkReady = () => {
        if (!mapInstanceRef.current) return;
        const checkMap = mapInstanceRef.current as any;
        if (checkMap.loaded() && checkMap.isStyleLoaded()) {
          setupLayers();
        } else {
          setTimeout(checkReady, 50);
        }
      };
      checkReady();
    }

    // Cleanup handlers on unmount
    return () => {
      if (mapInstanceRef.current && clickHandlersAddedRef.current) {
        const mapboxMap = mapInstanceRef.current as any;
        try {
          mapboxMap.off('click', LAYER_IDS.points);
          mapboxMap.off('click', LAYER_IDS.labels);
          if (mapClickHandlerRef.current) {
            mapboxMap.off('click', mapClickHandlerRef.current);
            mapClickHandlerRef.current = null;
          }
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
  }, [mapLoaded, pins, accountId, isOwnProfile, accountUsername, accountImageUrl, onPinSelect, activeCollectionId, dropPinMode, onMapClick]);

  // Show toast when a collection is selected (not on initial load)
  useEffect(() => {
    if (activeCollectionId && collections.length > 0) {
      const collection = collections.find(c => c.id === activeCollectionId);
      if (collection) {
        const count = pins.filter(pin => pin.collection_id === activeCollectionId).length;
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
  }, [activeCollectionId, collections, pins]);

  return (
    <div ref={mapWrapperRef} className="relative w-full h-full bg-gray-100 overflow-hidden" style={{ height: '100%', position: 'relative' }}>
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" style={{ height: '100%' }} />
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


