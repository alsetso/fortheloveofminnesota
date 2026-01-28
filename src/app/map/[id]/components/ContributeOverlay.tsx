'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStateSafe, AccountService } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useToast } from '@/features/ui';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { MentionService } from '@/features/mentions/services/mentionService';
import { supabase } from '@/lib/supabase';
import { XMarkIcon, ChevronLeftIcon, UserIcon, PhotoIcon, CheckCircleIcon, MagnifyingGlassIcon, CameraIcon, UserPlusIcon, ChevronDownIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import ImagePreviewContainer from '@/components/modals/ImagePreviewContainer';
import InlineMap from '@/components/map/InlineMap';
import { MAP_CONFIG } from '@/features/map/config';
import confetti from 'canvas-confetti';
import type { Mention } from '@/types/mention';
import { CollectionService } from '@/features/collections/services/collectionService';
import type { Collection } from '@/types/collection';
import { getMapUrl } from '@/lib/maps/urls';

type MentionType = { id: string; emoji: string; name: string };

interface ContributeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  mapId: string;
  mapSlug?: string | null;
  onMentionCreated?: (mention: Mention) => void;
}

export default function ContributeOverlay({ isOpen, onClose, mapId, mapSlug, onMentionCreated }: ContributeOverlayProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, account, activeAccountId, isLoading, signOut } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const { success, error: showError } = useToast();
  
  const [mentionTypes, setMentionTypes] = useState<MentionType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [fullAddress, setFullAddress] = useState<string | null>(null);
  const [mapMeta, setMapMeta] = useState<Record<string, any> | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [mapZoom, setMapZoom] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdMention, setCreatedMention] = useState<Mention | null>(null);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  
  // Media upload state
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaUploadedUrl, setMediaUploadedUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Tag Others state
  const [taggedAccounts, setTaggedAccounts] = useState<Array<{ id: string; username: string; image_url: string | null }>>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagUsername, setTagUsername] = useState('');
  const [tagSearchResults, setTagSearchResults] = useState<Array<{ id: string; username: string; image_url: string | null }>>([]);
  const [isSearchingTag, setIsSearchingTag] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const [showFullscreenMap, setShowFullscreenMap] = useState(false);
  
  // Collections state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [loadingCollections, setLoadingCollections] = useState(false);
  
  const [showMentionTypesModal, setShowMentionTypesModal] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showMediaPreviewModal, setShowMediaPreviewModal] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const [showCollectionAccordion, setShowCollectionAccordion] = useState(false);
  const [showTagMenuDropdown, setShowTagMenuDropdown] = useState(false);
  const [isUpdatingTaggable, setIsUpdatingTaggable] = useState(false);
  const [showMapMetaInfo, setShowMapMetaInfo] = useState(false);
  const tagInfoRef = useRef<HTMLDivElement>(null);
  const collectionInfoRef = useRef<HTMLDivElement>(null);
  const mediaInfoRef = useRef<HTMLDivElement>(null);
  const mapMetaInfoRef = useRef<HTMLDivElement>(null);
  const tagButtonRef = useRef<HTMLButtonElement>(null);
  const mediaButtonRef = useRef<HTMLButtonElement>(null);
  const tagMenuDropdownRef = useRef<HTMLDivElement>(null);

  // Lock map ID to current map
  const selectedMapId = mapId;

  // Lock body scroll when overlay is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Fuzzy search function
  const fuzzyMatch = (text: string, query: string): boolean => {
    if (!query.trim()) return true;
    const normalizedText = text.toLowerCase().trim();
    const normalizedQuery = query.toLowerCase().trim();
    if (normalizedText.includes(normalizedQuery)) return true;
    let textIndex = 0;
    for (let i = 0; i < normalizedQuery.length; i++) {
      const char = normalizedQuery[i];
      const foundIndex = normalizedText.indexOf(char, textIndex);
      if (foundIndex === -1) return false;
      textIndex = foundIndex + 1;
    }
    return true;
  };

  const filteredMentionTypes = useMemo(() => {
    if (!searchQuery.trim()) return mentionTypes;
    return mentionTypes.filter(type => 
      fuzzyMatch(type.name, searchQuery) || 
      fuzzyMatch(type.emoji, searchQuery)
    );
  }, [mentionTypes, searchQuery]);

  // Fetch mention types
  useEffect(() => {
    if (!isOpen) return;
    const fetchMentionTypes = async () => {
      setLoadingTypes(true);
      try {
        const { data, error } = await supabase
          .from('mention_types')
          .select('id, emoji, name')
          .eq('is_active', true)
          .order('name');
        
        if (error) throw error;
        setMentionTypes((data || []) as MentionType[]);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[ContributeOverlay] Failed to fetch mention types:', error);
        }
        setError('Failed to load mention types');
      } finally {
        setLoadingTypes(false);
      }
    };

    fetchMentionTypes();
  }, [isOpen]);

  // Read URL params and sessionStorage data when overlay opens
  useEffect(() => {
    if (isOpen && searchParams) {
      const urlLat = searchParams.get('lat');
      const urlLng = searchParams.get('lng');
      const urlMentionTypeId = searchParams.get('mention_type_id');
      const dataKey = searchParams.get('data_key');
      
      if (urlLat && urlLng) {
        setLat(urlLat);
        setLng(urlLng);
      }
      
      if (urlMentionTypeId) {
        setSelectedTypeId(urlMentionTypeId);
      }
      
      // Load mapMeta and fullAddress from sessionStorage if available
      if (dataKey) {
        try {
          const stored = sessionStorage.getItem(dataKey);
          if (stored) {
            const { mapMeta: storedMapMeta, fullAddress: storedFullAddress } = JSON.parse(stored);
            if (storedMapMeta) {
              setMapMeta(storedMapMeta);
            }
            if (storedFullAddress) {
              setFullAddress(storedFullAddress);
            }
            // Clean up after reading
            sessionStorage.removeItem(dataKey);
          }
        } catch (err) {
          // Ignore parse errors
        }
      }
    }
  }, [isOpen, searchParams]);

  // Reset form when overlay closes
  useEffect(() => {
    if (!isOpen) {
      // Cleanup confetti interval if it exists
      if (typeof window !== 'undefined' && (window as any).__contributeConfettiCleanup) {
        (window as any).__contributeConfettiCleanup();
        delete (window as any).__contributeConfettiCleanup;
      }
      
      setDescription('');
      setLat('');
      setLng('');
      setSelectedTypeId('');
      setFullAddress(null);
      setMapMeta(null);
      setMapZoom(null);
      if (mediaPreview && mediaPreview.startsWith('blob:')) {
        URL.revokeObjectURL(mediaPreview);
      }
      setMediaFile(null);
      setMediaPreview(null);
      setMediaUploadedUrl(null);
      setMediaType(null);
      setTaggedAccounts([]);
      setSelectedCollectionId(null);
      setCreatedMention(null);
      setShowSuccessScreen(false);
      setError(null);
    }
  }, [isOpen, mediaPreview]);

  // Handle location selection from map
  const handleLocationSelect = useCallback((selectedLat: number, selectedLng: number) => {
    const newLat = selectedLat.toFixed(6);
    const newLng = selectedLng.toFixed(6);
    
    // Clear existing address and mapMeta when location changes
    // This ensures fresh data is fetched for the new location
    if (lat !== newLat || lng !== newLng) {
      setFullAddress(null);
      setMapMeta(null);
    }
    
    setLat(newLat);
    setLng(newLng);
  }, [lat, lng]);

  // Reverse geocode coordinates when they change
  useEffect(() => {
    if (!lat || !lng) {
      setFullAddress(null);
      setMapMeta(null);
      setIsReverseGeocoding(false);
      return;
    }

    // Always fetch fresh data when coordinates change
    // The handleLocationSelect callback clears fullAddress and mapMeta when coordinates change,
    // ensuring fresh data is fetched for each new location

    let cancelled = false;
    setIsReverseGeocoding(true);

    const reverseGeocode = async () => {
      try {
        const token = MAP_CONFIG.MAPBOX_TOKEN;
        if (!token) {
          if (!cancelled && !fullAddress && !mapMeta) {
            setFullAddress(null);
            setMapMeta(null);
          }
          setIsReverseGeocoding(false);
          return;
        }

        const url = `${MAP_CONFIG.GEOCODING_BASE_URL}/${lng},${lat}.json`;
        const params = new URLSearchParams({
          access_token: token,
          types: 'address,poi,neighborhood,locality,place,postcode,district,region',
          limit: '1',
        });

        const response = await fetch(`${url}?${params}`);
        if (cancelled) return;
        
        if (response.ok) {
          const data = await response.json();
          if (cancelled) return;
          
          if (data.features && data.features.length > 0) {
            const feature = data.features[0];
            // Always update with fresh data from reverse geocoding
            setFullAddress(feature.place_name || null);
            setMapMeta({
              feature: feature,
              place_name: feature.place_name,
              text: feature.text,
              place_type: feature.place_type,
              properties: feature.properties,
              context: feature.context,
              geometry: feature.geometry,
            });
          } else {
            if (!fullAddress && !mapMeta) {
              setFullAddress(null);
              setMapMeta(null);
            }
          }
        } else {
          if (!fullAddress && !mapMeta) {
            setFullAddress(null);
            setMapMeta(null);
          }
        }
      } catch (error) {
        if (!cancelled && process.env.NODE_ENV === 'development') {
          console.error('[ContributeOverlay] Failed to reverse geocode:', error);
        }
        if (!cancelled && !fullAddress && !mapMeta) {
          setFullAddress(null);
          setMapMeta(null);
        }
      } finally {
        if (!cancelled) {
          setIsReverseGeocoding(false);
        }
      }
    };

    reverseGeocode();
    
    return () => {
      cancelled = true;
    };
  }, [lat, lng]); // Removed fullAddress and mapMeta from deps to prevent loops

  const handleOpenFullscreenMap = useCallback(() => {
    setShowFullscreenMap(true);
  }, []);

  const handleCloseFullscreenMap = useCallback(() => {
    setShowFullscreenMap(false);
  }, []);

  const handleSelectType = (typeId: string) => {
    setSelectedTypeId(typeId);
    setSearchQuery('');
  };

  // Handle media selection
  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      setError('Please sign in to upload media');
      return;
    }

    setIsProcessingMedia(true);
    setError(null);

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      setError('Please select a valid image or video file.');
      setIsProcessingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    const isPro = account?.plan === 'contributor' || account?.plan === 'plus';
    if (isVideo && !isPro) {
      setError('Videos are a Contributor feature.');
      setIsProcessingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / 1024 / 1024);
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
      setError(`${isVideo ? 'Video' : 'Image'} is too large (${fileSizeMB}MB). Maximum size is ${maxSizeMB}MB.`);
      setIsProcessingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (mediaPreview && mediaPreview.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreview);
    }
    
    setMediaFile(file);
    setMediaType(isImage ? 'image' : 'video');

    try {
      const blobUrl = URL.createObjectURL(file);
      setMediaPreview(blobUrl);
      setIsProcessingMedia(false);
      setShowMediaModal(false);
    } catch (err) {
      setError('Failed to process file.');
      setIsProcessingMedia(false);
      setMediaFile(null);
      setMediaType(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveMedia = () => {
    if (mediaPreview && mediaPreview.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaFile(null);
    setMediaPreview(null);
    setMediaUploadedUrl(null);
    setMediaType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadMedia = async (): Promise<{ url: string | null; type: 'image' | 'video' | null }> => {
    if (!mediaFile || !user || !mediaType) return { url: null, type: null };

    setIsUploadingMedia(true);
    try {
      const fileExt = mediaFile.name.split('.').pop() || (mediaType === 'image' ? 'jpg' : 'mp4');
      const fileName = `${user.id}/mentions/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const contentType = mediaFile.type || (mediaType === 'video' 
        ? (fileExt === 'webm' ? 'video/webm' : fileExt === 'mov' ? 'video/quicktime' : 'video/mp4')
        : (fileExt === 'png' ? 'image/png' : fileExt === 'gif' ? 'image/gif' : fileExt === 'webp' ? 'image/webp' : 'image/jpeg'));

      const { error: uploadError } = await supabase.storage
        .from('mentions-media')
        .upload(fileName, mediaFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: contentType,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: urlData } = supabase.storage
        .from('mentions-media')
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error(`Failed to get ${mediaType} URL`);
      }

      setMediaUploadedUrl(urlData.publicUrl);
      return { url: urlData.publicUrl, type: mediaType };
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[ContributeOverlay] Error uploading media:', err);
      }
      throw err;
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const searchTaggableAccounts = useCallback(async (username: string) => {
    if (!username.trim() || username.length < 1) {
      setTagSearchResults([]);
      return;
    }

    setIsSearchingTag(true);
    setTagError(null);

    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, username, image_url')
        .eq('account_taggable', true)
        .not('username', 'is', null)
        .ilike('username', `${username.trim()}%`)
        .limit(10);

      if (error) throw error;

      setTagSearchResults((data || []).filter(acc => acc.username !== null) as Array<{ id: string; username: string; image_url: string | null }>);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[ContributeOverlay] Error searching taggable accounts:', err);
      }
      setTagError('Failed to search users.');
      setTagSearchResults([]);
    } finally {
      setIsSearchingTag(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (tagUsername && showTagModal) {
        searchTaggableAccounts(tagUsername);
      } else {
        setTagSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [tagUsername, showTagModal, searchTaggableAccounts]);

  // Load collections
  useEffect(() => {
    if (!activeAccountId || !isOpen) {
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
        if (process.env.NODE_ENV === 'development') {
          console.error('[ContributeOverlay] Error loading collections:', err);
        }
      } finally {
        setLoadingCollections(false);
      }
    };

    loadCollections();
  }, [activeAccountId, isOpen]);

  // Close modals when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
        setShowAccountDropdown(false);
      }
      if (tagInfoRef.current && !tagInfoRef.current.contains(event.target as Node)) {
        // Handle tag info
      }
      if (collectionInfoRef.current && !collectionInfoRef.current.contains(event.target as Node)) {
        // Handle collection info
      }
      if (mediaInfoRef.current && !mediaInfoRef.current.contains(event.target as Node)) {
        // Handle media info
      }
      if (tagMenuDropdownRef.current && !tagMenuDropdownRef.current.contains(event.target as Node)) {
        setShowTagMenuDropdown(false);
      }
      if (mapMetaInfoRef.current && !mapMetaInfoRef.current.contains(event.target as Node)) {
        setShowMapMetaInfo(false);
      }
    };

    if (showAccountDropdown || showTagMenuDropdown || showMapMetaInfo) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [showAccountDropdown, showTagMenuDropdown, showMapMetaInfo]);

  const handleAddTaggedAccount = (account: { id: string; username: string; image_url: string | null }) => {
    if (taggedAccounts.some(acc => acc.id === account.id)) {
      setTagError('This user is already tagged');
      return;
    }
    setTaggedAccounts([...taggedAccounts, account]);
    setTagUsername('');
    setTagSearchResults([]);
    setTagError(null);
  };

  const handleRemoveTaggedAccount = (accountId: string) => {
    setTaggedAccounts(taggedAccounts.filter(acc => acc.id !== accountId));
  };

  const handleToggleTaggable = async () => {
    if (!account || !activeAccountId || isUpdatingTaggable) return;
    
    setIsUpdatingTaggable(true);
    try {
      const newTaggable = !account.account_taggable;
      await AccountService.updateCurrentAccount({ account_taggable: newTaggable }, activeAccountId);
      
      if (account) {
        (account as any).account_taggable = newTaggable;
      }
      
      success(
        newTaggable ? 'Tagging enabled' : 'Tagging disabled',
        newTaggable 
          ? 'Others can now tag you in mentions' 
          : 'Others can no longer tag you in mentions'
      );
      setShowTagMenuDropdown(false);
    } catch (err) {
      showError('Failed to update setting', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsUpdatingTaggable(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !activeAccountId) {
      openWelcome();
      return;
    }

    if (!selectedTypeId) {
      setError('Please select a mention type');
      return;
    }

    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      setError('Please enter valid coordinates');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let imageUrl: string | null = null;
      let videoUrl: string | null = null;
      let finalMediaType: 'image' | 'video' | 'none' = 'none';
      
      if (mediaFile && mediaType) {
        const uploadResult = await uploadMedia();
        if (uploadResult.type === 'image') {
          imageUrl = uploadResult.url;
          finalMediaType = 'image';
        } else if (uploadResult.type === 'video') {
          videoUrl = uploadResult.url;
          finalMediaType = 'video';
        }
      }

      const mention = await MentionService.createMention({
        lat: latNum,
        lng: lngNum,
        description: description.trim(),
        mention_type_id: selectedTypeId,
        visibility: 'public',
        image_url: imageUrl || undefined,
        video_url: videoUrl || undefined,
        media_type: finalMediaType !== 'none' ? finalMediaType : undefined,
        tagged_account_ids: taggedAccounts.length > 0 ? taggedAccounts.map(acc => acc.id) : undefined,
        collection_id: selectedCollectionId || undefined,
        map_id: selectedMapId || undefined,
        full_address: fullAddress || undefined,
        map_meta: mapMeta || undefined,
      }, activeAccountId);

      // Dispatch event for MentionsLayer to refresh
      window.dispatchEvent(new CustomEvent('mention-created', {
        detail: { mention }
      }));

      setCreatedMention(mention);
      
      // If callback provided, use it (map page will handle fly-to and modal)
      // Otherwise, show success screen in overlay
      if (onMentionCreated) {
        onMentionCreated(mention);
        setIsSubmitting(false);
      } else {
        window.location.hash = 'success';
        setShowSuccessScreen(true);
        
        // Trigger confetti with proper cleanup
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };
        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
        const interval = setInterval(() => {
          const timeLeft = animationEnd - Date.now();
          if (timeLeft <= 0) {
            clearInterval(interval);
            return;
          }
          const particleCount = 50 * (timeLeft / duration);
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
          });
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
          });
        }, 250);
        
        // Cleanup interval on unmount or overlay close
        const cleanup = () => clearInterval(interval);
        // Store cleanup in a way that survives component updates
        if (typeof window !== 'undefined') {
          (window as any).__contributeConfettiCleanup = cleanup;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create mention');
      setIsSubmitting(false);
    }
  };

  const handleCloseSuccess = () => {
    setShowSuccessScreen(false);
    // Remove hash using history API
    if (typeof window !== 'undefined') {
      const url = window.location.pathname + window.location.search;
      window.history.replaceState(null, '', url);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
    onClose();
  };

  if (!isOpen) return null;

  const isSuccessScreen = showSuccessScreen && createdMention;

  return (
    <div className="fixed inset-0 z-[100] bg-white" style={{ width: '100vw', height: '100dvh' }}>
      <div className="h-full bg-gray-50 overflow-y-auto scrollbar-hide" style={{ width: '100%', height: '100%' }}>
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between">
            <div className="flex items-center">
              <Image
                src="/logo.png"
                alt="For the Love of Minnesota"
                width={120}
                height={32}
                className="h-6 w-auto"
                priority
              />
            </div>
            <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-gray-900">Contribute to Map</h1>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-3 pb-32 space-y-3">
          {isSuccessScreen ? (
            <div className="h-[calc(100vh-200px)] flex items-center justify-center">
              <div className="max-w-md w-full">
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center space-y-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircleIcon className="w-10 h-10 text-green-600" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-gray-900">Mention Created!</h2>
                    <p className="text-sm text-gray-600">Your mention has been added to the map</p>
                  </div>
                  <div className="flex flex-col gap-2 pt-4">
                    <button
                      onClick={() => {
                        if (mapSlug) {
                          router.push(getMapUrl({ id: mapId, slug: mapSlug }));
                        } else {
                          router.push(`/map/${mapId}`);
                        }
                        onClose();
                      }}
                      className="w-full px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                    >
                      Back to Map
                    </button>
                    <button
                      onClick={handleCloseSuccess}
                      className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-md transition-colors"
                    >
                      Create Another
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Profile Section */}
              {account ? (
                <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowCollectionAccordion(!showCollectionAccordion)}
                    className="w-full p-2 flex items-center gap-2 hover:bg-gray-50 transition-colors"
                  >
                    <ProfilePhoto account={account} size="sm" />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-bold text-gray-900 truncate">
                        {AccountService.getDisplayName(account)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedCollectionId ? (
                        <span className="text-xs font-medium text-gray-700 truncate max-w-[120px]">
                          {(() => {
                            const selectedCollection = collections.find(c => c.id === selectedCollectionId);
                            if (!selectedCollection) return '';
                            const displayText = `${selectedCollection.emoji} ${selectedCollection.title}`;
                            return displayText.length > 30 ? `${displayText.substring(0, 30)}...` : displayText;
                          })()}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-gray-700">+Collection</span>
                      )}
                      <ChevronDownIcon 
                        className={`w-4 h-4 text-gray-500 transition-transform duration-200 flex-shrink-0 ${
                          showCollectionAccordion ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>
                  
                  {showCollectionAccordion && (
                    <div className="border-t border-gray-200 p-2 space-y-1.5 max-h-64 overflow-y-auto">
                      {loadingCollections ? (
                        <div className="text-xs text-gray-500 py-4 text-center">Loading collections...</div>
                      ) : collections.length === 0 ? (
                        <div className="text-xs text-gray-500 py-4 text-center">
                          No collections yet. Create one from your profile.
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setSelectedCollectionId(null)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs rounded-md transition-colors ${
                              !selectedCollectionId
                                ? 'bg-gray-100 text-gray-900'
                                : 'hover:bg-gray-50 text-gray-900'
                            }`}
                          >
                            <span className="text-base">📁</span>
                            <span className="font-medium">Unassigned</span>
                            {!selectedCollectionId && (
                              <CheckCircleIcon className="w-4 h-4 text-gray-600 ml-auto" />
                            )}
                          </button>
                          {collections.map((collection) => (
                            <button
                              key={collection.id}
                              type="button"
                              onClick={() => setSelectedCollectionId(collection.id)}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs rounded-md transition-colors ${
                                selectedCollectionId === collection.id
                                  ? 'bg-gray-100 text-gray-900'
                                  : 'hover:bg-gray-50 text-gray-900'
                              }`}
                            >
                              <span className="text-base">{collection.emoji}</span>
                              <span className="font-medium">{collection.title}</span>
                              {selectedCollectionId === collection.id && (
                                <CheckCircleIcon className="w-4 h-4 text-gray-600 ml-auto" />
                              )}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-md border border-gray-200 p-2">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">Sign in to post</p>
                      <p className="text-xs text-gray-500 mt-0.5">Create an account to share your mention</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openWelcome()}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors flex-shrink-0"
                    >
                      Sign In
                    </button>
                  </div>
                </div>
              )}
              
              {/* Mention Type */}
              <div>
                {selectedTypeId ? (
                  <div className="inline-flex items-center gap-2 px-2 py-1.5 bg-white border border-gray-200 rounded-md">
                    <span className="text-lg">
                      {mentionTypes.find(t => t.id === selectedTypeId)?.emoji}
                    </span>
                    <span className="text-xs font-medium text-gray-700">
                      {mentionTypes.find(t => t.id === selectedTypeId)?.name}
                    </span>
                    <XMarkIcon 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTypeId('');
                      }}
                      className="ml-1 w-3.5 h-3.5 text-red-600 hover:text-red-800 transition-colors cursor-pointer"
                      title="Remove mention type"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowMentionTypesModal(true)}
                    className="relative flex items-center gap-2 px-2 py-1.5 rounded-md transition-all hover:bg-gray-50 active:bg-gray-100 group touch-manipulation"
                    title="Add tag (required)"
                  >
                    <span className="text-xl font-bold text-gray-400 group-hover:text-gray-600 transition-colors">
                      #
                    </span>
                    <span className="text-[18px] font-bold text-gray-500 group-hover:text-gray-700 transition-colors">
                      Add tag
                    </span>
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white bg-red-500" />
                  </button>
                )}
              </div>
              
              {/* Location Map */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Location <span className="text-red-500">*</span>
                </label>
                <div className="relative w-full aspect-[3/2] rounded-md border border-gray-200 overflow-hidden bg-gray-50">
                  <InlineMap
                    lat={lat || undefined}
                    lng={lng || undefined}
                    onLocationSelect={handleLocationSelect}
                    onOpenFullscreen={handleOpenFullscreenMap}
                    initialZoom={12}
                    hideMarker={false}
                    onZoomChange={setMapZoom}
                  />
                </div>
                {(lat && lng) && (
                  <div className="mt-1 flex items-start justify-between gap-2">
                    {/* Left side: Address and Zoom */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      {isReverseGeocoding ? (
                        <p className="text-[10px] text-gray-400">Loading address...</p>
                      ) : fullAddress ? (
                        <p className="text-[10px] text-gray-600">{fullAddress}</p>
                      ) : null}
                      {mapZoom !== null && (
                        <p className="text-[10px] text-gray-400">Zoom: {mapZoom.toFixed(1)}</p>
                      )}
                    </div>
                    
                    {/* Right side: Map Meta */}
                    {mapMeta && !isReverseGeocoding && (() => {
                      const feature = mapMeta.feature;
                      const placeType = feature?.place_type?.[0] || '';
                      const text = feature?.text || mapMeta.text || '';
                      const context = feature?.context || mapMeta.context || [];
                      const emoji = feature?.icon || '📍';
                      
                      // Determine display name
                      let displayName = text || mapMeta.place_name?.split(',')[0] || 'Location';
                      if (placeType) {
                        const typeLabels: Record<string, string> = {
                          'poi': 'Point of Interest',
                          'address': 'Address',
                          'neighborhood': 'Neighborhood',
                          'locality': 'City',
                          'place': 'Place',
                        };
                        displayName = typeLabels[placeType] || displayName;
                      }
                      
                      // Determine category label
                      const props = feature?.properties || {};
                      let categoryLabel = feature?.category && feature.category !== 'unknown' 
                        ? feature.category.replace(/_/g, ' ')
                        : null;
                      
                      if (!categoryLabel || categoryLabel === 'unknown') {
                        if (props.type) {
                          categoryLabel = String(props.type).replace(/_/g, ' ');
                        } else if (props.class) {
                          categoryLabel = String(props.class).replace(/_/g, ' ');
                        } else if (feature?.sourceLayer) {
                          categoryLabel = feature.sourceLayer.replace(/_/g, ' ');
                        } else if (feature?.layerId) {
                          const layerId = feature.layerId.toLowerCase();
                          if (layerId.includes('poi')) categoryLabel = 'Point of Interest';
                          else if (layerId.includes('building')) categoryLabel = 'Building';
                          else if (layerId.includes('road') || layerId.includes('highway')) categoryLabel = 'Road';
                          else if (layerId.includes('water')) categoryLabel = 'Water';
                          else categoryLabel = feature.layerId.replace(/-/g, ' ').replace(/_/g, ' ');
                        }
                      }
                      
                      const singleLineLabel = categoryLabel && categoryLabel !== displayName
                        ? `${displayName} • ${categoryLabel}`
                        : displayName;
                      
                      // Build description from place_name or context
                      let description = mapMeta.place_name || '';
                      if (!description && context && Array.isArray(context)) {
                        const parts: string[] = [];
                        const neighborhood = context.find((c: any) => c.id?.startsWith('neighborhood'));
                        const locality = context.find((c: any) => c.id?.startsWith('locality'));
                        const district = context.find((c: any) => c.id?.startsWith('district'));
                        const postcode = context.find((c: any) => c.id?.startsWith('postcode'));
                        const region = context.find((c: any) => c.id?.startsWith('region'));
                        
                        if (neighborhood) parts.push(neighborhood.text);
                        if (locality) parts.push(locality.text);
                        if (district) parts.push(district.text);
                        if (postcode) parts.push(postcode.text);
                        if (region) parts.push(region.text);
                        
                        description = parts.join(', ');
                      }
                      
                      return (
                        <div className="relative flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowMapMetaInfo(!showMapMetaInfo);
                            }}
                            onMouseEnter={() => setShowMapMetaInfo(true)}
                            onMouseLeave={() => setShowMapMetaInfo(false)}
                            className="flex items-center gap-1 px-1.5 py-0.5 border rounded border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                            aria-label="Map metadata information"
                          >
                            {emoji && emoji !== '📍' && (
                              <span className="text-[9px] flex-shrink-0 leading-none">{emoji}</span>
                            )}
                            <span className="text-[9px] font-medium text-gray-700 truncate max-w-[100px] leading-tight">
                              {singleLineLabel}
                            </span>
                          </button>
                          
                          {showMapMetaInfo && description && (
                            <div
                              ref={mapMetaInfoRef}
                              className="absolute top-full right-0 mt-1 z-50 border rounded-md shadow-lg p-2 bg-white border-gray-200 min-w-[180px] max-w-[240px]"
                              onMouseEnter={() => setShowMapMetaInfo(true)}
                              onMouseLeave={() => setShowMapMetaInfo(false)}
                            >
                              <p className="text-[10px] text-gray-700 leading-relaxed">
                                {description}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <form id="mention-form" onSubmit={handleSubmit} className="space-y-3">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-2">
                    <p className="text-xs text-red-600">{error}</p>
                  </div>
                )}

                {/* Description */}
                <div className="pt-3">
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    maxLength={240}
                    className="w-full px-0 py-2 text-[20px] font-bold bg-transparent border-0 focus:outline-none resize-none placeholder:text-gray-400"
                    placeholder="Write a mention..."
                    required
                  />

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2 sm:gap-1.5 flex-1">
                      <div className="relative">
                        <button
                          ref={tagButtonRef}
                          type="button"
                          onClick={() => {
                            if (!user) {
                              openWelcome();
                              return;
                            }
                            setShowTagModal(true);
                          }}
                          className="relative flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-md transition-all hover:bg-gray-50 active:bg-gray-100 group touch-manipulation"
                          title={taggedAccounts.length > 0 ? `${taggedAccounts.length} user${taggedAccounts.length > 1 ? 's' : ''} tagged` : 'Tag users (optional)'}
                        >
                          <UserPlusIcon className={`w-4 h-4 sm:w-4 sm:h-4 transition-colors ${
                            taggedAccounts.length > 0 ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-600'
                          }`} />
                          {taggedAccounts.length > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 sm:w-2 sm:h-2 bg-green-500 rounded-full border-2 border-white" />
                          )}
                        </button>
                      </div>

                      <div className="relative">
                        <button
                          ref={mediaButtonRef}
                          type="button"
                          onClick={() => {
                            if (!user) {
                              openWelcome();
                              return;
                            }
                            if (mediaPreview) {
                              setShowMediaPreviewModal(true);
                            } else {
                              setError(null);
                              setShowMediaModal(true);
                            }
                          }}
                          className="relative flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-md transition-all hover:bg-gray-50 active:bg-gray-100 group touch-manipulation"
                          title={mediaPreview ? (mediaType === 'video' ? 'View video' : 'View photo') : 'Add media (optional)'}
                        >
                          <CameraIcon className={`w-4 h-4 sm:w-4 sm:h-4 transition-colors ${
                            mediaPreview ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-600'
                          }`} />
                          {mediaPreview && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 sm:w-2 sm:h-2 bg-green-500 rounded-full border-2 border-white" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-end">
                      <span className={`text-[10px] font-medium px-2.5 py-1.5 rounded-md ${
                        description.length >= 240 
                          ? 'text-red-600 bg-red-50 border border-red-200' 
                          : description.length >= 200
                          ? 'text-orange-600 bg-orange-50 border border-orange-200'
                          : 'text-gray-500 bg-gray-50 border border-gray-200'
                      }`}>
                        {description.length}/240
                      </span>
                    </div>
                  </div>

                  {/* Status Indicators */}
                  {(selectedTypeId || selectedCollectionId || taggedAccounts.length > 0 || mediaPreview) && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pt-1.5 border-t border-gray-100">
                      {selectedTypeId && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 rounded-md border border-green-200">
                          <span className="text-[10px] text-green-700 font-medium">
                            {mentionTypes.find(t => t.id === selectedTypeId)?.emoji} {mentionTypes.find(t => t.id === selectedTypeId)?.name}
                          </span>
                        </div>
                      )}
                      {selectedCollectionId && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 rounded-md border border-green-200">
                          <span className="text-[10px] text-green-700 font-medium">
                            {collections.find(c => c.id === selectedCollectionId)?.emoji} {collections.find(c => c.id === selectedCollectionId)?.title}
                          </span>
                        </div>
                      )}
                      {taggedAccounts.length > 0 && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 rounded-md border border-green-200">
                          <span className="text-[10px] text-green-700 font-medium">
                            @{taggedAccounts.length} user{taggedAccounts.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      {mediaPreview && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 rounded-md border border-green-200">
                          <span className="text-[10px] text-green-700 font-medium">
                            {mediaType === 'video' ? '🎥 Video' : '📷 Photo'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {!selectedTypeId && description.trim().length > 0 && (
                    <div className="mt-1.5 flex items-center gap-1 px-1.5 py-0.5 bg-red-50 rounded-md border border-red-200">
                      <span className="text-[10px] text-red-700 font-medium">
                        ⚠️ Select a mention type to continue
                      </span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <button
                      type="submit"
                      disabled={!user || !activeAccountId || isSubmitting || isUploadingMedia || !selectedTypeId || !description.trim() || !lat || !lng}
                      className="w-full px-4 py-2.5 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {!user || !activeAccountId ? 'Sign In to Post' : (isSubmitting ? (isUploadingMedia ? 'Uploading media...' : 'Creating...') : 'Drop Pin')}
                    </button>
                  </div>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Tag Modal - Simplified version */}
        {showTagModal && (
          <div 
            className="fixed inset-0 z-[110] flex items-end justify-center pointer-events-none"
            onClick={() => setShowTagModal(false)}
          >
            <div 
              className="w-full max-w-[600px] bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-hidden flex flex-col animate-slide-up pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">Tag Others</h2>
                <div className="flex items-center gap-2">
                  <div ref={tagMenuDropdownRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setShowTagMenuDropdown(!showTagMenuDropdown)}
                      className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                      aria-label="Menu"
                    >
                      <EllipsisVerticalIcon className="w-5 h-5" />
                    </button>
                    {showTagMenuDropdown && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                        <button
                          type="button"
                          onClick={handleToggleTaggable}
                          disabled={isUpdatingTaggable}
                          className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
                        >
                          {isUpdatingTaggable ? (
                            <span>Updating...</span>
                          ) : (
                            <>
                              <span>{account?.account_taggable ? 'Disable' : 'Enable'} Tagging</span>
                              {account?.account_taggable && (
                                <CheckCircleIcon className="w-4 h-4 text-green-600 ml-auto" />
                              )}
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTagModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                    aria-label="Close"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={tagUsername}
                    onChange={(e) => {
                      setTagUsername(e.target.value);
                      setTagError(null);
                    }}
                    placeholder="Search by username..."
                    className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                    autoFocus
                  />
                </div>

                {tagError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-2">
                    <p className="text-xs text-red-600">{tagError}</p>
                  </div>
                )}

                {isSearchingTag && (
                  <div className="text-xs text-gray-500 py-4 text-center">Searching...</div>
                )}

                {taggedAccounts.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-500 px-1 mb-1">Tagged</div>
                    {taggedAccounts.map((taggedAccount) => (
                      <div
                        key={taggedAccount.id}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-green-50 rounded-md"
                      >
                        {taggedAccount.image_url ? (
                          <Image
                            src={taggedAccount.image_url}
                            alt={taggedAccount.username}
                            width={24}
                            height={24}
                            className="w-6 h-6 rounded-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                            <UserIcon className="w-3.5 h-3.5 text-gray-500" />
                          </div>
                        )}
                        <span className="font-medium text-xs text-gray-900">@{taggedAccount.username}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTaggedAccount(taggedAccount.id)}
                          className="ml-auto text-gray-400 hover:text-gray-600"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {!isSearchingTag && tagUsername.trim() && tagSearchResults.length === 0 && !tagError && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <p className="text-xs text-yellow-800">
                      No users found. The username may not exist, or the user hasn&apos;t enabled tagging.
                    </p>
                  </div>
                )}

                {!isSearchingTag && tagSearchResults.length > 0 && (
                  <div className="space-y-1">
                    {tagSearchResults.map((account) => {
                      const isAlreadyTagged = taggedAccounts.some(acc => acc.id === account.id);
                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => {
                            if (!isAlreadyTagged) {
                              handleAddTaggedAccount(account);
                              setTagUsername('');
                            } else {
                              setTagError('This user is already tagged');
                            }
                          }}
                          disabled={isAlreadyTagged}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs rounded-md transition-colors ${
                            isAlreadyTagged
                              ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                              : 'hover:bg-gray-50 text-gray-900'
                          }`}
                        >
                          {account.image_url ? (
                            <Image
                              src={account.image_url}
                              alt={account.username}
                              width={24}
                              height={24}
                              className="w-6 h-6 rounded-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                              <UserIcon className="w-3.5 h-3.5 text-gray-500" />
                            </div>
                          )}
                          <span className="font-medium">@{account.username}</span>
                          {isAlreadyTagged && (
                            <span className="ml-auto text-[10px] text-gray-400">Tagged</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {!tagUsername.trim() && taggedAccounts.length === 0 && (
                  <div className="text-xs text-gray-500 py-4 text-center">
                    Search by username to tag users
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mention Types Modal */}
        {showMentionTypesModal && (
          <div 
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 transition-opacity duration-300 p-4"
            onClick={() => setShowMentionTypesModal(false)}
          >
            <div 
              className="w-full max-w-[600px] bg-white rounded-lg shadow-lg max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">What&apos;s going on here?</h2>
                <button
                  type="button"
                  onClick={() => setShowMentionTypesModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="px-4 py-3 border-b border-gray-200">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search mention types..."
                    className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3">
                {loadingTypes ? (
                  <div className="text-xs text-gray-500 py-4 text-center">Loading types...</div>
                ) : filteredMentionTypes.length === 0 ? (
                  <div className="text-xs text-gray-500 py-4 text-center">
                    {searchQuery.trim() ? 'No mention types found.' : 'No mention types available.'}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {filteredMentionTypes.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          handleSelectType(type.id);
                          setShowMentionTypesModal(false);
                          setSearchQuery('');
                        }}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md border transition-all ${
                          selectedTypeId === type.id
                            ? 'border-gray-900 bg-gray-50 opacity-100'
                            : 'border-gray-200 bg-white opacity-60 hover:opacity-80'
                        }`}
                      >
                        <span className="text-lg leading-none">{type.emoji}</span>
                        <span className="text-sm font-medium text-gray-900">{type.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Media Modal - Simplified */}
        {showMediaModal && (
          <div 
            className="fixed inset-0 z-[110] flex items-end justify-center pointer-events-none"
            onClick={() => setShowMediaModal(false)}
          >
            <div 
              className="w-full max-w-[600px] bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-hidden flex flex-col animate-slide-up pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">Add Media</h2>
                <button
                  type="button"
                  onClick={() => setShowMediaModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={(account?.plan === 'contributor' || account?.plan === 'plus') ? "image/*,video/*" : "image/*"}
                  onChange={handleMediaSelect}
                  className="hidden"
                  disabled={isProcessingMedia || isUploadingMedia}
                />

                {isProcessingMedia ? (
                  <div className="relative w-full aspect-video rounded-md border border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center animate-pulse">
                        <PhotoIcon className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-xs font-medium text-gray-600">
                        Processing {mediaType === 'video' ? 'video' : 'image'}...
                      </p>
                    </div>
                  </div>
                ) : mediaPreview ? (
                  <div className="space-y-3">
                    <div className="relative">
                      {mediaType === 'video' ? (
                        <div className="relative w-full aspect-video rounded-md border border-gray-200 overflow-hidden bg-gray-100">
                          <video
                            src={mediaUploadedUrl || mediaPreview}
                            controls
                            playsInline
                            muted
                            preload="metadata"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          onClick={() => setPreviewImageUrl(mediaPreview)}
                          className="relative w-full aspect-video rounded-md border border-gray-200 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity bg-gray-100"
                        >
                          <Image
                            src={mediaPreview}
                            alt="Image preview"
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessingMedia || isUploadingMedia}
                        className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Change {mediaType === 'video' ? 'Video' : 'Photo'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleRemoveMedia();
                          setShowMediaModal(false);
                        }}
                        disabled={isProcessingMedia || isUploadingMedia}
                        className="flex-1 px-3 py-2 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Remove {mediaType === 'video' ? 'Video' : 'Photo'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div
                      onClick={() => !isProcessingMedia && !isUploadingMedia && fileInputRef.current?.click()}
                      className={`relative w-full border-2 border-dashed border-gray-200 rounded-md p-8 transition-colors ${
                        isProcessingMedia || isUploadingMedia
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                          <PhotoIcon className="w-6 h-6 text-gray-600" />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-medium text-gray-900 mb-1">
                            Upload a photo or video
                          </p>
                          <p className="text-[10px] text-gray-500">
                            Click or drag and drop
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            Max file size: 5MB (images) / 50MB (videos, up to 1080p 10s)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {error && (error.includes('image') || error.includes('video') || error.includes('media') || error.includes('file') || error.includes('size') || error.includes('format')) && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 space-y-1">
                    <div className="flex items-start gap-2">
                      <XMarkIcon className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-red-800">Upload Error</p>
                        <p className="text-xs text-red-600 mt-0.5">{error}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="text-xs text-red-700 hover:text-red-800 underline"
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Media Preview Modal */}
        {showMediaPreviewModal && mediaPreview && (
          <div 
            className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none"
          >
            <div 
              className="w-full max-w-[400px] bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">
                  {mediaType === 'video' ? 'Video Preview' : 'Photo Preview'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowMediaPreviewModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="relative w-full">
                {mediaType === 'video' ? (
                  <div className="relative w-full aspect-video bg-black">
                    <video
                      ref={videoRef}
                      src={mediaUploadedUrl || mediaPreview}
                      controls
                      playsInline
                      muted
                      preload="metadata"
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="relative w-full aspect-video bg-gray-100">
                    <Image
                      src={mediaUploadedUrl || mediaPreview}
                      alt="Media preview"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                )}
              </div>

              <div className="px-4 py-3 border-t border-gray-200 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowMediaPreviewModal(false);
                    setShowMediaModal(true);
                  }}
                  className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Change {mediaType === 'video' ? 'Video' : 'Photo'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleRemoveMedia();
                    setShowMediaPreviewModal(false);
                  }}
                  className="flex-1 px-3 py-2 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                >
                  Remove {mediaType === 'video' ? 'Video' : 'Photo'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Preview Container */}
        <ImagePreviewContainer
          isOpen={previewImageUrl !== null}
          onClose={() => setPreviewImageUrl(null)}
          imageUrl={previewImageUrl || ''}
          alt="Mention image preview"
        />
        
        {/* Fullscreen Map Modal */}
        {showFullscreenMap && (
          <div className="fixed inset-0 z-[120] bg-white">
            <div className="relative w-full h-full">
              <button
                type="button"
                onClick={handleCloseFullscreenMap}
                className="absolute top-4 right-4 z-30 flex items-center gap-2 px-4 py-2 text-xs bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 transition-colors"
              >
                <XMarkIcon className="w-4 h-4 text-gray-600" />
                <span className="text-gray-900">Close</span>
              </button>
              
              <div className="w-full h-full">
                <InlineMap
                  lat={lat}
                  lng={lng}
                  onLocationSelect={handleLocationSelect}
                  fullscreen={true}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
