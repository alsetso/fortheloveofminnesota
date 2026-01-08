'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { MentionService } from '@/features/mentions/services/mentionService';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { MinnesotaBoundsService } from '@/features/map/services/minnesotaBoundsService';
import FirstMentionModal from '@/components/modals/FirstMentionModal';
import { supabase } from '@/lib/supabase';
import { findYouTubeUrls } from '@/features/mentions/utils/youtubeHelpers';
import YouTubePreview from '@/features/mentions/components/YouTubePreview';

interface CreateMentionContentProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  initialCoordinates?: { lat: number; lng: number } | null;
  initialAtlasMeta?: Record<string, any> | null;
  initialMapMeta?: Record<string, any> | null;
  initialFullAddress?: string | null;
  onMentionCreated?: () => void;
}

export default function CreateMentionContent({ 
  map, 
  mapLoaded,
  initialCoordinates,
  initialAtlasMeta,
  initialMapMeta,
  initialFullAddress,
  onMentionCreated 
}: CreateMentionContentProps) {
  const { user, account, activeAccountId } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'only_me'>('public');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(initialCoordinates || null);
  const [showFirstMentionModal, setShowFirstMentionModal] = useState(false);
  const [showMapMetaInfo, setShowMapMetaInfo] = useState(false);
  const mapMetaInfoRef = useRef<HTMLDivElement>(null);
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });

  // Listen for blur style and map style changes
  useEffect(() => {
    const handleBlurStyleChange = (e: CustomEvent) => {
      setUseBlurStyle(e.detail.useBlurStyle);
    };
    const handleMapStyleChange = (e: CustomEvent) => {
      setCurrentMapStyle(e.detail.mapStyle);
    };
    window.addEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    window.addEventListener('map-style-change', handleMapStyleChange as EventListener);
    return () => {
      window.removeEventListener('blur-style-change', handleBlurStyleChange as EventListener);
      window.removeEventListener('map-style-change', handleMapStyleChange as EventListener);
    };
  }, []);

  // Use transparent backgrounds and white text when satellite + blur
  const useTransparentUI = useBlurStyle && currentMapStyle === 'satellite';

  // Detect YouTube URLs in description
  const youtubeUrls = findYouTubeUrls(description);

  // Close map meta info popup when clicking outside
  useEffect(() => {
    if (!showMapMetaInfo) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (mapMetaInfoRef.current && !mapMetaInfoRef.current.contains(event.target as Node)) {
        setShowMapMetaInfo(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMapMetaInfo]);

  // Use initialCoordinates if provided, otherwise get map center coordinates
  useEffect(() => {
    if (initialCoordinates) {
      setCoordinates(initialCoordinates);
      setError(null);
    } else if (map && mapLoaded) {
      const mapboxMap = map as any;
      const center = mapboxMap.getCenter();
      if (center) {
        const lat = center.lat;
        const lng = center.lng;
        
        // Check if within Minnesota bounds
        if (MinnesotaBoundsService.isWithinMinnesota({ lat, lng })) {
          setCoordinates({ lat, lng });
        } else {
          setCoordinates(null);
          setError('Map center is outside Minnesota');
        }
      }
    }
  }, [map, mapLoaded, initialCoordinates]);

  // Listen for map movement to update coordinates (only if no initialCoordinates provided)
  useEffect(() => {
    if (!map || !mapLoaded || initialCoordinates) return;

    const mapboxMap = map as any;
    const updateCoordinates = () => {
      const center = mapboxMap.getCenter();
      if (center) {
        const lat = center.lat;
        const lng = center.lng;
        
        if (MinnesotaBoundsService.isWithinMinnesota({ lat, lng })) {
          setCoordinates({ lat, lng });
          setError(null);
        } else {
          setCoordinates(null);
          setError('Map center is outside Minnesota');
        }
      }
    };

    mapboxMap.on('moveend', updateCoordinates);
    
    return () => {
      mapboxMap.off('moveend', updateCoordinates);
    };
  }, [map, mapLoaded, initialCoordinates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      openWelcome();
      return;
    }

    if (!coordinates) {
      setError('Please center the map on a location in Minnesota');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Reverse geocode if full_address not provided
      let fullAddress = initialFullAddress || null;
      if (!fullAddress && coordinates) {
        try {
          const { MAP_CONFIG } = await import('@/features/map/config');
          const token = MAP_CONFIG.MAPBOX_TOKEN;
          if (token) {
            const url = `${MAP_CONFIG.GEOCODING_BASE_URL}/${coordinates.lng},${coordinates.lat}.json`;
            const params = new URLSearchParams({
              access_token: token,
              types: 'address',
              limit: '1',
            });
            
            const response = await fetch(`${url}?${params}`);
            if (response.ok) {
              const data = await response.json();
              if (data.features && data.features.length > 0) {
                fullAddress = data.features[0].place_name || null;
              }
            }
          }
        } catch (err) {
          console.debug('[CreateMentionContent] Error reverse geocoding:', err);
        }
      }

      const mentionData = {
        lat: coordinates.lat,
        lng: coordinates.lng,
        description: description.trim() || null,
        visibility,
        full_address: fullAddress,
        atlas_meta: initialAtlasMeta || null,
        map_meta: initialMapMeta || null,
      };

      const createdMention = await MentionService.createMention(mentionData, activeAccountId || undefined);
      
      // Check if this is the user's first mention
      if (activeAccountId) {
        try {
          const { count, error: countError } = await supabase
            .from('mentions')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', activeAccountId)
            .eq('archived', false);

          if (!countError && count === 1) {
            // This is the first mention!
            setShowFirstMentionModal(true);
          }
        } catch (err) {
          console.error('[CreateMentionContent] Error checking mention count:', err);
          // Continue even if check fails
        }
      }
      
      // Reset form
      setDescription('');
      setVisibility('public');
      
      // Trigger refresh
      window.dispatchEvent(new CustomEvent('mention-created'));
      
      // Dispatch event to remove temporary marker after mention is created
      window.dispatchEvent(new CustomEvent('mention-created-remove-temp-pin'));
      
      if (onMentionCreated) {
        onMentionCreated();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create mention';
      console.error('[CreateMentionContent] Error creating mention:', errorMessage, err);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="space-y-3 p-4">
        <p className={`text-xs ${useTransparentUI ? 'text-white/80' : 'text-gray-600'}`}>
          Sign in to create mentions on the map.
        </p>
        <button
          onClick={openWelcome}
          className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-3 px-4 py-4">
      {/* Atlas Entity Label */}
      {initialAtlasMeta && (
        <div className={`flex items-center gap-2 p-2 border rounded-md ${
          useTransparentUI
            ? 'bg-white/10 border-white/20'
            : 'bg-gray-50 border-gray-200'
        }`}>
          {initialAtlasMeta.icon_path && (
            <Image
              src={initialAtlasMeta.icon_path}
              alt={initialAtlasMeta.name || 'Entity'}
              width={20}
              height={20}
              className="w-5 h-5 object-contain flex-shrink-0"
              unoptimized
            />
          )}
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-semibold ${useTransparentUI ? 'text-white' : 'text-gray-900'}`}>
              {initialAtlasMeta.name || 'Atlas Entity'}
            </div>
            {initialAtlasMeta.table_name && (
              <div className={`text-[10px] capitalize ${useTransparentUI ? 'text-white/70' : 'text-gray-500'}`}>
                {initialAtlasMeta.table_name.replace('_', ' ')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Map Metadata Label */}
      {initialMapMeta && !initialAtlasMeta && initialMapMeta.feature && (() => {
        const feature = initialMapMeta.feature;
        const props = feature.properties || {};
        
        // Determine display label - prefer name, fallback to type/class/layerId
        let displayName = feature.name || 'Map Feature';
        if (!feature.name) {
          if (props.type) {
            displayName = String(props.type);
          } else if (props.class) {
            displayName = String(props.class).replace(/_/g, ' ');
          } else if (feature.layerId) {
            // Parse layerId for common patterns
            const layerId = feature.layerId.toLowerCase();
            if (layerId.includes('poi')) displayName = 'Point of Interest';
            else if (layerId.includes('building')) displayName = 'Building';
            else if (layerId.includes('road') || layerId.includes('highway')) displayName = 'Road';
            else if (layerId.includes('water')) displayName = 'Water';
            else if (layerId.includes('landuse')) displayName = 'Land Use';
            else if (layerId.includes('place')) displayName = 'Place';
            else displayName = feature.layerId.replace(/-/g, ' ').replace(/_/g, ' ');
          }
        }
        
        // Determine category label - prefer category, fallback to type/class
        let categoryLabel = feature.category && feature.category !== 'unknown' 
          ? feature.category.replace(/_/g, ' ')
          : null;
        
        if (!categoryLabel || categoryLabel === 'unknown') {
          if (props.type) {
            categoryLabel = String(props.type).replace(/_/g, ' ');
          } else if (props.class) {
            categoryLabel = String(props.class).replace(/_/g, ' ');
          } else if (feature.sourceLayer) {
            categoryLabel = feature.sourceLayer.replace(/_/g, ' ');
          } else if (feature.layerId) {
            const layerId = feature.layerId.toLowerCase();
            if (layerId.includes('poi')) categoryLabel = 'Point of Interest';
            else if (layerId.includes('building')) categoryLabel = 'Building';
            else if (layerId.includes('road') || layerId.includes('highway')) categoryLabel = 'Road';
            else if (layerId.includes('water')) categoryLabel = 'Water';
            else categoryLabel = feature.layerId.replace(/-/g, ' ').replace(/_/g, ' ');
          }
        }
        
        // Combine displayName and categoryLabel into single line
        const singleLineLabel = categoryLabel && categoryLabel !== displayName
          ? `${displayName} • ${categoryLabel}`
          : displayName;

        return (
          <div className="relative">
            <div className={`flex items-center gap-2 p-2 border rounded-md ${
              useTransparentUI
                ? 'bg-white/10 border-white/20'
                : 'bg-gray-50 border-gray-200'
            }`}>
              {feature.icon && feature.icon !== '📍' && (
                <span className="text-xs flex-shrink-0">{feature.icon}</span>
              )}
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-semibold truncate ${useTransparentUI ? 'text-white' : 'text-gray-900'}`}>
                  {singleLineLabel}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMapMetaInfo(!showMapMetaInfo);
                }}
                className={`flex-shrink-0 p-0.5 transition-colors ${
                  useTransparentUI
                    ? 'text-white/60 hover:text-white'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                aria-label="Map metadata information"
              >
                <InformationCircleIcon className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {/* Info Popup */}
            {showMapMetaInfo && (
              <div
                ref={mapMetaInfoRef}
                className={`absolute top-full left-0 right-0 mt-1 z-50 border rounded-md shadow-lg p-2 ${
                  useTransparentUI
                    ? 'bg-white/90 backdrop-blur-md border-white/20'
                    : 'bg-white border-gray-200'
                }`}
              >
                <p className={`text-xs ${useTransparentUI ? 'text-white/90' : 'text-gray-600'}`}>
                  By dropping a pin, hovering over labels on the map will reference these in the mention.
                </p>
              </div>
            )}
          </div>
        );
      })()}

      {/* Description */}
      <div>
        <textarea
          value={description}
          onChange={(e) => {
            const value = e.target.value;
            if (value.length <= 240) {
              setDescription(value);
            }
          }}
          maxLength={240}
          className={`w-full px-0 py-0 text-xs placeholder:text-gray-400 focus:outline-none resize-none bg-transparent ${
            useTransparentUI ? 'text-white placeholder:text-white/50' : 'text-gray-900'
          }`}
          placeholder="What's going on here?"
          rows={4}
          disabled={isSubmitting || !coordinates}
        />
        <div className="flex items-center justify-end gap-2 mt-1">
          <span className={`text-[10px] ${
            description.length >= 240 
              ? 'text-red-500' 
              : useTransparentUI 
              ? 'text-white/60' 
              : 'text-gray-400'
          }`}>
            {description.length}/240
          </span>
          {/* Submit Button - Only show if description has at least 1 character */}
          {description.trim().length > 0 && (
            <button
              type="submit"
              disabled={isSubmitting || !coordinates || !description.trim()}
              className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Create Mention"
            >
              {isSubmitting ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <PaperAirplaneIcon className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
        
        {/* YouTube Preview */}
        {youtubeUrls.length > 0 && (
          <div className="mt-2 space-y-2">
            {youtubeUrls.map((youtubeData, index) => (
              <YouTubePreview
                key={index}
                url={youtubeData.url}
                compact={false}
                useTransparentUI={useTransparentUI}
              />
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className={`text-[10px] p-2 rounded ${
          useTransparentUI
            ? 'text-red-300 bg-red-500/20'
            : 'text-red-600 bg-red-50'
        }`}>
          {error}
        </div>
      )}
      </form>
      <FirstMentionModal
        isOpen={showFirstMentionModal}
        onClose={() => setShowFirstMentionModal(false)}
      />
    </>
  );
}

