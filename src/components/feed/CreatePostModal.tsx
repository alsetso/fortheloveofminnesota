'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStateSafe, Account } from '@/features/auth';
import Link from 'next/link';
import ProfilePhoto from '../shared/ProfilePhoto';
import { Mention } from '@/types/mention';
import PostMapDrawer from './PostMapDrawer';
import PostImageDrawer from './PostImageDrawer';
import { getAccessibleMaps, type AccessibleMap } from '@/lib/maps/getAccessibleMaps';
import { MentionService } from '@/features/mentions/services/mentionService';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
  initialAction?: 'upload_photo' | 'upload_video' | 'mention' | null;
  initialMapId?: string | null;
  initialMentionTypeId?: string | null;
  /** Mode: 'post' creates posts, 'pin' creates map_pins. Default: 'pin' */
  createMode?: 'post' | 'pin';
}

type PinStep = 'mode' | 'single' | 'location' | 'description' | 'optional' | 'review';
type PostStep = 'mode' | 'content' | 'optional' | 'review';
type Step = PinStep | PostStep;

export default function CreatePostModal({ 
  isOpen, 
  onClose, 
  onPostCreated,
  initialAction,
  initialMapId,
  initialMentionTypeId,
  createMode: initialCreateMode = 'pin'
}: CreatePostModalProps) {
  const { account, activeAccountId } = useAuthStateSafe();
  const [currentStep, setCurrentStep] = useState<Step>('mode');
  const [createMode, setCreateMode] = useState<'post' | 'pin'>(initialCreateMode);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [showTitle, setShowTitle] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'draft'>('public');
  const [images, setImages] = useState<Array<{ url: string; alt?: string; type?: 'image' | 'video' }>>([]);
  const [selectedMentionIds, setSelectedMentionIds] = useState<string[]>([]);
  const [showMentionsList, setShowMentionsList] = useState(false);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [isLoadingMentions, setIsLoadingMentions] = useState(false);
  const [showMapView, setShowMapView] = useState(false);
  const [showImageView, setShowImageView] = useState(false);
  const [mapData, setMapData] = useState<{
    type: 'pin' | 'area' | 'both';
    geometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon | GeoJSON.Point;
    center?: { lat: number; lng: number };
    screenshot?: string;
  } | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<'image' | 'mention' | 'map' | null>(null);
  const [selectedMentionTypeId, setSelectedMentionTypeId] = useState<string | null>(null);
  const [showMentionTypesModal, setShowMentionTypesModal] = useState(false);
  const [mentionTypes, setMentionTypes] = useState<Array<{ id: string; emoji: string; name: string }>>([]);
  const [isLoadingMentionTypes, setIsLoadingMentionTypes] = useState(false);
  const [mentionTypeSearchQuery, setMentionTypeSearchQuery] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [liveMapId, setLiveMapId] = useState<string | null>(null);
  const [accessibleMaps, setAccessibleMaps] = useState<AccessibleMap[]>([]);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);
  const [showMapSelector, setShowMapSelector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Random heart emojis
  const heartEmojis = ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '❣️', '❤️‍🔥', '❤️‍🩹'];
  
  const getRandomHeartEmoji = () => {
    return heartEmojis[Math.floor(Math.random() * heartEmojis.length)];
  };

  const handleAddEmoji = () => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const emoji = getRandomHeartEmoji();
    
    const newContent = content.slice(0, start) + emoji + content.slice(end);
    setContent(newContent);
    
    // Set cursor position after the inserted emoji
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  // Check if user can upload videos
  const canUploadVideo = account?.plan === 'contributor' || 
                         (account?.plan as string) === 'plus' || 
                         account?.plan === 'gov';

  // Fetch accessible maps when modal opens
  useEffect(() => {
    if (!isOpen || !account?.id) {
      setAccessibleMaps([]);
      return;
    }

    const fetchMaps = async () => {
      setIsLoadingMaps(true);
      try {
        const maps = await getAccessibleMaps(account.id);
        setAccessibleMaps(maps);
      } catch (err) {
        console.error('Error fetching accessible maps:', err);
      } finally {
        setIsLoadingMaps(false);
      }
    };

    fetchMaps();
  }, [isOpen, account?.id]);

  // Fetch live map ID and set as default for pins
  useEffect(() => {
    if (isOpen && createMode === 'pin') {
      const fetchLiveMap = async () => {
        try {
          const { supabase } = await import('@/lib/supabase');
          const { data: liveMap, error } = await supabase
            .from('map')
            .select('id')
            .eq('slug', 'live')
            .eq('is_active', true)
            .single();
          
          if (!error && liveMap) {
            setLiveMapId(liveMap.id);
            // Set as selected if no initialMapId provided
            if (!initialMapId) {
              setSelectedMapId(liveMap.id);
            }
          }
        } catch (err) {
          console.error('Error fetching live map:', err);
        }
      };
      fetchLiveMap();
    }
  }, [isOpen, createMode, initialMapId]);

  // Set initial map ID when modal opens
  useEffect(() => {
    if (isOpen && initialMapId) {
      setSelectedMapId(initialMapId);
    } else if (!isOpen) {
      // Reset when modal closes
      setSelectedMapId(null);
      setLiveMapId(null);
    }
  }, [isOpen, initialMapId]);

  // Fetch mention types (only active ones for public selection)
  useEffect(() => {
    if (!isOpen) return;

    const fetchMentionTypes = async () => {
      setIsLoadingMentionTypes(true);
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data, error } = await supabase
          .from('mention_types')
          .select('id, emoji, name')
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (error) throw error;
        setMentionTypes(data || []);
      } catch (err) {
        console.error('Error fetching mention types:', err);
      } finally {
        setIsLoadingMentionTypes(false);
      }
    };

    fetchMentionTypes();
  }, [isOpen]);

  // Handle initial actions
  useEffect(() => {
    if (isOpen) {
      if (initialAction === 'upload_photo') {
        setTimeout(() => {
          fileInputRef.current?.click();
        }, 300);
      } else if (initialAction === 'upload_video') {
        if (!canUploadVideo) {
          setError('Video uploads are only available for Contributor plan.');
        } else {
          setTimeout(() => {
            fileInputRef.current?.click();
          }, 300);
        }
      } else if (initialAction === 'mention') {
        setContent('@');
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 100);
      }
    }
  }, [isOpen, initialAction, canUploadVideo]);

  // Focus textarea when modal opens (if not already handled by initialAction)
  useEffect(() => {
    if (isOpen && textareaRef.current && !initialAction) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialAction]);

  // Fetch user's mentions
  useEffect(() => {
    if (!account?.id || !showMentionsList) return;

    const fetchMentions = async () => {
      setIsLoadingMentions(true);
      try {
        const { supabase } = await import('@/lib/supabase');
        // Get live map ID first
        const { data: liveMap } = await supabase
          .from('map')
          .select('id')
          .eq('slug', 'live')
          .eq('is_active', true)
          .single();

        const { data, error } = await supabase
          .from('map_pins')
          .select(`
            id,
            lat,
            lng,
            description,
            image_url,
            visibility,
            account_id,
            city_id,
            collection_id,
            created_at,
            updated_at,
            map_meta,
            full_address,
            collection:collections(
              id,
              emoji,
              title
            ),
            mention_type:mention_types(
              id,
              emoji,
              name
            )
          `)
          .eq('map_id', liveMap?.id)
          .eq('account_id', account.id)
          .eq('archived', false)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;
        setMentions((data || []) as unknown as Mention[]);
      } catch (err) {
        console.error('Error fetching mentions:', err);
        setError('Failed to load mentions');
      } finally {
        setIsLoadingMentions(false);
      }
    };

    fetchMentions();
  }, [account?.id, showMentionsList]);

  // Step definitions - minimized steps with optional fields combined
  const pinSteps: PinStep[] = ['mode', 'location', 'description', 'optional', 'review'];
  const postSteps: PostStep[] = ['mode', 'content', 'optional', 'review'];
  
  const getCurrentStepIndex = () => {
    const steps = createMode === 'pin' ? pinSteps : postSteps;
    return steps.indexOf(currentStep as any);
  };
  
  const getTotalSteps = () => {
    return createMode === 'pin' ? pinSteps.length : postSteps.length;
  };
  
  const canGoNext = () => {
    if (currentStep === 'mode') return !!createMode;
    if (currentStep === 'single') {
      // Single-step pin form: require location, map, mention type, and description
      return !!(mapData?.center?.lat && mapData?.center?.lng && selectedMapId && content.trim() && selectedMentionTypeId);
    }
    if (currentStep === 'location') {
      // For pins, require both location and map selection
      if (createMode === 'pin') {
        return !!(mapData?.center?.lat && mapData?.center?.lng && selectedMapId);
      }
      return !!(mapData?.center?.lat && mapData?.center?.lng);
    }
    if (currentStep === 'description') return !!content.trim() && !!selectedMentionTypeId;
    if (currentStep === 'content') return !!content.trim();
    return true; // Other steps are optional
  };
  
  const handleNext = () => {
    if (!canGoNext()) return;
    const steps = createMode === 'pin' ? pinSteps : postSteps;
    const currentIndex = steps.indexOf(currentStep as any);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1] as Step);
      setError(null);
    }
  };
  
  const handleBack = () => {
    const steps = createMode === 'pin' ? pinSteps : postSteps;
    const currentIndex = steps.indexOf(currentStep as any);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1] as Step);
      setError(null);
    }
  };
  
  const handleModeSelect = (mode: 'pin' | 'post') => {
    setCreateMode(mode);
    // For pins, skip stepper and go directly to single-step form
    // For posts, use the stepper starting with content step
    setCurrentStep(mode === 'pin' ? 'single' : 'content');
    if (mode === 'pin' && initialMentionTypeId) {
      setSelectedMentionTypeId(initialMentionTypeId);
    }
  };

  // Set initial mention type when modal opens (for pin mode)
  useEffect(() => {
    if (isOpen && createMode === 'pin' && initialMentionTypeId) {
      setSelectedMentionTypeId(initialMentionTypeId);
    }
  }, [isOpen, initialMentionTypeId, createMode]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('mode');
      setCreateMode(initialCreateMode);
      setContent('');
      setTitle('');
      setShowTitle(false);
      setError(null);
      setImages([]);
      setSelectedMentionIds([]);
      setShowMentionsList(false);
      setMentions([]);
      setShowMapView(false);
      setShowImageView(false);
      setMapData(null);
      setVisibility('public');
      setShowPrivacyMenu(false);
      setSelectedMediaType(null);
      setSelectedMentionTypeId(null);
      setShowMentionTypesModal(false);
      setMentionTypeSearchQuery('');
    }
  }, [isOpen, initialCreateMode]);

  // Focus title input when it's shown
  useEffect(() => {
    if (showTitle && titleInputRef.current) {
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [showTitle]);

  // Lock body scroll when modal is open and handle slide-up animation
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      
      // Trigger slide-up animation on next frame
      requestAnimationFrame(() => {
        if (modalRef.current) {
          modalRef.current.style.transform = 'translateY(0)';
        }
      });
    } else {
      document.body.style.overflow = '';
      // Reset transform when closing
      if (modalRef.current) {
        modalRef.current.style.transform = '';
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Clear other media types if they have data
    if (selectedMentionIds.length > 0) {
      setSelectedMentionIds([]);
    }
    if (mapData) {
      setMapData(null);
      if (mapData.screenshot) {
        setImages((prev) => prev.filter((img) => img.url !== mapData.screenshot));
      }
    }

    Array.from(files).forEach((file) => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (isImage || isVideo) {
        if (isVideo && !canUploadVideo) {
          setError('Video uploads are only available for Contributor plan.');
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const url = event.target?.result as string;
          setImages((prev) => [...prev, { 
            url, 
            alt: file.name, 
            type: isImage ? 'image' : 'video' 
          }]);
          setSelectedMediaType('image');
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleImagesSave = (newImages: Array<{ url: string; alt?: string; type: 'image' | 'video' }>) => {
    // For pins, clear other media types if they have data
    if (createMode === 'pin') {
    if (selectedMentionIds.length > 0) {
      setSelectedMentionIds([]);
    }
    if (mapData) {
      setMapData(null);
      if (mapData.screenshot) {
        // Remove map screenshot from new images if it exists
        const filteredNewImages = newImages.filter((img) => img.url !== mapData.screenshot);
        setImages(filteredNewImages);
      } else {
        setImages(newImages);
      }
    } else {
      setImages(newImages);
      }
    } else {
      // For posts, allow multiple media types but handle map screenshot separately
      if (mapData?.screenshot) {
        // Remove map screenshot from new images if it exists
        const filteredNewImages = newImages.filter((img) => img.url !== mapData.screenshot);
        setImages(filteredNewImages);
      } else {
        setImages(newImages);
      }
    }
    setSelectedMediaType('image');
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => {
      const imageToRemove = prev[index];
      const newImages = prev.filter((_, i) => i !== index);
      
      // If removing the last image and it's not a map screenshot, clear media type
      // If it's a map screenshot, we need to check if mapData still exists
      if (newImages.length === 0) {
        // If no images left and no map data, clear media type
        if (!mapData || imageToRemove.url !== mapData.screenshot) {
          setSelectedMediaType(null);
        }
      } else if (imageToRemove.url === mapData?.screenshot) {
        // If removing map screenshot but other images exist, keep media type as 'image'
        // This shouldn't happen in normal flow, but handle it
      }
      
      return newImages;
    });
  };

  const handleLocationClick = () => {
    // Clear other media types if they have data
    if (images.length > 0) {
      setImages([]);
    }
    if (mapData) {
      setMapData(null);
      if (mapData.screenshot) {
        setImages((prev) => prev.filter((img) => img.url !== mapData.screenshot));
      }
    }
    setSelectedMediaType('mention');
    setShowMentionsList(true);
  };

  const handleMentionToggle = (mentionId: string) => {
    setSelectedMentionIds((prev) => {
      const newIds = prev.includes(mentionId)
        ? prev.filter((id) => id !== mentionId)
        : [...prev, mentionId];
      
      if (newIds.length === 0) {
        setSelectedMediaType(null);
      } else {
        setSelectedMediaType('mention');
      }
      
      return newIds;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.id) return;

    // Validation differs based on mode
    if (createMode === 'pin') {
      // For map_pins: require description, location, and mention type
      if (!content.trim()) {
        setError('Please enter a description');
        return;
      }
      if (!mapData?.center?.lat || !mapData?.center?.lng) {
        setError('Please select a location on the map');
        return;
      }
      if (!selectedMentionTypeId) {
        setError('Please select a mention type');
        return;
      }
    } else {
      // For posts: require content
      if (!content.trim()) {
        setError('Please enter some content');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (createMode === 'pin') {
        // Create map_pin (mention) using MentionService
        let imageUrl: string | null = null;
        let videoUrl: string | null = null;
        let finalMediaType: 'image' | 'video' | 'none' = 'none';

        // Extract image/video URLs from images array (excluding map screenshot)
        const mediaImages = images.filter(img => img.url !== mapData?.screenshot);
        if (mediaImages.length > 0) {
          const firstMedia = mediaImages[0];
          if (firstMedia.type === 'video') {
            videoUrl = firstMedia.url;
            finalMediaType = 'video';
          } else {
            imageUrl = firstMedia.url;
            finalMediaType = 'image';
          }
        }

        const mention = await MentionService.createMention({
          lat: mapData!.center!.lat,
          lng: mapData!.center!.lng,
          description: content.trim(),
          mention_type_id: selectedMentionTypeId || undefined,
          visibility: visibility === 'public' ? 'public' : 'only_me',
          image_url: imageUrl || undefined,
          video_url: videoUrl || undefined,
          media_type: finalMediaType !== 'none' ? finalMediaType : undefined,
          map_id: selectedMapId || undefined,
          map_meta: mapData?.geometry ? {
            type: mapData.type,
            geometry: mapData.geometry,
            screenshot: mapData.screenshot,
          } : undefined,
        }, activeAccountId || undefined);

        // Dispatch event for MentionsLayer to refresh
        window.dispatchEvent(new CustomEvent('mention-created', {
          detail: { mention }
        }));
      } else {
        // Create post using existing API
        // Format images to match API schema (url, alt, width, height)
        const formattedImages = images.length > 0 
          ? images.map(img => ({
              url: img.url,
              alt: img.alt || undefined,
              width: undefined,
              height: undefined,
            }))
          : null;

      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
          body: JSON.stringify({
          title: title.trim() || null,
          content: content.trim(),
          visibility: visibility,
          mention_type_id: selectedMentionTypeId || null,
          mention_ids: selectedMentionIds.length > 0 ? selectedMentionIds : null,
          map_id: selectedMapId || null,
            images: formattedImages,
          map_data: mapData ? {
            lat: mapData.center?.lat || 0,
            lng: mapData.center?.lng || 0,
            type: mapData.type,
            geometry: mapData.geometry,
            screenshot: mapData.screenshot,
          } : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create post');
        }
      }

      // Reset and close
      setContent('');
      setTitle('');
      setShowTitle(false);
      setImages([]);
      setSelectedMentionIds([]);
      setShowMentionsList(false);
      setSelectedMentionTypeId(null);
      setSelectedMapId(null);
      setMapData(null);
      onPostCreated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : (createMode === 'pin' ? 'Failed to create pin' : 'Failed to create post'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const accountName = account?.first_name && account?.last_name
    ? `${account.first_name} ${account.last_name}`
    : account?.first_name || account?.username || 'User';

  if (!isOpen || !account) return null;

  // Step labels for display
  const getStepLabel = (step: Step) => {
    const labels: Record<Step, string> = {
      'mode': 'Choose Type',
      'single': 'Create Pin',
      'location': 'Location',
      'description': 'Description',
      'content': 'Content',
      'optional': 'Optional',
      'review': 'Review'
    };
    return labels[step] || step;
  };

  // Portal modal to document body to ensure it overlays entire map container
  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[100] transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div
          ref={modalRef}
          className="bg-white sm:rounded-md w-full max-w-[500px] pointer-events-auto flex flex-col h-screen sm:h-[90vh] transition-transform duration-300 ease-out border border-gray-200"
          style={{ transform: 'translateY(100%)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-[10px] border-b border-gray-200 flex-shrink-0">
            {showImageView || showMapView || (createMode === 'post' && showMentionsList) ? (
              <>
                <button
                  onClick={() => {
                    setShowImageView(false);
                    setShowMapView(false);
                    if (createMode === 'post') {
                    setShowMentionsList(false);
                    }
                  }}
                  className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="text-sm font-semibold text-gray-900 flex-1 text-center">
                  {showImageView ? 'Add Photos & Videos' : showMapView ? (createMode === 'pin' ? 'Select Location' : 'Draw on Map') : 'Select Mentions'}
                </h3>
                <div className="w-9" /> {/* Spacer for centering */}
              </>
            ) : (
              <>
                {currentStep !== 'mode' && currentStep !== 'single' ? (
                  <button
                    onClick={handleBack}
                    className="w-8 h-8 rounded-full hover:bg-gray-50 flex items-center justify-center transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                ) : (
                  <div className="w-9" />
                )}
                <h3 className="text-sm font-semibold text-gray-900 flex-1 text-center">
                  {currentStep === 'mode' 
                    ? getStepLabel(currentStep)
                    : currentStep === 'single'
                      ? 'Create Pin'
                      : createMode === 'pin' 
                        ? 'Drop Pin'
                        : 'Add Post'
                  }
                </h3>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full hover:bg-gray-50 flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Stepper Progress Indicator - Hide mode step and single-step pin form, start from first real action */}
          {currentStep !== 'mode' && currentStep !== 'single' && !showImageView && !showMapView && !(createMode === 'post' && showMentionsList) && (
            <div className="px-[10px] py-2 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                {(createMode === 'pin' ? pinSteps : postSteps)
                  .filter(step => step !== 'mode' && step !== 'single') // Exclude mode and single-step from stepper display
                  .map((step, index) => {
                    const allSteps: Step[] = createMode === 'pin' ? pinSteps : postSteps;
                    const currentStepIndex = allSteps.indexOf(currentStep);
                    const stepIndex = allSteps.indexOf(step as Step);
                    const isActive = step === currentStep;
                    const isCompleted = stepIndex < currentStepIndex;
                    const isUpcoming = stepIndex > currentStepIndex;
                    
                    return (
                      <div key={step} className="flex items-center flex-1">
                        <div className="flex flex-col items-center flex-1">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium transition-colors ${
                            isActive 
                              ? 'bg-gray-900 text-white' 
                              : isCompleted 
                                ? 'bg-gray-900 text-white' 
                                : 'bg-gray-200 text-gray-500'
                          }`}>
                            {isCompleted ? (
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              index + 1
                            )}
                          </div>
                          <span className={`text-[10px] mt-1 text-center ${
                            isActive ? 'text-gray-900 font-medium' : 'text-gray-500'
                          }`}>
                            {getStepLabel(step)}
                          </span>
                        </div>
                        {index < (createMode === 'pin' ? pinSteps : postSteps).filter(s => s !== 'mode' && s !== 'single').length - 1 && (
                          <div className={`flex-1 h-0.5 mx-1 ${
                            isCompleted ? 'bg-gray-900' : 'bg-gray-200'
                          }`} />
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Content Area */}
          <div className="relative overflow-hidden flex-1 min-h-0">
            {/* Mentions List View - Slides in from right (only for posts) */}
            {createMode === 'post' && (
            <div
              className={`absolute inset-0 bg-white transition-transform duration-300 z-10 ${
                showMentionsList ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              <div className="flex flex-col h-full">
                {/* Mentions List */}
                <div className="flex-1 overflow-y-auto p-4">
                  {isLoadingMentions ? (
                    <div className="flex items-center justify-center py-8">
                      <span className="text-sm text-gray-500">Loading mentions...</span>
                    </div>
                  ) : mentions.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <span className="text-sm text-gray-500">No mentions found</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {mentions.map((mention) => (
                        <button
                          key={mention.id}
                          type="button"
                          onClick={() => handleMentionToggle(mention.id)}
                          className={`w-full flex items-start gap-2 p-[10px] rounded-md border transition-colors text-left ${
                            selectedMentionIds.includes(mention.id)
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex-shrink-0">
                            {mention.image_url ? (
                              <img
                                src={mention.image_url}
                                alt="Mention"
                                className="w-10 h-10 rounded-md object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center">
                                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">
                              {mention.description || 'Mention'}
                            </p>
                            {mention.collection && (
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                {mention.collection.emoji} {mention.collection.title}
                              </p>
                            )}
                            {mention.mention_type && (
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                {mention.mention_type.emoji} {mention.mention_type.name}
                              </p>
                            )}
                          </div>
                          {selectedMentionIds.includes(mention.id) && (
                            <div className="flex-shrink-0">
                              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}

            {/* Image View - Slides in from right */}
            <div
              className={`absolute inset-0 bg-white transition-transform duration-300 z-10 ${
                showImageView ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              <PostImageDrawer
                onClose={() => setShowImageView(false)}
                onImagesSave={handleImagesSave}
                initialImages={images.filter(img => img.url !== mapData?.screenshot)}
                canUploadVideo={canUploadVideo}
              />
            </div>

            {/* Map View - Slides in from right */}
            <div
              className={`absolute inset-0 bg-white transition-transform duration-300 z-10 flex flex-col ${
                showMapView ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              <PostMapDrawer
                onClose={() => setShowMapView(false)}
                onMapDataSave={(data) => {
                  console.log('Map data saved:', data);
                  setMapData(data);
                  setSelectedMediaType('map');
                  // Add screenshot to images array as thumbnail
                  if (data.screenshot) {
                    console.log('Adding screenshot to images:', data.screenshot.substring(0, 50) + '...');
                    setImages((prev) => {
                      // Remove any existing map screenshot
                      const filtered = prev.filter((img) => img.url !== data.screenshot);
                      // Add the new screenshot as the first image (thumbnail)
                      const newImages: Array<{ url: string; alt?: string; type?: 'image' | 'video' }> = [{ url: data.screenshot || '', alt: 'Map screenshot', type: 'image' as const }, ...filtered];
                      return newImages;
                      console.log('Updated images array:', newImages.length);
                      return newImages;
                    });
                  } else {
                    console.warn('No screenshot in map data');
                  }
                  setShowMapView(false);
                }}
                initialMapData={mapData}
              />
            </div>

            {/* Step Content Area */}
            <div className={`flex-1 overflow-y-auto transition-transform duration-300 ${
              (createMode === 'post' && showMentionsList) || showMapView || showImageView ? '-translate-x-full' : 'translate-x-0'
            }`}>
              {/* Step 0: Mode Selection */}
              {currentStep === 'mode' && (
                <div className="p-[10px]">
                  <div className="text-center mb-3">
                    <h2 className="text-sm font-semibold text-gray-900 mb-1">What would you like to create?</h2>
                    <p className="text-xs text-gray-600">Choose between a pin on the map or a general post</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleModeSelect('pin')}
                      className="p-3 border-2 border-gray-200 rounded-md hover:border-gray-900 transition-colors text-left group"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-900 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <h3 className="text-sm font-semibold text-gray-900">Pin</h3>
                      </div>
                      <p className="text-xs text-gray-600">Add a location-based pin to the map with a category and description</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeSelect('post')}
                      className="p-3 border-2 border-gray-200 rounded-md hover:border-gray-900 transition-colors text-left group"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-900 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="text-sm font-semibold text-gray-900">Post</h3>
                      </div>
                      <p className="text-xs text-gray-600">Create a general post with optional title, media, and location</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Pin Steps - Single step form for contribute style */}
              {createMode === 'pin' && currentStep === 'single' && (
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="p-[10px] flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto space-y-3">
                    {/* Mention Type */}
                    <div>
                      {selectedMentionTypeId ? (
                        <div className="inline-flex items-center gap-2 px-2 py-1.5 bg-white border border-gray-200 rounded-md">
                          <span className="text-sm">
                            {mentionTypes.find(t => t.id === selectedMentionTypeId)?.emoji}
                          </span>
                          <span className="text-xs font-medium text-gray-700">
                            {mentionTypes.find(t => t.id === selectedMentionTypeId)?.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedMentionTypeId(null)}
                            className="ml-1 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowMentionTypesModal(true)}
                          className="relative inline-flex items-center gap-2 px-2 py-1.5 rounded-md transition-all hover:bg-gray-50 active:bg-gray-100 group"
                        >
                          <span className="text-sm font-bold text-gray-400 group-hover:text-gray-600 transition-colors">#</span>
                          <span className="text-xs font-medium text-gray-500 group-hover:text-gray-700 transition-colors">Add tag</span>
                          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white bg-red-500" />
                        </button>
                      )}
                    </div>

                    {/* Map Selector */}
                    <div>
                      {selectedMapId ? (
                        <div className="inline-flex items-center gap-2 px-2 py-1.5 bg-white border border-gray-200 rounded-md">
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                          <span className="text-xs font-medium text-gray-900">
                            {accessibleMaps.find(m => m.id === selectedMapId)?.name || 'Live Map'}
                          </span>
                          {accessibleMaps.find(m => m.id === selectedMapId)?.visibility === 'private' && (
                            <svg className="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          {!(selectedMapId === liveMapId && accessibleMaps.length === 1) && (
                            <button
                              type="button"
                              onClick={() => setShowMapSelector(true)}
                              className="ml-1 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowMapSelector(true)}
                          disabled={isLoadingMaps}
                          className="relative inline-flex items-center gap-2 px-2 py-1.5 rounded-md transition-all hover:bg-gray-50 active:bg-gray-100 group"
                        >
                          <svg className="w-4 h-4 text-gray-500 group-hover:text-gray-700 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                          <span className="text-xs font-medium text-gray-500 group-hover:text-gray-700 transition-colors">
                            {isLoadingMaps ? 'Loading maps...' : 'Select map'}
                          </span>
                          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white bg-red-500" />
                        </button>
                      )}
                      
                      {/* Map Dropdown */}
                      {showMapSelector && !isLoadingMaps && (
                        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-md z-50 max-h-64 overflow-y-auto">
                          <div className="p-2">
                            {accessibleMaps.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-gray-500">No accessible maps</div>
                            ) : (
                              accessibleMaps.map((map) => (
                                <button
                                  key={map.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedMapId(map.id);
                                    setShowMapSelector(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center gap-2 ${
                                    selectedMapId === map.id
                                      ? 'bg-gray-100 text-gray-900 font-medium'
                                      : 'text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                  </svg>
                                  <span className="flex-1 truncate">{map.name}</span>
                                  {map.visibility === 'private' && (
                                    <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Location Map */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Location <span className="text-red-500">*</span>
                      </label>
                      <div className="relative w-full aspect-[3/2] rounded-md border border-gray-200 overflow-hidden bg-gray-50">
                        <button
                          type="button"
                          onClick={() => setShowMapView(true)}
                          className="w-full h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          {mapData?.center ? (
                            <div className="text-center">
                              <svg className="w-8 h-8 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <p className="text-xs text-gray-600">Location selected</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                {mapData.center.lat.toFixed(4)}, {mapData.center.lng.toFixed(4)}
                              </p>
                            </div>
                          ) : (
                            <div className="text-center">
                              <svg className="w-8 h-8 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <p className="text-xs text-gray-600">Tap to select location</p>
                            </div>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Description <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Describe this location..."
                        className="w-full min-h-[120px] px-3 py-2 text-xs resize-none focus:outline-none placeholder:text-gray-400 border border-gray-200 rounded-md"
                        maxLength={240}
                      />
                      {content.length >= 230 && (
                        <div className="text-right text-[10px] text-gray-500 mt-0.5">
                          {content.length}/240
                        </div>
                      )}
                    </div>

                    {/* Media */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Media (optional)</label>
                      <button
                        type="button"
                        onClick={() => setShowImageView(true)}
                        className="w-full p-3 border-2 border-gray-200 rounded-md hover:border-gray-900 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs font-medium text-gray-900">
                            {images.length > 0 ? `${images.length} image${images.length > 1 ? 's' : ''} selected` : 'Add photos or videos'}
                          </span>
                        </div>
                      </button>
                    </div>

                    {/* Privacy */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Privacy</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setVisibility('public')}
                          className={`p-3 border-2 rounded-md text-left transition-colors ${
                            visibility === 'public' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs font-medium text-gray-900">Public</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVisibility('draft')}
                          className={`p-3 border-2 rounded-md text-left transition-colors ${
                            visibility === 'draft' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs font-medium text-gray-900">Draft</span>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-xs text-red-600">{error}</p>
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="pt-3 border-t border-gray-200 flex-shrink-0">
                    <button
                      type="submit"
                      disabled={!canGoNext() || isSubmitting}
                      className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      {isSubmitting ? 'Creating...' : 'Create Pin'}
                    </button>
                  </div>
                </form>
              )}

              {/* Pin Steps - Old stepper (kept for reference but not used) */}
              {createMode === 'pin' && currentStep !== 'mode' && currentStep !== 'single' && (
                <form onSubmit={(e) => { e.preventDefault(); currentStep === 'review' ? handleSubmit(e) : handleNext(); }} className="p-[10px]">
                  
                  {/* Step: Location */}
                  {currentStep === 'location' && (
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-1">Select location</h3>
                        <p className="text-xs text-gray-600 mb-3">Choose where to place your pin on the map (required)</p>
                        <button
                          type="button"
                          onClick={() => setShowMapView(true)}
                          className="w-full p-3 border-2 border-gray-200 rounded-md hover:border-gray-900 transition-colors text-left mb-3"
                        >
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="font-medium text-gray-900">
                              {mapData?.center ? 'Location selected' : 'Click to select location'}
                            </span>
                          </div>
                          {mapData?.center && (
                            <p className="text-sm text-gray-600 mt-2">
                              {mapData.center.lat.toFixed(4)}, {mapData.center.lng.toFixed(4)}
                            </p>
                          )}
                        </button>

                        {/* Map Selector - Required for pins, locked if live map is only accessible map */}
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">
                            Map {createMode === 'pin' && <span className="text-red-500">*</span>}
                          </label>
                          {selectedMapId ? (
                            <div className={`flex items-center justify-between p-3 border-2 rounded-md ${
                              selectedMapId === liveMapId && createMode === 'pin' && accessibleMaps.length === 1
                                ? 'border-gray-300 bg-gray-50'
                                : 'border-gray-200'
                            }`}>
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                                <span className="text-sm font-medium text-gray-900">
                                  {accessibleMaps.find(m => m.id === selectedMapId)?.name || 'Live Map'}
                                </span>
                                {accessibleMaps.find(m => m.id === selectedMapId)?.visibility === 'private' && (
                                  <svg className="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                                {selectedMapId === liveMapId && createMode === 'pin' && accessibleMaps.length === 1 && (
                                  <span className="text-xs text-gray-500">(Locked)</span>
                                )}
                              </div>
                              {/* Only lock if live map is the only accessible map for pins */}
                              {!(selectedMapId === liveMapId && createMode === 'pin' && accessibleMaps.length === 1) && initialMapId !== selectedMapId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if ((createMode as 'post' | 'pin') === 'post') {
                                      setSelectedMapId(null);
                                    } else {
                                      // For pins, allow changing to another map, but not removing
                                      setShowMapSelector(true);
                                    }
                                  }}
                                  className="text-sm text-gray-500 hover:text-gray-700"
                                >
                                  Change
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setShowMapSelector(!showMapSelector)}
                                className="w-full p-3 border-2 border-gray-200 rounded-md hover:border-gray-900 transition-colors text-left"
                                disabled={isLoadingMaps}
                              >
                                <div className="flex items-center gap-3">
                                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                  </svg>
                                  <span className="font-medium text-gray-900">
                                    {isLoadingMaps ? 'Loading maps...' : createMode === 'pin' ? 'Select a map (required)' : 'Select a map (optional)'}
                                  </span>
                                </div>
                              </button>
                              
                              {/* Map Dropdown */}
                              {showMapSelector && !isLoadingMaps && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md z-50 max-h-64 overflow-y-auto">
                                  <div className="p-2">
                                    {(createMode as 'post' | 'pin') === 'post' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedMapId(null);
                                          setShowMapSelector(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                                          !selectedMapId
                                            ? 'bg-gray-100 text-gray-900 font-medium'
                                            : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                      >
                                        No map (default)
                                      </button>
                                    )}
                                    {accessibleMaps.length === 0 ? (
                                      <div className="px-3 py-2 text-sm text-gray-500">
                                        No accessible maps
                                      </div>
                                    ) : (
                                      accessibleMaps.map((map) => (
                                        <button
                                          key={map.id}
                                          type="button"
                                          onClick={() => {
                                            setSelectedMapId(map.id);
                                            setShowMapSelector(false);
                                          }}
                                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                                            selectedMapId === map.id
                                              ? 'bg-gray-100 text-gray-900 font-medium'
                                              : 'text-gray-700 hover:bg-gray-50'
                                          }`}
                                        >
                                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                          </svg>
                                          <span className="flex-1 truncate">{map.name}</span>
                                          {map.visibility === 'private' && (
                                            <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                            </svg>
                                          )}
                                        </button>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step: Description */}
                  {currentStep === 'description' && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-1">Add description</h3>
                        <p className="text-xs text-gray-600 mb-3">Describe this location and select a category (both required)</p>
                        
                        {/* Mention Type Selector */}
                        <div className="mb-3">
                          <label className="text-xs font-medium text-gray-700 mb-1 block">Category (required)</label>
                          {isLoadingMentionTypes ? (
                            <div className="text-center py-3 text-gray-500 text-xs">Loading categories...</div>
                          ) : selectedMentionTypeId ? (
                            <div className="flex items-center justify-between p-[10px] border-2 border-gray-200 rounded-md">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{mentionTypes.find(t => t.id === selectedMentionTypeId)?.emoji}</span>
                                <span className="text-xs font-medium text-gray-900">
                                  {mentionTypes.find(t => t.id === selectedMentionTypeId)?.name}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedMentionTypeId(null)}
                                className="text-xs text-gray-500 hover:text-gray-700"
                              >
                                Change
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowMentionTypesModal(true)}
                              className="w-full p-3 border-2 border-gray-200 rounded-md hover:border-gray-900 transition-colors text-left"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-red-500">#</span>
                                <span className="text-xs font-medium text-gray-900">Select category</span>
                              </div>
                            </button>
                          )}
                        </div>

                        {/* Description Textarea */}
                        <div>
                          <label className="text-xs font-medium text-gray-700 mb-1 block">Description (required)</label>
                          <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Describe this location..."
                            className="w-full min-h-[200px] px-3 py-2 text-xs resize-none focus:outline-none placeholder:text-gray-400 border border-gray-200 rounded-md"
                            maxLength={240}
                          />
                          {content.length >= 230 && (
                            <div className="text-right text-xs text-gray-500 mt-1">
                              {content.length}/240
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step: Optional (combines media, privacy) */}
                  {currentStep === 'optional' && createMode === 'pin' && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-1">Optional settings</h3>
                        <p className="text-xs text-gray-600 mb-3">Add media or change privacy</p>
                        
                        {/* Media */}
                        <div className="mb-4">
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Media</label>
                          <button
                            type="button"
                            onClick={() => setShowImageView(true)}
                            className="w-full p-3 border-2 border-gray-200 rounded-lg hover:border-gray-900 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                              </svg>
                              <span className="font-medium text-gray-900">
                                {images.length > 0 ? `${images.length} media selected` : 'Add photos or videos'}
                              </span>
                            </div>
                          </button>
                        </div>

                        {/* Privacy */}
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Privacy</label>
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => setVisibility('public')}
                              className={`w-full p-3 border-2 rounded-lg text-left transition-colors ${
                                visibility === 'public' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div>
                                  <div className="font-medium text-gray-900">Public</div>
                                  <div className="text-xs text-gray-600">Anyone can see this pin</div>
                                </div>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setVisibility('draft')}
                              className={`w-full p-3 border-2 rounded-lg text-left transition-colors ${
                                visibility === 'draft' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                                <div>
                                  <div className="font-medium text-gray-900">Only me</div>
                                  <div className="text-xs text-gray-600">Only you can see this pin</div>
                                </div>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step: Review */}
                  {currentStep === 'review' && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Review your pin</h3>
                        <div className="space-y-3">
                          {selectedMentionTypeId && (
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-xs text-gray-500 mb-1">Category</div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{mentionTypes.find(t => t.id === selectedMentionTypeId)?.emoji}</span>
                                <span className="font-medium">{mentionTypes.find(t => t.id === selectedMentionTypeId)?.name}</span>
                              </div>
                            </div>
                          )}
                          {mapData?.center && (
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-xs text-gray-500 mb-1">Location</div>
                              <div className="font-medium">{mapData.center.lat.toFixed(4)}, {mapData.center.lng.toFixed(4)}</div>
                            </div>
                          )}
                          {content && (
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-xs text-gray-500 mb-1">Description</div>
                              <div className="font-medium">{content}</div>
                            </div>
                          )}
                          {images.length > 0 && (
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-xs text-gray-500 mb-1">Media</div>
                              <div className="font-medium">{images.length} item(s)</div>
                            </div>
                          )}
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">Privacy</div>
                            <div className="font-medium">{visibility === 'public' ? 'Public' : 'Only me'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Legacy form fields - hidden but kept for compatibility */}
                  <div className="hidden">
            {/* Mention Type Tag Selector - Required for pins, optional for posts */}
            <div className="mb-3">
              {selectedMentionTypeId && mentionTypes.length > 0 ? (
                // Show selected tag
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 bg-gray-50">
                  <span className="text-lg leading-none">
                    {mentionTypes.find(t => t.id === selectedMentionTypeId)?.emoji}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {mentionTypes.find(t => t.id === selectedMentionTypeId)?.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedMentionTypeId(null)}
                    className="w-5 h-5 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors text-gray-400 hover:text-gray-600"
                    title="Remove tag"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                // Show Add Tag button (always visible, but required for pins)
                <button
                  type="button"
                  onClick={() => setShowMentionTypesModal(true)}
                  className="relative inline-flex items-center gap-2 px-3 py-2 rounded-md transition-all hover:bg-gray-50 active:bg-gray-100 group touch-manipulation"
                  title="Add tag"
                >
                  <span className="text-xl font-bold text-red-500 group-hover:text-red-600 transition-colors">
                    #
                  </span>
                  <span className="text-sm font-medium text-gray-500 group-hover:text-gray-700 transition-colors">
                    Add tag{createMode === 'pin' && ' (required)'}
                  </span>
                </button>
              )}
            </div>

            {/* Map Selector */}
            <div className="mb-3">
              {selectedMapId ? (
                // Show selected map
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 bg-gray-50">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <span className="text-sm font-medium text-gray-900">
                    {accessibleMaps.find(m => m.id === selectedMapId)?.name || 'Map'}
                  </span>
                  {accessibleMaps.find(m => m.id === selectedMapId)?.visibility === 'private' && (
                    <svg className="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {/* Only show remove button if map was not pre-selected via initialMapId */}
                  {initialMapId !== selectedMapId && (
                    <button
                      type="button"
                      onClick={() => setSelectedMapId(null)}
                      className="w-5 h-5 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors text-gray-400 hover:text-gray-600"
                      title="Remove map"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ) : (
                // Show Add Map button (only if no initialMapId is set)
                !initialMapId && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowMapSelector(!showMapSelector)}
                      className="relative inline-flex items-center gap-2 px-3 py-2 rounded-md transition-all hover:bg-gray-50 active:bg-gray-100 group touch-manipulation"
                      title="Add to map"
                      disabled={isLoadingMaps}
                    >
                      <svg className="w-4 h-4 text-gray-500 group-hover:text-gray-700 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <span className="text-sm font-medium text-gray-500 group-hover:text-gray-700 transition-colors">
                        {isLoadingMaps ? 'Loading maps...' : 'Add to map'}
                      </span>
                    </button>
                  
                  {/* Map Dropdown */}
                  {showMapSelector && !isLoadingMaps && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
                      <div className="p-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMapId(null);
                            setShowMapSelector(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                            !selectedMapId
                              ? 'bg-gray-100 text-gray-900 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          No map (general post)
                        </button>
                        {accessibleMaps.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-500">
                            No accessible maps
                          </div>
                        ) : (
                          accessibleMaps.map((map) => (
                            <button
                              key={map.id}
                              type="button"
                              onClick={() => {
                                setSelectedMapId(map.id);
                                setShowMapSelector(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                                selectedMapId === map.id
                                  ? 'bg-gray-100 text-gray-900 font-medium'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                              </svg>
                              <span className="flex-1 truncate">{map.name}</span>
                              {map.visibility === 'private' && (
                                <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                  </div>
                )
              )}
            </div>

            {/* Title Input - Only for posts */}
            {(createMode as 'post' | 'pin') === 'post' && showTitle && (
              <div className="mb-3 relative">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Add a title..."
                  className="w-full px-4 py-2 text-xl font-semibold border-0 focus:outline-none placeholder:text-gray-400"
                  maxLength={90}
                />
                {title.length >= 80 && (
                  <div className="absolute bottom-1 right-2 text-xs text-gray-500">
                    {title.length}/90
                  </div>
                )}
              </div>
            )}

            {/* Text Input */}
            <div className="relative min-h-[200px]">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={createMode === 'pin' ? 'Describe this location...' : `What's on your mind, ${accountName.split(' ')[0]}?`}
                className="w-full h-full min-h-[200px] px-4 py-3 text-lg resize-none focus:outline-none placeholder:text-gray-400"
                maxLength={240}
              />
              
              {/* Character Count - Show when within 10 of limit (240) */}
              {content.length >= 230 && (
                <div className="absolute bottom-12 right-2 text-xs text-gray-500">
                  {content.length}/240
                </div>
              )}
              
              {/* Bottom Icons */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 pointer-events-none">
                <div className="flex items-center gap-2 pointer-events-auto">
                  {/* Title toggle - Only for posts */}
                  {(createMode as 'post' | 'pin') === 'post' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowTitle(!showTitle);
                      if (!showTitle) {
                        setTimeout(() => {
                          titleInputRef.current?.focus();
                        }, 100);
                      }
                    }}
                    className={`w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors ${
                      showTitle ? 'bg-gray-100' : ''
                    }`}
                    title="Add title"
                  >
                    <span className={`text-sm font-semibold ${showTitle ? 'text-gray-900' : 'text-gray-600'}`}>Aa</span>
                  </button>
                  )}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowPrivacyMenu(!showPrivacyMenu)}
                      className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                      title="Privacy"
                    >
                      {visibility === 'public' ? (
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                    
                    {/* Privacy Menu Dropdown */}
                    {showPrivacyMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-[102]"
                          onClick={() => setShowPrivacyMenu(false)}
                        />
                        <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg z-[103] min-w-[160px]">
                          <button
                            type="button"
                            onClick={() => {
                              setVisibility('public');
                              setShowPrivacyMenu(false);
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${
                              visibility === 'public' ? 'bg-gray-50 font-medium' : ''
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">Public</div>
                              <div className="text-xs text-gray-500">Anyone can see this</div>
                            </div>
                            {visibility === 'public' && (
                              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVisibility('draft');
                              setShowPrivacyMenu(false);
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors border-t border-gray-100 ${
                              visibility === 'draft' ? 'bg-gray-50 font-medium' : ''
                            }`}
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">Only Me</div>
                              <div className="text-xs text-gray-500">Save as draft</div>
                            </div>
                            {visibility === 'draft' && (
                              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddEmoji}
                  className="pointer-events-auto w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors ml-auto"
                  title="Add emoji"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.414 5 5 0 007.072 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Selected Images Preview */}
            {images.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-2">
                  {images.map((image, index) => (
                    <div 
                      key={image.url || index} 
                      className="relative group"
                      onMouseEnter={(e) => {
                        const button = e.currentTarget.querySelector('button');
                        if (button) button.classList.remove('opacity-0');
                      }}
                      onMouseLeave={(e) => {
                        const button = e.currentTarget.querySelector('button');
                        if (button) button.classList.add('opacity-0');
                      }}
                    >
                      {image.type === 'video' ? (
                        <div className="w-full h-32 bg-gray-100 rounded-lg border border-gray-300 flex items-center justify-center relative overflow-hidden">
                          <video
                            src={image.url}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={image.url}
                          alt={image.alt || `Image ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border border-gray-300"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-2 left-2 w-6 h-6 bg-black/70 hover:bg-black text-white rounded-full flex items-center justify-center opacity-0 transition-opacity z-10 pointer-events-auto"
                        aria-label="Remove image"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Map Data Display */}
            {mapData && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex gap-3 p-3">
                    {mapData.screenshot && (
                      <div className="flex-shrink-0">
                        <img
                          src={mapData.screenshot}
                          alt="Map preview"
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 mb-1">
                            {mapData.type === 'area' ? 'Area' : mapData.type === 'pin' ? 'Pin' : 'Area & Pin'}
                          </p>
                          {mapData.center && (
                            <p className="text-xs text-gray-500">
                              {mapData.center.lat.toFixed(4)}, {mapData.center.lng.toFixed(4)}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMapData(null);
                            setSelectedMediaType(null);
                            // Remove screenshot from images if it exists
                            if (mapData?.screenshot) {
                              setImages((prev) => prev.filter((img) => img.url !== mapData.screenshot));
                            }
                          }}
                          className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors text-gray-400 hover:text-gray-600"
                          title="Remove map"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Selected Mentions Display - Only for posts */}
            {(createMode as 'post' | 'pin') === 'post' && selectedMentionIds.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="space-y-3">
                  {mentions
                    .filter((m) => selectedMentionIds.includes(m.id))
                    .map((mention) => {
                      const mentionDate = mention.created_at 
                        ? new Date(mention.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })
                        : null;
                      
                      return (
                        <div key={mention.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors">
                          <div className="flex gap-3 p-3">
                            {/* Image/Icon */}
                            <div className="flex-shrink-0">
                              {mention.image_url ? (
                                <img
                                  src={mention.image_url}
                                  alt={mention.description || 'Mention'}
                                  className="w-16 h-16 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                                  {mention.mention_type ? (
                                    <span className="text-2xl">{mention.mention_type.emoji}</span>
                                  ) : (
                                    <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  {/* Description */}
                                  {mention.description && (
                                    <p className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">
                                      {mention.description}
                                    </p>
                                  )}
                                  
                                  {/* Metadata Row */}
                                  <div className="flex items-center gap-2 flex-wrap mt-1">
                                    {mention.mention_type && (
                                      <span className="text-xs text-gray-600 flex items-center gap-1">
                                        <span>{mention.mention_type.emoji}</span>
                                        <span>{mention.mention_type.name}</span>
                                      </span>
                                    )}
                                    {mention.collection && (
                                      <>
                                        {mention.mention_type && <span className="text-gray-300">•</span>}
                                        <span className="text-xs text-gray-600 flex items-center gap-1">
                                          <span>{mention.collection.emoji}</span>
                                          <span>{mention.collection.title}</span>
                                        </span>
                                      </>
                                    )}
                                    {mentionDate && (
                                      <>
                                        {(mention.mention_type || mention.collection) && <span className="text-gray-300">•</span>}
                                        <span className="text-xs text-gray-500">{mentionDate}</span>
                                      </>
                                    )}
                                  </div>

                                  {/* Location */}
                                  {mention.map_meta?.place_name && (
                                    <div className="flex items-center gap-1 mt-1.5">
                                      <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                      </svg>
                                      <span className="text-xs text-gray-500 truncate">
                                        {mention.map_meta.place_name}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Remove Button */}
                                <button
                                  type="button"
                                  onClick={() => handleMentionToggle(mention.id)}
                                  className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors text-gray-400 hover:text-gray-600"
                                  title="Remove mention"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

                  </div>
                  {/* Legacy form fields - hidden but kept for compatibility */}
                  <div className="hidden">
                    {/* All old form code is here but hidden */}
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                      {error}
                  </div>
                  )}

                  {/* Step Navigation */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-3">
                    {getCurrentStepIndex() > 0 && (
                      <button
                        type="button"
                        onClick={handleBack}
                        className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Back
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={!canGoNext() || isSubmitting}
                      className={`${getCurrentStepIndex() > 0 ? 'flex-1' : 'w-full'} py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                    >
                      {currentStep === 'review' 
                        ? (isSubmitting 
                            ? (createMode === 'pin' ? 'Creating pin...' : 'Posting...') 
                            : (createMode === 'pin' ? 'Create Pin' : 'Post'))
                        : 'Next'}
                    </button>
                  </div>
                </form>
              )}

              {/* Post Steps */}
              {createMode === 'post' && currentStep !== 'mode' && (
                <form onSubmit={(e) => { e.preventDefault(); currentStep === 'review' ? handleSubmit(e) : handleNext(); }} className="p-4">
                  
                  {/* Step: Content */}
                  {currentStep === 'content' && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">What's on your mind?</h3>
                        <p className="text-sm text-gray-600 mb-4">Share your thoughts (required)</p>
                        <textarea
                          ref={textareaRef}
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          placeholder={`What's on your mind, ${accountName.split(' ')[0]}?`}
                          className="w-full min-h-[200px] px-4 py-3 text-lg resize-none focus:outline-none placeholder:text-gray-400 border border-gray-200 rounded-lg"
                          maxLength={10000}
                        />
                        {content.length >= 9990 && (
                          <div className="text-right text-xs text-gray-500 mt-1">
                            {content.length}/10,000
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step: Optional (combines title, mention type, media, mentions, map, privacy) */}
                  {currentStep === 'optional' && createMode === 'post' && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Optional settings</h3>
                        <p className="text-sm text-gray-600 mb-4">Add a title, category, media, mentions, location, or change privacy</p>
                        
                        {/* Title */}
                        <div className="mb-4">
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Title</label>
                          <input
                            ref={titleInputRef}
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Add a title..."
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                            maxLength={200}
                          />
                        </div>

                        {/* Mention Type */}
                        <div className="mb-4">
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Category</label>
                          {selectedMentionTypeId ? (
                            <div className="flex items-center justify-between p-3 border-2 border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2">
                                <span className="text-lg">{mentionTypes.find(t => t.id === selectedMentionTypeId)?.emoji}</span>
                                <span className="text-sm font-medium text-gray-900">
                                  {mentionTypes.find(t => t.id === selectedMentionTypeId)?.name}
                                </span>
                              </div>
                <button
                  type="button"
                                onClick={() => setSelectedMentionTypeId(null)}
                                className="text-sm text-gray-500 hover:text-gray-700"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowMentionTypesModal(true)}
                              className="w-full p-3 border-2 border-gray-200 rounded-lg hover:border-gray-900 transition-colors text-left"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xl font-bold text-red-500">#</span>
                                <span className="font-medium text-gray-900">Add category</span>
                              </div>
                            </button>
                          )}
                        </div>

                        {/* Media */}
                        <div className="mb-4">
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Media</label>
                          <button
                            type="button"
                            onClick={() => setShowImageView(true)}
                            className="w-full p-3 border-2 border-gray-200 rounded-lg hover:border-gray-900 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                              <span className="font-medium text-gray-900">
                                {images.length > 0 ? `${images.length} media selected` : 'Add photos or videos'}
                              </span>
                            </div>
                </button>
                        </div>

                        {/* Mentions */}
                        <div className="mb-4">
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Mentions</label>
                <button
                  type="button"
                            onClick={() => setShowMentionsList(true)}
                            className="w-full p-3 border-2 border-gray-200 rounded-lg hover:border-gray-900 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                              <span className="font-medium text-gray-900">
                                {selectedMentionIds.length > 0 ? `${selectedMentionIds.length} mention(s) selected` : 'Reference other pins'}
                              </span>
                            </div>
                </button>
                        </div>

                        {/* Map/Location */}
                        <div className="mb-4">
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Location</label>
                <button
                  type="button"
                            onClick={() => setShowMapView(true)}
                            className="w-full p-3 border-2 border-gray-200 rounded-lg hover:border-gray-900 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                              <span className="font-medium text-gray-900">
                                {mapData?.center ? 'Location selected' : 'Add location (optional)'}
                              </span>
                            </div>
                </button>
                  </div>

                        {/* Privacy */}
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Privacy</label>
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => setVisibility('public')}
                              className={`w-full p-3 border-2 rounded-lg text-left transition-colors ${
                                visibility === 'public' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div>
                                  <div className="font-medium text-gray-900">Public</div>
                                  <div className="text-xs text-gray-600">Anyone can see this post</div>
                </div>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setVisibility('draft')}
                              className={`w-full p-3 border-2 rounded-lg text-left transition-colors ${
                                visibility === 'draft' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                                <div>
                                  <div className="font-medium text-gray-900">Draft</div>
                                  <div className="text-xs text-gray-600">Save as draft</div>
                                </div>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step: Review */}
                  {currentStep === 'review' && createMode === 'post' && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Review your post</h3>
                        <div className="space-y-3">
                          {title && (
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-xs text-gray-500 mb-1">Title</div>
                              <div className="font-medium">{title}</div>
                            </div>
                          )}
                          {content && (
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-xs text-gray-500 mb-1">Content</div>
                              <div className="font-medium">{content}</div>
                            </div>
                          )}
                          {selectedMentionTypeId && (
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-xs text-gray-500 mb-1">Category</div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{mentionTypes.find(t => t.id === selectedMentionTypeId)?.emoji}</span>
                                <span className="font-medium">{mentionTypes.find(t => t.id === selectedMentionTypeId)?.name}</span>
                              </div>
                            </div>
                          )}
                          {images.length > 0 && (
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-xs text-gray-500 mb-1">Media</div>
                              <div className="font-medium">{images.length} item(s)</div>
                            </div>
                          )}
                          {selectedMentionIds.length > 0 && (
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-xs text-gray-500 mb-1">Mentions</div>
                              <div className="font-medium">{selectedMentionIds.length} mention(s)</div>
                            </div>
                          )}
                          {mapData?.center && (
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-xs text-gray-500 mb-1">Location</div>
                              <div className="font-medium">{mapData.center.lat.toFixed(4)}, {mapData.center.lng.toFixed(4)}</div>
                            </div>
                          )}
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">Privacy</div>
                            <div className="font-medium">{visibility === 'public' ? 'Public' : 'Draft'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

            {/* Error Message */}
            {error && (
              <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </div>
            )}

                  {/* Step Navigation */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-3">
                    {getCurrentStepIndex() > 0 && (
                      <button
                        type="button"
                        onClick={handleBack}
                        className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Back
                      </button>
                    )}
              <button
                type="submit"
                      disabled={!canGoNext() || isSubmitting}
                      className={`${getCurrentStepIndex() > 0 ? 'flex-1' : 'w-full'} py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
              >
                      {currentStep === 'review' 
                        ? (isSubmitting ? 'Posting...' : 'Post')
                        : 'Next'}
              </button>
            </div>
          </form>
              )}
            </div>
          </div>

          {/* Mention Types Modal */}
          {showMentionTypesModal && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-[102]"
                onClick={() => {
                  setShowMentionTypesModal(false);
                  setMentionTypeSearchQuery('');
                }}
              />
              <div className="fixed inset-0 z-[103] flex items-center justify-center p-4 pointer-events-none">
                <div
                  className="bg-white rounded-lg shadow-xl w-full max-w-[500px] pointer-events-auto max-h-[80vh] flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Select Tag</h3>
                    <button
                      onClick={() => {
                        setShowMentionTypesModal(false);
                        setMentionTypeSearchQuery('');
                      }}
                      className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Search Input */}
                  <div className="p-4 border-b border-gray-200">
                    <input
                      type="text"
                      value={mentionTypeSearchQuery}
                      onChange={(e) => setMentionTypeSearchQuery(e.target.value)}
                      placeholder="Search tags..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                    />
                  </div>

                  {/* Mention Types List */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {isLoadingMentionTypes ? (
                      <div className="flex items-center justify-center py-8">
                        <span className="text-sm text-gray-500">Loading tags...</span>
                      </div>
                    ) : (() => {
                      const filteredTypes = mentionTypes.filter((type) =>
                        type.name.toLowerCase().includes(mentionTypeSearchQuery.toLowerCase())
                      );

                      return filteredTypes.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                          <span className="text-sm text-gray-500">No tags found</span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-3">
                          {filteredTypes.map((type) => (
                            <button
                              key={type.id}
                              type="button"
                              onClick={() => {
                                setSelectedMentionTypeId(type.id);
                                setShowMentionTypesModal(false);
                                setMentionTypeSearchQuery('');
                              }}
                              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md border transition-all ${
                                selectedMentionTypeId === type.id
                                  ? 'border-gray-900 bg-gray-50 opacity-100'
                                  : 'border-gray-200 bg-white opacity-60 hover:opacity-80'
                              }`}
                            >
                              <span className="text-lg leading-none">{type.emoji}</span>
                              <span className="text-sm font-medium text-gray-900">{type.name}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );

  // Use portal to render at document body level
  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
