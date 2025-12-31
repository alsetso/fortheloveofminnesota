'use client';

import Image from 'next/image';
import { EyeIcon } from '@heroicons/react/24/outline';
import { AccountService } from '@/features/auth';

interface MapIDDetailsProps {
  title: string;
  description: string | null;
  map_style: 'street' | 'satellite';
  visibility: 'public' | 'private' | 'shared';
  viewCount: number | null;
  account: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  } | null;
  map_account_id: string; // The account_id of the map owner
  current_account_id?: string | null; // The current user's account ID
  created_at?: string;
  updated_at?: string;
}

export default function MapIDDetails({
  title,
  description,
  map_style,
  visibility,
  viewCount,
  account,
  map_account_id,
  current_account_id,
  created_at,
  updated_at,
}: MapIDDetailsProps) {
  const displayName = account
    ? account.username ||
      (account.first_name && account.last_name
        ? `${account.first_name} ${account.last_name}`.trim()
        : account.first_name || 'User')
    : null;

  const isOwner = current_account_id && map_account_id === current_account_id;

  return (
    <div className="space-y-3">
      {/* Title */}
      <div className="space-y-1.5">
        <h2 className="text-sm font-semibold text-gray-900">Map Details</h2>
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-1.5">
          <div>
            <div className="text-[10px] font-medium text-gray-500 mb-0.5">Title</div>
            <div className="text-xs text-gray-900">{title}</div>
          </div>
          {description && (
            <div>
              <div className="text-[10px] font-medium text-gray-500 mb-0.5">Description</div>
              <div className="text-xs text-gray-600">{description}</div>
            </div>
          )}
        </div>
      </div>

      {/* Owner */}
      {account && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium text-gray-500">Owner</div>
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <div className="flex items-center gap-1.5">
              {account.image_url ? (
                <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
                  <Image
                    src={account.image_url}
                    alt={displayName || 'User'}
                    width={24}
                    height={24}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] text-gray-500">
                    {(account.first_name?.[0] || account.username?.[0] || 'U').toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-xs font-medium text-gray-900 truncate">
                {displayName}
              </span>
              {isOwner && (
                <span className="ml-auto text-[10px] font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                  Owner
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Map Settings */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-medium text-gray-500">Settings</div>
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Style</span>
            <span className="text-xs font-medium text-gray-900 capitalize">{map_style}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Visibility</span>
            <span className="text-xs font-medium text-gray-900 capitalize">{visibility}</span>
          </div>
        </div>
      </div>

      {/* Statistics */}
      {viewCount !== null && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium text-gray-500">Statistics</div>
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <div className="flex items-center gap-1.5">
              <EyeIcon className="w-4 h-4 text-gray-500" />
              <div className="flex-1">
                <div className="text-xs font-medium text-gray-900">
                  {viewCount.toLocaleString()} {viewCount === 1 ? 'view' : 'views'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timestamps */}
      {(created_at || updated_at) && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium text-gray-500">Timestamps</div>
          <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-1">
            {created_at && (
              <div>
                <div className="text-[10px] text-gray-500">Created</div>
                <div className="text-xs text-gray-600">
                  {new Date(created_at).toLocaleDateString()} {new Date(created_at).toLocaleTimeString()}
                </div>
              </div>
            )}
            {updated_at && (
              <div>
                <div className="text-[10px] text-gray-500">Updated</div>
                <div className="text-xs text-gray-600">
                  {new Date(updated_at).toLocaleDateString()} {new Date(updated_at).toLocaleTimeString()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

