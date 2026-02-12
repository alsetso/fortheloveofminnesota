'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeftIcon, XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { Mention } from '@/types/mention';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { Account } from '@/features/auth';
import PostMapDrawer from '@/components/feed/PostMapDrawer';
import PostImageDrawer from '@/components/feed/PostImageDrawer';
import MentionCard from '@/components/feed/MentionCard';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';

export default function EditMapPostPage() {
  const router = useRouter();
  const params = useParams();
  const mapIdOrSlug = params?.id as string;
  const postId = params?.postId as string;
  const { account } = useAuthStateSafe();
  const supabase = useSupabaseClient();
  
  const [post, setPost] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showTitle, setShowTitle] = useState(false);
  const [images, setImages] = useState<Array<{ url: string; alt?: string; type?: 'image' | 'video' }>>([]);
  const [showImageView, setShowImageView] = useState(false);
  const [selectedMentionIds, setSelectedMentionIds] = useState<string[]>([]);
  const [showMentionsList, setShowMentionsList] = useState(false);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [selectedMentions, setSelectedMentions] = useState<Mention[]>([]);
  const [isLoadingMentions, setIsLoadingMentions] = useState(false);
  const [mentionTypeId, setMentionTypeId] = useState<string | null>(null);
  const [mentionTypes, setMentionTypes] = useState<Array<{ id: string; emoji: string; name: string }>>([]);
  const [isLoadingMentionTypes, setIsLoadingMentionTypes] = useState(false);
  const [showMapView, setShowMapView] = useState(false);
  const [mapData, setMapData] = useState<{
    type: 'pin' | 'area' | 'both';
    geometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon | GeoJSON.Point;
    center?: { lat: number; lng: number };
    screenshot?: string;
    address?: string;
    place_name?: string;
  } | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'draft'>('public');
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load post data
  useEffect(() => {
    if (!postId || !account?.id) return;

    const loadPost = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/posts/${postId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 404) {
            setError('Post not found');
          } else {
            setError('Failed to load post');
          }
          return;
        }

        const data = await response.json();
        const postData = data.post;

        // Check if user owns this post
        if (postData.account_id !== account.id) {
          setError('You do not have permission to edit this post');
          return;
        }

        setPost(postData);
        setTitle(postData.title || '');
        setShowTitle(!!postData.title);
        setContent(postData.content || '');
        setVisibility(postData.visibility || 'public');
        setSelectedMentionIds(postData.mention_ids || []);
        setMentionTypeId(postData.mention_type_id || null);
        
        // Load images (filter out map screenshot if it exists)
        if (postData.images && Array.isArray(postData.images)) {
          const filteredImages = postData.map_data?.screenshot
            ? postData.images.filter((img: any) => img.url !== postData.map_data.screenshot)
            : postData.images;
          setImages(filteredImages || []);
        }
        
        // Load map data if it exists
        if (postData.map_data) {
          setMapData({
            type: postData.map_data.type || 'pin',
            geometry: postData.map_data.geometry,
            center: postData.map_data.lat && postData.map_data.lng 
              ? { lat: postData.map_data.lat, lng: postData.map_data.lng }
              : undefined,
            screenshot: postData.map_data.screenshot,
            address: postData.map_data.address,
            place_name: postData.map_data.place_name,
          });
        }
      } catch (err) {
        console.error('[EditMapPostPage] Error loading post:', err);
        setError('Failed to load post');
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [postId, account?.id]);

  // Fetch mention types
  useEffect(() => {
    const fetchMentionTypes = async () => {
      setIsLoadingMentionTypes(true);
      try {
        const { data, error } = await supabase
          .from('mention_types')
          .select('id, emoji, name')
          .eq('is_active', true)
          .order('name');
        
        if (error) throw error;
        setMentionTypes((data || []) as Array<{ id: string; emoji: string; name: string }>);
      } catch (err) {
        console.error('[EditMapPostPage] Error fetching mention types:', err);
      } finally {
        setIsLoadingMentionTypes(false);
      }
    };

    fetchMentionTypes();
  }, [supabase]);

  // Fetch user's mentions
  useEffect(() => {
    if (!account?.id) return;

    const fetchMentions = async () => {
      if (showMentionsList) {
        setIsLoadingMentions(true);
      }
      try {
        const { supabase } = await import('@/lib/supabase');
        // Get live map ID first
        const { data: liveMap } = await supabase
          .schema('maps')
          .from('maps')
          .select('id')
          .eq('slug', 'live')
          .eq('is_active', true)
          .single();

        const { data, error: err } = await supabase
          .schema('maps')
          .from('pins')
          .select(`
            id,
            description,
            image_url,
            lat,
            lng,
            account_id,
            city_id,
            collection_id,
            created_at,
            updated_at,
            mention_type:mention_types(
              emoji,
              name
            ),
            collection:collections(
              emoji,
              title
            )
          `)
          .eq('map_id', liveMap?.id)
          .eq('account_id', account.id)
          .eq('archived', false)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(100);

        if (err) throw err;
        const mentionsData = (data || []) as unknown as Mention[];
        setMentions(mentionsData);
        
        // Load selected mentions if we have mention_ids
        if (selectedMentionIds.length > 0) {
          const selected = mentionsData.filter(m => selectedMentionIds.includes(m.id));
          setSelectedMentions(selected);
        }
      } catch (err) {
        console.error('[EditMapPostPage] Error fetching mentions:', err);
        setError('Failed to load mentions');
      } finally {
        setIsLoadingMentions(false);
      }
    };

    fetchMentions();
  }, [account?.id, showMentionsList, selectedMentionIds]);

  const handleMentionToggle = (mentionId: string) => {
    setSelectedMentionIds((prev) => {
      if (prev.includes(mentionId)) {
        const updated = prev.filter((id) => id !== mentionId);
        setSelectedMentions(prevMentions => prevMentions.filter(m => m.id !== mentionId));
        return updated;
      } else {
        const mention = mentions.find(m => m.id === mentionId);
        if (mention) {
          setSelectedMentions(prev => [...prev, mention]);
        }
        return [...prev, mentionId];
      }
    });
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleImagesSave = (newImages: Array<{ url: string; alt?: string; type?: 'image' | 'video' }>) => {
    setImages(newImages);
    setShowImageView(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim() || null,
          content: content.trim(),
          visibility: visibility,
          mention_type_id: mentionTypeId || null,
          mention_ids: selectedMentionIds.length > 0 ? selectedMentionIds : null,
          images: images.length > 0 ? images : null,
          map_data: mapData ? {
            lat: mapData.center?.lat || 0,
            lng: mapData.center?.lng || 0,
            type: mapData.type,
            geometry: mapData.geometry,
            screenshot: mapData.screenshot,
            address: mapData.address,
            place_name: mapData.place_name,
          } : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update post');
      }

      router.push(`/map/${mapIdOrSlug}/post/${postId}`);
    } catch (err) {
      console.error('[EditMapPostPage] Error updating post:', err);
      setError(err instanceof Error ? err.message : 'Failed to update post');
      setIsSubmitting(false);
    }
  };

  if (!account) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to edit posts</p>
          <Link href="/" className="text-blue-600 hover:text-blue-700">
            Go to home
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading post...</p>
        </div>
      </div>
    );
  }

  if (error && !post) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href={`/map/${mapIdOrSlug}/post/${postId}`} className="text-blue-600 hover:text-blue-700">
            Back to post
          </Link>
        </div>
      </div>
    );
  }

  const username = post?.account?.username || account.username || 'unknown';

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={`/map/${mapIdOrSlug}/post/${postId}`} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </Link>
          <Link
            href="/"
            className="absolute left-1/2 transform -translate-x-1/2"
          >
            <Image
              src="/logo.png"
              alt="Love of Minnesota"
              width={32}
              height={32}
              className="w-8 h-8"
            />
          </Link>
          <span className="text-sm font-medium text-gray-600">Editing</span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[600px] mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Author Info */}
          <div className="flex items-center gap-3">
            <ProfilePhoto 
              account={account as unknown as Account} 
              size="md" 
              editable={false} 
            />
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-900">
                @{username}
              </div>
            </div>
          </div>

          {/* Title Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowTitle(!showTitle);
                if (!showTitle && titleInputRef.current) {
                  setTimeout(() => titleInputRef.current?.focus(), 0);
                }
              }}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              title="Toggle title"
            >
              <span className="text-sm font-semibold text-gray-600">Aa</span>
            </button>
            {showTitle && (
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add a title..."
                maxLength={90}
                className="flex-1 text-xl font-semibold text-gray-900 border-none outline-none bg-transparent"
              />
            )}
            {showTitle && title.length >= 80 && (
              <span className="text-xs text-gray-500">{90 - title.length}</span>
            )}
          </div>

          {/* Content */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              maxLength={240}
              rows={6}
              className="w-full text-sm text-gray-900 border-none outline-none resize-none"
            />
            {content.length >= 230 && (
              <div className="absolute bottom-2 right-2 text-xs text-gray-500">
                {240 - content.length}
              </div>
            )}
          </div>

          {/* Mention Type Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Category
            </label>
            <div className="relative">
              <select
                value={mentionTypeId || ''}
                onChange={(e) => setMentionTypeId(e.target.value || null)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
              >
                <option value="">No category</option>
                {mentionTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.emoji} {type.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Images Display */}
          {images.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-600 mb-2">
                Images ({images.length})
              </div>
              <div className="grid grid-cols-2 gap-2">
                {images.map((image, index) => {
                  const isVideo = image.type === 'video';
                  return (
                    <div key={index} className="relative group rounded-lg overflow-hidden border border-gray-200">
                      {isVideo ? (
                        <video
                          src={image.url}
                          className="w-full h-32 object-cover"
                          controls
                        />
                      ) : (
                        <Image
                          src={image.url}
                          alt={image.alt || `Image ${index + 1}`}
                          width={200}
                          height={200}
                          className="w-full h-32 object-cover"
                          unoptimized={image.url.startsWith('data:') || image.url.includes('supabase.co')}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <XMarkIcon className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add/Edit Images Button */}
          <button
            type="button"
            onClick={() => setShowImageView(true)}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {images.length > 0 ? 'Edit Images' : 'Add Images'}
          </button>

          {/* Mentions List View */}
          {showMentionsList && (
            <div className="border border-gray-200 rounded-lg p-4 bg-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Select Mentions</h3>
                <button
                  type="button"
                  onClick={() => setShowMentionsList(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {isLoadingMentions ? (
                  <div className="text-center py-4 text-sm text-gray-500">Loading mentions...</div>
                ) : mentions.length === 0 ? (
                  <div className="text-center py-4 text-sm text-gray-500">No mentions found</div>
                ) : (
                  mentions.map((mention) => (
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
                        <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Selected Mentions Display */}
          {selectedMentions.length > 0 && !showMentionsList && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-600 mb-2">
                Referenced Places ({selectedMentions.length})
              </div>
              {selectedMentions.map((mention) => (
                <div key={mention.id} className="relative">
                  <MentionCard mention={mention as any} />
                  <button
                    type="button"
                    onClick={() => handleMentionToggle(mention.id)}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                  >
                    <XMarkIcon className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Mentions Button */}
          <button
            type="button"
            onClick={() => setShowMentionsList(true)}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {selectedMentionIds.length > 0 ? 'Change Mentions' : 'Add Mentions'}
          </button>

          {/* Map Data Display */}
          {mapData && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-600 mb-2">Map Location</div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                {mapData.screenshot && (
                  <div className="mb-3 rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={mapData.screenshot}
                      alt="Map preview"
                      className="w-full h-auto"
                    />
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {mapData.place_name || mapData.address || 'Location'}
                    </div>
                    {mapData.address && mapData.place_name && (
                      <div className="text-xs text-gray-500 mb-1">{mapData.address}</div>
                    )}
                    {mapData.type && (
                      <div className="text-xs text-gray-500 mb-1">
                        {mapData.type === 'area' ? 'Area' : mapData.type === 'pin' ? 'Pin' : 'Area & Pin'}
                      </div>
                    )}
                    {mapData.center && (
                      <div className="text-xs text-gray-500">
                        {mapData.center.lat.toFixed(4)}, {mapData.center.lng.toFixed(4)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowMapView(true)}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapData(null)}
                      className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Add Map Button */}
          {!mapData && (
            <button
              type="button"
              onClick={() => setShowMapView(true)}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Add Map Location
            </button>
          )}

          {/* Privacy/Visibility */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Visibility</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPrivacyMenu(!showPrivacyMenu)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {visibility === 'public' ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Public
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    Draft
                  </>
                )}
              </button>
              {showPrivacyMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowPrivacyMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[160px]">
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
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3">
            <Link
              href={`/map/${mapIdOrSlug}/post/${postId}`}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </main>

      {/* Image Drawer - Full Screen Overlay */}
      {showImageView && (
        <div className="fixed inset-0 bg-white z-50">
          <PostImageDrawer
            onClose={() => setShowImageView(false)}
            onImagesSave={handleImagesSave}
            initialImages={images}
          />
        </div>
      )}

      {/* Map View - Full Screen Overlay */}
      {showMapView && (
        <div className="fixed inset-0 bg-white z-50">
          <PostMapDrawer
            onClose={() => setShowMapView(false)}
            onMapDataSave={(data) => {
              setMapData({
                ...data,
                address: mapData?.address,
                place_name: mapData?.place_name,
              });
              setShowMapView(false);
            }}
            initialMapData={mapData}
          />
        </div>
      )}
    </div>
  );
}
