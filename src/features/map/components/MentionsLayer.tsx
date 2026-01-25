'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { MentionService } from '@/features/mentions/services/mentionService';
import type { Mention } from '@/types/mention';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { supabase } from '@/lib/supabase';
import {
  buildMentionsLabelLayout,
  buildMentionsLabelPaint,
  buildMentionsIconLayout,
  mentionsLayerStyles,
} from '@/features/map/config/layerStyles';

interface MentionsLayerProps {
  map: MapboxMapInstance;
  mapLoaded: boolean;
  onLoadingChange?: (isLoading: boolean) => void;
  /** Optional mention ID to highlight on the map */
  selectedMentionId?: string | null;
  /** Optional map ID to filter mentions by map */
  mapId?: string | null;
}

/**
 * MentionsLayer component manages Mapbox mention visualization
 * Handles fetching, formatting, and real-time updates
 */
export default function MentionsLayer({ map, mapLoaded, onLoadingChange, selectedMentionId, mapId }: MentionsLayerProps) {
  const sourceId = 'map-mentions';
  const pointLayerId = 'map-mentions-point';
  const pointLabelLayerId = 'map-mentions-point-label';
  const highlightLayerId = 'map-mentions-highlight';
  const highlightSourceId = 'map-mentions-highlight-source';
  
  const { account } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const mentionsRef = useRef<Mention[]>([]);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const isAddingLayersRef = useRef<boolean>(false);
  const popupRef = useRef<any>(null); // Mapbox Popup instance
  const clickHandlersAddedRef = useRef<boolean>(false);
  const locationSelectedHandlerRef = useRef<(() => void) | null>(null);
  const mentionClickHandlerRef = useRef<((e: any) => void) | null>(null);
  const mentionHoverStartHandlerRef = useRef<((e: any) => void) | null>(null);
  const mentionHoverEndHandlerRef = useRef<(() => void) | null>(null);
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
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | null>(null);
  const [isLoadingMentions, setIsLoadingMentions] = useState(false);

  // Notify parent of loading state changes
  useEffect(() => {
    onLoadingChange?.(isLoadingMentions);
  }, [isLoadingMentions, onLoadingChange]);
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

  // Update highlight when selectedMentionId changes
  useEffect(() => {
    if (!mapLoaded || !map) return;

    const mapboxMap = map as any;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    // Helper to check if base layer exists
    const checkBaseLayerExists = () => {
      try {
        return mapboxMap.getLayer(pointLayerId) !== undefined;
      } catch {
        return false;
      }
    };

    const updateHighlight = () => {
      if (!selectedMentionId) {
        // Remove highlight
        try {
          if (mapboxMap.getLayer(highlightLayerId)) {
            mapboxMap.removeLayer(highlightLayerId);
          }
          if (mapboxMap.getSource(highlightSourceId)) {
            mapboxMap.removeSource(highlightSourceId);
          }
        } catch (e) {
          // Ignore if doesn't exist
        }
        return;
      }

      // Wait for base layer to exist before adding highlight
      if (!checkBaseLayerExists()) {
        // Retry after a short delay if base layer doesn't exist yet
        timeoutId = setTimeout(() => {
          if (checkBaseLayerExists()) {
            updateHighlight();
          }
        }, 100);
        return;
      }

      // Find selected mention in current mentions
      const selectedMention = mentionsRef.current.find(m => m.id === selectedMentionId);
      if (!selectedMention) return;

      // Create highlight GeoJSON
      const highlightGeoJSON = {
        type: 'FeatureCollection' as const,
        features: [{
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [selectedMention.lng, selectedMention.lat],
          },
          properties: {
            id: selectedMention.id,
          },
        }],
      };

      try {
        // Remove existing highlight
        if (mapboxMap.getLayer(highlightLayerId)) {
          mapboxMap.removeLayer(highlightLayerId);
        }
        if (mapboxMap.getSource(highlightSourceId)) {
          mapboxMap.removeSource(highlightSourceId);
        }

        // Add highlight source (check if it exists first)
        if (!mapboxMap.getSource(highlightSourceId)) {
          mapboxMap.addSource(highlightSourceId, {
            type: 'geojson',
            data: highlightGeoJSON,
          });
        } else {
          // Source exists, just update data
          const existingSource = mapboxMap.getSource(highlightSourceId) as any;
          if (existingSource && existingSource.setData) {
            existingSource.setData(highlightGeoJSON);
          }
        }

        // Add highlight circle layer - only if base layer exists and layer doesn't already exist
        if (!mapboxMap.getLayer(highlightLayerId) && checkBaseLayerExists()) {
          try {
            mapboxMap.addLayer({
              id: highlightLayerId,
              type: 'circle',
              source: highlightSourceId,
              paint: {
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  0, 8,
                  10, 12,
                  14, 16,
                  18, 20,
                  20, 24,
                ],
                'circle-color': '#3b82f6',
                'circle-stroke-width': 3,
                'circle-stroke-color': '#2563eb',
                'circle-opacity': 0.3,
                'circle-stroke-opacity': 1.0,
              },
            }, pointLayerId);
          } catch (addError: any) {
            // Ignore "already exists" errors (can happen in React Strict Mode)
            if (addError?.message?.includes('already exists')) {
              // Layer was added by another render, that's fine
            } else {
              console.warn('[MentionsLayer] Error adding highlight layer:', addError);
            }
          }
        }
      } catch (e) {
        console.warn('[MentionsLayer] Error updating highlight:', e);
      }
    };

    updateHighlight();
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [selectedMentionId, mapLoaded, map, pointLayerId, highlightLayerId, highlightSourceId]);

  // Fetch mentions and add to map
  useEffect(() => {
    if (!map || !mapLoaded) return;

    let mounted = true;

    const loadMentions = async (showLoading = false) => {
      // Prevent concurrent calls
      if (isAddingLayersRef.current) return;
      
      // Always show loading on initial load or when explicitly requested
      setIsLoadingMentions(true);
      
      try {
        // Check if this is the live map
        const isLiveMap = pathname === '/map/live' || pathname === '/live';
        
        // Get year filter from URL
        const yearParam = searchParams.get('year');
        const year = yearParam ? parseInt(yearParam, 10) : undefined;
        
        // Get mention type filter from URL (support both single 'type' and multiple 'types')
        const typeParam = searchParams.get('type');
        const typesParam = searchParams.get('types');
        let mentionTypeIds: string[] | undefined;
        
        if (typesParam) {
          // Multiple types - comma-separated slugs
          const slugs = typesParam.split(',').map(s => s.trim());
          const { data: allTypes } = await supabase
            .from('mention_types')
            .select('id, name')
            .eq('is_active', true);
          
          if (allTypes) {
            const matchingIds = slugs
              .map(slug => {
                const matchingType = allTypes.find(type => {
                  const typeSlug = mentionTypeNameToSlug(type.name);
                  return typeSlug === slug;
                });
                return matchingType?.id;
              })
              .filter(Boolean) as string[];
            
            if (matchingIds.length > 0) {
              mentionTypeIds = matchingIds;
            }
          }
        } else if (typeParam) {
          // Single type
          const { data: allTypes } = await supabase
            .from('mention_types')
            .select('id, name')
            .eq('is_active', true);
          
          if (allTypes) {
            const matchingType = allTypes.find(type => {
              const typeSlug = mentionTypeNameToSlug(type.name);
              return typeSlug === typeParam;
            });
            
            if (matchingType) {
              mentionTypeIds = [matchingType.id];
            }
          }
        }
        
        let mentions: Mention[] = [];
        
        // For live map, use cached endpoint with client-side filtering
        if (isLiveMap) {
          const CACHE_KEY = 'live_map_mentions_cache';
          const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
          
          // Check sessionStorage cache first
          try {
            const cached = sessionStorage.getItem(CACHE_KEY);
            if (cached) {
              const { data, timestamp } = JSON.parse(cached);
              const age = Date.now() - timestamp;
              
              if (age < CACHE_DURATION) {
                // Use cached data immediately
                mentions = data;
                
                // Apply client-side filters
                if (mentionTypeIds && mentionTypeIds.length > 0) {
                  mentions = mentions.filter(m => 
                    m.mention_type?.id && mentionTypeIds!.includes(m.mention_type.id)
                  );
                }
                
                if (timeFilter) {
                  const now = Date.now();
                  const filterTime = timeFilter === '24h' 
                    ? now - 24 * 60 * 60 * 1000
                    : timeFilter === '7d'
                    ? now - 7 * 24 * 60 * 60 * 1000
                    : 0;
                  
                  if (filterTime > 0) {
                    mentions = mentions.filter(m => {
                      const mentionTime = new Date(m.created_at).getTime();
                      return mentionTime >= filterTime;
                    });
                  }
                }
                
                if (year) {
                  mentions = mentions.filter(m => {
                    if (!m.post_date) return false;
                    const mentionYear = new Date(m.post_date).getFullYear();
                    return mentionYear === year;
                  });
                }
                
                // Fetch fresh data in background (stale-while-revalidate)
                fetch('/api/maps/live/mentions')
                  .then(res => res.json())
                  .then(data => {
                    if (data.mentions && mounted) {
                      // Update cache
                      try {
                        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                          data: data.mentions,
                          timestamp: Date.now(),
                        }));
                      } catch (err) {
                        // Cache write failed, continue
                      }
                    }
                  })
                  .catch(() => {
                    // Background fetch failed, continue with cached data
                  });
              }
            }
          } catch (err) {
            // Cache read failed, continue with API fetch
          }
          
          // If no valid cache, fetch from API
          if (mentions.length === 0) {
            try {
              const response = await fetch('/api/maps/live/mentions');
              if (response.ok) {
                const data = await response.json();
                mentions = data.mentions || [];
                
                // Store in cache
                try {
                  sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                    data: mentions,
                    timestamp: Date.now(),
                  }));
                } catch (err) {
                  // Cache write failed, continue
                }
                
                // Apply client-side filters
                if (mentionTypeIds && mentionTypeIds.length > 0) {
                  mentions = mentions.filter(m => 
                    m.mention_type?.id && mentionTypeIds!.includes(m.mention_type.id)
                  );
                }
                
                if (timeFilter) {
                  const now = Date.now();
                  const filterTime = timeFilter === '24h' 
                    ? now - 24 * 60 * 60 * 1000
                    : timeFilter === '7d'
                    ? now - 7 * 24 * 60 * 60 * 1000
                    : 0;
                  
                  if (filterTime > 0) {
                    mentions = mentions.filter(m => {
                      const mentionTime = new Date(m.created_at).getTime();
                      return mentionTime >= filterTime;
                    });
                  }
                }
                
                if (year) {
                  mentions = mentions.filter(m => {
                    if (!m.post_date) return false;
                    const mentionYear = new Date(m.post_date).getFullYear();
                    return mentionYear === year;
                  });
                }
              } else {
                // API failed, fallback to MentionService
                throw new Error('API fetch failed');
              }
            } catch (err) {
              // Fallback to MentionService
              const filters: any = {
                include_null_map_id: true,
              };
              if (mentionTypeIds && mentionTypeIds.length > 0) {
                if (mentionTypeIds.length === 1) {
                  filters.mention_type_id = mentionTypeIds[0];
                } else {
                  filters.mention_type_ids = mentionTypeIds;
                }
              }
              if (year && !timeFilter) {
                filters.year = year;
              }
              if (timeFilter) {
                filters.timeFilter = timeFilter;
              }
              mentions = await MentionService.getMentions(filters);
            }
          }
        } else {
          // For non-live maps, use existing MentionService logic
          const filters: any = {};
          if (mapId) {
            filters.map_id = mapId;
          }
          if (year && !timeFilter) {
            filters.year = year;
          }
          if (timeFilter) {
            filters.timeFilter = timeFilter;
          }
          if (mentionTypeIds && mentionTypeIds.length > 0) {
            if (mentionTypeIds.length === 1) {
              filters.mention_type_id = mentionTypeIds[0];
            } else {
              filters.mention_type_ids = mentionTypeIds;
            }
          }
          
          mentions = await MentionService.getMentions(Object.keys(filters).length > 0 ? filters : undefined);
        }
        if (!mounted) return;

        mentionsRef.current = mentions;
        const geoJSON = MentionService.mentionsToGeoJSON(mentions);

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
        // Optimized: Load fallback first, then add map layers, then lazy load account images
        const fallbackImageId = 'map-mention-heart-fallback';
        const accountImageIds = new Map<string, string>();
        
        // Load fallback heart icon (required before adding layers)
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
              // Double-check before adding (race condition protection)
              if (!mapboxMap.hasImage(fallbackImageId)) {
                try {
                  mapboxMap.addImage(fallbackImageId, imageData, { pixelRatio: 2 });
                } catch (addError: any) {
                  // Ignore "already exists" errors (can happen in React Strict Mode)
                  if (addError?.message?.includes('already exists')) {
                    // Image was added by another render, that's fine
                  } else {
                    throw addError;
                  }
                }
              }
            }
          } catch (error) {
            console.error('[MentionsLayer] Failed to load fallback icon:', error);
          }
        }
        
        // Collect unique account images (will be loaded asynchronously after map renders)
        const uniqueAccountImages = new Map<string, { imageUrl: string; isPro: boolean }>();
        geoJSON.features.forEach((feature: any) => {
          const accountImageUrl = feature.properties.account_image_url;
          const accountPlan = feature.properties.account_plan;
          const isPro = accountPlan === 'contributor' || accountPlan === 'plus';
          
          if (accountImageUrl) {
            const key = `${accountImageUrl}|${isPro ? 'contributor' : 'regular'}`;
            if (!uniqueAccountImages.has(key)) {
              uniqueAccountImages.set(key, { imageUrl: accountImageUrl, isPro });
            }
          }
        });
        
        // Load each unique account image (separate for contributor vs non-contributor)
        const imageLoadPromises = Array.from(uniqueAccountImages.entries()).map(async ([key, { imageUrl, isPro }]) => {
          const imageId = `map-mention-account-${imageUrl.replace(/[^a-zA-Z0-9]/g, '_')}-${isPro ? 'contributor' : 'regular'}`;
          
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
                
                // Draw border circle - gold gradient for contributor, white for regular
                if (isPro) {
                  // Gold gradient border for contributor accounts
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
                ctx.strokeStyle = isPro ? '#f59e0b' : '#ffffff'; // Gold for contributor, white for regular
                ctx.lineWidth = borderWidth;
                ctx.stroke();
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                
                const imageData = ctx.getImageData(0, 0, size, size);
                // Double-check before adding (race condition protection)
                if (!mapboxMap.hasImage(imageId)) {
                  try {
                    mapboxMap.addImage(imageId, imageData, { pixelRatio: 2 });
                  } catch (addError: any) {
                    // Ignore "already exists" errors (can happen in React Strict Mode)
                    if (addError?.message?.includes('already exists')) {
                      // Image was added by another render, that's fine
                    } else {
                      throw addError;
                    }
                  }
                }
                accountImageIds.set(key, imageId);
              }
            }
          } catch (error) {
            console.warn('[MentionsLayer] Failed to load account image:', imageUrl, error);
            accountImageIds.set(key, fallbackImageId);
          }
        });
        
        // Load images in parallel (but still await for icon expression)
        // Optimized: Load in smaller batches to prevent blocking
        await Promise.all(imageLoadPromises);
        
        // Build case expression for icon selection (match by image URL and plan)
        let iconExpression: any;
        if (accountImageIds.size === 0) {
          // No account images, just use fallback
          iconExpression = fallbackImageId;
        } else {
          // Build case expression with conditions
          iconExpression = ['case'];
          accountImageIds.forEach((imageId, key) => {
            const [imageUrl, planType] = key.split('|');
            if (planType === 'contributor') {
              // Match contributor or plus accounts with this image URL
              iconExpression.push([
                'all',
                ['==', ['get', 'account_image_url'], imageUrl],
                ['in', ['get', 'account_plan'], ['literal', ['contributor', 'plus']]]
              ]);
              iconExpression.push(imageId);
            } else {
              // Match regular accounts (plan is null or not contributor/plus) with this image URL
              iconExpression.push([
                'all',
                ['==', ['get', 'account_image_url'], imageUrl],
                ['!', ['in', ['get', 'account_plan'], ['literal', ['contributor', 'plus']]]]
              ]);
              iconExpression.push(imageId);
            }
          });
          iconExpression.push(fallbackImageId); // Fallback to heart icon
        }

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

        // Build icon-size expression - make selected mention larger
        // Mapbox requires 'zoom' to be at top level, so we always use interpolate with zoom
        // and for each zoom level, use a case expression to return the size directly
        // When selectedMentionId is null, just use base sizes
        const baseIconSize = mentionsLayerStyles.point.icon.size;
        const iconSizeExpression = selectedMentionId
          ? [
              'interpolate',
              ['linear'],
              ['zoom'],
              // For each zoom level, use case to return 1.5x size if selected, normal size otherwise
              0, ['case', ['==', ['get', 'id'], selectedMentionId], 0.375, 0.25],
              5, ['case', ['==', ['get', 'id'], selectedMentionId], 0.6, 0.4],
              10, ['case', ['==', ['get', 'id'], selectedMentionId], 0.975, 0.65],
              12, ['case', ['==', ['get', 'id'], selectedMentionId], 1.2, 0.8],
              14, ['case', ['==', ['get', 'id'], selectedMentionId], 1.65, 1.1],
              16, ['case', ['==', ['get', 'id'], selectedMentionId], 1.95, 1.3],
              18, ['case', ['==', ['get', 'id'], selectedMentionId], 2.25, 1.5],
              20, ['case', ['==', ['get', 'id'], selectedMentionId], 2.7, 1.8],
            ]
          : baseIconSize;

        // Add points as mention icons with zoom-based sizing
        try {
          // Check if layer already exists before adding
          if (mapboxMap.getLayer(pointLayerId)) {
            // Layer already exists, skip adding
            if (process.env.NODE_ENV === 'development') {
              console.warn('[MentionsLayer] Point layer already exists, skipping add');
            }
          } else {
            const iconLayout = buildMentionsIconLayout();
            map.addLayer({
              id: pointLayerId,
              type: 'symbol',
              source: sourceId,
              layout: {
                ...iconLayout,
                'icon-image': iconExpression,
                'icon-size': iconSizeExpression, // Use conditional size expression
              },
            });
          }
        } catch (e: any) {
          // Ignore "already exists" errors (can happen in React Strict Mode)
          if (e?.message?.includes('already exists')) {
            // Layer was added by another render, that's fine
          } else {
            console.error('[MentionsLayer] Error adding point layer:', e);
            isAddingLayersRef.current = false;
            return;
          }
        }

        // Add labels for points (positioned above mention icon)
        try {
          // Check if layer already exists before adding
          if (mapboxMap.getLayer(pointLabelLayerId)) {
            // Layer already exists, skip adding
            if (process.env.NODE_ENV === 'development') {
              console.warn('[MentionsLayer] Label layer already exists, skipping add');
            }
          } else {
            mapboxMap.addLayer({
              id: pointLabelLayerId,
              type: 'symbol',
              source: sourceId,
              layout: buildMentionsLabelLayout(),
              paint: buildMentionsLabelPaint(),
            });
          }
        } catch (e: any) {
          // Ignore "already exists" errors (can happen in React Strict Mode)
          if (e?.message?.includes('already exists')) {
            // Layer was added by another render, that's fine
          } else {
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
        }

        // Add highlight circle for selected mention (blue ring)
        if (selectedMentionId) {
          try {
            // Find the selected mention in the GeoJSON
            const selectedFeature = geoJSON.features.find(
              (f: any) => f.properties?.id === selectedMentionId
            );

            if (selectedFeature) {
              // Create highlight source with just the selected mention
              const highlightGeoJSON = {
                type: 'FeatureCollection' as const,
                features: [selectedFeature],
              };

              // Remove existing highlight source/layer if present
              try {
                if (mapboxMap.getLayer(highlightLayerId)) {
                  mapboxMap.removeLayer(highlightLayerId);
                }
                if (mapboxMap.getSource(highlightSourceId)) {
                  mapboxMap.removeSource(highlightSourceId);
                }
              } catch (e) {
                // Ignore if doesn't exist
              }

              // Add highlight source (check if it exists first)
              if (!mapboxMap.getSource(highlightSourceId)) {
                mapboxMap.addSource(highlightSourceId, {
                  type: 'geojson',
                  data: highlightGeoJSON,
                });
              } else {
                // Source exists, just update data
                const existingSource = mapboxMap.getSource(highlightSourceId) as any;
                if (existingSource && existingSource.setData) {
                  existingSource.setData(highlightGeoJSON);
                }
              }

              // Add highlight circle layer (blue ring around selected mention)
              // Check if layer already exists before adding
              if (!mapboxMap.getLayer(highlightLayerId)) {
                try {
                  mapboxMap.addLayer({
                    id: highlightLayerId,
                    type: 'circle',
                    source: highlightSourceId,
                    paint: {
                      'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        0, 8,   // Small at low zoom
                        10, 12, // Medium at zoom 10
                        14, 16, // Larger at zoom 14
                        18, 20, // Full size at zoom 18
                        20, 24  // Largest at max zoom
                      ],
                      'circle-color': '#3b82f6', // Blue color
                      'circle-stroke-width': 3,
                      'circle-stroke-color': '#2563eb', // Darker blue border
                      'circle-opacity': 0.3, // Semi-transparent fill
                      'circle-stroke-opacity': 1.0, // Solid border
                    },
                  }, pointLayerId); // Insert before point layer so it appears behind
                } catch (addError: any) {
                  // Ignore "already exists" errors (can happen in React Strict Mode)
                  if (addError?.message?.includes('already exists')) {
                    // Layer was added by another render, that's fine
                  } else {
                    throw addError;
                  }
                }
              }
            }
          } catch (e) {
            console.warn('[MentionsLayer] Error adding highlight layer:', e);
            // Continue even if highlight fails
          }
        } else {
          // Remove highlight if no selected mention
          try {
            if (mapboxMap.getLayer(highlightLayerId)) {
              mapboxMap.removeLayer(highlightLayerId);
            }
            if (mapboxMap.getSource(highlightSourceId)) {
              mapboxMap.removeSource(highlightSourceId);
            }
          } catch (e) {
            // Ignore if doesn't exist
          }
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

        // Add click handlers for mention interactions (only once, but reset on filter changes)
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

            // Fetch map_meta for the mention (not included in initial fetch for performance)
            let mapMeta: Record<string, any> | null = null;
            if (!mention.map_meta) {
              try {
                const { supabase } = await import('@/lib/supabase');
                const { data: mentionData } = await supabase
                  .from('mentions')
                  .select('map_meta')
                  .eq('id', mentionId)
                  .single();
                
                if (mentionData && mentionData.map_meta) {
                  mapMeta = mentionData.map_meta;
                  // Update mention with map_meta
                  mention = {
                    ...mention,
                    map_meta: mapMeta,
                  };
                }
              } catch (error) {
                console.error('[MentionsLayer] Error fetching map_meta:', error);
                // Continue without map_meta
              }
            } else {
              mapMeta = mention.map_meta;
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

          // Store handler references for cleanup
          mentionClickHandlerRef.current = handleMentionClick;
          
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
          
          // Store hover handler references for cleanup
          mentionHoverStartHandlerRef.current = handleMentionHoverStart;
          mentionHoverEndHandlerRef.current = handleMentionHoverEnd;
          
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
        // Always clear loading state when done
        setIsLoadingMentions(false);
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
      
      // Remove click and hover handlers before removing layers
      if (map && !(map as any).removed && clickHandlersAddedRef.current) {
        try {
          const mapboxMap = map as any;
          
          // Remove click handlers
          if (mentionClickHandlerRef.current) {
            try {
              if (mapboxMap.getLayer(pointLayerId)) {
                (mapboxMap as any).off('click', pointLayerId, mentionClickHandlerRef.current);
              }
              if (mapboxMap.getLayer(pointLabelLayerId)) {
                (mapboxMap as any).off('click', pointLabelLayerId, mentionClickHandlerRef.current);
              }
            } catch (e) {
              // Handlers may already be removed
            }
          }
          
          // Remove hover handlers
          if (mentionHoverStartHandlerRef.current && mentionHoverEndHandlerRef.current) {
            try {
              if (mapboxMap.getLayer(pointLayerId)) {
                (mapboxMap as any).off('mouseenter', pointLayerId, mentionHoverStartHandlerRef.current);
                (mapboxMap as any).off('mouseleave', pointLayerId, mentionHoverEndHandlerRef.current);
              }
              if (mapboxMap.getLayer(pointLabelLayerId)) {
                (mapboxMap as any).off('mouseenter', pointLabelLayerId, mentionHoverStartHandlerRef.current);
                (mapboxMap as any).off('mouseleave', pointLabelLayerId, mentionHoverEndHandlerRef.current);
              }
            } catch (e) {
              // Handlers may already be removed
            }
          }
          
          // Reset handler refs
          mentionClickHandlerRef.current = null;
          mentionHoverStartHandlerRef.current = null;
          mentionHoverEndHandlerRef.current = null;
          clickHandlersAddedRef.current = false;
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[MentionsLayer] Error removing click handlers:', e);
          }
        }
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
  }, [map, mapLoaded, searchParams, timeFilter, mapId]);

  // Component doesn't render anything visible - loading state is shown in MapTopContainer toast
  return null;
}
