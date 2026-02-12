'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { UserIcon, MapPinIcon, EyeIcon, FolderIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getMapUrl, getMapUrlWithPin } from '@/lib/maps/urls';
import type { FeedMap, FeedPinActivity } from '@/app/api/feed/pin-activity/route';
import { useAuthStateSafe } from '@/features/auth';
import { CollectionService } from '@/features/collections/services/collectionService';
import { collectionTitleToSlug } from '@/features/collections/collectionSlug';
import type { Collection, CreateCollectionData } from '@/types/collection';
import { useToast } from '@/features/ui/hooks/useToast';
import MentionTypeCards from './MentionTypeCards';

const SECTION_TITLE_CLASS = 'text-xs font-medium text-gray-500 uppercase tracking-wide leading-none';
const ADD_LINK_CLASS =
  'text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline focus:outline-none focus:underline inline-flex items-center leading-none shrink-0';

function SectionHeaderWithAdd({
  title,
  addHref,
  onAddClick,
}: {
  title: string;
  addHref?: string;
  onAddClick?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 min-h-[1.5rem]">
      <p className={SECTION_TITLE_CLASS}>{title}</p>
      {addHref ? (
        <Link href={addHref} className={ADD_LINK_CLASS}>
          +Add
        </Link>
      ) : onAddClick ? (
        <button type="button" onClick={onAddClick} className={ADD_LINK_CLASS}>
          +Add
        </button>
      ) : null}
    </div>
  );
}

function getRelativeTime(date: string): string {
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
}

interface PinActivityFeedProps {
  maps: FeedMap[];
  activity: FeedPinActivity[];
  loading?: boolean;
  /** When false, hide "What you can post" section (e.g. on /username dashboard). Default true. */
  showWhatYouCanPost?: boolean;
  /** When false, hide "Personal Collections" section (e.g. on homepage). Default true. */
  showPersonalCollections?: boolean;
  /** When false, hide "Map Pins" section. Default true. */
  showMapPins?: boolean;
}

