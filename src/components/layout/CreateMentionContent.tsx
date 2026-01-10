'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
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
  initialImageBlob?: Blob | null;
  onMentionCreated?: () => void;
  onDescriptionChange?: (length: number, maxLength: number, isPro: boolean) => void;
}

export default function CreateMentionContent({ 
  map, 
  mapLoaded,
  initialCoordinates,
  initialAtlasMeta,
  initialMapMeta,
  initialFullAddress,
  initialImageBlob,
  onMentionCreated,
  onDescriptionChange
}: CreateMentionContentProps) {
  const { user, account, activeAccountId } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  
  // Determine max length based on account plan (240 for hobby, unlimited for pro/plus)
  const isPro = account?.plan === 'pro' || account?.plan === 'plus';
  const maxLength = isPro ? 10000 : 240; // Very high limit for pro users (effectively unlimited)
  
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'only_me'>('public');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(initialCoordinates || null);
  const [showFirstMentionModal, setShowFirstMentionModal] = useState(false);
  const [showMapMetaInfo, setShowMapMetaInfo] = useState(false);
  const mapMetaInfoRef = useRef<HTMLDivElement>(null);
  const initialCoordinatesProcessedRef = useRef<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height based on scrollHeight, with min and max constraints
      const minHeight = 60; // ~4 rows at text-xs
      const maxHeight = 200; // ~13 rows max
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, [description]);

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

  // Notify parent of description changes
  useEffect(() => {
    onDescriptionChange?.(description.length, maxLength, isPro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description.length, maxLength, isPro]); // Only depend on values, not the callback function

  // Handle initial image/video blob from camera
  useEffect(() => {
    if (initialImageBlob) {
      const isVideo = initialImageBlob.type.startsWith('video/');
      console.log('[CreateMentionContent] Received initial blob from camera:', isVideo ? 'video' : 'image');
      
      // Convert Blob to File for consistency with file input handling
      const fileName = isVideo 
        ? `camera-capture-${Date.now()}.webm`
        : `camera-capture-${Date.now()}.jpg`;
      const file = new File([initialImageBlob], fileName, { type: initialImageBlob.type });
      setImageFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        console.log('[CreateMentionContent] Preview created from camera blob');
      };
      reader.readAsDataURL(initialImageBlob);
    }
    // Note: We don't clear imageFile/imagePreview when initialImageBlob becomes null
    // because the user might have manually selected an image via file input
    // The parent (LiveMap) handles clearing the blob state after mention creation
  }, [initialImageBlob]);

  // Use initialCoordinates if provided, otherwise get map center coordinates
  useEffect(() => {
    if (initialCoordinates) {
      // Create a stable key to compare coordinates
      const coordKey = `${initialCoordinates.lat},${initialCoordinates.lng}`;
      // Only update if coordinates actually changed
      if (initialCoordinatesProcessedRef.current !== coordKey) {
        setCoordinates(initialCoordinates);
        setError(null);
        initialCoordinatesProcessedRef.current = coordKey;
      }
    } else {
      // Reset processed ref when initialCoordinates is null
      initialCoordinatesProcessedRef.current = null;
      if (map && mapLoaded) {
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mapLoaded, initialCoordinates?.lat, initialCoordinates?.lng]); // Only depend on lat/lng values, not the object

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mapLoaded, initialCoordinates?.lat, initialCoordinates?.lng]); // Only depend on lat/lng values, not the object

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      setError('Please sign in to upload images');
      return;
    }

    // Validate file type - only images allowed for now
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (isVideo) {
      setError('Video uploads are not available yet. Please upload an image instead.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    if (!isImage) {
      setError('Please select a valid image file');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Validate file size (max 5MB for images)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Image must be smaller than 5MB');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setImageFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadMedia = async (): Promise<{ url: string; type: 'image' | 'video' } | null> => {
    if (!imageFile || !user) return null;

    setIsUploadingImage(true);
    try {
      const isVideo = imageFile.type.startsWith('video/');
      const isImage = imageFile.type.startsWith('image/');
      
      // Allow images and videos from camera, but only images from file upload
      // (file upload validation happens in handleImageSelect)
      if (!isImage && !isVideo) {
        throw new Error('Only image and video files are allowed');
      }
      
      const fileExt = imageFile.name.split('.').pop() || (isVideo ? 'webm' : 'jpg');
      const fileName = `${user.id}/mentions/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('mentions-media')
        .upload(fileName, imageFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('mentions-media')
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get media URL');
      }

      return {
        url: urlData.publicUrl,
        type: isVideo ? 'video' : 'image',
      };
    } catch (err) {
      console.error('[CreateMentionContent] Error uploading media:', err);
      throw err;
    } finally {
      setIsUploadingImage(false);
    }
  };

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
      // Upload media first if one is selected
      let imageUrl: string | null = null;
      let videoUrl: string | null = null;
      let mediaType: 'image' | 'video' | 'none' = 'none';
      
      if (imageFile) {
        try {
          const mediaResult = await uploadMedia();
          if (mediaResult) {
            if (mediaResult.type === 'video') {
              videoUrl = mediaResult.url;
              mediaType = 'video';
            } else {
              imageUrl = mediaResult.url;
              mediaType = 'image';
            }
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to upload media';
          setError(errorMessage);
          setIsSubmitting(false);
          return;
        }
      }

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
        image_url: imageUrl,
        video_url: videoUrl,
        media_type: mediaType,
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
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
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
          className="w-full px-4 py-2.5 text-xs font-semibold text-gray-900 bg-white hover:bg-gray-50 border border-gray-300 rounded-md transition-colors"
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
          ref={textareaRef}
          value={description}
          onChange={(e) => {
            const value = e.target.value;
            if (value.length <= maxLength) {
              setDescription(value);
              onDescriptionChange?.(value.length, maxLength, isPro);
            }
          }}
          maxLength={maxLength}
          className={`w-full px-0 py-0 text-xs placeholder:text-gray-400 focus:outline-none resize-none bg-transparent overflow-hidden ${
            useTransparentUI ? 'text-white placeholder:text-white/50' : 'text-gray-900'
          }`}
          placeholder="What's going on here?"
          style={{ minHeight: '60px', maxHeight: '200px' }}
          disabled={isSubmitting || !coordinates}
        />
        <div className="flex items-center justify-end gap-2 mt-1.5">
          {/* Hidden file input for image upload (still needed for image preview functionality) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
            disabled={isSubmitting || isUploadingImage}
          />

          {/* Submit Button - Only show if description has at least 1 character or image is selected */}
          {(description.trim().length > 0 || imageFile) && (
            <button
              type="submit"
              disabled={isSubmitting || isUploadingImage || !coordinates || (!description.trim() && !imageFile)}
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
        
        {/* Image Preview */}
        {imagePreview && (
          <div className="relative mt-2">
            <div className="relative w-full h-32 rounded-md overflow-hidden border border-gray-200">
              {imageFile?.type.startsWith('video/') ? (
                <video
                  src={imagePreview}
                  controls
                  className="w-full h-full object-cover"
                  playsInline
                />
              ) : (
                <Image
                  src={imagePreview}
                  alt="Preview"
                  fill
                  className="object-cover"
                  unoptimized
                />
              )}
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                aria-label="Remove media"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
        
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

