'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { InformationCircleIcon, XMarkIcon, CameraIcon, PlusIcon, CheckIcon } from '@heroicons/react/24/outline';
import { MentionService } from '@/features/mentions/services/mentionService';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { MinnesotaBoundsService } from '@/features/map/services/minnesotaBoundsService';
import FirstMentionModal from '@/components/modals/FirstMentionModal';
import MentionCreatedModal from '@/components/modals/MentionCreatedModal';
import { supabase } from '@/lib/supabase';
import { CollectionService } from '@/features/collections/services/collectionService';
import type { Collection } from '@/types/collection';
import type { Mention } from '@/types/mention';


interface CreateMentionContentProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  initialCoordinates?: { lat: number; lng: number } | null;
  initialMapMeta?: Record<string, any> | null;
  initialFullAddress?: string | null;
  initialImageBlob?: Blob | null;
  onMentionCreated?: () => void;
  useTransparentUI?: boolean;
  useWhiteText?: boolean;
  selectedMentionTypeId?: string | null;
}

export default function CreateMentionContent({ 
  map, 
  mapLoaded,
  initialCoordinates,
  initialMapMeta,
  initialFullAddress,
  initialImageBlob,
  onMentionCreated,
  useTransparentUI = false,
  useWhiteText = false,
  selectedMentionTypeId = null,
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [showCollectionSelector, setShowCollectionSelector] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionTitle, setNewCollectionTitle] = useState('');
  const [newCollectionEmoji, setNewCollectionEmoji] = useState('📍');
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const collectionSelectorRef = useRef<HTMLDivElement>(null);
  const [showMentionCreatedModal, setShowMentionCreatedModal] = useState(false);
  const [createdMention, setCreatedMention] = useState<Mention | null>(null);

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

  // Close collection selector when clicking outside
  useEffect(() => {
    if (!showCollectionSelector && !showCreateCollection) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (collectionSelectorRef.current && !collectionSelectorRef.current.contains(event.target as Node)) {
        setShowCollectionSelector(false);
        setShowCreateCollection(false);
        setNewCollectionTitle('');
        setNewCollectionEmoji('📍');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCollectionSelector, showCreateCollection]);

  // Load collections when account is available
  useEffect(() => {
    if (!activeAccountId) {
      setCollections([]);
      setSelectedCollectionId(null);
      return;
    }

    const loadCollections = async () => {
      setLoadingCollections(true);
      try {
        const data = await CollectionService.getCollections(activeAccountId);
        setCollections(data);
      } catch (err) {
        console.error('[CreateMentionContent] Error loading collections:', err);
      } finally {
        setLoadingCollections(false);
      }
    };

    loadCollections();
  }, [activeAccountId]);

  // Handle initial image blob from camera
  useEffect(() => {
    if (initialImageBlob && initialImageBlob.type.startsWith('image/')) {
      const fileName = `camera-capture-${Date.now()}.jpg`;
      const file = new File([initialImageBlob], fileName, { type: initialImageBlob.type });
      setImageFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(initialImageBlob);
    }
  }, [initialImageBlob]);

  // Set coordinates from initialCoordinates or map center
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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      setError('Please sign in to upload images');
      return;
    }

    // Validate file type - only images allowed
    if (!file.type.startsWith('image/')) {
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

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !user) return null;

    setIsUploadingImage(true);
    try {
      const fileExt = imageFile.name.split('.').pop() || 'jpg';
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
        throw new Error('Failed to get image URL');
      }

      return urlData.publicUrl;
    } catch (err) {
      console.error('[CreateMentionContent] Error uploading image:', err);
      throw err;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionTitle.trim() || isCreatingCollection) return;

    setIsCreatingCollection(true);
    try {
      const newCollection = await CollectionService.createCollection({
        emoji: newCollectionEmoji || '📍',
        title: newCollectionTitle.trim(),
        description: null,
      });
      
      // Refresh collections
      if (activeAccountId) {
        const data = await CollectionService.getCollections(activeAccountId);
        setCollections(data);
      }
      
      // Select the new collection
      setSelectedCollectionId(newCollection.id);
      
      // Reset form
      setShowCreateCollection(false);
      setShowCollectionSelector(false);
      setNewCollectionTitle('');
      setNewCollectionEmoji('📍');
    } catch (err) {
      console.error('[CreateMentionContent] Error creating collection:', err);
      setError(err instanceof Error ? err.message : 'Failed to create collection');
    } finally {
      setIsCreatingCollection(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      openWelcome();
      return;
    }

    // Check if user is onboarded
    if (account && !account.onboarded) {
      setError('Please complete onboarding to create mentions');
      // Trigger onboarding demo to show (it should already be visible, but ensure it's focused)
      window.dispatchEvent(new CustomEvent('show-onboarding-demo'));
      return;
    }

    if (!coordinates) {
      setError('Please center the map on a location in Minnesota');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Upload image first if one is selected
      let imageUrl: string | null = null;
      
      if (imageFile) {
        try {
          imageUrl = await uploadImage();
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to upload image';
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
        collection_id: selectedCollectionId || null,
        mention_type_id: selectedMentionTypeId || null,
        image_url: imageUrl,
        video_url: null,
        media_type: (imageUrl ? 'image' : 'none') as 'image' | 'none',
        full_address: fullAddress,
        atlas_meta: null,
        map_meta: initialMapMeta || null,
      };

      const createdMention = await MentionService.createMention(mentionData, activeAccountId || undefined);
      
      // Trigger refresh IMMEDIATELY so pin appears on map
      window.dispatchEvent(new CustomEvent('mention-created', {
        detail: { mention: createdMention }
      }));
      
      // Store created mention for success modal
      setCreatedMention(createdMention);
      
      // Wait for map to refresh and render the new pin before showing modal
      // This ensures the screenshot captures the newly created pin
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Check if this is the user's first mention
      if (activeAccountId && createdMention.id) {
        try {
          const { count } = await supabase
            .from('mentions')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', activeAccountId)
            .eq('archived', false);

          if (count === 1) {
            setShowFirstMentionModal(true);
          } else {
            // Show success modal for non-first mentions
            setShowMentionCreatedModal(true);
          }
        } catch (err) {
          // Continue even if check fails - show success modal
          console.debug('[CreateMentionContent] Error checking mention count:', err);
          setShowMentionCreatedModal(true);
        }
      } else {
        // Show success modal if no account ID
        setShowMentionCreatedModal(true);
      }
      
      // Reset form
      setDescription('');
      setVisibility('public');
      setSelectedCollectionId(null);
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Dispatch event to remove temporary marker after mention is created
      window.dispatchEvent(new CustomEvent('mention-created-remove-temp-pin'));
      
      // Don't call onMentionCreated callback yet - let the modal handle closing
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
      <form onSubmit={handleSubmit} className={`space-y-3 px-4 pt-4 ${imagePreview ? 'pb-4' : 'pb-0'}`}>
      {/* Map Metadata Label - Only show for admins */}
      {initialMapMeta && initialMapMeta.feature && account?.role === 'admin' && (() => {
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
                {account?.role === 'admin' && (
                  <p className={`text-[10px] mt-1 ${useTransparentUI ? 'text-white/70' : 'text-gray-500'}`}>
                    Admin: Metadata labels visible
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Collection Selector */}
      {activeAccountId && (
        <div className="relative" ref={collectionSelectorRef}>
          {/* Selected Collection or +Assign Button */}
          {!selectedCollectionId ? (
            <button
              type="button"
              onClick={() => {
                if (collections.length === 0) {
                  setShowCreateCollection(true);
                } else {
                  setShowCollectionSelector(!showCollectionSelector);
                }
              }}
              disabled={isSubmitting}
              className={`w-full px-2 py-1.5 text-xs border rounded-md text-left transition-colors ${
                useTransparentUI
                  ? 'bg-white/10 border-white/20 text-blue-400 hover:text-blue-300'
                  : 'bg-white border-gray-200 text-blue-600 hover:text-blue-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              +Assign
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowCollectionSelector(!showCollectionSelector)}
              disabled={isSubmitting}
              className={`w-full px-2 py-1.5 text-xs border rounded-md text-left transition-colors ${
                useTransparentUI
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'bg-white border-gray-200 text-gray-900'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {collections.find(c => c.id === selectedCollectionId)?.emoji} {collections.find(c => c.id === selectedCollectionId)?.title}
            </button>
          )}

          {/* Collection Selector Dropdown */}
          {showCollectionSelector && !showCreateCollection && (
            <div className={`absolute top-full left-0 right-0 mt-1 border rounded-md shadow-lg max-h-48 overflow-y-auto z-50 ${
              useTransparentUI
                ? 'bg-white/90 backdrop-blur-md border-white/20'
                : 'bg-white border-gray-200'
            }`}>
              <button
                type="button"
                onClick={() => {
                  setSelectedCollectionId(null);
                  setShowCollectionSelector(false);
                }}
                className={`w-full px-2 py-1.5 text-xs text-left hover:bg-gray-100 transition-colors ${
                  useTransparentUI ? 'text-white/80' : 'text-gray-600'
                }`}
              >
                Unassigned
              </button>
              {collections.map((collection) => (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => {
                    setSelectedCollectionId(collection.id);
                    setShowCollectionSelector(false);
                  }}
                  className={`w-full px-2 py-1.5 text-xs text-left hover:bg-gray-100 transition-colors ${
                    useTransparentUI ? 'text-white/80' : 'text-gray-900'
                  }`}
                >
                  {collection.emoji} {collection.title}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setShowCollectionSelector(false);
                  setShowCreateCollection(true);
                }}
                className={`w-full px-2 py-1.5 text-xs text-left border-t transition-colors ${
                  useTransparentUI
                    ? 'text-blue-400 hover:bg-white/10 border-white/20'
                    : 'text-blue-600 hover:bg-gray-50 border-gray-200'
                }`}
              >
                +Create Collection
              </button>
            </div>
          )}

          {/* Create Collection Form */}
          {showCreateCollection && (
            <div className={`absolute top-full left-0 right-0 mt-1 border rounded-md shadow-lg p-2 z-50 ${
              useTransparentUI
                ? 'bg-white/90 backdrop-blur-md border-white/20'
                : 'bg-white border-gray-200'
            }`}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCollectionEmoji}
                    onChange={(e) => setNewCollectionEmoji(e.target.value)}
                    placeholder="📍"
                    className={`w-8 text-center text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 ${
                      useTransparentUI
                        ? 'bg-white/10 border-white/20 text-white focus:ring-white/40'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-gray-400'
                    }`}
                    maxLength={2}
                  />
                  <input
                    type="text"
                    value={newCollectionTitle}
                    onChange={(e) => setNewCollectionTitle(e.target.value)}
                    placeholder="Collection title"
                    className={`flex-1 text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 ${
                      useTransparentUI
                        ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-white/40'
                        : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-gray-400'
                    }`}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newCollectionTitle.trim()) {
                        e.preventDefault();
                        handleCreateCollection();
                      }
                    }}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCreateCollection}
                    disabled={isCreatingCollection || !newCollectionTitle.trim()}
                    className={`p-0.5 rounded transition-colors disabled:opacity-50 ${
                      useTransparentUI
                        ? 'hover:bg-white/10 text-white'
                        : 'hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    <CheckIcon className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateCollection(false);
                      setNewCollectionTitle('');
                      setNewCollectionEmoji('📍');
                    }}
                    className={`p-0.5 rounded transition-colors ${
                      useTransparentUI
                        ? 'hover:bg-white/10 text-white'
                        : 'hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Description */}
      <div>
        <textarea
          ref={textareaRef}
          value={description}
            onChange={(e) => {
            const value = e.target.value;
            if (value.length <= maxLength) {
              setDescription(value);
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
        <div className="flex items-center justify-between gap-2 mt-1.5">
          {/* Hidden file input for image upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
            disabled={isSubmitting || isUploadingImage}
          />

          {/* Left: Camera Icon Button - Upload image from device */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting || isUploadingImage}
            className="flex-shrink-0 w-5 h-5 text-gray-900 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Upload image"
          >
            <CameraIcon className="w-5 h-5" />
          </button>

          {/* Right: Character count and submit button */}
          <div className="flex items-center gap-2">
            {/* Character Count */}
            <span className={`text-[10px] ${description.length >= maxLength ? 'text-red-500' : useTransparentUI ? 'text-white/70' : 'text-gray-400'}`}>
              {description.length}/{maxLength}
            </span>

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
        </div>
        
        {/* Image Preview */}
        {imagePreview && (
          <div className="relative mt-2">
            <div className="relative w-full h-32 rounded-md overflow-hidden border border-gray-200">
              <Image
                src={imagePreview}
                alt="Preview"
                fill
                className="object-cover"
                unoptimized
              />
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
        onClose={() => {
          setShowFirstMentionModal(false);
          setShowMentionCreatedModal(true); // Show success modal after first mention modal
        }}
      />
      <MentionCreatedModal
        isOpen={showMentionCreatedModal}
        onClose={() => {
          setShowMentionCreatedModal(false);
          setCreatedMention(null);
          // Now call the callback to close the create popup
          if (onMentionCreated) {
            onMentionCreated();
          }
        }}
        mention={createdMention}
        map={map}
      />
    </>
  );
}

