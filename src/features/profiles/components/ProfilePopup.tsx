'use client';

import { useState } from 'react';
import Image from 'next/image';
import { UserIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import ProfileCard from './ProfileCard';
import SimpleProfileCardWithCollections from './SimpleProfileCardWithCollections';
import type { ProfileAccount, ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';

interface ProfilePopupProps {
  account: ProfileAccount;
  pins: ProfilePin[];
  collections: Collection[];
  isOwnProfile: boolean;
  selectedCollectionId: string | null;
  onCollectionSelect: (collectionId: string | null) => void;
  onCollectionsUpdate: () => void;
  onPinUpdate: (pinId: string, collectionId: string | null) => Promise<void>;
  selectedPinId?: string | null;
  onPinSelect?: (pinId: string | null) => void;
}

export default function ProfilePopup({
  account,
  pins,
  collections,
  isOwnProfile,
  selectedCollectionId,
  onCollectionSelect,
  onCollectionsUpdate,
  onPinUpdate,
  selectedPinId,
  onPinSelect,
}: ProfilePopupProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const displayName = account.first_name 
    ? `${account.first_name}${account.last_name ? ` ${account.last_name}` : ''}`
    : account.username || 'User';

  return (
    <div 
      className={`absolute top-2 left-2 z-20 bg-white border border-gray-200 rounded-md shadow-sm transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-h-[calc(100vh-5rem)]' : 'max-h-14'
      }`}
      style={{ 
        maxWidth: '600px',
        width: 'calc(100% - 1rem)',
      }}
    >
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-2 py-2 border-b border-gray-200 hover:bg-gray-50 transition-colors"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200 flex-shrink-0">
          {account.image_url ? (
            <Image
              src={account.image_url}
              alt={displayName}
              width={32}
              height={32}
              className="w-full h-full object-cover"
              unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
            />
          ) : (
            <UserIcon className="w-5 h-5 text-gray-500" />
          )}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-xs font-semibold text-gray-900 truncate">
            {displayName}
          </div>
          {account.username && (
            <div className="text-[10px] text-gray-500 truncate">
              @{account.username}
            </div>
          )}
        </div>
        {isExpanded ? (
          <ChevronUpIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronDownIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
          <div className="p-3 space-y-3">
            {/* Profile Card */}
            <ProfileCard account={account} isOwnProfile={isOwnProfile} />

            {/* Collections Management */}
            <SimpleProfileCardWithCollections
              accountUsername={account.username}
              accountImageUrl={account.image_url}
              collections={collections}
              pins={pins}
              isOwnProfile={isOwnProfile}
              accountId={account.id}
              selectedCollectionId={selectedCollectionId}
              onCollectionSelect={onCollectionSelect}
              onCollectionsUpdate={onCollectionsUpdate}
              onPinUpdate={onPinUpdate}
              selectedPinId={selectedPinId}
              onPinSelect={onPinSelect}
            />
          </div>
        </div>
      )}
    </div>
  );
}
