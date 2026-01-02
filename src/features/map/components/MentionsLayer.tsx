'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MentionService } from '@/features/mentions/services/mentionService';
import type { Mention } from '@/types/mention';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import {
  buildMentionsLabelLayout,
  buildMentionsLabelPaint,
  buildMentionsIconLayout,
} from '@/features/map/config/layerStyles';

interface MentionsLayerProps {
  map: MapboxMapInstance;
  mapLoaded: boolean;
}

/**
 * MentionsLayer component manages Mapbox mention visualization
 * Handles fetching, formatting, and real-time updates
 */
export default function MentionsLayer({ map, mapLoaded }: MentionsLayerProps) {
  const sourceId = 'map-mentions';
  const pointLayerId = 'map-mentions-point';
  const pointLabelLayerId = 'map-mentions-point-label';
  
  const { account } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const searchParams = useSearchParams();
  const mentionsRef = useRef<Mention[]>([]);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const isAddingLayersRef = useRef<boolean>(false);
  const popupRef = useRef<any>(null); // Mapbox Popup instance
  const clickHandlersAddedRef = useRef<boolean>(false);
  const locationSelectedHandlerRef = useRef<(() => void) | null>(null);
  const styleChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHandlingStyleChangeRef = useRef<boolean>(false);
  const mentionCreatedHandlerRef = useRef<((event: CustomEvent<{ mention: Mention }>) => void) | null>(null);
  const mentionArchivedHandlerRef = useRef<((event: CustomEvent<{ mentionId: string }>) => void) | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const currentMentionRef = useRef<Mention | null>(null);
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

  // Fetch mentions and add to map
  useEffect(() => {
    if (!map || !mapLoaded) return;

    let mounted = true;

    const loadMentions = async () => {
      // Prevent concurrent calls
      if (isAddingLayersRef.current) return;
      
      try {
        // Get year filter from URL
        const yearParam = searchParams.get('year');
        const year = yearParam ? parseInt(yearParam, 10) : undefined;
        
        const mentions = await MentionService.getMentions(year ? { year } : undefined);
        if (!mounted) return;

        mentionsRef.current = mentions;
        const geoJSON = MentionService.mentionsToGeoJSON(mentions);
        
        // Log for debugging
        if (process.env.NODE_ENV === 'development') {
          console.log('[MentionsLayer] Loaded mentions:', mentions.length);
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
            console.warn('[MentionsLayer] Error checking existing source:', e);
          }
        }

        // Source doesn't exist - need to add source and layers
        // First, clean up any existing layers (shouldn't exist if source doesn't, but be safe)
        // IMPORTANT: Remove layers BEFORE removing source to avoid "source not found" errors
        try {
          // Remove layers first (they depend on the source)
          if (mapboxMap.getLayer(pointLabelLayerId)) {
            try {
              mapboxMap.removeLayer(pointLabelLayerId);
            } catch (e) {
              // Layer may already be removed or source missing - ignore
            }
          }
          if (mapboxMap.getLayer(pointLayerId)) {
            try {
              mapboxMap.removeLayer(pointLayerId);
            } catch (e) {
              // Layer may already be removed or source missing - ignore
            }
          }
          // Then remove source (only if it exists)
          if (mapboxMap.getSource(sourceId)) {
            try {
              mapboxMap.removeSource(sourceId);
            } catch (e) {
              // Source may already be removed - ignore
            }
          }
        } catch (e) {
          // Source or layers may already be removed (e.g., during style change)
          // This is expected and safe to ignore
          if (process.env.NODE_ENV === 'development') {
            console.warn('[MentionsLayer] Error during cleanup:', e);
          }
        }

        // Add source (no clustering)
        // Ensure source doesn't already exist before adding
        try {
          if (!mapboxMap.getSource(sourceId)) {
            mapboxMap.addSource(sourceId, {
              type: 'geojson',
              data: geoJSON,
            });
          } else {
            // Source exists, just update data
            const existingSource = mapboxMap.getSource(sourceId) as any;
            if (existingSource && existingSource.setData) {
              existingSource.setData(geoJSON);
            }
          }
        } catch (e) {
          console.error('[MentionsLayer] Error adding/updating source:', e);
          isAddingLayersRef.current = false;
          return;
        }

        // Load mention icon image
        const mentionImageId = 'map-mention-icon';
        
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
            console.error('[MentionsLayer] Failed to load mention icon:', error);
            // Fallback: continue without icon (will show as missing image)
          }
        }

        // Verify source exists before adding layers
        if (!mapboxMap.getSource(sourceId)) {
          console.error('[MentionsLayer] Source does not exist before adding layer');
          isAddingLayersRef.current = false;
          return;
        }

        // Add points as mention icons with zoom-based sizing
        try {
          const iconLayout = buildMentionsIconLayout();
          map.addLayer({
            id: pointLayerId,
            type: 'symbol',
            source: sourceId,
          layout: {
              ...iconLayout,
            'icon-image': mentionImageId,
          },
          });
        } catch (e) {
          console.error('[MentionsLayer] Error adding point layer:', e);
          isAddingLayersRef.current = false;
          return;
        }

        // Add labels for points (positioned above mention icon)
        try {
          mapboxMap.addLayer({
            id: pointLabelLayerId,
            type: 'symbol',
            source: sourceId,
            layout: buildMentionsLabelLayout(),
            paint: buildMentionsLabelPaint(),
          });
        } catch (e) {
          console.error('[MentionsLayer] Error adding label layer:', e);
          // Try to remove the point layer if label layer failed
          try {
            if (mapboxMap.getLayer(pointLayerId)) {
              mapboxMap.removeLayer(pointLayerId);
            }
          } catch (removeError) {
            // Ignore removal errors
          }
          isAddingLayersRef.current = false;
          return;
        }

        isAddingLayersRef.current = false;

        // Add click handlers for mention interactions (only once)
        if (!clickHandlersAddedRef.current) {
          const handleMentionClick = async (e: any) => {
            if (!mounted) return;
            if (!mapboxMap || !e || !e.point || typeof e.point.x !== 'number' || typeof e.point.y !== 'number' || typeof mapboxMap.queryRenderedFeatures !== 'function') return;
            
            // Stop event propagation to prevent map click handler from firing
            if (e.originalEvent) {
              e.originalEvent.stopPropagation();
            }
            
            const features = mapboxMap.queryRenderedFeatures(e.point, {
              layers: [pointLayerId, pointLabelLayerId],
            });

            if (features.length === 0) return;

            const feature = features[0];
            const mentionId = feature.properties?.id;
            
            if (!mentionId) return;

            // Find the mention data
            let mention = mentionsRef.current.find(m => m.id === mentionId);
            if (!mention) return;

            // Fetch full account profile data if account_id exists
            if (mention.account_id && (!mention.account || !mention.account.username)) {
              try {
                const { supabase } = await import('@/lib/supabase');
                const { data: accountData } = await supabase
                  .from('accounts')
                  .select('id, username, first_name, image_url')
                  .eq('id', mention.account_id)
                  .single();
                
                if (accountData) {
                  // Update mention with full account data
                  mention = {
                    ...mention,
                    account: {
                      id: accountData.id,
                      username: accountData.username,
                      image_url: accountData.image_url,
                    }
                  };
                  // Update in refs
                  const index = mentionsRef.current.findIndex(m => m.id === mentionId);
                  if (index !== -1) {
                    mentionsRef.current[index] = mention;
                  }
                }
              } catch (error) {
                console.error('[MentionsLayer] Error fetching account profile:', error);
                // Continue with existing mention data
              }
            }

            // Fly to mention location
            const currentZoom = mapboxMap.getZoom();
            const targetZoom = Math.max(currentZoom, 14); // Ensure we zoom in at least to level 14
            
            mapboxMap.flyTo({
              center: [mention.lng, mention.lat],
              zoom: targetZoom,
              duration: 800,
              essential: true, // Animation is essential for accessibility
            });

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

            const createPopupContent = (mentionToUse: Mention = mention, viewCount: number | null = null) => {
              const currentMention = mentionToUse || mention;
              // Determine profile URL - use username if available
              const profileSlug = currentMention.account?.username;
              const profileUrl = profileSlug ? `/profile/${encodeURIComponent(profileSlug)}` : null;
              
              // Display name: use username, fallback to 'User'
              const displayName = currentMention.account?.username || 'User';
              
              // Check if current user owns this mention
              const isOwnMention = accountRef.current && currentMention.account_id === accountRef.current.id;
              
              // Check if user is authenticated
              const isAuthenticated = !!accountRef.current;
              
              // Only show account info if user is authenticated
              const accountInfo = isAuthenticated ? `
                <a href="${profileUrl || '#'}" style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; text-decoration: none; cursor: ${profileUrl ? 'pointer' : 'default'};" ${profileUrl ? '' : 'onclick="event.preventDefault()"'}>
                  ${currentMention.account?.image_url ? `
                    <img src="${escapeHtml(currentMention.account.image_url)}" alt="${escapeHtml(displayName)}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid #e5e7eb;" />
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
              
              // Manage button (only for own mentions)
              const manageButton = isOwnMention ? `
                <div style="position: relative;">
                  <button class="mention-manage-button" data-mention-id="${currentMention.id}" style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: none; background: transparent; cursor: pointer; border-radius: 4px; color: #6b7280; transition: all 0.15s;" onmouseover="this.style.background='#f3f4f6'; this.style.color='#111827';" onmouseout="this.style.background='transparent'; this.style.color='#6b7280';" aria-label="Manage mention">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="2"></circle>
                      <circle cx="12" cy="12" r="2"></circle>
                      <circle cx="12" cy="19" r="2"></circle>
                    </svg>
                  </button>
                  <div class="mention-manage-menu" id="mention-manage-menu-${currentMention.id}" style="display: none; position: absolute; top: 28px; right: 0; min-width: 120px; background: white; border: 1px solid #e5e7eb; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 1000; overflow: hidden;">
                    <button class="mention-edit-button" data-mention-id="${currentMention.id}" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #374151; text-align: left; transition: background 0.15s;" onmouseover="this.style.background='#f3f4f6';" onmouseout="this.style.background='transparent';">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      Edit
                    </button>
                    <button class="mention-delete-button" data-mention-id="${currentMention.id}" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #dc2626; text-align: left; border-top: 1px solid #e5e7eb; transition: background 0.15s;" onmouseover="this.style.background='#fef2f2';" onmouseout="this.style.background='transparent';">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Archive
                    </button>
                  </div>
                </div>
              ` : '';

              // "See who" link for unauthenticated users
              const seeWhoLink = !isAuthenticated ? `
                <a id="see-who-link-${currentMention.id}" href="#" style="font-size: 12px; color: #2563eb; text-decoration: none; cursor: pointer; transition: color 0.15s;" onmouseover="this.style.color='#1d4ed8'; text-decoration: underline;" onmouseout="this.style.color='#2563eb'; this.style.textDecoration='none';">See who</a>
              ` : '';

              return `
                <div class="map-mention-popup-content" style="min-width: 200px; max-width: 280px; padding: 10px; background: white; border-radius: 6px;">
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
                    ${currentMention.collection ? `
                      <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 6px;">
                        <span style="font-size: 12px;">${escapeHtml(currentMention.collection.emoji)}</span>
                        <span style="font-size: 12px; color: #6b7280; font-weight: 500;">
                          ${escapeHtml(currentMention.collection.title)}
                        </span>
                      </div>
                    ` : ''}
                    ${currentMention.description ? `
                      <div style="font-size: 12px; color: #374151; line-height: 1.5; word-wrap: break-word;">
                        ${escapeHtml(currentMention.description)}
                      </div>
                    ` : ''}
                  </div>
                  
                  <!-- Footer with date and view count -->
                  <div style="padding-top: 8px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                      <div style="font-size: 12px; color: #6b7280;">
                        ${formatDate(currentMention.created_at)}
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

            // Dispatch event to notify FloatingMapContainer to close location details
            window.dispatchEvent(new CustomEvent('mention-popup-opening', {
              detail: { mentionId: mention.id }
            }));

            // Set current mention ref before creating popup
            currentMentionRef.current = mention;
            
            // Track mention view (async, non-blocking)
            const trackMentionView = () => {
              const referrer = typeof document !== 'undefined' ? document.referrer : null;
              const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
              
              // Generate or get device ID from localStorage
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
                  pin_id: mention.id,
                  referrer_url: referrer || null,
                  user_agent: userAgent || null,
                  session_id: deviceId,
                }),
                keepalive: true,
              }).catch((error) => {
                // Silently fail - don't break the page
                if (process.env.NODE_ENV === 'development') {
                  console.error('[MentionsLayer] Failed to track mention view:', error);
                }
              });
            };

            // Track view asynchronously (non-blocking)
            if ('requestIdleCallback' in window) {
              requestIdleCallback(trackMentionView, { timeout: 2000 });
            } else {
              setTimeout(trackMentionView, 1000);
            }
            
            // Fetch view stats
            const fetchViewStats = async (): Promise<number | null> => {
              try {
                const response = await fetch(`/api/analytics/pin-stats?pin_id=${mention.id}`);
                if (!response.ok) return null;
                const data = await response.json();
                return data.stats?.total_views || 0;
              } catch (error) {
                if (process.env.NODE_ENV === 'development') {
                  console.error('[MentionsLayer] Failed to fetch view stats:', error);
                }
                return null;
              }
            };

            // Create popup immediately (without view count initially)
            const mapbox = await import('mapbox-gl');
            popupRef.current = new mapbox.default.Popup({
              offset: 25,
              closeButton: false, // We're handling close button in the header
              closeOnClick: true,
              className: 'map-mention-popup',
              maxWidth: '280px',
              anchor: 'bottom',
            })
              .setLngLat([mention.lng, mention.lat])
              .setHTML(createPopupContent())
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
              const seeWhoLink = popupElement.querySelector(`#see-who-link-${mention.id}`) as HTMLAnchorElement;
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
              const manageButton = popupElement.querySelector('.mention-manage-button') as HTMLButtonElement;
              const manageMenu = popupElement.querySelector('.mention-manage-menu') as HTMLDivElement;
              
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
                const editButton = popupElement.querySelector('.mention-edit-button') as HTMLButtonElement;
                if (editButton) {
                  editButton.addEventListener('click', async (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    manageMenu.style.display = 'none';
                    
                    // Store current mention for editing
                    currentMentionRef.current = mention;
                    setEditDescription(mention.description || '');
                    setIsEditing(true);
                    
                    // Update popup to show edit form
                    if (popupRef.current) {
                      const editForm = `
                        <div class="map-mention-popup-content" style="min-width: 200px; max-width: 280px; padding: 10px; background: white; border-radius: 6px;">
                          <div style="margin-bottom: 10px; padding-bottom: 8px;">
                            <h3 style="font-size: 13px; font-weight: 600; color: #111827; margin: 0;">Edit Mention</h3>
                          </div>
                          <div style="margin-bottom: 10px;">
                            <label style="display: block; font-size: 12px; font-weight: 500; color: #374151; margin-bottom: 4px;">Description</label>
                            <textarea id="mention-edit-description" style="width: 100%; min-height: 60px; padding: 6px 8px; font-size: 12px; border: 1px solid #d1d5db; border-radius: 4px; resize: vertical; font-family: inherit;" placeholder="Add a description...">${escapeHtml(mention.description || '')}</textarea>
                          </div>
                          <div style="display: flex; gap: 6px;">
                            <button class="mention-edit-cancel" data-mention-id="${mention.id}" style="flex: 1; padding: 6px 12px; font-size: 12px; font-weight: 500; color: #374151; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.background='#e5e7eb';" onmouseout="this.style.background='#f3f4f6';">Cancel</button>
                            <button class="mention-edit-save" data-mention-id="${mention.id}" style="flex: 1; padding: 6px 12px; font-size: 12px; font-weight: 500; color: white; background: #111827; border: 1px solid #111827; border-radius: 4px; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.background='#374151';" onmouseout="this.style.background='#111827';">Save</button>
                          </div>
                        </div>
                      `;
                      popupRef.current.setHTML(editForm);
                      setTimeout(() => setupPopupHandlers(), 0);
                    }
                  });
                }

                // Archive button handler
                const deleteButton = popupElement.querySelector('.mention-delete-button') as HTMLButtonElement;
                if (deleteButton) {
                  deleteButton.addEventListener('click', (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    manageMenu.style.display = 'none';
                    
                    // Show inline confirmation
                    if (popupRef.current) {
                      const confirmDeleteForm = `
                        <div class="map-mention-popup-content" style="min-width: 200px; max-width: 280px; padding: 10px; background: white; border-radius: 6px;">
                          <div style="margin-bottom: 10px; padding-bottom: 8px;">
                            <h3 style="font-size: 13px; font-weight: 600; color: #111827; margin: 0;">Archive Mention</h3>
                          </div>
                          <div style="margin-bottom: 10px;">
                            <p style="font-size: 12px; color: #374151; line-height: 1.5; margin: 0 0 8px 0;">
                              Are you sure you want to archive this mention? It will be hidden from your profile.
                            </p>
                            ${mention.description ? `
                              <div style="padding: 8px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; margin-bottom: 8px;">
                                <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">Mention description:</div>
                                <div style="font-size: 12px; color: #111827;">${escapeHtml(mention.description)}</div>
                              </div>
                            ` : ''}
                          </div>
                          <div style="display: flex; gap: 6px;">
                            <button class="mention-delete-cancel" data-mention-id="${mention.id}" style="flex: 1; padding: 6px 12px; font-size: 12px; font-weight: 500; color: #374151; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.background='#e5e7eb';" onmouseout="this.style.background='#f3f4f6';">Cancel</button>
                            <button class="mention-delete-confirm" data-mention-id="${mention.id}" style="flex: 1; padding: 6px 12px; font-size: 12px; font-weight: 500; color: white; background: #dc2626; border: 1px solid #dc2626; border-radius: 4px; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.background='#b91c1c';" onmouseout="this.style.background='#dc2626';">Archive</button>
                          </div>
                        </div>
                      `;
                      popupRef.current.setHTML(confirmDeleteForm);
                      setTimeout(() => setupPopupHandlers(), 0);
                    }
                  });
                }
              }

              // Archive confirmation handlers
              const deleteCancelButton = popupElement.querySelector('.mention-delete-cancel') as HTMLButtonElement;
              if (deleteCancelButton) {
                deleteCancelButton.addEventListener('click', (e: MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const mentionId = deleteCancelButton.getAttribute('data-mention-id');
                  if (!mentionId) return;
                  
                  const currentMentionForCancel = mentionsRef.current.find(m => m.id === mentionId) || mention;
                  if (!currentMentionForCancel) return;
                  
                  // Reload popup with original content
                  if (popupRef.current) {
                    popupRef.current.setHTML(createPopupContent(currentMentionForCancel));
                    setTimeout(() => setupPopupHandlers(), 0);
                  }
                });
              }

              const deleteConfirmButton = popupElement.querySelector('.mention-delete-confirm') as HTMLButtonElement;
              if (deleteConfirmButton) {
                deleteConfirmButton.addEventListener('click', async (e: MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const mentionId = deleteConfirmButton.getAttribute('data-mention-id');
                  if (!mentionId) return;
                  
                  const mentionToDelete = mentionsRef.current.find(m => m.id === mentionId) || mention;
                  if (!mentionToDelete) return;
                  
                  setIsDeleting(true);
                  
                  // Update button to show loading state
                  if (deleteConfirmButton) {
                    deleteConfirmButton.disabled = true;
                    deleteConfirmButton.style.opacity = '0.6';
                    deleteConfirmButton.style.cursor = 'not-allowed';
                    deleteConfirmButton.textContent = 'Archiving...';
                  }
                  
                  try {
                    // Archive the mention by updating archived = true
                    await MentionService.updateMention(mentionId, { archived: true });
                    
                    // Remove mention from local refs
                    mentionsRef.current = mentionsRef.current.filter(m => m.id !== mentionId);
                    // Reload mentions
                    const yearParam = searchParams.get('year');
                    const year = yearParam ? parseInt(yearParam, 10) : undefined;
                    const updatedMentions = await MentionService.getMentions(year ? { year } : undefined);
                    mentionsRef.current = updatedMentions;
                    const geoJSON = MentionService.mentionsToGeoJSON(updatedMentions);
                    const source = mapboxMap.getSource(sourceId) as any;
                    if (source) {
                      source.setData(geoJSON);
                    }
                    // Close popup
                    if (popupRef.current) {
                      popupRef.current.remove();
                      popupRef.current = null;
                    }
                    // Dispatch event to refresh mentions
                    window.dispatchEvent(new CustomEvent('mention-archived', { detail: { mentionId } }));
                  } catch (error) {
                    console.error('[MentionsLayer] Error archiving mention:', error);
                    // Restore button state
                    if (deleteConfirmButton) {
                      deleteConfirmButton.disabled = false;
                      deleteConfirmButton.style.opacity = '1';
                      deleteConfirmButton.style.cursor = 'pointer';
                      deleteConfirmButton.textContent = 'Archive';
                    }
                    // Show error in popup
                    if (popupRef.current) {
                      const errorForm = `
                        <div class="map-mention-popup-content" style="min-width: 200px; max-width: 280px; padding: 10px; background: white; border-radius: 6px;">
                          <div style="margin-bottom: 10px; padding-bottom: 8px;">
                            <h3 style="font-size: 13px; font-weight: 600; color: #dc2626; margin: 0;">Archive Failed</h3>
                          </div>
                          <div style="margin-bottom: 10px;">
                            <p style="font-size: 12px; color: #374151; line-height: 1.5; margin: 0;">
                              Failed to archive mention. Please try again.
                            </p>
                          </div>
                          <div style="display: flex; gap: 6px;">
                            <button class="mention-delete-error-ok" data-mention-id="${mentionId}" style="flex: 1; padding: 6px 12px; font-size: 12px; font-weight: 500; color: white; background: #111827; border: 1px solid #111827; border-radius: 4px; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.background='#374151';" onmouseout="this.style.background='#111827';">OK</button>
                          </div>
                        </div>
                      `;
                      popupRef.current.setHTML(errorForm);
                      setTimeout(() => {
                        const okButton = popupRef.current?.getElement()?.querySelector('.mention-delete-error-ok') as HTMLButtonElement;
                        if (okButton) {
                          okButton.addEventListener('click', () => {
                            if (popupRef.current) {
                              const currentMentionForReload = mentionsRef.current.find(m => m.id === mentionId) || mentionToDelete;
                              popupRef.current.setHTML(createPopupContent(currentMentionForReload));
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
              const editCancelButton = popupElement.querySelector('.mention-edit-cancel') as HTMLButtonElement;
              if (editCancelButton) {
                editCancelButton.addEventListener('click', (e: MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const mentionId = editCancelButton.getAttribute('data-mention-id');
                  if (!mentionId) return;
                  
                  const currentMentionForCancel = mentionsRef.current.find(m => m.id === mentionId) || mention;
                  if (!currentMentionForCancel) return;
                  
                  setIsEditing(false);
                  currentMentionRef.current = null;
                  // Reload popup with original content
                  if (popupRef.current) {
                    popupRef.current.setHTML(createPopupContent(currentMentionForCancel));
                    setTimeout(() => setupPopupHandlers(), 0);
                  }
                });
              }

              const editSaveButton = popupElement.querySelector('.mention-edit-save') as HTMLButtonElement;
              const editDescriptionTextarea = popupElement.querySelector('#mention-edit-description') as HTMLTextAreaElement;
              if (editSaveButton) {
                editSaveButton.addEventListener('click', async (e: MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const mentionId = editSaveButton.getAttribute('data-mention-id');
                  if (!mentionId) return;
                  
                  const currentMentionForEdit = mentionsRef.current.find(m => m.id === mentionId) || mention;
                  if (!currentMentionForEdit) return;
                  
                  const newDescription = editDescriptionTextarea?.value.trim() || null;
                  
                  try {
                    // Update mention description
                    await MentionService.updateMention(mentionId, { description: newDescription });
                    
                    // Update mention in local refs
                    const mentionIndex = mentionsRef.current.findIndex(m => m.id === mentionId);
                    if (mentionIndex !== -1) {
                      mentionsRef.current[mentionIndex] = {
                        ...mentionsRef.current[mentionIndex],
                        description: newDescription,
                      };
                    }
                    
                    // Reload mentions to get fresh data
                    const yearParam = searchParams.get('year');
                    const year = yearParam ? parseInt(yearParam, 10) : undefined;
                    const updatedMentions = await MentionService.getMentions(year ? { year } : undefined);
                    mentionsRef.current = updatedMentions;
                    const geoJSON = MentionService.mentionsToGeoJSON(updatedMentions);
                    const source = mapboxMap.getSource(sourceId) as any;
                    if (source) {
                      source.setData(geoJSON);
                    }
                    
                    // Update popup with new content
                    if (popupRef.current) {
                      const updatedMention = updatedMentions.find(m => m.id === mentionId);
                      if (updatedMention) {
                        popupRef.current.setHTML(createPopupContent(updatedMention));
                        setTimeout(() => setupPopupHandlers(), 0);
                      }
                    }
                    
                    setIsEditing(false);
                    currentMentionRef.current = null;
                    
                    // Dispatch event to refresh mentions
                    window.dispatchEvent(new CustomEvent('mention-updated', { detail: { mentionId } }));
                  } catch (error) {
                    console.error('[MentionsLayer] Error updating mention:', error);
                    alert('Failed to update mention. Please try again.');
                  }
                });
              }
            };

            setTimeout(setupPopupHandlers, 0);

            // Fetch and update view count asynchronously
            fetchViewStats().then((viewCount) => {
              if (popupRef.current && viewCount !== null) {
                popupRef.current.setHTML(createPopupContent(mention, viewCount));
                // Re-setup handlers after updating HTML
                setTimeout(setupPopupHandlers, 0);
              }
            });

            // Cleanup popup ref when it closes
            popupRef.current.on('close', () => {
              currentMentionRef.current = null;
              popupRef.current = null;
            });
          };

          // Add click handler to point layer
          // Cast to any for layer-specific event handlers (not in interface)
          (mapboxMap as any).on('click', pointLayerId, handleMentionClick);
          (mapboxMap as any).on('click', pointLabelLayerId, handleMentionClick);

          // Make mentions cursor pointer and prevent mention creation on hover
          const handleMentionHoverStart = (e: any) => {
            if (!e || !e.point) return;
            
            // Get mention ID from the feature
            const features = (mapboxMap as any).queryRenderedFeatures(e.point, {
              layers: [pointLayerId, pointLabelLayerId],
            });
            
            if (features.length > 0) {
              const mentionId = features[0].properties?.id;
              if (mentionId) {
                // Find the full mention object
                const mention = mentionsRef.current.find(m => m.id === mentionId);
                if (mention) {
                  // Dispatch event with mention ID to prevent mention creation when hovering
                  window.dispatchEvent(new CustomEvent('mention-hover-start', {
                    detail: { mentionId, mention }
                  }));
                  const canvas = (mapboxMap as any).getCanvas();
                  if (canvas) {
                    canvas.style.cursor = 'pointer';
                  }
                }
              }
            }
          };
          
          const handleMentionHoverEnd = () => {
            // Dispatch event to allow mention creation when not hovering
            window.dispatchEvent(new CustomEvent('mention-hover-end'));
            const canvas = (mapboxMap as any).getCanvas();
            if (canvas) {
              canvas.style.cursor = '';
            }
          };
          
          // Add hover handlers for both point and label layers
          (mapboxMap as any).on('mouseenter', pointLayerId, handleMentionHoverStart);
          (mapboxMap as any).on('mouseleave', pointLayerId, handleMentionHoverEnd);
          (mapboxMap as any).on('mouseenter', pointLabelLayerId, handleMentionHoverStart);
          (mapboxMap as any).on('mouseleave', pointLabelLayerId, handleMentionHoverEnd);

          // Listen for location-selected-on-map event to close popup
          locationSelectedHandlerRef.current = () => {
            if (popupRef.current) {
              popupRef.current.remove();
              popupRef.current = null;
            }
          };
          window.addEventListener('location-selected-on-map', locationSelectedHandlerRef.current);

          clickHandlersAddedRef.current = true;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load map mentions';
        console.error('[MentionsLayer] Error loading map mentions:', errorMessage, error);
        // Log full error details in development
        if (process.env.NODE_ENV === 'development') {
          console.error('[MentionsLayer] Full error details:', {
            error,
            message: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
        isAddingLayersRef.current = false;
      }
    };

    loadMentions();

    // Re-add mentions when map style changes (e.g., switching to satellite)
    // Use 'style.load' instead of 'styledata' - fires once when style is fully loaded
    // This minimizes flash by re-adding layers immediately after style loads
    const handleStyleLoad = () => {
      if (!mounted) return;
      
      const mapboxMap = map as any;
      if (!mapboxMap.isStyleLoaded()) return;
      
      // Check if source already exists (shouldn't after style change, but check anyway)
      const sourceExists = !!mapboxMap.getSource(sourceId);
      if (sourceExists) {
        return;
      }
      
      // Prevent concurrent re-initialization
      if (isHandlingStyleChangeRef.current) return;
      isHandlingStyleChangeRef.current = true;
      
      // Reset flags and reload mentions immediately
      isAddingLayersRef.current = false;
      clickHandlersAddedRef.current = false;
      
      loadMentions().finally(() => {
        isHandlingStyleChangeRef.current = false;
      });
    };

    // Subscribe to style.load event - fires once when style is fully loaded
    // This is better than 'styledata' which fires multiple times and requires debouncing
    try {
      map.on('style.load', handleStyleLoad);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[MentionsLayer] Error subscribing to style.load:', e);
      }
    }

    // Listen for mention-created event to immediately add new mention
    mentionCreatedHandlerRef.current = async (event: CustomEvent<{ mention: Mention }>) => {
      if (!mounted || !map || !mapLoaded) return;
      
      if (!event.detail) return;
      const { mention } = event.detail;
      if (!mention) return;

      try {
        const mapboxMap = map as any;
        const existingSource = map.getSource(sourceId) as any;
        
        if (existingSource && existingSource.type === 'geojson') {
          // Add the new mention to the current list
          mentionsRef.current = [mention, ...mentionsRef.current];
          
          // Update the GeoJSON source
          const geoJSON = MentionService.mentionsToGeoJSON(mentionsRef.current);
          existingSource.setData(geoJSON);
        } else {
          // Source doesn't exist yet, reload all mentions
          loadMentions();
        }
      } catch (error) {
        console.error('[MentionsLayer] Error adding mention:', error);
        // Fallback to full reload
        loadMentions();
      }
    };
    window.addEventListener('mention-created', mentionCreatedHandlerRef.current as EventListener);

    // Listen for mention-archived event to immediately remove mention
    mentionArchivedHandlerRef.current = async (event: CustomEvent<{ mentionId: string }>) => {
      if (!mounted || !map || !mapLoaded) return;
      
      if (!event.detail) return;
      const { mentionId } = event.detail;
      if (!mentionId) return;

      try {
        const mapboxMap = map as any;
        const existingSource = map.getSource(sourceId) as any;
        
        if (existingSource && existingSource.type === 'geojson') {
          // Remove the archived mention from the current list
          mentionsRef.current = mentionsRef.current.filter(m => m.id !== mentionId);
          
          // Update the GeoJSON source
          const geoJSON = MentionService.mentionsToGeoJSON(mentionsRef.current);
          existingSource.setData(geoJSON);
          
          // Close popup if it's for this mention
          if (popupRef.current && currentMentionRef.current?.id === mentionId) {
            popupRef.current.remove();
            popupRef.current = null;
            currentMentionRef.current = null;
          }
        } else {
          // Source doesn't exist yet, reload all mentions
          loadMentions();
        }
      } catch (error) {
        console.error('[MentionsLayer] Error removing mention:', error);
        // Fallback to full reload
        loadMentions();
      }
    };
    window.addEventListener('mention-archived', mentionArchivedHandlerRef.current as EventListener);

    return () => {
      mounted = false;
      
      // Clear style change timeout
      if (styleChangeTimeoutRef.current) {
        clearTimeout(styleChangeTimeoutRef.current);
        styleChangeTimeoutRef.current = null;
      }
      
      // Remove window event listeners
      if (locationSelectedHandlerRef.current) {
        window.removeEventListener('location-selected-on-map', locationSelectedHandlerRef.current);
        locationSelectedHandlerRef.current = null;
      }
      if (mentionCreatedHandlerRef.current) {
        window.removeEventListener('mention-created', mentionCreatedHandlerRef.current as EventListener);
        mentionCreatedHandlerRef.current = null;
      }
      if (mentionArchivedHandlerRef.current) {
        window.removeEventListener('mention-archived', mentionArchivedHandlerRef.current as EventListener);
        mentionArchivedHandlerRef.current = null;
      }
      
      // Remove event listeners safely
      if (map && typeof map.off === 'function') {
        try {
          // Remove style.load listener
          map.off('style.load', handleStyleLoad);
        } catch (e) {
          // Event listener may not exist or map may be removed
          if (process.env.NODE_ENV === 'development') {
            console.warn('[MentionsLayer] Error removing styledata listener:', e);
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
          
          // Check if map has been removed or is in invalid state
          if (mapboxMap._removed) {
            return;
          }
          
          // Safely check if getSource is still callable
          let existingSource;
          try {
            existingSource = map.getSource(sourceId);
          } catch (sourceError) {
            // getSource may fail if map is partially destroyed
            return;
          }
          
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
          // Map may be in an invalid state - ignore cleanup errors silently
          // Don't log warnings for cleanup errors as they're expected when map is destroyed
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
          mapboxMap.off('mouseenter', pointLabelLayerId);
          mapboxMap.off('mouseleave', pointLabelLayerId);
        } catch (e) {
          // Handlers may not exist or map may be removed
        }
      }
    };
  }, [map, mapLoaded, searchParams]);

  return null; // This component doesn't render anything
}

