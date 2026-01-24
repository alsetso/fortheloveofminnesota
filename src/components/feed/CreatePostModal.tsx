'use client';

import { useState, useEffect, useRef } from 'react';
import { Group } from '@/types/group';
import { useAuthStateSafe, Account } from '@/features/auth';
import Link from 'next/link';
import ProfilePhoto from '../shared/ProfilePhoto';
import { Mention } from '@/types/mention';
import PostMapDrawer from './PostMapDrawer';
import PostImageDrawer from './PostImageDrawer';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
  initialAction?: 'upload_photo' | 'upload_video' | 'mention' | null;
  initialGroupId?: string | null;
  lockGroupId?: boolean;
}

export default function CreatePostModal({ 
  isOpen, 
  onClose, 
  onPostCreated,
  initialAction,
  initialGroupId,
  lockGroupId = false
}: CreatePostModalProps) {
  const { account } = useAuthStateSafe();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [showTitle, setShowTitle] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId || null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
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
                         account?.plan === 'plus' || account?.plan === 'business' || 
                         account?.plan === 'plus' || 
                         account?.plan === 'business' || 
                         account?.plan === 'gov';

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

  // Fetch user's groups
  useEffect(() => {
    if (!account?.id || !isOpen) return;

    const fetchGroups = async () => {
      setIsLoadingGroups(true);
      try {
        const response = await fetch('/api/groups?limit=100', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          const memberGroups = (data.groups || []).filter(
            (g: Group) => g.is_member === true
          );
          setGroups(memberGroups);
        }
      } catch (err) {
        console.error('Error fetching groups:', err);
      } finally {
        setIsLoadingGroups(false);
      }
    };

    fetchGroups();
  }, [account?.id, isOpen]);

  // Handle initial actions
  useEffect(() => {
    if (isOpen) {
      if (initialAction === 'upload_photo') {
        setTimeout(() => {
          fileInputRef.current?.click();
        }, 300);
      } else if (initialAction === 'upload_video') {
        if (!canUploadVideo) {
          setError('Video uploads are only available for Contributor, Professional, and Business plans.');
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
        const { data, error } = await supabase
          .from('mentions')
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
          .eq('account_id', account.id)
          .eq('archived', false)
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

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setContent('');
      setTitle('');
      setShowTitle(false);
      if (!lockGroupId) {
        setSelectedGroupId(null);
      } else {
        setSelectedGroupId(initialGroupId || null);
      }
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
  }, [isOpen, lockGroupId, initialGroupId]);

  // Set initial group ID when provided
  useEffect(() => {
    if (initialGroupId && isOpen) {
      setSelectedGroupId(initialGroupId);
    }
  }, [initialGroupId, isOpen]);

  // Focus title input when it's shown
  useEffect(() => {
    if (showTitle && titleInputRef.current) {
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [showTitle]);

  // Lock body scroll when modal is open
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
          setError('Video uploads are only available for Contributor, Professional, and Business plans.');
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
    // Clear other media types if they have data
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
    if (!content.trim() || !account?.id) return;

    setIsSubmitting(true);
    setError(null);

    try {
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
          group_id: selectedGroupId || null,
          mention_type_id: selectedMentionTypeId || null,
          mention_ids: selectedMentionIds.length > 0 ? selectedMentionIds : null,
          images: images.length > 0 ? images : null,
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

      // Reset and close
      setContent('');
      setTitle('');
      setShowTitle(false);
      if (!lockGroupId) {
        setSelectedGroupId(null);
      } else {
        setSelectedGroupId(initialGroupId || null);
      }
      setImages([]);
      setSelectedMentionIds([]);
      setShowMentionsList(false);
      setSelectedMentionTypeId(null);
      onPostCreated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const accountName = account?.first_name && account?.last_name
    ? `${account.first_name} ${account.last_name}`
    : account?.first_name || account?.username || 'User';

  if (!isOpen || !account) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[100] transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-lg shadow-xl w-full max-w-[500px] pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            {showImageView || showMapView || showMentionsList ? (
              <>
                <button
                  onClick={() => {
                    setShowImageView(false);
                    setShowMapView(false);
                    setShowMentionsList(false);
                  }}
                  className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="text-lg font-semibold text-gray-900 flex-1 text-center">
                  {showImageView ? 'Add Photos & Videos' : showMapView ? 'Draw on Map' : 'Select Mentions'}
                </h3>
                <div className="w-9" /> {/* Spacer for centering */}
              </>
            ) : (
              <>
                <Link 
                  href={`/profile/${account.username || account.id}`}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <ProfilePhoto 
                    account={account as unknown as Account} 
                    size="sm" 
                    editable={false} 
                  />
                  <span className="text-sm font-semibold text-gray-900">
                    @{account.username || account.id}
                  </span>
                </Link>
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Content Area */}
          <div className="relative overflow-hidden">
            {/* Mentions List View - Slides in from right */}
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
                          className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${
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
                                className="w-12 h-12 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                                <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {mention.description || 'Mention'}
                            </p>
                            {mention.collection && (
                              <p className="text-xs text-gray-500 mt-1">
                                {mention.collection.emoji} {mention.collection.title}
                              </p>
                            )}
                            {mention.mention_type && (
                              <p className="text-xs text-gray-500 mt-1">
                                {mention.mention_type.emoji} {mention.mention_type.name}
                              </p>
                            )}
                          </div>
                          {selectedMentionIds.includes(mention.id) && (
                            <div className="flex-shrink-0">
                              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
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
              className={`absolute inset-0 bg-white transition-transform duration-300 z-10 ${
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
                      const newImages = [{ url: data.screenshot, alt: 'Map screenshot', type: 'image' as const }, ...filtered];
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

            {/* Main Form View */}
            <form onSubmit={handleSubmit} className={`p-4 transition-transform duration-300 ${
              showMentionsList || showMapView || showImageView ? '-translate-x-full' : 'translate-x-0'
            }`}>
            {/* Group Selector - Optional */}
            {groups.length > 0 && (
              <div className="mb-3">
                <select
                  value={selectedGroupId || ''}
                  onChange={(e) => setSelectedGroupId(e.target.value || null)}
                  disabled={lockGroupId}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-600"
                >
                  <option value="">Feed (no group)</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Mention Type Tag Selector */}
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
                // Show Add Tag button
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
                    Add tag
                  </span>
                </button>
              )}
            </div>

            {/* Title Input */}
            {showTitle && (
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
                placeholder={`What's on your mind, ${accountName.split(' ')[0]}?`}
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

            {/* Selected Mentions Display */}
            {selectedMentionIds.length > 0 && (
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

            {/* Add to your post */}
            {(() => {
              // Check if there are user-uploaded images (excluding map screenshot)
              const hasImageData = images.some(img => img.url !== mapData?.screenshot);
              const hasMentionData = selectedMentionIds.length > 0;
              const hasMapData = mapData !== null;
              const isImageDisabled = hasMentionData || hasMapData;
              const isMentionDisabled = hasImageData || hasMapData;
              const isMapDisabled = hasImageData || hasMentionData;

              return (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Add to your post</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Photo/Video - FUNCTIONING */}
                <button
                  type="button"
                  onClick={() => {
                    if (isImageDisabled) return;
                    setShowImageView(true);
                  }}
                  disabled={isImageDisabled}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-all ${
                    isImageDisabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title={isImageDisabled ? 'Clear other selections first' : 'Photo/video'}
                >
                  <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={canUploadVideo ? "image/*,video/*" : "image/*"}
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />

                {/* Location - FUNCTIONING */}
                <button
                  type="button"
                  onClick={() => {
                    if (isMentionDisabled) return;
                    handleLocationClick();
                  }}
                  disabled={isMentionDisabled}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-all ${
                    isMentionDisabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title={isMentionDisabled ? 'Clear other selections first' : 'Location'}
                >
                  <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Map - FUNCTIONING */}
                <button
                  type="button"
                  onClick={() => {
                    if (isMapDisabled) return;
                    // Clear other media types if they have data
                    if (images.length > 0) {
                      setImages([]);
                    }
                    if (selectedMentionIds.length > 0) {
                      setSelectedMentionIds([]);
                    }
                    setSelectedMediaType('map');
                    setShowMapView(true);
                  }}
                  disabled={isMapDisabled}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-all ${
                    isMapDisabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title={isMapDisabled ? 'Clear other selections first' : 'Map'}
                >
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </button>
                  </div>
                </div>
              );
            })()}

            {/* Error Message */}
            {error && (
              <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </div>
            )}

            {/* Submit Button - FUNCTIONING */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={!content.trim() || isSubmitting}
                className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </form>
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
}
