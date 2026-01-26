'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStateSafe, AccountService } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useToast } from '@/features/ui';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { MentionService } from '@/features/mentions/services/mentionService';
import { supabase } from '@/lib/supabase';
import { XMarkIcon, ChevronLeftIcon, UserIcon, PhotoIcon, PlusIcon, CheckCircleIcon, MagnifyingGlassIcon, CameraIcon, UserPlusIcon, ShareIcon, EyeIcon, FolderIcon, Cog6ToothIcon, CreditCardIcon, ArrowRightOnRectangleIcon, ChevronDownIcon, InformationCircleIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import ImagePreviewContainer from '@/components/modals/ImagePreviewContainer';
import InlineMap from '@/components/map/InlineMap';
import { MAP_CONFIG } from '@/features/map/config';
import confetti from 'canvas-confetti';
import type { Mention } from '@/types/mention';
import { CollectionService } from '@/features/collections/services/collectionService';
import type { Collection } from '@/types/collection';

type MentionType = { id: string; emoji: string; name: string };

export default function AddMentionPage() {
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_success, setSuccess] = useState(false);
  const [createdMention, setCreatedMention] = useState<Mention | null>(null);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  
  // Media upload state (image or video)
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null); // Blob URL for preview
  const [mediaUploadedUrl, setMediaUploadedUrl] = useState<string | null>(null); // Supabase URL after upload
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
  const [isCopied, setIsCopied] = useState(false);
  
  // Collections state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [loadingCollections, setLoadingCollections] = useState(false);
  
  // Maps state
  const [maps, setMaps] = useState<Array<{ id: string; name: string; emoji?: string }>>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [loadingMaps, setLoadingMaps] = useState(false);
  const [showMentionTypesModal, setShowMentionTypesModal] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showMediaPreviewModal, setShowMediaPreviewModal] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const [showTagInfo, setShowTagInfo] = useState(false);
  const [showCollectionInfo, setShowCollectionInfo] = useState(false);
  const [showMediaInfo, setShowMediaInfo] = useState(false);
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

  // Fuzzy search function
  const fuzzyMatch = (text: string, query: string): boolean => {
    if (!query.trim()) return true;
    
    const normalizedText = text.toLowerCase().trim();
    const normalizedQuery = query.toLowerCase().trim();
    
    // Exact match
    if (normalizedText.includes(normalizedQuery)) return true;
    
    // Fuzzy match: check if all query characters appear in order
    let textIndex = 0;
    for (let i = 0; i < normalizedQuery.length; i++) {
      const char = normalizedQuery[i];
      const foundIndex = normalizedText.indexOf(char, textIndex);
      if (foundIndex === -1) return false;
      textIndex = foundIndex + 1;
    }
    return true;
  };

  // Filter mention types based on search query
  const filteredMentionTypes = useMemo(() => {
    if (!searchQuery.trim()) return mentionTypes;
    
    return mentionTypes.filter(type => 
      fuzzyMatch(type.name, searchQuery) || 
      fuzzyMatch(type.emoji, searchQuery)
    );
  }, [mentionTypes, searchQuery]);

  // Fetch mention types
  useEffect(() => {
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
          console.error('[AddMentionPage] Failed to fetch mention types:', error);
        }
        setError('Failed to load mention types');
      } finally {
        setLoadingTypes(false);
      }
    };

    fetchMentionTypes();
  }, []);

  // Open mention type modal on page load (only if no type is selected from URL)
  // Now works for both authenticated and non-authenticated users
  useEffect(() => {
    const urlMentionTypeId = searchParams.get('mention_type_id');
    if (!isLoading && !loadingTypes && mentionTypes.length > 0 && !selectedTypeId && !urlMentionTypeId) {
      setShowMentionTypesModal(true);
    }
  }, [isLoading, loadingTypes, mentionTypes.length, selectedTypeId, searchParams]);

  // Read lat, lng, mention_type_id, and username from URL parameters
  useEffect(() => {
    const urlLat = searchParams.get('lat');
    const urlLng = searchParams.get('lng');
    const urlMentionTypeId = searchParams.get('mention_type_id');
    
    // Validate and set coordinates with bounds checking
    if (urlLat && urlLng) {
      const latNum = parseFloat(urlLat);
      const lngNum = parseFloat(urlLng);
      
      // Validate coordinate ranges (latitude: -90 to 90, longitude: -180 to 180)
      if (!isNaN(latNum) && !isNaN(lngNum) && 
          latNum >= -90 && latNum <= 90 && 
          lngNum >= -180 && lngNum <= 180) {
        setLat(latNum.toFixed(6));
        setLng(lngNum.toFixed(6));
      } else if (process.env.NODE_ENV === 'development') {
        console.warn('[AddMentionPage] Invalid coordinates:', { lat: latNum, lng: lngNum });
      }
    }
    
    // Validate and set mention type if provided in URL
    // UUID format validation: 8-4-4-4-12 hex characters
    if (urlMentionTypeId && mentionTypes.length > 0) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(urlMentionTypeId)) {
        const typeExists = mentionTypes.some(t => t.id === urlMentionTypeId);
        if (typeExists) {
          setSelectedTypeId(urlMentionTypeId);
        } else if (process.env.NODE_ENV === 'development') {
          console.warn('[AddMentionPage] Mention type not found:', urlMentionTypeId);
        }
      } else if (process.env.NODE_ENV === 'development') {
        console.warn('[AddMentionPage] Invalid mention type ID format:', urlMentionTypeId);
      }
    }
  }, [searchParams, mentionTypes]);

  // Auto-tag user from username parameter
  useEffect(() => {
    const urlUsername = searchParams.get('username');
    if (!urlUsername || !supabase) return;

    // Validate username format (3-30 chars, alphanumeric with hyphens/underscores only)
    const trimmedUsername = urlUsername.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AddMentionPage] Invalid username length:', trimmedUsername.length);
      }
      return;
    }

    // Validate username pattern (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AddMentionPage] Invalid username format:', trimmedUsername);
      }
      return;
    }

    const fetchAndTagUser = async () => {
      try {
        // Search for the user by username (Supabase handles SQL injection prevention)
        const { data, error } = await supabase
          .from('accounts')
          .select('id, username, image_url, account_taggable')
          .eq('username', trimmedUsername)
          .eq('account_taggable', true)
          .single();

        if (error || !data) {
          // Don't expose internal errors to users, only log in development
          if (process.env.NODE_ENV === 'development') {
            console.error('[AddMentionPage] Error fetching user for tagging:', error);
          }
          return;
        }

        // Check if user is already tagged and add if not
        setTaggedAccounts(prev => {
          if (prev.some(acc => acc.id === data.id)) {
            return prev; // Already tagged, no change
          }
          return [...prev, {
            id: data.id,
            username: data.username!,
            image_url: data.image_url
          }];
        });
      } catch (err) {
        // Don't expose internal errors to users, only log in development
        if (process.env.NODE_ENV === 'development') {
          console.error('[AddMentionPage] Error auto-tagging user:', err);
        }
      }
    };

    fetchAndTagUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Only run when searchParams changes (username param)

  // No longer redirecting non-authenticated users - page is now public

  // Check for #success hash in URL
  useEffect(() => {
    const checkHash = () => {
      if (typeof window !== 'undefined' && window.location.hash === '#success') {
        setShowSuccessScreen(true);
        // Trigger confetti
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

        const randomInRange = (min: number, max: number) => {
          return Math.random() * (max - min) + min;
        };

        const interval = setInterval(() => {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            return clearInterval(interval);
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
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // Handle location selection from map
  const handleLocationSelect = useCallback((selectedLat: number, selectedLng: number) => {
    setLat(selectedLat.toFixed(6));
    setLng(selectedLng.toFixed(6));
  }, []);

  // Reverse geocode coordinates to get address and map metadata
  useEffect(() => {
    if (!lat || !lng) {
      setFullAddress(null);
      setMapMeta(null);
      return;
    }

    const reverseGeocode = async () => {
      setIsReverseGeocoding(true);
      try {
        const token = MAP_CONFIG.MAPBOX_TOKEN;
        if (!token) {
          setFullAddress(null);
          setMapMeta(null);
          return;
        }

        // Fetch full geocoding data with all location types
        const url = `${MAP_CONFIG.GEOCODING_BASE_URL}/${lng},${lat}.json`;
        const params = new URLSearchParams({
          access_token: token,
          types: 'address,poi,neighborhood,locality,place,postcode,district,region',
          limit: '1',
        });

        const response = await fetch(`${url}?${params}`);
        if (response.ok) {
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            const feature = data.features[0];
            setFullAddress(feature.place_name || null);
            
            // Store full map metadata
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
            setFullAddress(null);
            setMapMeta(null);
          }
        } else {
          setFullAddress(null);
          setMapMeta(null);
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[AddMentionPage] Failed to reverse geocode:', error);
        }
        setFullAddress(null);
        setMapMeta(null);
      } finally {
        setIsReverseGeocoding(false);
      }
    };

    reverseGeocode();
  }, [lat, lng]);

  // Handle fullscreen map
  const handleOpenFullscreenMap = useCallback(() => {
    setShowFullscreenMap(true);
  }, []);

  const handleCloseFullscreenMap = useCallback(() => {
    setShowFullscreenMap(false);
  }, []);

  const handleSelectType = (typeId: string) => {
    setSelectedTypeId(typeId);
    setSearchQuery(''); // Clear search after selection
  };

  const _handleRemoveSelectedType = () => {
    setSelectedTypeId('');
  };

  // Handle media selection (image or video)
  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      setError('Please sign in to upload media');
      return;
    }

    setIsProcessingMedia(true);
    setError(null);

    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      setError('Please select a valid image or video file. Supported formats: JPG, PNG, GIF, WebP, MP4, WebM, QuickTime.');
      setIsProcessingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Restrict videos to Contributor users only
    const isPro = account?.plan === 'contributor' || account?.plan === 'plus';
    if (isVideo && !isPro) {
      setError('Videos are a Contributor feature. Upgrade to Contributor to add videos to your mentions.');
      setIsProcessingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      router.push('/billing');
      return;
    }

    // Validate file size (50MB for videos to support 1080p 10-second videos, 5MB for images)
    // 1080p 10-second videos typically range from 10-30MB depending on bitrate
    const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / 1024 / 1024);
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
      setError(`${isVideo ? 'Video' : 'Image'} is too large (${fileSizeMB}MB). Maximum size is ${maxSizeMB}MB for ${isVideo ? '1080p 10-second videos' : 'images'}.`);
      setIsProcessingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Clear previous media (only one media type allowed)
    // Revoke previous blob URL if it exists
    if (mediaPreview && mediaPreview.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreview);
    }
    
    setMediaFile(file);
    setMediaType(isImage ? 'image' : 'video');

    // Create preview using blob URL (better for videos, works for images too)
    try {
      const blobUrl = URL.createObjectURL(file);
      setMediaPreview(blobUrl);
      setIsProcessingMedia(false);
      setShowMediaModal(false); // Close modal after successful selection
    } catch (err) {
      setError('Failed to process file. The file may be corrupted or in an unsupported format. Please try a different file.');
      setIsProcessingMedia(false);
      setMediaFile(null);
      setMediaType(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveMedia = () => {
    // Revoke blob URL to prevent memory leaks
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

  // Upload media (image or video) to Supabase storage
  const uploadMedia = async (): Promise<{ url: string | null; type: 'image' | 'video' | null }> => {
    if (!mediaFile || !user || !mediaType) return { url: null, type: null };

    setIsUploadingMedia(true);
    try {
      const fileExt = mediaFile.name.split('.').pop() || (mediaType === 'image' ? 'jpg' : 'mp4');
      const fileName = `${user.id}/mentions/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Ensure correct Content-Type is set based on file type
      const contentType = mediaFile.type || (mediaType === 'video' 
        ? (fileExt === 'webm' ? 'video/webm' : fileExt === 'mov' ? 'video/quicktime' : 'video/mp4')
        : (fileExt === 'png' ? 'image/png' : fileExt === 'gif' ? 'image/gif' : fileExt === 'webp' ? 'image/webp' : 'image/jpeg'));

      // Upload to Supabase storage with explicit Content-Type
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

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('mentions-media')
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error(`Failed to get ${mediaType} URL`);
      }

      // Store uploaded URL for preview
      setMediaUploadedUrl(urlData.publicUrl);

      return { url: urlData.publicUrl, type: mediaType };
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[AddMentionPage] Error uploading media:', err);
      }
      throw err;
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Search for taggable accounts by username
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
        console.error('[AddMentionPage] Error searching taggable accounts:', err);
      }
      setTagError('Failed to search users. Please try again.');
      setTagSearchResults([]);
    } finally {
      setIsSearchingTag(false);
    }
  }, []);

  // Debounced tag search
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
        if (process.env.NODE_ENV === 'development') {
          console.error('[AddMentionPage] Error loading collections:', err);
        }
      } finally {
        setLoadingCollections(false);
      }
    };

    loadCollections();
  }, [activeAccountId]);

  // Fetch maps where account is a member
  useEffect(() => {
    if (!activeAccountId) {
      setMaps([]);
      setSelectedMapId(null);
      return;
    }

    const loadMaps = async () => {
      setLoadingMaps(true);
      try {
        // Fetch maps where user is owner or member
        // The API endpoint with account_id returns maps owned by the account
        // We also need to fetch maps where the account is a member
        const [ownedResponse, memberResponse] = await Promise.all([
          fetch(`/api/maps?account_id=${activeAccountId}`),
          // Fetch maps where account is a member by checking map_members
          supabase
            .from('map_members')
            .select(`
              map_id,
              map:map!map_members_map_id_fkey(
                id,
                name,
                settings,
                is_active
              )
            `)
            .eq('account_id', activeAccountId)
            .eq('map.is_active', true),
        ]);

        const mapsSet = new Map<string, { id: string; name: string; emoji?: string }>();

        // Add owned maps
        if (ownedResponse.ok) {
          const ownedData = await ownedResponse.json();
          (ownedData.maps || []).forEach((map: any) => {
            if (map.is_active) {
              mapsSet.set(map.id, {
                id: map.id,
                name: map.name || map.title || 'Unnamed Map',
                emoji: (map.settings as any)?.appearance?.emoji || '🗺️',
              });
            }
          });
        }

        // Add member maps
        if (memberResponse.data) {
          memberResponse.data.forEach((member: any) => {
            const map = member.map;
            if (map && map.is_active && !mapsSet.has(map.id)) {
              mapsSet.set(map.id, {
                id: map.id,
                name: map.name || 'Unnamed Map',
                emoji: (map.settings as any)?.appearance?.emoji || '🗺️',
              });
            }
          });
        }

        setMaps(Array.from(mapsSet.values()).sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[AddMentionPage] Error loading maps:', err);
        }
      } finally {
        setLoadingMaps(false);
      }
    };

    loadMaps();
  }, [activeAccountId]);

  // Close account dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
        setShowAccountDropdown(false);
      }
      if (tagInfoRef.current && !tagInfoRef.current.contains(event.target as Node)) {
        setShowTagInfo(false);
      }
      if (collectionInfoRef.current && !collectionInfoRef.current.contains(event.target as Node)) {
        setShowCollectionInfo(false);
      }
      if (mediaInfoRef.current && !mediaInfoRef.current.contains(event.target as Node)) {
        setShowMediaInfo(false);
      }
      if (tagMenuDropdownRef.current && !tagMenuDropdownRef.current.contains(event.target as Node)) {
        setShowTagMenuDropdown(false);
      }
      if (mapMetaInfoRef.current && !mapMetaInfoRef.current.contains(event.target as Node)) {
        setShowMapMetaInfo(false);
      }
    };

    if (showAccountDropdown || showTagInfo || showCollectionInfo || showMediaInfo || showTagMenuDropdown || showMapMetaInfo) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [showAccountDropdown, showTagInfo, showCollectionInfo, showMediaInfo, showTagMenuDropdown, showMapMetaInfo]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut();
      localStorage.removeItem('freemap_sessions');
      localStorage.removeItem('freemap_current_session');
      router.replace('/');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[AddMentionPage] Sign out error:', error);
      }
    }
  };

  // Share functionality - must be before any conditional returns
  const shareUrl = useMemo(() => {
    if (!createdMention || typeof window === 'undefined') return '';
    return `${window.location.origin}/mention/${createdMention.id}`;
  }, [createdMention]);

  // Add tagged account
  const handleAddTaggedAccount = (account: { id: string; username: string; image_url: string | null }) => {
    // Check if already tagged
    if (taggedAccounts.some(acc => acc.id === account.id)) {
      setTagError('This user is already tagged');
      return;
    }

    setTaggedAccounts([...taggedAccounts, account]);
    setTagUsername('');
    setTagSearchResults([]);
    setTagError(null);
  };

  // Remove tagged account
  const handleRemoveTaggedAccount = (accountId: string) => {
    setTaggedAccounts(taggedAccounts.filter(acc => acc.id !== accountId));
  };

  // Open tag modal
  const handleOpenTagModal = () => {
    if (!user) {
      openWelcome();
      return;
    }
    setShowTagModal(true);
    setTagUsername('');
    setTagError(null);
    setTagSearchResults([]);
  };

  // Close tag modal
  const handleCloseTagModal = () => {
    setShowTagModal(false);
    setTagUsername('');
    setTagSearchResults([]);
    setTagError(null);
    setShowTagMenuDropdown(false);
  };

  // Toggle account_taggable setting
  const handleToggleTaggable = async () => {
    if (!account || !activeAccountId || isUpdatingTaggable) return;
    
    setIsUpdatingTaggable(true);
    try {
      const newTaggable = !account.account_taggable;
      await AccountService.updateCurrentAccount({ account_taggable: newTaggable }, activeAccountId);
      
      // Update local account state
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
      // Upload media if one was selected
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

      setCreatedMention(mention);
      setSuccess(true);
      // Add #success to URL and stay on page
      window.location.hash = 'success';
      setShowSuccessScreen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create mention');
      setIsSubmitting(false);
    }
  };

  // Show loading state while auth is loading
  if (isLoading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center overflow-hidden" style={{ maxHeight: '100dvh' }}>
        <div className="text-xs text-gray-500">Loading...</div>
      </div>
    );
  }

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[AddMentionPage] Error copying to clipboard:', error);
      }
    }
  };

  const handleShare = async () => {
    if (!createdMention || !shareUrl) return;
    const shareData = {
      title: 'Check out my mention on Love of Minnesota',
      text: createdMention.description || 'I just created a mention on the map!',
      url: shareUrl,
    };
    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        handleCopyLink();
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[AddMentionPage] Share cancelled or failed:', error);
      }
    }
  };

  const handleCloseSuccess = () => {
    setShowSuccessScreen(false);
    window.location.hash = '';
    // Reset form
    setDescription('');
    setLat('');
    setLng('');
    setSelectedTypeId('');
    // Revoke blob URL to prevent memory leaks
    if (mediaPreview && mediaPreview.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaFile(null);
    setMediaPreview(null);
    setMediaUploadedUrl(null);
    setMediaType(null);
    setTaggedAccounts([]);
    setSelectedCollectionId(null);
    setSelectedMapId(null);
    setCreatedMention(null);
    setSuccess(false);
  };

  // Page is now public - no early return for non-authenticated users

  // Determine which screen to show
  const isSuccessScreen = showSuccessScreen && createdMention;

  return (
    <>
      {isSuccessScreen ? (
        <div className="h-screen bg-gray-50 flex items-center justify-center" style={{ maxHeight: '100dvh' }}>
          <div className="max-w-md w-full mx-4">
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center space-y-6">
              {/* Success Icon */}
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircleIcon className="w-10 h-10 text-green-600" />
              </div>

              {/* Success Message */}
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">Mention Created!</h2>
                <p className="text-sm text-gray-600">Your mention has been added to the map</p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-4">
                <button
                  onClick={() => router.push(`/mention/${createdMention.id}`)}
                  className="w-full px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                >
                  View Mention
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
        <div className="h-screen bg-gray-50 overflow-y-auto scrollbar-hide" style={{ maxHeight: '100dvh', height: '100dvh' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
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
          <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-gray-900">Add Mention</h1>
          {account && (
            <div ref={accountDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className={`w-8 h-8 rounded-full overflow-hidden transition-all ${
                  (account.plan === 'contributor' || account.plan === 'plus')
                    ? 'p-[1px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600'
                    : 'border border-gray-200'
                } ${showAccountDropdown ? 'ring-2 ring-gray-300' : ''}`}
                aria-label="Account menu"
                aria-expanded={showAccountDropdown}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-white">
                  {account.image_url ? (
                    <Image
                      src={account.image_url}
                      alt={account.username || 'Account'}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                      unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <UserIcon className="w-4 h-4 text-gray-500" />
                    </div>
                  )}
                </div>
              </button>

              {/* Dropdown Menu */}
              {showAccountDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountDropdown(false);
                      if (account.username) {
                        router.push(`/profile/${account.username}`);
                      }
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors text-left"
                  >
                    <UserIcon className="w-4 h-4 text-gray-500" />
                    View Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountDropdown(false);
                      router.push('/settings');
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors text-left"
                  >
                    <Cog6ToothIcon className="w-4 h-4 text-gray-500" />
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountDropdown(false);
                      router.push('/billing');
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors text-left"
                  >
                    <CreditCardIcon className="w-4 h-4 text-gray-500" />
                    Billing
                  </button>
                  <div className="border-t border-gray-200 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountDropdown(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors text-left"
                  >
                    <ArrowRightOnRectangleIcon className="w-4 h-4 text-red-600" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
          {/* Profile Section - Show account user is posting from OR sign in prompt */}
          {!showSuccessScreen && (
            account ? (
              <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
                {/* Account Card Header - Clickable */}
                <button
                  type="button"
                  onClick={() => setShowCollectionAccordion(!showCollectionAccordion)}
                  className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
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
                
                {/* Collection Accordion Content */}
                {showCollectionAccordion && (
                  <div className="border-t border-gray-200 p-3 space-y-2 max-h-64 overflow-y-auto">
                    {loadingCollections ? (
                      <div className="text-xs text-gray-500 py-4 text-center">Loading collections...</div>
                    ) : collections.length === 0 ? (
                      <div className="text-xs text-gray-500 py-4 text-center">
                        No collections yet. Create one from your profile.
                      </div>
                    ) : (
                      <>
                        {/* Option to remove collection */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCollectionId(null);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs rounded-md transition-colors ${
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

                        {/* Collection list */}
                        {collections.map((collection) => (
                          <button
                            key={collection.id}
                            type="button"
                            onClick={() => {
                              setSelectedCollectionId(collection.id);
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs rounded-md transition-colors ${
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
              <div className="bg-white rounded-md border border-gray-200 p-4">
                <div className="flex items-center gap-3">
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
                    className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors flex-shrink-0"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            )
          )}
          
          {/* Required: Mention Type */}
          {!showSuccessScreen && (
            <div>
              {selectedTypeId ? (
                // Show selected mention type as removable badge
                <div className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md">
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
                // Show original button when nothing selected
                <button
                  type="button"
                  onClick={() => setShowMentionTypesModal(true)}
                  className="relative flex items-center gap-2 px-3 py-2 rounded-md transition-all hover:bg-gray-50 active:bg-gray-100 group touch-manipulation"
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
          )}
          
          {/* Location Map - Always render to avoid hook count issues */}
          <div className={showSuccessScreen ? 'hidden' : ''}>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Location <span className="text-red-500">*</span>
            </label>
            <div className="relative w-full h-64 rounded-md border border-gray-200 overflow-hidden bg-gray-50">
              <InlineMap
                lat={lat || undefined}
                lng={lng || undefined}
                onLocationSelect={handleLocationSelect}
                onOpenFullscreen={handleOpenFullscreenMap}
              />
            </div>
            {(lat && lng) && (
              <div className="mt-1 space-y-1">
                {isReverseGeocoding ? (
                  <p className="text-[10px] text-gray-400">Loading address...</p>
                ) : fullAddress ? (
                  <p className="text-[10px] text-gray-600">{fullAddress}</p>
                ) : null}
                <p className="text-[10px] text-gray-500">
                  Coordinates: {lat}, {lng}
                </p>
              </div>
            )}
          </div>
          {!showSuccessScreen && (
            <form id="mention-form" onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              {/* Description */}
              <div className="pt-5">
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

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3 pt-3 border-t border-gray-100">
                  {/* Icon Toolbar - Optional Icons */}
                  <div className="flex items-center gap-2 sm:gap-1.5 flex-1">
                    {/* Tag Users - Optional */}
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

                    {/* Camera - Optional */}
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
                            // If media is already uploaded, show preview modal
                            setShowMediaPreviewModal(true);
                          } else {
                            // If no media, show upload modal
                            setError(null); // Clear any previous image errors
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

                  {/* Character Count */}
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

                {/* Map Metadata Display - Similar to mention modal */}
                {mapMeta && !isReverseGeocoding && (() => {
                  const feature = mapMeta.feature;
                  const placeType = feature?.place_type?.[0] || '';
                  const text = feature?.text || mapMeta.text || '';
                  const context = mapMeta.context || [];
                  
                  // Determine emoji based on place type
                  let emoji = '📍';
                  if (placeType === 'poi') {
                    emoji = '🏢';
                  } else if (placeType === 'address') {
                    emoji = '🏠';
                  } else if (placeType === 'neighborhood') {
                    emoji = '🏘️';
                  } else if (placeType === 'locality') {
                    emoji = '🏙️';
                  } else if (placeType === 'district') {
                    emoji = '🏛️';
                  } else if (placeType === 'postcode') {
                    emoji = '📮';
                  } else if (placeType === 'region') {
                    emoji = '🗺️';
                  } else if (placeType === 'country') {
                    emoji = '🌍';
                  }
                  
                  // Determine display name - prefer text, fallback to place_name
                  let displayName = text || mapMeta.place_name?.split(',')[0] || 'Location';
                  
                  // Get category label if available
                  let categoryLabel = null;
                  if (context.length > 0) {
                    const neighborhood = context.find((c: any) => c.id?.startsWith('neighborhood'));
                    const locality = context.find((c: any) => c.id?.startsWith('locality'));
                    const district = context.find((c: any) => c.id?.startsWith('district'));
                    
                    if (neighborhood) {
                      categoryLabel = neighborhood.text;
                    } else if (locality) {
                      categoryLabel = locality.text;
                    } else if (district) {
                      categoryLabel = district.text;
                    }
                  }
                  
                  // Combine display name and category
                  const singleLineLabel = categoryLabel && categoryLabel !== displayName
                    ? `${displayName} • ${categoryLabel}`
                    : displayName;
                  
                  return (
                    <div className="relative mt-2">
                      <div className="flex items-center gap-2 p-2 border rounded-md bg-gray-50 border-gray-200">
                        {emoji && emoji !== '📍' && (
                          <span className="text-xs flex-shrink-0">{emoji}</span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate text-gray-900">
                            {singleLineLabel}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMapMetaInfo(!showMapMetaInfo);
                          }}
                          className="flex-shrink-0 p-0.5 transition-colors text-gray-400 hover:text-gray-600"
                          aria-label="Map metadata information"
                        >
                          <InformationCircleIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      {/* Info Popup */}
                      {showMapMetaInfo && (
                        <div
                          ref={mapMetaInfoRef}
                          className="absolute top-full left-0 right-0 mt-1 z-50 border rounded-md shadow-lg p-2 bg-white border-gray-200"
                        >
                          <div className="space-y-1.5">
                            {context && Array.isArray(context) && (
                              <>
                                {context.find((c: any) => c.id?.startsWith('neighborhood')) && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-gray-400">Neighborhood:</span>
                                    <span className="text-[10px] text-gray-700 font-medium">
                                      {context.find((c: any) => c.id?.startsWith('neighborhood'))?.text}
                                    </span>
                                  </div>
                                )}
                                {context.find((c: any) => c.id?.startsWith('locality')) && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-gray-400">City:</span>
                                    <span className="text-[10px] text-gray-700 font-medium">
                                      {context.find((c: any) => c.id?.startsWith('locality'))?.text}
                                    </span>
                                  </div>
                                )}
                                {context.find((c: any) => c.id?.startsWith('district')) && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-gray-400">District:</span>
                                    <span className="text-[10px] text-gray-700 font-medium">
                                      {context.find((c: any) => c.id?.startsWith('district'))?.text}
                                    </span>
                                  </div>
                                )}
                                {context.find((c: any) => c.id?.startsWith('postcode')) && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-gray-400">ZIP:</span>
                                    <span className="text-[10px] text-gray-700 font-medium">
                                      {context.find((c: any) => c.id?.startsWith('postcode'))?.text}
                                    </span>
                                  </div>
                                )}
                                {context.find((c: any) => c.id?.startsWith('region')) && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-gray-400">State:</span>
                                    <span className="text-[10px] text-gray-700 font-medium">
                                      {context.find((c: any) => c.id?.startsWith('region'))?.text}
                                    </span>
                                  </div>
                                )}
                                {context.find((c: any) => c.id?.startsWith('country')) && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-gray-400">Country:</span>
                                    <span className="text-[10px] text-gray-700 font-medium">
                                      {context.find((c: any) => c.id?.startsWith('country'))?.text}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                            {mapMeta.properties && (
                              <>
                                {mapMeta.properties.category && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-gray-400">Category:</span>
                                    <span className="text-[10px] text-gray-700 font-medium">
                                      {mapMeta.properties.category}
                                    </span>
                                  </div>
                                )}
                                {mapMeta.properties.landmark && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-gray-400">Landmark:</span>
                                    <span className="text-[10px] text-gray-700 font-medium">
                                      {mapMeta.properties.landmark}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Map Selector */}
                {maps.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Map (optional)
                    </label>
                    <select
                      value={selectedMapId || ''}
                      onChange={(e) => setSelectedMapId(e.target.value || null)}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 bg-white"
                    >
                      <option value="">Default (Live Map)</option>
                      {maps.map((map) => (
                        <option key={map.id} value={map.id}>
                          {map.emoji} {map.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Status Indicators */}
                {(selectedTypeId || selectedCollectionId || selectedMapId || taggedAccounts.length > 0 || mediaPreview) && (
                  <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                    {selectedTypeId && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 rounded-md border border-green-200">
                        <span className="text-[10px] text-green-700 font-medium">
                          {mentionTypes.find(t => t.id === selectedTypeId)?.emoji} {mentionTypes.find(t => t.id === selectedTypeId)?.name}
                        </span>
                      </div>
                    )}
                    {selectedCollectionId && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 rounded-md border border-green-200">
                        <span className="text-[10px] text-green-700 font-medium">
                          {collections.find(c => c.id === selectedCollectionId)?.emoji} {collections.find(c => c.id === selectedCollectionId)?.title}
                        </span>
                      </div>
                    )}
                    {selectedMapId && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 rounded-md border border-green-200">
                        <span className="text-[10px] text-green-700 font-medium">
                          {maps.find(m => m.id === selectedMapId)?.emoji} {maps.find(m => m.id === selectedMapId)?.name}
                        </span>
                      </div>
                    )}
                    {taggedAccounts.length > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 rounded-md border border-green-200">
                        <span className="text-[10px] text-green-700 font-medium">
                          @{taggedAccounts.length} user{taggedAccounts.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    {mediaPreview && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 rounded-md border border-green-200">
                        <span className="text-[10px] text-green-700 font-medium">
                          {mediaType === 'video' ? '🎥 Video' : '📷 Photo'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Required Field Warning */}
                {!selectedTypeId && description.trim().length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 px-2 py-1 bg-red-50 rounded-md border border-red-200">
                    <span className="text-[10px] text-red-700 font-medium">
                      ⚠️ Select a mention type to continue
                    </span>
                  </div>
                )}
              </div>

            </form>
          )}
        </div>

        {/* Sticky Footer */}
        <div 
          className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-[9999] shadow-lg" 
          style={{ 
            paddingBottom: 'env(safe-area-inset-bottom)'
          }}
        >
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.push('/map/live')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              Back
            </button>
            <button
              type="submit"
              form="mention-form"
              disabled={!user || !activeAccountId || isSubmitting || isUploadingMedia || !selectedTypeId || !description.trim() || !lat || !lng}
              className="px-4 py-2 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!user || !activeAccountId ? 'Sign In to Post' : (isSubmitting ? (isUploadingMedia ? 'Uploading media...' : 'Creating...') : 'Create Mention')}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Tag Others Popup */}
      {showTagModal && (
        <div 
          className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none"
          onClick={handleCloseTagModal}
        >
          <div 
            className="w-full max-w-[600px] bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-hidden flex flex-col animate-slide-up pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
              {/* Header */}
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
                    onClick={handleCloseTagModal}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                    aria-label="Close"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {/* Search Input */}
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

              {/* Error Message */}
              {tagError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-2">
                  <p className="text-xs text-red-600">{tagError}</p>
                </div>
              )}

              {/* Search Results */}
              {isSearchingTag && (
                <div className="text-xs text-gray-500 py-4 text-center">Searching...</div>
              )}

              {!isSearchingTag && tagUsername.trim() && tagSearchResults.length === 0 && !tagError && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <p className="text-xs text-yellow-800">
                    No users found. The username may not exist, or the user hasn&apos;t enabled tagging in their account settings.
                  </p>
                </div>
              )}

              {/* Tagged Users List */}
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

              {/* Search Results */}
              {isSearchingTag && (
                <div className="text-xs text-gray-500 py-4 text-center">Searching...</div>
              )}

              {!isSearchingTag && tagUsername.trim() && tagSearchResults.length === 0 && !tagError && (
                <div className="text-xs text-gray-500 py-4 text-center">
                  No users found
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

              {/* Info Message */}
              {!tagUsername.trim() && taggedAccounts.length === 0 && (
                <div className="text-xs text-gray-500 py-4 text-center">
                  Search by username to tag users
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collection Selector Modal */}
      {showCollectionModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity duration-300 p-4"
          onClick={() => setShowCollectionModal(false)}
        >
          <div 
            className="w-full max-w-[600px] bg-white rounded-lg shadow-lg max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Select Collection</h2>
              <button
                type="button"
                onClick={() => setShowCollectionModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {loadingCollections ? (
                <div className="text-xs text-gray-500 py-4 text-center">Loading collections...</div>
              ) : collections.length === 0 ? (
                <div className="text-xs text-gray-500 py-4 text-center">
                  No collections yet. Create one from your profile.
                </div>
              ) : (
                <>
                  {/* Option to remove collection */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCollectionId(null);
                      setShowCollectionModal(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs rounded-md transition-colors ${
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

                  {/* Collection list */}
                  {collections.map((collection) => (
                    <button
                      key={collection.id}
                      type="button"
                      onClick={() => {
                        setSelectedCollectionId(collection.id);
                        setShowCollectionModal(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs rounded-md transition-colors ${
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
          </div>
        </div>
      )}

      {/* Mention Types Modal */}
      {showMentionTypesModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity duration-300 p-4"
          onClick={() => setShowMentionTypesModal(false)}
        >
          <div 
            className="w-full max-w-[600px] bg-white rounded-lg shadow-lg max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
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

            {/* Search Input */}
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

            {/* Content */}
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

      {/* Media Popup */}
      {showMediaModal && (
        <div 
          className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none"
          onClick={() => setShowMediaModal(false)}
        >
          <div 
            className="w-full max-w-[600px] bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-hidden flex flex-col animate-slide-up pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
              {/* Header */}
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

            {/* Content */}
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
                <div className="space-y-3">
                  {/* Processing State */}
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
                </div>
              ) : mediaPreview ? (
                <div className="space-y-3">
                  {/* Current Media Preview */}
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
                          onError={(e) => {
                            if (process.env.NODE_ENV === 'development') {
                              console.error('[AddMentionPage] Video preview error:', e);
                            }
                          }}
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
                    <p className="mt-1 text-[10px] text-gray-500 text-center">
                      {mediaType === 'video' ? 'Video preview' : 'Click image to view full size'}
                    </p>
                  </div>

                  {/* Actions */}
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
                  {/* Upload Area */}
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

                  {/* Info */}
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p className="text-[10px] text-blue-800">
                      Supported formats: JPG, PNG, GIF, WebP, MP4, WebM, QuickTime
                    </p>
                  </div>
                </div>
              )}

              {/* Error Display */}
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
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          <div 
            className="w-full max-w-[400px] bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
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

            {/* Media Content */}
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
                    onError={(e) => {
                      if (process.env.NODE_ENV === 'development') {
                        console.error('[AddMentionPage] Video playback error:', e);
                      }
                      setError('Failed to load video. Please try uploading again.');
                    }}
                    onLoadedMetadata={() => {
                      // Attempt play after metadata loads (user interaction required for autoplay)
                      if (videoRef.current) {
                        videoRef.current.play().catch((err) => {
                          if (process.env.NODE_ENV === 'development') {
                            console.debug('[AddMentionPage] Autoplay prevented:', err);
                          }
                          // Autoplay blocked is fine - user can click play
                        });
                      }
                    }}
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

            {/* Actions */}
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

      {/* All InlineMap components - Always render at the end to maintain hook order */}
      {/* Image Preview Modal */}
      <ImagePreviewContainer
        isOpen={previewImageUrl !== null}
        onClose={() => setPreviewImageUrl(null)}
        imageUrl={previewImageUrl || ''}
        alt="Mention image preview"
      />
      
      {/* Fullscreen Map Modal */}
      <div className={showFullscreenMap ? 'fixed inset-0 z-50 bg-white' : 'hidden'} style={showFullscreenMap ? { width: '100vw', height: '100vh' } : {}}>
        <div className="relative w-full h-full">
          {/* Close Button */}
          <button
            type="button"
            onClick={handleCloseFullscreenMap}
            className="absolute top-4 right-4 z-30 flex items-center gap-2 px-4 py-2 text-xs bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 transition-colors"
          >
            <XMarkIcon className="w-4 h-4 text-gray-600" />
            <span className="text-gray-900">Close</span>
          </button>
          
          {/* Fullscreen Map */}
          <div key="fullscreen-map" className="w-full h-full">
            <InlineMap
              lat={lat}
              lng={lng}
              onLocationSelect={handleLocationSelect}
              fullscreen={true}
            />
          </div>
        </div>
      </div>
    </>
  );
}
