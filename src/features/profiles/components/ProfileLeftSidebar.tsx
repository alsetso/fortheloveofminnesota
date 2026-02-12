'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserIcon,
  MapIcon,
  FolderIcon,
  Cog6ToothIcon,
  PlusCircleIcon,
  GlobeAltIcon,
  LockClosedIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import ViewAsSelector from './ViewAsSelector';
import { useAuthStateSafe } from '@/features/auth';
import { socialGraphQueries } from '@/lib/data/queries/socialGraph';
import type { ProfileAccount } from '@/types/profile';
import type { ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';
import ProfileCardBlock from './ProfileCardBlock';

interface ProfileLeftSidebarProps {
  account: ProfileAccount;
  cityName?: string | null;
  collections: Collection[];
  pins: ProfilePin[];
  isOwnProfile: boolean;
  /** True when the viewer is the profile owner (show Owner/Public toggle even when viewing as public). */
  isProfileOwner?: boolean;
  selectedCollectionId: string | null;
  onCollectionSelect: (collectionId: string | null) => void;
  /** Optional follow button slot (e.g. from useProfileFollow) so state is shared with mobile sheet. */
  followSlot?: React.ReactNode;
  /** Called when a pin is clicked; parent can fly to pin and open popup. */
  onPinClick?: (pin: ProfilePin) => void;
}

function getCollectionPinCount(
  collectionId: string,
  pins: ProfilePin[],
  isOwnProfile: boolean
): number {
  const filtered = pins.filter((p) => p.collection_id === collectionId);
  if (isOwnProfile) return filtered.length;
  return filtered.filter((p) => p.visibility === 'public').length;
}

export default function ProfileLeftSidebar({
  account,
  cityName,
  collections,
  pins,
  isOwnProfile,
  isProfileOwner = isOwnProfile,
  selectedCollectionId,
  onCollectionSelect,
  followSlot: followSlotProp,
  onPinClick,
}: ProfileLeftSidebarProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { account: viewerAccount } = useAuthStateSafe();
  const [updatingPinId, setUpdatingPinId] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  const { data: edgesData } = useQuery(
    viewerAccount?.id && !isOwnProfile && followSlotProp == null
      ? socialGraphQueries.edges(viewerAccount.id)
      : { queryKey: ['skip'], queryFn: () => null, enabled: false }
  );
  const edges = edgesData?.edges ?? [];
  const followEdge = edges.find(
    (e) => e.to_account_id === account.id && e.relationship === 'follow' && e.status === 'accepted'
  );
  const isFollowing = !!followEdge;

  const handleFollow = async () => {
    if (!viewerAccount?.id || followLoading) return;
    setFollowLoading(true);
    try {
      const res = await fetch('/api/social/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_account_id: account.id, relationship: 'follow' }),
        credentials: 'include',
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['social-graph', 'edges', viewerAccount.id] });
        router.refresh();
      }
    } finally {
      setFollowLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!followEdge?.id || followLoading) return;
    setFollowLoading(true);
    try {
      const res = await fetch(`/api/social/edges?edge_id=${encodeURIComponent(followEdge.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['social-graph', 'edges', viewerAccount?.id] });
        router.refresh();
      }
    } finally {
      setFollowLoading(false);
    }
  };

  const followSlot =
    followSlotProp ??
    (!isOwnProfile && viewerAccount?.id ? (
      isFollowing ? (
        <button
          type="button"
          onClick={handleUnfollow}
          disabled={followLoading}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md border border-border-muted dark:border-white/10 bg-surface-accent dark:bg-white/10 text-foreground hover:bg-surface-accent/80 dark:hover:bg-white/20 transition-colors disabled:opacity-60"
        >
          <UserPlusIcon className="w-3.5 h-3.5" />
          Following
        </button>
      ) : (
        <button
          type="button"
          onClick={handleFollow}
          disabled={followLoading}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md bg-lake-blue text-white hover:bg-lake-blue/90 transition-colors disabled:opacity-60"
        >
          <UserPlusIcon className="w-3.5 h-3.5" />
          Follow
        </button>
      )
    ) : null);

  const updatePin = async (pinId: string, updates: { visibility?: 'public' | 'only_me'; collection_id?: string | null }) => {
    setUpdatingPinId(pinId);
    try {
      const res = await fetch(`/api/accounts/${account.id}/pins/${pinId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) router.refresh();
    } finally {
      setUpdatingPinId(null);
    }
  };

  const visibleCollections = isOwnProfile
    ? collections
    : collections.filter((c) => {
        const inCollection = pins.filter((p) => p.collection_id === c.id);
        return inCollection.length > 0 && inCollection.some((p) => p.visibility === 'public');
      });

  const allMentionsCount = isOwnProfile
    ? pins.length
    : pins.filter((p) => p.visibility === 'public').length;

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide p-3 space-y-3">
      {/* Owner: view as owner / public toggle (visible whenever viewer is the profile owner, including when viewing as public) */}
      {isProfileOwner && (
        <div className="flex-shrink-0 space-y-1">
          <p className="text-[10px] text-foreground-muted">Only you can see this</p>
          <ViewAsSelector visible darkText />
        </div>
      )}

      {/* Profile card */}
      <ProfileCardBlock
        account={account}
        cityName={cityName}
        isOwnProfile={isOwnProfile}
        isProfileOwner={isProfileOwner}
        followSlot={followSlot}
        showEditLink={isOwnProfile}
      />

      {/* Personal collections */}
      <div className="rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface p-2 flex-shrink-0">
        <div className="flex items-center justify-between gap-2 px-1 py-1 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <FolderIcon className="w-4 h-4 text-foreground-muted flex-shrink-0" />
            <h3 className="text-xs font-semibold text-foreground">Collections</h3>
          </div>
          {isOwnProfile && (
            <Link
              href="/settings/collections"
              className="flex items-center gap-1 text-[10px] font-medium text-lake-blue hover:text-lake-blue/80 transition-colors flex-shrink-0"
              title="Edit and manage collections"
            >
              <Cog6ToothIcon className="w-3 h-3" />
              Manage
            </Link>
          )}
        </div>
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => onCollectionSelect(null)}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-left text-xs transition-colors ${
              selectedCollectionId === null
                ? 'bg-surface-accent dark:bg-white/10 text-foreground font-medium'
                : 'hover:bg-surface-accent/50 dark:hover:bg-white/5 text-foreground-muted'
            }`}
          >
            <span>All mentions</span>
            <span className="text-[10px] tabular-nums">{allMentionsCount}</span>
          </button>
          {visibleCollections.map((c) => {
            const count = getCollectionPinCount(c.id, pins, isOwnProfile);
            if (count === 0 && !isOwnProfile) return null;
            const isSelected = selectedCollectionId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onCollectionSelect(c.id)}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${
                  isSelected
                    ? 'bg-surface-accent dark:bg-white/10 text-foreground font-medium'
                    : 'hover:bg-surface-accent/50 dark:hover:bg-white/5 text-foreground-muted'
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="flex-shrink-0">{c.emoji || '📍'}</span>
                  <span className="truncate">{c.title}</span>
                </span>
                <span className="text-[10px] tabular-nums flex-shrink-0">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pins: main content, not in a card; extends with sidebar scroll */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between gap-2 px-1 py-1 mb-1 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <PlusCircleIcon className="w-4 h-4 text-foreground-muted flex-shrink-0" />
            <h3 className="text-xs font-semibold text-foreground">Pins</h3>
          </div>
          {isOwnProfile && (
            <Link
              href="/settings/pins"
              className="flex items-center gap-1 text-[10px] font-medium text-lake-blue hover:text-lake-blue/80 transition-colors flex-shrink-0"
              title="Manage and delete pins"
            >
              <Cog6ToothIcon className="w-3 h-3" />
              Manage
            </Link>
          )}
        </div>
        {pins.length === 0 ? (
          <p className="text-[10px] text-foreground-muted px-1 mb-2">
            No pins yet. Add pins from the live map, then assign visibility and collection here.
          </p>
        ) : (
          <div className="space-y-1.5">
            {pins.map((pin) => {
              const isUpdating = updatingPinId === pin.id;
              const label = pin.description?.trim() ? pin.description.slice(0, 32) + (pin.description.length > 32 ? '…' : '') : 'Pin';
              const hasImage = pin.image_url && (pin.media_type === 'image' || !pin.media_type);
              const hasVideo = pin.video_url && pin.media_type === 'video';
              return (
                <div
                  key={pin.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onPinClick?.(pin)}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onPinClick) { e.preventDefault(); onPinClick(pin); } }}
                  className={`w-full text-left rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface p-2 space-y-1.5 hover:bg-gray-50 dark:hover:bg-surface-accent/50 transition-colors ${isUpdating ? 'opacity-60 pointer-events-none' : ''} ${onPinClick ? 'cursor-pointer' : ''}`}
                >
                  {(hasImage || hasVideo) && (
                    <div className="relative w-full aspect-video rounded overflow-hidden bg-surface-accent dark:bg-white/5 -mx-0.5 mt-0">
                      {hasImage && pin.image_url ? (
                        <Image
                          src={pin.image_url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="160px"
                          unoptimized={pin.image_url.includes('supabase.co')}
                        />
                      ) : hasVideo && pin.video_url ? (
                        <video
                          src={pin.video_url}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : null}
                    </div>
                  )}
                  <p className="text-[10px] text-foreground-muted truncate" title={pin.description ?? undefined}>
                    {label}
                  </p>
                  {isOwnProfile ? (
                    <>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <div className="flex rounded border border-border-muted dark:border-white/10 overflow-hidden">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); updatePin(pin.id, { visibility: 'public' }); }}
                            className={`p-1 transition-colors ${
                              pin.visibility === 'public'
                                ? 'bg-lake-blue text-white'
                                : 'bg-surface-accent dark:bg-white/5 text-foreground-muted hover:text-foreground'
                            }`}
                            title="Public"
                            aria-label="Public"
                          >
                            <GlobeAltIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); updatePin(pin.id, { visibility: 'only_me' }); }}
                            className={`p-1 transition-colors ${
                              pin.visibility === 'only_me'
                                ? 'bg-lake-blue text-white'
                                : 'bg-surface-accent dark:bg-white/5 text-foreground-muted hover:text-foreground'
                            }`}
                            title="Only me"
                            aria-label="Only me"
                          >
                            <LockClosedIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <select
                          id={`pin-${pin.id}-collection`}
                          aria-label="Collection"
                          value={pin.collection_id ?? ''}
                          onChange={(e) => { e.stopPropagation(); updatePin(pin.id, { collection_id: e.target.value || null }); }}
                          className="flex-1 min-w-0 text-[10px] rounded border border-border-muted dark:border-white/10 bg-surface dark:bg-white/5 text-foreground px-1.5 py-0.5"
                        >
                          <option value="">Select collection</option>
                          {collections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.emoji ?? '📍'} {c.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
