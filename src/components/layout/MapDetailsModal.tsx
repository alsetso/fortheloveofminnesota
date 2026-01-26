'use client';

import { XMarkIcon, EyeIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { AccountService } from '@/features/auth';
import { useAuthStateSafe } from '@/features/auth';

interface MapDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapInfo: {
    id: string;
    name: string;
    emoji: string;
    description: string | null;
    account: {
      id: string;
      username: string | null;
      first_name: string | null;
      last_name: string | null;
      image_url: string | null;
    } | null;
    viewCount: number | null;
    visibility: 'public' | 'private' | 'shared';
    created_at: string;
    updated_at: string;
    hideCreator: boolean;
  } | null;
}

export default function MapDetailsModal({ isOpen, onClose, mapInfo }: MapDetailsModalProps) {
  const { account } = useAuthStateSafe();
  
  if (!isOpen || !mapInfo) return null;
  
  const displayName = mapInfo.account
    ? (mapInfo.account.first_name && mapInfo.account.last_name
        ? `${mapInfo.account.first_name} ${mapInfo.account.last_name}`
        : mapInfo.account.username
        ? `@${mapInfo.account.username}`
        : 'User')
    : null;
  
  const isOwner = account && mapInfo.account && account.id === mapInfo.account.id;
  
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-t-2xl lg:rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-lg">{mapInfo.emoji}</span>
            <h2 className="text-sm font-semibold text-gray-900">Map Details</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {/* Title */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-gray-500">Title</div>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
              <div className="text-xs text-gray-900">{mapInfo.name}</div>
            </div>
          </div>
          
          {/* Description */}
          {mapInfo.description && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium text-gray-500">Description</div>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
                <div className="text-xs text-gray-600">{mapInfo.description}</div>
              </div>
            </div>
          )}
          
          {/* Owner */}
          {mapInfo.account && !mapInfo.hideCreator && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium text-gray-500">Owner</div>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
                <div className="flex items-center gap-2">
                  {mapInfo.account.image_url ? (
                    <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
                      <Image
                        src={mapInfo.account.image_url}
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
                        {(mapInfo.account.first_name?.[0] || mapInfo.account.username?.[0] || 'U').toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-xs font-medium text-gray-900 truncate flex-1">
                    {displayName}
                  </span>
                  {isOwner && (
                    <span className="text-[10px] font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                      Owner
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Settings */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-gray-500">Settings</div>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Visibility</span>
                <span className="text-xs font-medium text-gray-900 capitalize">{mapInfo.visibility}</span>
              </div>
            </div>
          </div>
          
          {/* Statistics */}
          {mapInfo.viewCount !== null && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium text-gray-500">Statistics</div>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
                <div className="flex items-center gap-1.5">
                  <EyeIcon className="w-4 h-4 text-gray-500" />
                  <div className="text-xs font-medium text-gray-900">
                    {mapInfo.viewCount.toLocaleString()} {mapInfo.viewCount === 1 ? 'view' : 'views'}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Timestamps */}
          {(mapInfo.created_at || mapInfo.updated_at) && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium text-gray-500">Timestamps</div>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px] space-y-1">
                {mapInfo.created_at && (
                  <div>
                    <div className="text-[10px] text-gray-500">Created</div>
                    <div className="text-xs text-gray-600">
                      {new Date(mapInfo.created_at).toLocaleDateString()} {new Date(mapInfo.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                )}
                {mapInfo.updated_at && (
                  <div>
                    <div className="text-[10px] text-gray-500">Updated</div>
                    <div className="text-xs text-gray-600">
                      {new Date(mapInfo.updated_at).toLocaleDateString()} {new Date(mapInfo.updated_at).toLocaleTimeString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
