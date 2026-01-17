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
  const mentionCreatedHandlerRef = useRef<EventListener | null>(null);
  const mentionArchivedHandlerRef = useRef<EventListener | null>(null);
  const styleLoadHandlerRef = useRef<(() => void) | null>(null);
  const layersDataRef = useRef<{ geoJSON: any; iconExpression: any[]; accountImageIds: Map<string, string>; fallbackImageId: string } | null>(null);
  const loadMentionsRef = useRef<((showLoading?: boolean) => Promise<void>) | null>(null);
  const hasFittedBoundsRef = useRef(false); // Track if we've done initial bounds fit
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | null>('7d');
  const [isLoadingMentions, setIsLoadingMentions] = useState(false);
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

  // Listen for time filter changes
  useEffect(() => {
    const handleTimeFilterChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ timeFilter: '24h' | '7d' | 'all' }>;
      const filter = customEvent.detail?.timeFilter;
      // Convert 'all' to null for the service (no filter)
      setTimeFilter(filter === 'all' ? null : filter || '7d');
    };

    const handleReloadMentions = () => {
      if (loadMentionsRef.current) {
        loadMentionsRef.current(true);
      }
    };

    window.addEventListener('mention-time-filter-change', handleTimeFilterChange);
    window.addEventListener('reload-mentions', handleReloadMentions);
    return () => {
      window.removeEventListener('mention-time-filter-change', handleTimeFilterChange);
      window.removeEventListener('reload-mentions', handleReloadMentions);
    };
  }, []);

  // Fetch mentions and add to map
  useEffect(() => {
    if (!map || !mapLoaded) return;

    let mounted = true;

    const loadMentions = async (showLoading = false) => {
      // Prevent concurrent calls
      if (isAddingLayersRef.current) return;
      
      if (showLoading) {
        setIsLoadingMentions(true);
      }
      
      try {
        // Get year filter from URL
        const yearParam = searchParams.get('year');
        const year = yearParam ? parseInt(yearParam, 10) : undefined;
        
        // Build filters object
        const filters: any = {};
        if (year && !timeFilter) {
          filters.year = year;
        }
        if (timeFilter) {
          filters.timeFilter = timeFilter;
        }
        
        const mentions = await MentionService.getMentions(Object.keys(filters).length > 0 ? filters : undefined);
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

        // Load account images and fallback heart icon
        const fallbackImageId = 'map-mention-heart-fallback';
        const accountImageIds = new Map<string, string>();
        
        // Load fallback heart icon
        if (!mapboxMap.hasImage(fallbackImageId)) {
          try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = '/heart.png';
            });
            
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, 0, 0, 64, 64);
              const imageData = ctx.getImageData(0, 0, 64, 64);
              mapboxMap.addImage(fallbackImageId, imageData, { pixelRatio: 2 });
            }
          } catch (error) {
            console.error('[MentionsLayer] Failed to load fallback icon:', error);
          }
        }
        
        // Load unique account images with plan info (pro vs non-pro need different borders)
        const uniqueAccountImages = new Map<string, { imageUrl: string; isPro: boolean }>();
        geoJSON.features.forEach((feature: any) => {
          const accountImageUrl = feature.properties.account_image_url;
          const accountPlan = feature.properties.account_plan;
          const isPro = accountPlan === 'pro' || accountPlan === 'plus';
          
          if (accountImageUrl) {
            const key = `${accountImageUrl}|${isPro ? 'pro' : 'regular'}`;
            if (!uniqueAccountImages.has(key)) {
              uniqueAccountImages.set(key, { imageUrl: accountImageUrl, isPro });
            }
          }
        });
        
        // Load each unique account image (separate for pro vs non-pro)
        const imageLoadPromises = Array.from(uniqueAccountImages.entries()).map(async ([key, { imageUrl, isPro }]) => {
          const imageId = `map-mention-account-${imageUrl.replace(/[^a-zA-Z0-9]/g, '_')}-${isPro ? 'pro' : 'regular'}`;
          
          if (mapboxMap.hasImage(imageId)) {
            accountImageIds.set(key, imageId);
            return;
          }
          
          try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = () => {
                // If account image fails, use fallback
                accountImageIds.set(key, fallbackImageId);
                resolve(null);
              };
              img.src = imageUrl;
            });
            
            if (img.complete && img.naturalWidth > 0) {
              const canvas = document.createElement('canvas');
              const padding = 4; // Add padding to prevent square cropping
              const size = 64;
              const borderWidth = 3; // Border width
              const contentSize = size - (padding * 2); // Size of the actual circle content
              const radius = (contentSize - borderWidth * 2) / 2;
              const centerX = size / 2;
              const centerY = size / 2;
              
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // Draw shadow/glow behind the circle for prominence
                ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 2;
                
                // Draw border circle - gold gradient for pro, white for regular
                if (isPro) {
                  // Gold gradient border for pro accounts
                  const gradient = ctx.createLinearGradient(0, 0, size, size);
                  gradient.addColorStop(0, '#fbbf24'); // yellow-400
                  gradient.addColorStop(0.5, '#f59e0b'); // yellow-500
                  gradient.addColorStop(1, '#d97706'); // yellow-600
                  
                  ctx.beginPath();
                  ctx.arc(centerX, centerY, radius + borderWidth, 0, Math.PI * 2);
                  ctx.fillStyle = gradient;
                  ctx.fill();
                } else {
                  // White border for regular accounts
                  ctx.beginPath();
                  ctx.arc(centerX, centerY, radius + borderWidth, 0, Math.PI * 2);
                  ctx.fillStyle = '#ffffff';
                  ctx.fill();
                }
                
                // Reset shadow for image
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                
                // Clip to inner circle for image
                ctx.save();
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.clip();
                
                // Calculate image dimensions to fill circle (cover behavior)
                const imgAspect = img.width / img.height;
                let drawWidth = contentSize;
                let drawHeight = contentSize;
                let drawX = centerX - (drawWidth / 2);
                let drawY = centerY - (drawHeight / 2);
                
                if (imgAspect > 1) {
                  // Image is wider - fit to height
                  drawHeight = contentSize;
                  drawWidth = contentSize * imgAspect;
                  drawX = centerX - (drawWidth / 2);
                } else {
                  // Image is taller - fit to width
                  drawWidth = contentSize;
                  drawHeight = contentSize / imgAspect;
                  drawY = centerY - (drawHeight / 2);
                }
                
                // Draw image centered and cropped to circle
                ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
                ctx.restore();
                
                // Draw border outline with subtle shadow
                ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 1;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius + borderWidth, 0, Math.PI * 2);
                ctx.strokeStyle = isPro ? '#f59e0b' : '#ffffff'; // Gold for pro, white for regular
                ctx.lineWidth = borderWidth;
                ctx.stroke();
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                
                const imageData = ctx.getImageData(0, 0, size, size);
                mapboxMap.addImage(imageId, imageData, { pixelRatio: 2 });
                accountImageIds.set(key, imageId);
              }
            }
          } catch (error) {
            console.warn('[MentionsLayer] Failed to load account image:', imageUrl, error);
            accountImageIds.set(key, fallbackImageId);
          }
        });
        
        await Promise.all(imageLoadPromises);
        
        // Build case expression for icon selection (match by image URL and plan)
        const iconExpression: any[] = ['case'];
        accountImageIds.forEach((imageId, key) => {
          const [imageUrl, planType] = key.split('|');
          if (planType === 'pro') {
            // Match pro or plus accounts with this image URL
            iconExpression.push([
              'all',
              ['==', ['get', 'account_image_url'], imageUrl],
              ['in', ['get', 'account_plan'], ['literal', ['pro', 'plus']]]
            ]);
            iconExpression.push(imageId);
          } else {
            // Match regular accounts (plan is null or not pro/plus) with this image URL
            iconExpression.push([
              'all',
              ['==', ['get', 'account_image_url'], imageUrl],
              ['!', ['in', ['get', 'account_plan'], ['literal', ['pro', 'plus']]]]
            ]);
            iconExpression.push(imageId);
          }
        });
        iconExpression.push(fallbackImageId); // Fallback to heart icon

        // Store layer data for re-adding after style changes (before adding layers)
        layersDataRef.current = {
          geoJSON,
          iconExpression,
          accountImageIds: new Map(accountImageIds),
          fallbackImageId,
        };

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
            'icon-image': iconExpression,
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

        // Fit map bounds to show all mentions on initial load only
        if (!hasFittedBoundsRef.current && mentions.length > 0 && geoJSON.features.length > 0) {
          try {
            // Calculate bounds from all mention coordinates
            let minLng = Infinity;
            let maxLng = -Infinity;
            let minLat = Infinity;
            let maxLat = -Infinity;

            geoJSON.features.forEach((feature: any) => {
              if (feature.geometry && feature.geometry.coordinates) {
                const [lng, lat] = feature.geometry.coordinates;
                minLng = Math.min(minLng, lng);
                maxLng = Math.max(maxLng, lng);
                minLat = Math.min(minLat, lat);
                maxLat = Math.max(maxLat, lat);
              }
            });

            // Only fit bounds if we have valid coordinates
            if (minLng !== Infinity && maxLng !== -Infinity && minLat !== Infinity && maxLat !== -Infinity) {
              // Add padding around the bounds
              const padding = 50; // pixels
              
              mapboxMap.fitBounds(
                [[minLng, minLat], [maxLng, maxLat]],
                {
                  padding: { top: padding, bottom: padding, left: padding, right: padding },
                  maxZoom: 12, // Don't zoom in too much, keep overview
                  duration: 1000, // Smooth animation
                }
              );
              
              hasFittedBoundsRef.current = true; // Mark as done
            }
          } catch (e) {
            // Silently fail if fitBounds fails
            if (process.env.NODE_ENV === 'development') {
              console.warn('[MentionsLayer] Error fitting bounds to mentions:', e);
            }
          }
        }

        // Ensure layers are visible after adding
        try {
          if (mapboxMap.getLayer(pointLayerId)) {
            mapboxMap.setLayoutProperty(pointLayerId, 'visibility', 'visible');
          }
          if (mapboxMap.getLayer(pointLabelLayerId)) {
            mapboxMap.setLayoutProperty(pointLabelLayerId, 'visibility', 'visible');
          }
          
          // Dispatch event to hide reload button
          window.dispatchEvent(new CustomEvent('mentions-reloaded'));
        } catch (error) {
          console.warn('[MentionsLayer] Error showing layers:', error);
        }

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
                  .select('id, username, first_name, image_url, plan')
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
                      plan: accountData.plan,
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
            
            // Optimistically increment view_count for immediate UI feedback
            const updatedMention = {
              ...mention,
              view_count: (mention.view_count || 0) + 1
            };
            
            // Update mention in refs
            const mentionIndex = mentionsRef.current.findIndex(m => m.id === mentionId);
            if (mentionIndex !== -1) {
              mentionsRef.current[mentionIndex] = updatedMention;
            }
            
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
            
            // Dispatch mention-click event for iOS-style popup (handled by LiveMap)
            // Use the updated mention with incremented view_count
            window.dispatchEvent(new CustomEvent('mention-click', {
              detail: { 
                mention: updatedMention,
                address: mention.full_address || mention.map_meta?.place_name || null
              }
            }));
            
            // Don't create Mapbox popup - use iOS-style popup instead
            return;
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

        // Listen for style.load events to hide mentions layer when map style changes
        if (!styleLoadHandlerRef.current) {
          styleLoadHandlerRef.current = () => {
            if (!mounted || !map) return;
            
            const mapboxMap = map as any;
            if (!mapboxMap.isStyleLoaded || !mapboxMap.isStyleLoaded()) return;

            // Hide mentions layers when style changes (if they exist)
            try {
              if (mapboxMap.getLayer(pointLayerId)) {
                mapboxMap.setLayoutProperty(pointLayerId, 'visibility', 'none');
              }
              if (mapboxMap.getLayer(pointLabelLayerId)) {
                mapboxMap.setLayoutProperty(pointLabelLayerId, 'visibility', 'none');
              }
            } catch (error) {
              // Layers may not exist yet - that's okay
              console.debug('[MentionsLayer] Layers may not exist after style change:', error);
            }
            
            // Always dispatch event to show reload button (even if layers don't exist yet)
            window.dispatchEvent(new CustomEvent('mentions-layer-hidden'));
          };

          mapboxMap.on('style.load', styleLoadHandlerRef.current);
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
      } finally {
        if (showLoading) {
          setIsLoadingMentions(false);
        }
      }
    };

    // Store loadMentions in ref for style.load handler
    loadMentionsRef.current = loadMentions;

    loadMentions();

    return () => {
      mounted = false;
      isAddingLayersRef.current = false;
      
      // Cleanup subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      
      // Remove location selected handler
      if (locationSelectedHandlerRef.current) {
        window.removeEventListener('location-selected-on-map', locationSelectedHandlerRef.current);
        locationSelectedHandlerRef.current = null;
      }
      
      // Remove mention created handler
      if (mentionCreatedHandlerRef.current) {
        window.removeEventListener('mention-created', mentionCreatedHandlerRef.current);
        mentionCreatedHandlerRef.current = null;
      }
      
      // Remove mention archived handler
      if (mentionArchivedHandlerRef.current) {
        window.removeEventListener('mention-archived', mentionArchivedHandlerRef.current);
        mentionArchivedHandlerRef.current = null;
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
      
      // Cleanup style change timeout
      if (styleChangeTimeoutRef.current) {
        clearTimeout(styleChangeTimeoutRef.current);
        styleChangeTimeoutRef.current = null;
      }

      // Remove style.load handler
      if (styleLoadHandlerRef.current && map) {
        try {
          const mapboxMap = map as any;
          mapboxMap.off('style.load', styleLoadHandlerRef.current);
        } catch (e) {
          // Map may be removed
        }
        styleLoadHandlerRef.current = null;
      }
      
      // Remove layers and source if map still exists
      if (map && !(map as any).removed) {
        try {
          const mapboxMap = map as any;
          
          // Remove layers
          try {
            if (mapboxMap.getLayer(pointLayerId)) {
              mapboxMap.removeLayer(pointLayerId);
                }
              } catch (e) {
            // Layer may not exist
              }
              
              try {
            if (mapboxMap.getLayer(pointLabelLayerId)) {
              mapboxMap.removeLayer(pointLabelLayerId);
                }
              } catch (e) {
            // Layer may not exist
            }
            
            // Remove source
              try {
            if (mapboxMap.getSource(sourceId)) {
                mapboxMap.removeSource(sourceId);
              }
          } catch (sourceError) {
            // Source may not exist or may be in use
            if (process.env.NODE_ENV === 'development') {
              console.warn('[MentionsLayer] Error removing source:', sourceError);
            }
          }
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[MentionsLayer] Error during cleanup:', e);
          }
        }
      }
    };
  }, [map, mapLoaded, searchParams, timeFilter]);

  // Loading spinner overlay
  if (isLoadingMentions) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-30 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg px-4 py-3 shadow-lg flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
          <span className="text-xs font-medium text-gray-900">Loading mentions...</span>
        </div>
      </div>
    );
  }

  return null;
}
