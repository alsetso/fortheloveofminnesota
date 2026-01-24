'use client';

import { useState } from 'react';
import { 
  ChevronUpIcon, 
  ChevronDownIcon, 
  InformationCircleIcon, 
  MapPinIcon, 
  PencilSquareIcon, 
  ArrowUpTrayIcon, 
  EyeIcon, 
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import Image from 'next/image';

interface MapInfoCardProps {
  title?: string;
  description?: string | null;
  account?: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  } | null;
  viewCount?: number | null;
  isOwner: boolean;
  hideCreator?: boolean;
  onInfoClick: () => void;
  onPinClick: () => void;
  onDrawClick: () => void;
  pinMode: boolean;
  showAreaDrawModal: boolean;
}

export default function MapInfoCard({
  title,
  description,
  account,
  viewCount,
  isOwner,
  hideCreator = false,
  onInfoClick,
  onPinClick,
  onDrawClick,
  pinMode,
  showAreaDrawModal,
}: MapInfoCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const displayName = account
    ? account.username ||
      (account.first_name && account.last_name
        ? `${account.first_name} ${account.last_name}`.trim()
        : account.first_name || 'User')
    : null;

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      await navigator.clipboard.writeText(url);
      // Could add toast notification here
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  return (
    <>
      {/* Floating Info Card - Bottom Center */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg border border-gray-200 shadow-lg overflow-hidden transition-all">
          {/* Collapsed State */}
          {!isExpanded && (
            <button
              onClick={() => setIsExpanded(true)}
              className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-gray-50 transition-colors"
            >
              {/* Owner Avatar */}
              {account && !hideCreator && (
                <div className="flex-shrink-0">
                  {account.image_url ? (
                    <Image
                      src={account.image_url}
                      alt={displayName || 'User'}
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full object-cover border border-gray-200"
                      unoptimized
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center border border-gray-200">
                      <span className="text-xs text-gray-500 font-medium">
                        {(account.first_name?.[0] || account.username?.[0] || 'U').toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Title & Owner */}
              <div className="flex-1 min-w-0 text-left">
                {title && (
                  <div className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                    {title}
                  </div>
                )}
                {account && !hideCreator && (
                  <div className="text-[10px] sm:text-xs text-gray-500 truncate">
                    {displayName}
                  </div>
                )}
              </div>

              {/* View Count */}
              {viewCount !== null && viewCount !== undefined && (
                <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-500 flex-shrink-0">
                  <EyeIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{viewCount.toLocaleString()}</span>
                </div>
              )}

              {/* Expand Arrow */}
              <ChevronUpIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
            </button>
          )}

          {/* Expanded State */}
          {isExpanded && (
            <div className="p-3 sm:p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {title && (
                    <h2 className="text-sm sm:text-base font-semibold text-gray-900 mb-1">
                      {title}
                    </h2>
                  )}
                  {account && !hideCreator && (
                    <Link
                      href={account.username ? `/profile/${account.username}` : '#'}
                      className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {account.image_url ? (
                        <Image
                          src={account.image_url}
                          alt={displayName || 'User'}
                          width={20}
                          height={20}
                          className="w-5 h-5 rounded-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-[9px] text-gray-500 font-medium">
                            {(account.first_name?.[0] || account.username?.[0] || 'U').toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="font-medium">{displayName}</span>
                    </Link>
                  )}
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Collapse"
                >
                  <ChevronDownIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Description */}
              {description && (
                <p className="text-xs sm:text-sm text-gray-600 line-clamp-3">
                  {description}
                </p>
              )}

              {/* Stats */}
              {viewCount !== null && viewCount !== undefined && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <EyeIcon className="w-4 h-4" />
                  <span>{viewCount.toLocaleString()} views</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                {/* Share Button */}
                <button
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  <ArrowUpTrayIcon className="w-4 h-4" />
                  <span>Share</span>
                </button>

                {/* Info Button */}
                <button
                  onClick={onInfoClick}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  <InformationCircleIcon className="w-4 h-4" />
                  <span>Info</span>
                </button>

                {/* Owner Actions */}
                {isOwner && (
                  <>
                    <button
                      onClick={onPinClick}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                        pinMode
                          ? 'bg-gray-900 text-white hover:bg-gray-800'
                          : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      <MapPinIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">Pin</span>
                    </button>
                    <button
                      onClick={onDrawClick}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                        showAreaDrawModal
                          ? 'bg-gray-900 text-white hover:bg-gray-800'
                          : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">Draw</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