export default function PinActivityFeed({ maps, activity, loading, showWhatYouCanPost = true, showPersonalCollections = true, showMapPins = true }: PinActivityFeedProps) {
  const { account } = useAuthStateSafe();
  const isAdmin = account?.role === 'admin';
  const { success, error: showError } = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createEmoji, setCreateEmoji] = useState('📍');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createSaving, setCreateSaving] = useState(false);

  useEffect(() => {
    if (!account?.id) {
      setCollections([]);
      return;
    }
    setCollectionsLoading(true);
    CollectionService.getCollections(account.id)
      .then(setCollections)
      .catch(() => setCollections([]))
      .finally(() => setCollectionsLoading(false));
  }, [account?.id]);

  const openCreateModal = () => {
    setCreateEmoji('📍');
    setCreateTitle('');
    setCreateDescription('');
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (!createSaving) setCreateModalOpen(false);
  };

  const handleCreateCollection = async () => {
    if (!createTitle.trim()) {
      showError('Error', 'Title is required');
      return;
    }
    setCreateSaving(true);
    try {
      const data: CreateCollectionData = {
        emoji: createEmoji || '📍',
        title: createTitle.trim(),
        description: createDescription.trim() || null,
      };
      const created = await CollectionService.createCollection(data);
      setCollections((prev) => [created, ...prev]);
      setCreateModalOpen(false);
      setCreateTitle('');
      setCreateDescription('');
      setCreateEmoji('📍');
      success('Created', 'Collection created');
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'Failed to create collection');
    } finally {
      setCreateSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 bg-gray-100 rounded-md animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-md p-[10px] h-20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Feed from: maps as list cards - shown on mobile only (desktop shows in sidebar) */}
      <div className="lg:hidden space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Feed from</p>
        {maps.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <p className="text-xs text-gray-500">No maps yet. Join or create a map to see pin activity.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {maps.map((map) => (
              <Link
                key={map.id}
                href={getMapUrl({ id: map.id, slug: map.slug ?? undefined })}
                className="block bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-xs font-medium text-gray-900">{map.name}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* What you can post - shown on mobile only (desktop shows in sidebar) */}
      {showWhatYouCanPost && (
        <div className="lg:hidden">
          <MentionTypeCards isAdmin={isAdmin} />
        </div>
      )}

      {/* Personal Collections */}
      {showPersonalCollections && (
      <div className="space-y-2">
        <SectionHeaderWithAdd title="Personal Collections" onAddClick={openCreateModal} />
        {collectionsLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-md p-[10px] h-10 animate-pulse" />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <p className="text-xs text-gray-500">No collections yet.</p>
            {account?.username && (
              <Link
                href={`/${encodeURIComponent(account.username)}`}
                className="text-xs font-medium text-gray-600 hover:text-gray-900 mt-0.5 inline-block"
              >
                Create on your profile →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {collections.map((collection) => (
              <Link
                key={collection.id}
                href={
                  account?.username
                    ? `/${encodeURIComponent(account.username)}/${encodeURIComponent(collectionTitleToSlug(collection.title))}`
                    : '#'
                }
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm flex-shrink-0">{collection.emoji}</span>
                <span className="text-xs font-medium text-gray-900 truncate flex-1">{collection.title}</span>
                <FolderIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Create collection modal — portaled to body, above page wrapper and mobile nav */}
      {createModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50"
            onClick={closeCreateModal}
            onKeyDown={(e) => e.key === 'Escape' && closeCreateModal()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-collection-title"
          >
            <div
              className="bg-white border border-gray-200 rounded-md w-full max-w-sm shadow-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.key === 'Escape' && closeCreateModal()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h2 id="create-collection-title" className="text-sm font-semibold text-gray-900">
                  Create collection
                </h2>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={createSaving}
                  className="p-1 -m-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 rounded transition-colors"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              {/* Form */}
              <div className="px-4 py-3 space-y-3">
                <div className="flex gap-2 items-end">
                  <div className="w-14 flex-shrink-0">
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Emoji</label>
                    <input
                      type="text"
                      value={createEmoji}
                      onChange={(e) => setCreateEmoji(e.target.value.slice(0, 2))}
                      className="w-full h-9 px-2 text-center text-base border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                      maxLength={2}
                      placeholder="📍"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Title</label>
                    <input
                      type="text"
                      value={createTitle}
                      onChange={(e) => setCreateTitle(e.target.value)}
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
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 placeholder:text-gray-400"
                    placeholder="Short description"
                  />
                </div>
              </div>
              {/* Actions */}
              <div className="flex gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={createSaving}
                  className="flex-1 h-9 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCollection}
                  disabled={createSaving || !createTitle.trim()}
                  className="flex-1 h-9 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {createSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Map pins list */}
      {showMapPins && (
        <div className="space-y-2">
          <SectionHeaderWithAdd title="Map Pins" addHref="/maps" />
          {activity.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-md p-[10px]">
              <p className="text-xs text-gray-500">No pin activity yet on your maps.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activity.map((item) => (
                <PinActivityItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const isLiveMap = (map: FeedPinActivity['map']) =>
  map?.slug === 'live';

function PinActivityItem({ item }: { item: FeedPinActivity }) {
  const router = useRouter();
  const mapHref = item.map
    ? isLiveMap(item.map)
      ? '/maps'
      : getMapUrl({ id: item.map.id, slug: item.map.slug ?? undefined })
    : '#';
  const hasLatLng =
    item.lat != null &&
    item.lng != null &&
    Number.isFinite(item.lat) &&
    Number.isFinite(item.lng);
  const cardHref =
    item.map && (hasLatLng || item.id)
      ? isLiveMap(item.map)
        ? `/maps?pin=${encodeURIComponent(item.id)}`
        : hasLatLng
          ? getMapUrlWithPin(
              { id: item.map.id, slug: item.map.slug ?? undefined },
              item.lat!,
              item.lng!
            )
          : mapHref
      : mapHref;
  const displayName = item.account?.username ?? 'Someone';
  const relativeTime = getRelativeTime(item.created_at);
  const snippet = item.description ?? item.caption ?? item.emoji ?? null;
  const hasImage = !!(item.image_url && item.media_type !== 'video');
  const hasVideo = !!(item.video_url || item.media_type === 'video');
  const hasMedia = hasImage || hasVideo;

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a') || (e.target as HTMLElement).closest('button')) return;
    router.push(`/mention/${item.id}`);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!(e.target as HTMLElement).closest('a') && !(e.target as HTMLElement).closest('button')) {
            router.push(`/mention/${item.id}`);
          }
        }
      }}
      className="block bg-white border border-gray-200 rounded-md p-3 hover:bg-gray-50 transition-colors cursor-pointer"
    >
      <div className="flex gap-1.5">
        <div className="flex-shrink-0">
          {item.account?.image_url ? (
            <img
              src={item.account.image_url}
              alt=""
              className="w-7 h-7 rounded-full object-cover"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
              <UserIcon className="w-3 h-3 text-gray-500" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 min-h-0 self-start">
          <p className="text-xs text-gray-900 leading-tight">
            {item.account?.username ? (
              <Link
                href={`/${encodeURIComponent(item.account.username)}`}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                {displayName}
              </Link>
            ) : (
              <span className="font-medium">{displayName}</span>
            )}
            {' added a pin to '}
            {item.map ? (
              <Link
                href={mapHref}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                {item.map.name}
              </Link>
            ) : (
              'a map'
            )}
            {' · '}
            <span className="text-gray-500">{relativeTime}</span>
          </p>
          {snippet && (
            <p className="text-xs text-gray-600 truncate mt-0.5 leading-tight">{snippet}</p>
          )}
          {/* Row: mention type · video · View (no wrap) - below description */}
          <div className="flex flex-nowrap items-baseline gap-x-1.5 mt-0.5 leading-none text-[10px] min-w-0">
            {item.mention_type && (
              <span className="text-gray-600 shrink-0">
                <span>{item.mention_type.emoji}</span>
                <span className="ml-0.5">{item.mention_type.name}</span>
              </span>
            )}
            {item.mention_type && hasVideo && (
              <span className="text-gray-300 shrink-0">·</span>
            )}
            {hasVideo && (
              <span className="text-gray-600 shrink-0 whitespace-nowrap">+ video</span>
            )}
            {(item.mention_type || hasVideo) && (
              <span className="text-gray-300 shrink-0">·</span>
            )}
            <Link
              href={item.map && isLiveMap(item.map) ? `/maps?pin=${encodeURIComponent(item.id)}` : cardHref}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 font-medium inline-flex items-center gap-0.5 whitespace-nowrap text-gray-600 hover:text-gray-900 transition-colors leading-none py-0"
            >
              <EyeIcon className="w-2.5 h-2.5" />
              View on Map
            </Link>
          </div>
        </div>
        {/* Compact media thumbnail */}
        {hasMedia && item.image_url && (
          <div className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border border-gray-200 bg-gray-100 relative">
            <Image
              src={item.image_url}
              alt=""
              fill
              className="object-cover"
              unoptimized={item.image_url.includes('supabase.co')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
