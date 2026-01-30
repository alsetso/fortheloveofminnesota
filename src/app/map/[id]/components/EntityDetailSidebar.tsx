'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { XMarkIcon, PencilIcon, TrashIcon, MapPinIcon, EyeIcon } from '@heroicons/react/24/outline';
import { useToastContext } from '@/features/ui/contexts/ToastContext';
import { createToast } from '@/features/ui/services/toast';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { useAuthStateSafe } from '@/features/auth';
import type { Account } from '@/features/auth';

interface MapPin {
  id: string;
  map_id: string;
  emoji: string | null;
  caption: string | null;
  description: string | null;
  image_url: string | null;
  video_url: string | null;
  media_type?: 'image' | 'video' | 'none' | null;
  lat: number;
  lng: number;
  full_address?: string | null;
  account_id: string | null;
  created_at: string;
  updated_at: string;
  view_count?: number | null;
  account?: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name?: string | null;
    image_url: string | null;
    plan: string | null;
  } | null;
  collection?: {
    id: string;
    emoji: string;
    title: string;
  } | null;
  mention_type?: {
    id: string;
    emoji: string;
    name: string;
  } | null;
}

interface MapArea {
  id: string;
  map_id: string;
  name: string;
  description: string | null;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  created_at: string;
  updated_at: string;
}

interface EntityDetailSidebarProps {
  entity: MapPin | MapArea;
  entityType: 'pin' | 'area';
  isOwner: boolean;
  permissionsLoading?: boolean;
  mapId: string;
  onClose: () => void;
  onDeleted?: () => void;
  onUpdated?: (updated: MapPin | MapArea) => void;
}

