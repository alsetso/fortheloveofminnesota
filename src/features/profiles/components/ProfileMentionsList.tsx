'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatPinDate } from '@/types/profile';
import type { ProfilePin } from '@/types/profile';
import type { Collection, UpdateCollectionData } from '@/types/collection';
import { EyeIcon, HeartIcon, MapPinIcon, DocumentTextIcon, XMarkIcon, PencilIcon } from '@heroicons/react/24/outline';
import { getMapUrlWithPin } from '@/lib/maps/urls';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { MentionService } from '@/features/mentions/services/mentionService';
import { CollectionService } from '@/features/collections/services/collectionService';
import toast from 'react-hot-toast';

interface ProfileMentionsListProps {
  pins: ProfilePin[];
  collections?: Collection[];
  isOwnProfile?: boolean;
  onViewMap?: () => void;
  onCollectionsUpdate?: () => void;
}

function PinSkeleton({ onClick, isLast, hasImage }: { onClick?: () => void; isLast?: boolean; hasImage?: boolean }) {
  return (
    <div 
      className="bg-white border border-gray-200 rounded-md p-[10px] cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={onClick}
    >
      <div className="flex gap-1.5">
        {/* Content Skeleton */}
        <div className="min-w-0 flex-1 min-h-0 self-start">
          {/* Description skeleton */}
          <div className="space-y-1 mb-1">
            <div className="h-3 w-full max-w-md bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-3/4 max-w-sm bg-gray-200 rounded animate-pulse" />
          </div>

          {/* Metadata skeleton */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="h-2.5 w-16 bg-gray-200 rounded animate-pulse" />
            <div className="h-2.5 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-2.5 w-12 bg-gray-200 rounded animate-pulse" />
          </div>

          {/* Sign in prompt */}
          <div className="pt-1">
            <button className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline">
              Sign in to view details
            </button>
          </div>
        </div>
        
        {/* Image skeleton - only show if pin has an image */}
        {hasImage && (
          <div className="flex-shrink-0 w-12 h-12 bg-gray-200 rounded-md animate-pulse" />
        )}
      </div>
    </div>
  );
}

function getViewOnMapHref(pin: ProfilePin): string {
  const isLive = pin.map?.slug === 'live';
  if (isLive) return `/live?pin=${encodeURIComponent(pin.id)}`;
  if (pin.map && Number.isFinite(pin.lat) && Number.isFinite(pin.lng)) {
    return getMapUrlWithPin({ id: pin.map.id, slug: pin.map.slug ?? null }, pin.lat, pin.lng);
  }
  return `/live?pin=${encodeURIComponent(pin.id)}`;
}

export default function ProfileMentionsList({ pins: initialPins, collections = [], isOwnProfile = false, onViewMap, onCollectionsUpdate }: ProfileMentionsListProps) {
  const router = useRouter();
  const { account } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const isAuthenticated = Boolean(account);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [localPins, setLocalPins] = useState<ProfilePin[]>(initialPins);
  const [editingCollectionPinId, setEditingCollectionPinId] = useState<string | null>(null);
  const [updatingCollectionId, setUpdatingCollectionId] = useState<string | null>(null);
  const [editingCollections, setEditingCollections] = useState(false);
  const [editCollectionModalOpen, setEditCollectionModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [editEmoji, setEditEmoji] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingCollection, setSavingCollection] = useState(false);

  // Update local pins when initialPins changes
  useEffect(() => {
    setLocalPins(initialPins);
  }, [initialPins]);

  // Use localPins for filtering
  const pins = localPins;

  // Handle collection change
  const handleCollectionChange = async (pinId: string, collectionId: string | null) => {
    if (updatingCollectionId) return;
    setUpdatingCollectionId(pinId);

    try {
      await MentionService.updateMention(pinId, { collection_id: collectionId });
      setLocalPins(prevPins =>
        prevPins.map(pin =>
          pin.id === pinId 
            ? { 
                ...pin, 
                collection_id: collectionId,
                collection: collectionId 
                  ? collections.find(c => c.id === collectionId) 
                    ? { 
                        id: collections.find(c => c.id === collectionId)!.id,
                        emoji: collections.find(c => c.id === collectionId)!.emoji,
                        title: collections.find(c => c.id === collectionId)!.title
                      }
                    : null
                  : null,
                updated_at: new Date().toISOString() 
              } 
            : pin
        )
      );
      setEditingCollectionPinId(null);
      toast.success('Collection updated');
    } catch (err) {
      console.error('Error updating collection:', err);
      toast.error('Failed to update collection');
    } finally {
      setUpdatingCollectionId(null);
    }
  };
  
  // Filter collections - show public ones for visitors, all for owners
  const visibleCollections = useMemo(() => {
    if (isOwnProfile) return collections;
    return collections.filter(c => {
      const collectionPins = pins.filter(p => p.collection_id === c.id);
      return collectionPins.length > 0 && collectionPins.some(p => p.visibility === 'public');
    });
  }, [collections, pins, isOwnProfile]);

  // Get unassigned count (pins without a collection)
  const unassignedCount = useMemo(() => {
    return pins.filter(p => !p.collection_id && (isOwnProfile || p.visibility === 'public')).length;
  }, [pins, isOwnProfile]);

  // Filter pins based on visibility and selected collection
  const filteredPins = useMemo(() => {
    let filtered = pins.filter(pin => isOwnProfile || pin.visibility === 'public');
    
    // Apply collection filter
    if (selectedCollectionId === 'unassigned') {
      filtered = filtered.filter(pin => !pin.collection_id);
    } else if (selectedCollectionId) {
      filtered = filtered.filter(pin => pin.collection_id === selectedCollectionId);
    }
    // If selectedCollectionId is null, show all pins (no filter)
    
    return filtered;
  }, [pins, isOwnProfile, selectedCollectionId]);
  
  // For non-authenticated visitors, show skeletons that prompt signup
  if (!isAuthenticated && !isOwnProfile) {
    if (filteredPins.length === 0) {
      return (
        <div className="px-[10px] pb-[10px]">
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <p className="text-xs text-gray-500">No mentions found</p>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <div className="space-y-2 px-[10px] pb-[10px]">
          {filteredPins.map((pin) => (
            <PinSkeleton 
              key={pin.id} 
              onClick={openWelcome} 
              isLast={false}
              hasImage={Boolean(pin.image_url || pin.video_url)}
            />
          ))}
        </div>
      </div>
    );
  }

  if (filteredPins.length === 0) {
    return (
      <div className="px-[10px] pb-[10px]">
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <p className="text-xs text-gray-500">No mentions found</p>
        </div>
      </div>
    );
  }

  const getRelativeTime = (date: string): string => {
    const now = new Date();
    const then = new Date(date);
    const diffSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    if (diffSeconds < 60) return 'just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
    if (diffSeconds < 2592000) return `${Math.floor(diffSeconds / 604800)}w ago`;
    if (diffSeconds < 31536000) return `${Math.floor(diffSeconds / 2592000)}mo ago`;
    return `${Math.floor(diffSeconds / 31536000)}y ago`;
  };

  return (
    <div className="space-y-3">
      {/* Collection Filter */}
      {(visibleCollections.length > 0 || unassignedCount > 0) && (
        <div className="px-2 sm:px-[10px] pt-2 pb-2 border-b border-gray-200">
          <div className="flex items-start justify-between gap-2">
            {/* Collections - wraps on multiple lines */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap flex-1 min-w-0">
              {/* All button */}
              <button
                onClick={() => setSelectedCollectionId(null)}
                className={`inline-flex items-center justify-center gap-1 px-1.5 h-[25px] text-[10px] font-medium rounded-md transition-colors ${
                  selectedCollectionId === null
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                All
                {selectedCollectionId === null && (
                  <span className="text-[9px] opacity-75">
                    ({pins.filter(p => isOwnProfile || p.visibility === 'public').length})
                  </span>
                )}
              </button>

              {/* Collection buttons */}
              {visibleCollections.map((collection) => {
                const collectionPins = pins.filter(
                  p => p.collection_id === collection.id && (isOwnProfile || p.visibility === 'public')
                );
                if (collectionPins.length === 0) return null;
                
                const handleCollectionClick = () => {
                  if (editingCollections && isOwnProfile) {
                    // Open edit modal
                    setEditingCollection(collection);
                    setEditEmoji(collection.emoji);
                    setEditTitle(collection.title);
                    setEditDescription(collection.description ?? '');
                    setEditCollectionModalOpen(true);
                  } else {
                    // Select collection filter
                    setSelectedCollectionId(collection.id);
                  }
                };
                
                return (
                  <button
                    key={collection.id}
                    onClick={handleCollectionClick}
                    className={`inline-flex items-center justify-center gap-1 px-1.5 h-[25px] text-[10px] font-medium rounded-md transition-colors ${
                      selectedCollectionId === collection.id && !editingCollections
                        ? 'bg-gray-900 text-white'
                        : editingCollections && isOwnProfile
                          ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                          : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span>{collection.emoji}</span>
                    <span>{collection.title}</span>
                    {selectedCollectionId === collection.id && !editingCollections && (
                      <span className="text-[9px] opacity-75">({collectionPins.length})</span>
                    )}
                  </button>
                );
              })}

              {/* Unassigned button */}
              {unassignedCount > 0 && (
                <button
                  onClick={() => setSelectedCollectionId('unassigned')}
                  className={`inline-flex items-center justify-center gap-1 px-1.5 h-[25px] text-[10px] font-medium rounded-md transition-colors ${
                    selectedCollectionId === 'unassigned'
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Unassigned
                  {selectedCollectionId === 'unassigned' && (
                    <span className="text-[9px] opacity-75">({unassignedCount})</span>
                  )}
                </button>
              )}
            </div>

            {/* Edit button - only for owners */}
            {isOwnProfile && (
              <button
                onClick={() => setEditingCollections(!editingCollections)}
                className="inline-flex items-center justify-center gap-1 px-2 h-[25px] text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors shrink-0"
              >
                <PencilIcon className="w-3 h-3" />
                <span>Edit</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* List Content - Card-based like PinActivityFeed */}
      <div className="space-y-2 px-2 sm:px-[10px] pb-2 sm:pb-[10px]">
        {filteredPins.map((pin) => {
          const hasImage = !!(pin.image_url && pin.media_type !== 'video');
          const hasVideo = !!(pin.video_url || pin.media_type === 'video');
          const hasMedia = hasImage || hasVideo;
          
          const handleCardClick = (e: React.MouseEvent) => {
            if ((e.target as HTMLElement).closest('a') || (e.target as HTMLElement).closest('button')) return;
            router.push(`/mention/${pin.id}`);
          };

          return (
            <div
              key={pin.id}
              role="button"
              tabIndex={0}
              onClick={handleCardClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (!(e.target as HTMLElement).closest('a') && !(e.target as HTMLElement).closest('button')) {
                    router.push(`/mention/${pin.id}`);
                  }
                }
              }}
              className="bg-white p-2 sm:p-[10px] hover:bg-gray-50 transition-colors cursor-pointer rounded-md border border-transparent hover:border-gray-200"
            >
              <div className="flex gap-2 sm:gap-1.5">
                {/* Compact media thumbnail or placeholder */}
                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden border border-gray-200 bg-gray-100 relative">
                  {hasMedia && pin.image_url ? (
                    <Image
                      src={pin.image_url}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized={pin.image_url.includes('supabase.co') || pin.image_url.startsWith('data:')}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-gray-200" />
                    </div>
                  )}
                </div>
                
                {/* Content */}
                <div className="min-w-0 flex-1 min-h-0 self-start text-left">
                  {/* Mention Type */}
                  {pin.mention_type && (
                    <div className="mb-1">
                      <span className="text-[10px] text-gray-600 shrink-0">
                        <span>{pin.mention_type.emoji}</span>
                        <span className="ml-0.5">{pin.mention_type.name}</span>
                      </span>
                    </div>
                  )}
                  
                  {/* Description */}
                  {pin.description && (
                    <p className="text-xs font-medium text-gray-900 leading-relaxed mb-1.5 line-clamp-2 sm:line-clamp-3">
                      {pin.description}
                    </p>
                  )}

                  {/* Metadata Row - Collection, Views, Likes, Time */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-1.5 gap-y-1 leading-none text-[10px] min-w-0 overflow-x-auto scrollbar-hide">
                    
                    {/* Collection Badge - Editable for owners */}
                    {isOwnProfile && editingCollectionPinId === pin.id ? (
                      <div className="flex flex-wrap gap-1 items-center shrink-0">
                        {/* Unassigned option */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCollectionChange(pin.id, null);
                          }}
                          disabled={updatingCollectionId === pin.id}
                          className={`inline-flex items-center px-1 py-0.5 text-[10px] rounded transition-colors ${
                            !pin.collection_id
                              ? 'bg-gray-200 text-gray-900 border border-gray-300 font-medium'
                              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                          } disabled:opacity-50`}
                        >
                          Unassigned
                        </button>
                        {collections.length > 0 ? (
                          collections.map((collection) => {
                            const isSelected = pin.collection_id === collection.id;
                            return (
                              <button
                                key={collection.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCollectionChange(pin.id, isSelected ? null : collection.id);
                                }}
                                disabled={updatingCollectionId === pin.id}
                                className={`inline-flex items-center gap-0.5 px-1 py-0.5 text-[10px] rounded transition-colors ${
                                  isSelected
                                    ? 'bg-gray-200 text-gray-900 border border-gray-300 font-medium'
                                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                                } disabled:opacity-50`}
                              >
                                <span>{collection.emoji}</span>
                                <span>{collection.title}</span>
                              </button>
                            );
                          })
                        ) : (
                          <span className="text-[10px] text-gray-500">No collections</span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCollectionPinId(null);
                          }}
                          className="text-[10px] text-gray-500 hover:text-gray-700 px-1 ml-0.5"
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <>
                        {pin.collection && (
                          <span className="inline-flex items-center gap-0.5 text-gray-600 shrink-0">
                            <span>{pin.collection.emoji}</span>
                            <span>{pin.collection.title}</span>
                          </span>
                        )}
                        {isOwnProfile && !pin.collection && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCollectionPinId(pin.id);
                            }}
                            className="text-gray-500 hover:text-gray-700 shrink-0 text-[10px]"
                          >
                            Add to collection
                          </button>
                        )}
                        {isOwnProfile && pin.collection && (
                          <>
                            <span className="text-gray-300 shrink-0">·</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCollectionPinId(pin.id);
                              }}
                              className="text-gray-500 hover:text-gray-700 shrink-0 text-[10px]"
                              title="Edit collection"
                            >
                              Edit
                            </button>
                          </>
                        )}
                      </>
                    )}
                    
                    {/* Map name */}
                    {pin.map?.name && (
                      <>
                        {pin.collection && <span className="text-gray-300 shrink-0">·</span>}
                        <span className="text-gray-600 shrink-0 whitespace-nowrap">{pin.map.name}</span>
                      </>
                    )}
                    
                    {/* Video indicator */}
                    {hasVideo && (
                      <>
                        {(pin.collection || pin.map?.name) && <span className="text-gray-300 shrink-0">·</span>}
                        <span className="text-gray-600 shrink-0 whitespace-nowrap">+ video</span>
                      </>
                    )}
                    
                    {/* View Count */}
                    {(pin.view_count !== undefined && pin.view_count > 0) && (
                      <>
                        {(pin.collection || pin.map?.name || hasVideo) && <span className="text-gray-300 shrink-0">·</span>}
                        <div className="flex items-center gap-0.5 text-gray-600 shrink-0">
                          <EyeIcon className="w-2.5 h-2.5" />
                          <span>{pin.view_count}</span>
                        </div>
                      </>
                    )}
                    
                    {/* Like Count */}
                    {(pin.likes_count !== undefined && pin.likes_count > 0) && (
                      <>
                        {(pin.collection || pin.map?.name || hasVideo || pin.view_count) && <span className="text-gray-300 shrink-0">·</span>}
                        <div className="flex items-center gap-0.5 text-gray-600 shrink-0">
                          <HeartIcon className="w-2.5 h-2.5" />
                          <span>{pin.likes_count}</span>
                        </div>
                      </>
                    )}
                    
                    {/* Timestamp */}
                    {(pin.collection || pin.map?.name || hasVideo || pin.view_count || pin.likes_count) && (
                      <>
                        <span className="text-gray-300 shrink-0">·</span>
                        <span className="text-gray-500 shrink-0 whitespace-nowrap">{getRelativeTime(pin.created_at)}</span>
                      </>
                    )}
                    
                    {/* View on Map link - public profile only */}
                    {!isOwnProfile && (
                      <>
                        {(pin.collection || pin.map?.name || hasVideo || pin.view_count || pin.likes_count) && <span className="text-gray-300 shrink-0">·</span>}
                        <Link
                          href={getViewOnMapHref(pin)}
                          className="shrink-0 font-medium inline-flex items-center gap-0.5 whitespace-nowrap text-gray-600 hover:text-gray-900 transition-colors leading-none py-0"
                        >
                          <EyeIcon className="w-2.5 h-2.5" />
                          View on Map
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Collection Modal */}
      {editCollectionModalOpen && editingCollection && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50"
            onClick={() => {
              if (!savingCollection) {
                setEditCollectionModalOpen(false);
                setEditingCollection(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !savingCollection) {
                setEditCollectionModalOpen(false);
                setEditingCollection(null);
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-collection-title"
          >
            <div
              className="bg-white border border-gray-200 rounded-md w-full max-w-sm shadow-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && !savingCollection) {
                  setEditCollectionModalOpen(false);
                  setEditingCollection(null);
                }
              }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h2 id="edit-collection-title" className="text-sm font-semibold text-gray-900">
                  Edit collection
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    if (!savingCollection) {
                      setEditCollectionModalOpen(false);
                      setEditingCollection(null);
                    }
                  }}
                  disabled={savingCollection}
                  className="p-1 -m-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 rounded transition-colors"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 py-3 space-y-3">
                <div className="flex gap-2 items-end">
                  <div className="w-14 flex-shrink-0">
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Emoji</label>
                    <input
                      type="text"
                      value={editEmoji}
                      onChange={(e) => setEditEmoji(e.target.value.slice(0, 2))}
                      className="w-full h-9 px-2 text-center text-base border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                      maxLength={2}
                      placeholder="📍"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full h-9 px-2.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 placeholder:text-gray-400"
                      placeholder="Collection name"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 placeholder:text-gray-400"
                    placeholder="Short description"
                  />
                </div>
              </div>
              <div className="flex gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={() => {
                    if (!savingCollection) {
                      setEditCollectionModalOpen(false);
                      setEditingCollection(null);
                    }
                  }}
                  disabled={savingCollection}
                  className="flex-1 h-9 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!editTitle.trim() || savingCollection || !editingCollection) return;
                    setSavingCollection(true);
                    try {
                      const data: UpdateCollectionData = {
                        emoji: editEmoji || '📍',
                        title: editTitle.trim(),
                        description: editDescription.trim() || null,
                      };
                      await CollectionService.updateCollection(editingCollection.id, data);
                      setEditCollectionModalOpen(false);
                      setEditingCollection(null);
                      toast.success('Collection updated');
                      if (onCollectionsUpdate) {
                        onCollectionsUpdate();
                      }
                    } catch (err) {
                      console.error('Error updating collection:', err);
                      toast.error(err instanceof Error ? err.message : 'Failed to update collection');
                    } finally {
                      setSavingCollection(false);
                    }
                  }}
                  disabled={savingCollection || !editTitle.trim()}
                  className="flex-1 h-9 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {savingCollection ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
