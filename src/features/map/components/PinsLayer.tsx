'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PublicMapPinService } from '@/features/map-pins/services/publicMapPinService';
import type { MapPin } from '@/types/map-pin';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';

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
  const pointLayerId = 'map-pins-point';
  const pointLabelLayerId = 'map-pins-point-label';
  
  const { account } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const searchParams = useSearchParams();
  const pinsRef = useRef<MapPin[]>([]);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const isAddingLayersRef = useRef<boolean>(false);
  const popupRef = useRef<any>(null); // Mapbox Popup instance
  const clickHandlersAddedRef = useRef<boolean>(false);
  const locationSelectedHandlerRef = useRef<(() => void) | null>(null);
  const selectPinByIdHandlerRef = useRef<((event: CustomEvent<{ pinId: string }>) => void) | null>(null);
  const styleChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHandlingStyleChangeRef = useRef<boolean>(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const currentPinRef = useRef<MapPin | null>(null);
  const accountRef = useRef(account);
  const openWelcomeRef = useRef(openWelcome);
  
  // Keep account ref updated
  useEffect(() => {
    accountRef.current = account;
  }, [account]);
  
  // Keep openWelcome ref updated
  useEffect(() => {
    openWelcomeRef.current = openWelcome;
  }, [openWelcome]);

  // Fetch pins and add to map
  useEffect(() => {
    if (!map || !mapLoaded) return;

    let mounted = true;

    const loadPins = async () => {
      // Prevent concurrent calls
      if (isAddingLayersRef.current) return;
      
      try {
        // Get year filter from URL
        const yearParam = searchParams.get('year');
        const year = yearParam ? parseInt(yearParam, 10) : undefined;
        
        const pins = await PublicMapPinService.getPins(year ? { year } : undefined);
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
          if (mapboxMap.getLayer(pointLabelLayerId)) {
            mapboxMap.removeLayer(pointLabelLayerId);
          }
          if (mapboxMap.getLayer(pointLayerId)) {
            mapboxMap.removeLayer(pointLayerId);
          }
          if (mapboxMap.getSource(sourceId)) {
            mapboxMap.removeSource(sourceId);
          }
        } catch (e) {
          // Source or layers may already be removed (e.g., during style change)
          // This is expected and safe to ignore
        }

        // Add source (no clustering)
        mapboxMap.addSource(sourceId, {
          type: 'geojson',
          data: geoJSON,
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

        // Add points as pin icons
        map.addLayer({
          id: pointLayerId,
          type: 'symbol',
          source: sourceId,
          layout: {
            'icon-image': pinImageId,
            'icon-size': 1, // Image is already sized to 8px
            'icon-anchor': 'top', // Use 'top' anchor if SVG tip is at top
            'icon-allow-overlap': true,
          },
        });

        // Add labels for points (positioned above pin icon)
        mapboxMap.addLayer({
          id: pointLabelLayerId,
          type: 'symbol',
          source: sourceId,
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
            if (!mapboxMap || !e || !e.point || typeof e.point.x !== 'number' || typeof e.point.y !== 'number' || typeof mapboxMap.queryRenderedFeatures !== 'function') return;
            
            const features = mapboxMap.queryRenderedFeatures(e.point, {
              layers: [pointLayerId, pointLabelLayerId],
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

            const createPopupContent = (viewCount: number | null, isLoading: boolean = false, pinToUse: MapPin = pin) => {
              // Use provided pin or fallback to current pin
              const currentPin = pinToUse || pin;
              // Determine profile URL - use username if available
              const profileSlug = currentPin.account?.username;
              const profileUrl = profileSlug ? `/profile/${encodeURIComponent(profileSlug)}` : null;
              
              // Display name: use username, fallback to 'User'
              const displayName = currentPin.account?.username || 'User';
              
              // Check if current user owns this pin
              const isOwnPin = accountRef.current && currentPin.account_id === accountRef.current.id;
              
              // Check if user is authenticated
              const isAuthenticated = !!accountRef.current;
              
              // Only show account info if user is authenticated
              const accountInfo = isAuthenticated ? `
                <a href="${profileUrl || '#'}" style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; text-decoration: none; cursor: ${profileUrl ? 'pointer' : 'default'};" ${profileUrl ? '' : 'onclick="event.preventDefault()"'}>
                  ${currentPin.account?.image_url ? `
                    <img src="${escapeHtml(currentPin.account.image_url)}" alt="${escapeHtml(displayName)}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid #e5e7eb;" />
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
              ` : '';
              
              // Manage button (only for own pins)
              const manageButton = isOwnPin ? `
                <div style="position: relative;">
                  <button class="pin-manage-button" data-pin-id="${currentPin.id}" style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: none; background: transparent; cursor: pointer; border-radius: 4px; color: #6b7280; transition: all 0.15s;" onmouseover="this.style.background='#f3f4f6'; this.style.color='#111827';" onmouseout="this.style.background='transparent'; this.style.color='#6b7280';" aria-label="Manage pin">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="2"></circle>
                      <circle cx="12" cy="12" r="2"></circle>
                      <circle cx="12" cy="19" r="2"></circle>
                    </svg>
                  </button>
                  <div class="pin-manage-menu" id="pin-manage-menu-${currentPin.id}" style="display: none; position: absolute; top: 28px; right: 0; min-width: 120px; background: white; border: 1px solid #e5e7eb; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 1000; overflow: hidden;">
                    <button class="pin-edit-button" data-pin-id="${currentPin.id}" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #374151; text-align: left; transition: background 0.15s;" onmouseover="this.style.background='#f3f4f6';" onmouseout="this.style.background='transparent';">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      Edit
                    </button>
                    <button class="pin-delete-button" data-pin-id="${currentPin.id}" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #dc2626; text-align: left; border-top: 1px solid #e5e7eb; transition: background 0.15s;" onmouseover="this.style.background='#fef2f2';" onmouseout="this.style.background='transparent';">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Delete
                    </button>
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

              // "See who" link for unauthenticated users
              const seeWhoLink = !isAuthenticated ? `
                <a id="see-who-link-${currentPin.id}" href="#" style="font-size: 12px; color: #2563eb; text-decoration: none; cursor: pointer; transition: color 0.15s;" onmouseover="this.style.color='#1d4ed8'; text-decoration: underline;" onmouseout="this.style.color='#2563eb'; this.style.textDecoration='none';">See who</a>
              ` : '';

              return `
                <div class="map-pin-popup-content" style="min-width: 200px; max-width: 280px; padding: 10px; background: white; border-radius: 6px;">
                  <!-- Header with account info (if authenticated), manage button, and close button -->
                  ${isAuthenticated || manageButton ? `
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px;">
                    ${accountInfo}
                    <div style="display: flex; align-items: center; gap: 4px;">
                      ${manageButton}
                      <button class="mapboxgl-popup-close-button" style="width: 16px; height: 16px; padding: 0; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 14px; line-height: 1; flex-shrink: 0; transition: color 0.15s;" onmouseover="this.style.color='#111827'" onmouseout="this.style.color='#6b7280'" aria-label="Close popup">×</button>
                    </div>
                  </div>
                  ` : `
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6b7280;">
                      ${seeWhoLink}
                      <span style="color: #6b7280;">sign in now</span>
                    </div>
                    <button class="mapboxgl-popup-close-button" style="width: 16px; height: 16px; padding: 0; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 14px; line-height: 1; flex-shrink: 0; transition: color 0.15s;" onmouseover="this.style.color='#111827'" onmouseout="this.style.color='#6b7280'" aria-label="Close popup">×</button>
                  </div>
                  `}
                  
                  <!-- Content -->
                  <div style="margin-bottom: 8px;">
                    ${currentPin.description ? `
                      <div style="font-size: 12px; color: #374151; line-height: 1.5; margin-bottom: ${currentPin.media_url ? '8px' : '0'}; word-wrap: break-word;">
                        ${escapeHtml(currentPin.description)}
                      </div>
                    ` : ''}
                    ${currentPin.media_url ? `
                      <div style="margin-top: ${currentPin.description ? '8px' : '0'};">
                        ${currentPin.media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? `
                          <img src="${escapeHtml(currentPin.media_url)}" alt="Pin media" style="width: 100%; border-radius: 4px; max-height: 120px; object-fit: cover; display: block;" />
                        ` : currentPin.media_url.match(/\.(mp4|webm|ogg)$/i) ? `
                          <video src="${escapeHtml(currentPin.media_url)}" controls style="width: 100%; border-radius: 4px; max-height: 120px; display: block;" />
                        ` : ''}
                      </div>
                    ` : ''}
                  </div>
                  
                  <!-- Footer with date and view count -->
                  <div style="padding-top: 8px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                      <div style="font-size: 12px; color: #6b7280;">
                        ${formatDate(currentPin.created_at)}
                      </div>
                      ${viewCountDisplay}
                    </div>
                  </div>
                </div>
              `;
            };

            // Remove existing popup
            if (popupRef.current) {
              popupRef.current.remove();
            }

            // Update URL with pin parameter for shareable links
            const url = new URL(window.location.href);
            url.searchParams.set('pin', pin.id);
            window.history.replaceState({}, '', url.pathname + url.search);

            // Dispatch event to notify FloatingMapContainer to close location details
            window.dispatchEvent(new CustomEvent('pin-popup-opening', {
              detail: { pinId: pin.id }
            }));

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

            // Add click handlers after popup is added to DOM
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

              // "See who" link handler
              const seeWhoLink = popupElement.querySelector(`#see-who-link-${pin.id}`) as HTMLAnchorElement;
              if (seeWhoLink) {
                seeWhoLink.addEventListener('click', (e: MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (openWelcomeRef.current) {
                    openWelcomeRef.current();
                  }
                });
              }

              // Manage button handler
              const manageButton = popupElement.querySelector('.pin-manage-button') as HTMLButtonElement;
              const manageMenu = popupElement.querySelector('.pin-manage-menu') as HTMLDivElement;
              
              if (manageButton && manageMenu) {
                // Toggle menu on button click
                manageButton.addEventListener('click', (e: MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const isVisible = manageMenu.style.display === 'block';
                  manageMenu.style.display = isVisible ? 'none' : 'block';
                });

                // Close menu when clicking outside
                const handleClickOutside = (e: MouseEvent) => {
                  if (!manageMenu.contains(e.target as Node) && !manageButton.contains(e.target as Node)) {
                    manageMenu.style.display = 'none';
                  }
                };
                document.addEventListener('click', handleClickOutside);

                // Edit button handler
                const editButton = popupElement.querySelector('.pin-edit-button') as HTMLButtonElement;
                if (editButton) {
                  editButton.addEventListener('click', async (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    manageMenu.style.display = 'none';
                    
                    // Store current pin for editing
                    currentPinRef.current = pin;
                    setEditDescription(pin.description || '');
                    setIsEditing(true);
                    
                    // Update popup to show edit form
                    if (popupRef.current) {
                      const editForm = `
                        <div class="map-pin-popup-content" style="min-width: 200px; max-width: 280px; padding: 10px; background: white; border-radius: 6px;">
                          <div style="margin-bottom: 10px; padding-bottom: 8px;">
                            <h3 style="font-size: 13px; font-weight: 600; color: #111827; margin: 0;">Edit Pin</h3>
                          </div>
                          <div style="margin-bottom: 10px;">
                            <label style="display: block; font-size: 12px; font-weight: 500; color: #374151; margin-bottom: 4px;">Description</label>
                            <textarea id="pin-edit-description" style="width: 100%; min-height: 60px; padding: 6px 8px; font-size: 12px; border: 1px solid #d1d5db; border-radius: 4px; resize: vertical; font-family: inherit;" placeholder="Add a description...">${escapeHtml(pin.description || '')}</textarea>
                          </div>
                          <div style="display: flex; gap: 6px;">
                            <button class="pin-edit-cancel" data-pin-id="${pin.id}" style="flex: 1; padding: 6px 12px; font-size: 12px; font-weight: 500; color: #374151; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.background='#e5e7eb';" onmouseout="this.style.background='#f3f4f6';">Cancel</button>
                            <button class="pin-edit-save" data-pin-id="${pin.id}" style="flex: 1; padding: 6px 12px; font-size: 12px; font-weight: 500; color: white; background: #111827; border: 1px solid #111827; border-radius: 4px; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.background='#374151';" onmouseout="this.style.background='#111827';">Save</button>
                          </div>
                        </div>
                      `;
                      popupRef.current.setHTML(editForm);
                      setTimeout(() => setupPopupHandlers(), 0);
                    }
                  });
                }

                // Delete button handler
                const deleteButton = popupElement.querySelector('.pin-delete-button') as HTMLButtonElement;
                if (deleteButton) {
                  deleteButton.addEventListener('click', (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    manageMenu.style.display = 'none';
                    
                    // Show inline confirmation
                    if (popupRef.current) {
                      const confirmDeleteForm = `
                        <div class="map-pin-popup-content" style="min-width: 200px; max-width: 280px; padding: 10px; background: white; border-radius: 6px;">
                          <div style="margin-bottom: 10px; padding-bottom: 8px;">
                            <h3 style="font-size: 13px; font-weight: 600; color: #111827; margin: 0;">Delete Pin</h3>
                          </div>
                          <div style="margin-bottom: 10px;">
                            <p style="font-size: 12px; color: #374151; line-height: 1.5; margin: 0 0 8px 0;">
                              Are you sure you want to delete this pin? This action cannot be undone.
                            </p>
                            ${pin.description ? `
                              <div style="padding: 8px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; margin-bottom: 8px;">
                                <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">Pin description:</div>
                                <div style="font-size: 12px; color: #111827;">${escapeHtml(pin.description)}</div>
                              </div>
                            ` : ''}
                          </div>
                          <div style="display: flex; gap: 6px;">
                            <button class="pin-delete-cancel" data-pin-id="${pin.id}" style="flex: 1; padding: 6px 12px; font-size: 12px; font-weight: 500; color: #374151; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.background='#e5e7eb';" onmouseout="this.style.background='#f3f4f6';">Cancel</button>
                            <button class="pin-delete-confirm" data-pin-id="${pin.id}" style="flex: 1; padding: 6px 12px; font-size: 12px; font-weight: 500; color: white; background: #dc2626; border: 1px solid #dc2626; border-radius: 4px; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.background='#b91c1c';" onmouseout="this.style.background='#dc2626';">Delete</button>
                          </div>
                        </div>
                      `;
                      popupRef.current.setHTML(confirmDeleteForm);
                      setTimeout(() => setupPopupHandlers(), 0);
                    }
                  });
                }
              }

              // Delete confirmation handlers
              const deleteCancelButton = popupElement.querySelector('.pin-delete-cancel') as HTMLButtonElement;
              if (deleteCancelButton) {
                deleteCancelButton.addEventListener('click', (e: MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const pinId = deleteCancelButton.getAttribute('data-pin-id');
                  if (!pinId) return;
                  
                  const currentPinForCancel = pinsRef.current.find(p => p.id === pinId) || pin;
                  if (!currentPinForCancel) return;
                  
                  // Reload popup with original content
                  if (popupRef.current) {
                    popupRef.current.setHTML(createPopupContent(null, false, currentPinForCancel));
                    setTimeout(() => setupPopupHandlers(), 0);
                  }
                });
              }

              const deleteConfirmButton = popupElement.querySelector('.pin-delete-confirm') as HTMLButtonElement;
              if (deleteConfirmButton) {
                deleteConfirmButton.addEventListener('click', async (e: MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const pinId = deleteConfirmButton.getAttribute('data-pin-id');
                  if (!pinId) return;
                  
                  const pinToDelete = pinsRef.current.find(p => p.id === pinId) || pin;
                  if (!pinToDelete) return;
                  
                  setIsDeleting(true);
                  
                  // Update button to show loading state
                  if (deleteConfirmButton) {
                    deleteConfirmButton.disabled = true;
                    deleteConfirmButton.style.opacity = '0.6';
                    deleteConfirmButton.style.cursor = 'not-allowed';
                    deleteConfirmButton.textContent = 'Deleting...';
                  }
                  
                  try {
                    await PublicMapPinService.deletePin(pinId);
                    // Remove pin from local refs
                    pinsRef.current = pinsRef.current.filter(p => p.id !== pinId);
                    // Reload pins
                    const yearParam = searchParams.get('year');
                    const year = yearParam ? parseInt(yearParam, 10) : undefined;
                    const updatedPins = await PublicMapPinService.getPins(year ? { year } : undefined);
                    pinsRef.current = updatedPins;
                    const geoJSON = PublicMapPinService.pinsToGeoJSON(updatedPins);
                    const source = mapboxMap.getSource(sourceId) as any;
                    if (source) {
                      source.setData(geoJSON);
                    }
                    // Close popup
                    if (popupRef.current) {
                      popupRef.current.remove();
                      popupRef.current = null;
                    }
                    // Dispatch event to refresh pins
                    window.dispatchEvent(new CustomEvent('pin-deleted', { detail: { pinId } }));
                  } catch (error) {
                    console.error('[PinsLayer] Error deleting pin:', error);
                    // Restore button state
                    if (deleteConfirmButton) {
                      deleteConfirmButton.disabled = false;
                      deleteConfirmButton.style.opacity = '1';
                      deleteConfirmButton.style.cursor = 'pointer';
                      deleteConfirmButton.textContent = 'Delete';
                    }
                    // Show error in popup
                    if (popupRef.current) {
                      const errorForm = `
                        <div class="map-pin-popup-content" style="min-width: 200px; max-width: 280px; padding: 10px; background: white; border-radius: 6px;">
                          <div style="margin-bottom: 10px; padding-bottom: 8px;">
                            <h3 style="font-size: 13px; font-weight: 600; color: #dc2626; margin: 0;">Delete Failed</h3>
                          </div>
                          <div style="margin-bottom: 10px;">
                            <p style="font-size: 12px; color: #374151; line-height: 1.5; margin: 0;">
                              Failed to delete pin. Please try again.
                            </p>
                          </div>
                          <div style="display: flex; gap: 6px;">
                            <button class="pin-delete-error-ok" data-pin-id="${pinId}" style="flex: 1; padding: 6px 12px; font-size: 12px; font-weight: 500; color: white; background: #111827; border: 1px solid #111827; border-radius: 4px; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.background='#374151';" onmouseout="this.style.background='#111827';">OK</button>
                          </div>
                        </div>
                      `;
                      popupRef.current.setHTML(errorForm);
                      setTimeout(() => {
                        const okButton = popupRef.current?.getElement()?.querySelector('.pin-delete-error-ok') as HTMLButtonElement;
                        if (okButton) {
                          okButton.addEventListener('click', () => {
                            if (popupRef.current) {
                              const currentPinForReload = pinsRef.current.find(p => p.id === pinId) || pinToDelete;
                              popupRef.current.setHTML(createPopupContent(null, false, currentPinForReload));
                              setTimeout(() => setupPopupHandlers(), 0);
                            }
                          });
                        }
                      }, 0);
                    }
                  } finally {
                    setIsDeleting(false);
                  }
                });
              }

              // Edit form handlers (when in edit mode)
              const editCancelButton = popupElement.querySelector('.pin-edit-cancel') as HTMLButtonElement;
              if (editCancelButton) {
                editCancelButton.addEventListener('click', (e: MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const pinId = editCancelButton.getAttribute('data-pin-id');
                  if (!pinId) return;
                  
                  const currentPinForCancel = pinsRef.current.find(p => p.id === pinId) || pin;
                  if (!currentPinForCancel) return;
                  
                  setIsEditing(false);
                  currentPinRef.current = null;
                  // Reload popup with original content
                  if (popupRef.current) {
                    popupRef.current.setHTML(createPopupContent(null, false, currentPinForCancel));
                    setTimeout(() => setupPopupHandlers(), 0);
                  }
                });
              }

              const editSaveButton = popupElement.querySelector('.pin-edit-save') as HTMLButtonElement;
              const editDescriptionTextarea = popupElement.querySelector('#pin-edit-description') as HTMLTextAreaElement;
              if (editSaveButton) {
                editSaveButton.addEventListener('click', async (e: MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const pinId = editSaveButton.getAttribute('data-pin-id');
                  if (!pinId) return;
                  
                  const currentPinForEdit = pinsRef.current.find(p => p.id === pinId) || pin;
                  if (!currentPinForEdit) return;
                  
                  const newDescription = editDescriptionTextarea?.value.trim() || null;
                  
                  try {
                    await PublicMapPinService.updatePin(pinId, {
                      description: newDescription,
                    });
                    
                    // Update pin in local refs
                    const pinIndex = pinsRef.current.findIndex(p => p.id === pinId);
                    if (pinIndex !== -1) {
                      pinsRef.current[pinIndex] = {
                        ...pinsRef.current[pinIndex],
                        description: newDescription,
                      };
                    }
                    
                    // Reload pins to get fresh data
                    const yearParam = searchParams.get('year');
                    const year = yearParam ? parseInt(yearParam, 10) : undefined;
                    const updatedPins = await PublicMapPinService.getPins(year ? { year } : undefined);
                    pinsRef.current = updatedPins;
                    const geoJSON = PublicMapPinService.pinsToGeoJSON(updatedPins);
                    const source = mapboxMap.getSource(sourceId) as any;
                    if (source) {
                      source.setData(geoJSON);
                    }
                    
                    // Update popup with new content
                    if (popupRef.current) {
                      const updatedPin = updatedPins.find(p => p.id === pinId);
                      if (updatedPin) {
                        popupRef.current.setHTML(createPopupContent(null, false, updatedPin));
                        setTimeout(() => setupPopupHandlers(), 0);
                      }
                    }
                    
                    setIsEditing(false);
                    currentPinRef.current = null;
                    
                    // Dispatch event to refresh pins
                    window.dispatchEvent(new CustomEvent('pin-updated', { detail: { pinId } }));
                  } catch (error) {
                    console.error('[PinsLayer] Error updating pin:', error);
                    alert('Failed to update pin. Please try again.');
                  }
                });
              }
            };

            setTimeout(setupPopupHandlers, 0);

            // Cleanup popup ref when it closes
            popupRef.current.on('close', () => {
              popupRef.current = null;
              // Clear pin parameter from URL when popup closes
              const url = new URL(window.location.href);
              if (url.searchParams.has('pin')) {
                url.searchParams.delete('pin');
                window.history.replaceState({}, '', url.pathname + url.search || '/');
              }
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

          // Add click handler to point layer
          // Cast to any for layer-specific event handlers (not in interface)
          (mapboxMap as any).on('click', pointLayerId, handlePinClick);
          (mapboxMap as any).on('click', pointLabelLayerId, handlePinClick);

          // Make pins cursor pointer
          (mapboxMap as any).on('mouseenter', pointLayerId, () => {
            (mapboxMap as any).getCanvas().style.cursor = 'pointer';
          });
          (mapboxMap as any).on('mouseleave', pointLayerId, () => {
            (mapboxMap as any).getCanvas().style.cursor = '';
          });

          // Listen for location-selected-on-map event to close popup
          locationSelectedHandlerRef.current = () => {
            if (popupRef.current) {
              popupRef.current.remove();
              popupRef.current = null;
            }
          };
          window.addEventListener('location-selected-on-map', locationSelectedHandlerRef.current);

          // Listen for select-pin-by-id event (from URL param watcher)
          selectPinByIdHandlerRef.current = (event: CustomEvent<{ pinId: string }>) => {
            const { pinId } = event.detail;
            const pin = pinsRef.current.find(p => p.id === pinId);
            if (pin) {
              // Simulate a click on the pin to open popup
              const fakeEvent = {
                point: { x: 0, y: 0 },
                lngLat: { lng: pin.lng, lat: pin.lat },
              };
              // Directly trigger the pin click handler logic
              handlePinClick(fakeEvent);
            }
          };
          window.addEventListener('select-pin-by-id', selectPinByIdHandlerRef.current as EventListener);

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
        
        const mapboxMap = map as any;
        if (!mapboxMap.isStyleLoaded()) return;
        
        // Check if our source was removed by the style change
        const sourceExists = !!mapboxMap.getSource(sourceId);
        if (sourceExists) {
          // Source still exists, no need to re-add
          return;
        }
        
        // Prevent concurrent re-initialization
        if (isHandlingStyleChangeRef.current) return;
        isHandlingStyleChangeRef.current = true;
        
        // Reset flags and reload pins since style change cleared our layers
        isAddingLayersRef.current = false;
        clickHandlersAddedRef.current = false;
        
        loadPins().finally(() => {
          isHandlingStyleChangeRef.current = false;
        });
      }, 100);
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
      
      // Clear style change timeout
      if (styleChangeTimeoutRef.current) {
        clearTimeout(styleChangeTimeoutRef.current);
        styleChangeTimeoutRef.current = null;
      }
      
      // Unsubscribe from real-time updates
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }

      // Remove window event listeners
      if (locationSelectedHandlerRef.current) {
        window.removeEventListener('location-selected-on-map', locationSelectedHandlerRef.current);
        locationSelectedHandlerRef.current = null;
      }
      if (selectPinByIdHandlerRef.current) {
        window.removeEventListener('select-pin-by-id', selectPinByIdHandlerRef.current as EventListener);
        selectPinByIdHandlerRef.current = null;
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
                if (mapboxMap.getLayer(pointLabelLayerId)) {
                  mapboxMap.removeLayer(pointLabelLayerId);
                }
              } catch (e) {
                // Layer may already be removed
              }
              
              try {
                if (mapboxMap.getLayer(pointLayerId)) {
                  mapboxMap.removeLayer(pointLayerId);
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
          mapboxMap.off('click', pointLayerId);
          mapboxMap.off('click', pointLabelLayerId);
          mapboxMap.off('mouseenter', pointLayerId);
          mapboxMap.off('mouseleave', pointLayerId);
        } catch (e) {
          // Handlers may not exist or map may be removed
        }
      }
    };
  }, [map, mapLoaded, searchParams]);

  return null; // This component doesn't render anything
}