export default function EntityDetailSidebar({
  entity,
  entityType,
  isOwner,
  permissionsLoading = false,
  mapId,
  onClose,
  onDeleted,
  onUpdated,
}: EntityDetailSidebarProps) {
  const { addToast } = useToastContext();
  const { account, activeAccountId } = useAuthStateSafe();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const isPin = entityType === 'pin';
  const pin = isPin ? (entity as MapPin) : null;
  const area = !isPin ? (entity as MapArea) : null;
  
  // Check if current user is the pin creator
  const currentAccountId = activeAccountId || account?.id || null;
  const isPinCreator = pin && currentAccountId && pin.account_id === currentAccountId;
  
  const createdDate = pin?.created_at 
    ? new Date(pin.created_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setIsDeleting(true);
    try {
      const endpoint = entityType === 'pin' 
        ? `/api/maps/${mapId}/pins/${entity.id}`
        : `/api/maps/${mapId}/areas/${entity.id}`;

      const response = await fetch(endpoint, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete');
      }

      onDeleted?.();
      onClose();
      addToast(createToast('success', 'Entity deleted successfully', {
        duration: 3000,
      }));
    } catch (err) {
      addToast(createToast('error', 'Failed to delete. Please try again.', {
        duration: 4000,
      }));
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-[10px] border-b border-gray-200 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-900">
          {isPin ? 'Pin Details' : 'Area Details'}
        </h2>
        <div className="flex items-center gap-2">
          {!permissionsLoading && (
            <>
              {/* Show Edit icon if user is pin creator */}
              {isPin && isPinCreator && (
                <button
                  onClick={() => {
                    window.location.href = `/map/${mapId}/pin/${pin?.id}/edit`;
                  }}
                  className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
                  aria-label="Edit"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
              )}
              {/* Show Delete button if map owner */}
              {isOwner && isPin && (
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                  aria-label="Delete"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
              {isOwner && !isPin && (
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                  aria-label="Delete"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </>
          )}
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-[10px] py-3 space-y-3">
        {/* Pin Content */}
        {isPin && pin && (
          <>
            {/* Account Info - At Top */}
            {pin.account && (
              <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
                <ProfilePhoto
                  account={{
                    id: pin.account.id,
                    user_id: null,
                    username: pin.account.username,
                    first_name: pin.account.first_name || null,
                    last_name: pin.account.last_name || null,
                    email: null,
                    phone: null,
                    image_url: pin.account.image_url,
                    cover_image_url: null,
                    bio: null,
                    city_id: null,
                    view_count: 0,
                    role: 'general',
                    traits: null,
                    stripe_customer_id: null,
                    plan: (pin.account.plan || 'hobby') as Account['plan'],
                    billing_mode: 'standard',
                    subscription_status: null,
                    stripe_subscription_id: null,
                    onboarded: false,
                    search_visibility: false,
                    created_at: '',
                    updated_at: '',
                    last_visit: null,
                  } as Account}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="text-xs font-medium text-gray-900 truncate">
                      {pin.account.first_name || pin.account.username || 'User'}
                    </div>
                    {pin.account.plan && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                        {pin.account.plan}
                      </span>
                    )}
                  </div>
                  {pin.account.username && (
                    <Link
                      href={`/${pin.account.username}`}
                      className="text-[10px] text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      @{pin.account.username}
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Caption */}
            {pin.caption && (
              <div>
                <div className="text-xs font-semibold text-gray-900">{pin.caption}</div>
              </div>
            )}

            {/* Description */}
            <div>
              <p className="text-xs text-gray-900 leading-relaxed">
                {pin.description || <span className="text-gray-400">No description</span>}
              </p>
            </div>

            {/* Media */}
            {pin.media_type === 'video' && pin.video_url && (
              <div className="rounded-md overflow-hidden border border-gray-200 bg-black">
                <video
                  src={pin.video_url}
                  controls
                  playsInline
                  muted
                  preload="metadata"
                  className="w-full h-auto max-h-[300px] object-contain"
                />
              </div>
            )}
            {pin.media_type === 'image' && pin.image_url && (
              <div className="rounded-md overflow-hidden border border-gray-200">
                <Image
                  src={pin.image_url}
                  alt={pin.caption || 'Pin image'}
                  width={400}
                  height={300}
                  className="w-full h-auto"
                  unoptimized={pin.image_url.includes('supabase.co')}
                />
              </div>
            )}

            {/* Location */}
            <div>
              {pin.full_address ? (
                <div className="flex items-start gap-2 text-[10px] text-gray-600">
                  <MapPinIcon className="w-3 h-3 text-gray-400 flex-shrink-0 mt-0.5" />
                  <span>{pin.full_address}</span>
                </div>
              ) : (
                <div>
                  <div className="text-[10px] font-medium text-gray-500 mb-0.5">Location</div>
                  <div className="text-xs text-gray-900">
                    {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
                  </div>
                </div>
              )}
            </div>

            {/* Collection & Mention Type */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {pin.collection && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200">
                  <span className="text-xs">{pin.collection.emoji}</span>
                  <span className="text-[10px] font-medium text-blue-700">{pin.collection.title}</span>
                </div>
              )}
              {pin.mention_type && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-50 border border-gray-200">
                  <span className="text-xs">{pin.mention_type.emoji}</span>
                  <span className="text-[10px] font-medium text-gray-700">{pin.mention_type.name}</span>
                </div>
              )}
            </div>

            {/* Created Date */}
            <div className="text-[10px] text-gray-500">
              Created {new Date(pin.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>

            {/* View Count */}
            {pin.view_count !== undefined && (
              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                <EyeIcon className="w-3 h-3" />
                <span>{pin.view_count} views</span>
              </div>
            )}
          </>
        )}

        {/* Area Content */}
        {!isPin && area && (
          <>
            <div>
              <div className="text-[10px] font-medium text-gray-500 mb-0.5">Name</div>
              <div className="text-xs font-semibold text-gray-900">{area.name}</div>
            </div>
            {area.description && (
              <div>
                <div className="text-[10px] font-medium text-gray-500 mb-0.5">Description</div>
                <div className="text-xs text-gray-900">{area.description}</div>
              </div>
            )}
          </>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-xs text-red-900 mb-2">Are you sure you want to delete this {entityType}?</p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
