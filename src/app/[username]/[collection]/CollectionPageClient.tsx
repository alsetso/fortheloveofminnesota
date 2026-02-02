'use client';

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import ProfileMap from '@/features/profiles/components/ProfileMap';
import ProfileMentionsList from '@/features/profiles/components/ProfileMentionsList';
import CollectionPageHeader from './CollectionPageHeader';
import { MapIcon, ListBulletIcon } from '@heroicons/react/24/outline';
import type { ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';

interface CollectionPageClientProps {
  collection: Collection;
  username: string;
  isOwnProfile: boolean;
  pins: ProfilePin[];
  accountId: string;
  accountUsername: string | null;
  accountImageUrl: string | null;
  collections: Collection[];
}

export default function CollectionPageClient({
  collection,
  username,
  isOwnProfile,
  pins: initialPins,
  accountId,
  accountUsername,
  accountImageUrl,
  collections,
}: CollectionPageClientProps) {
  const searchParams = useSearchParams();
  const viewAs = (searchParams.get('view') as 'owner' | 'public') || 'owner';
  const effectiveIsOwner = isOwnProfile && viewAs === 'owner';
  
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list');

  // Filter pins based on view mode (owner vs public)
  const filteredPins = useMemo(() => {
    if (effectiveIsOwner) {
      // Owner viewing as owner: show all pins in this collection
      return initialPins.filter(pin => pin.collection_id === collection.id);
    } else {
      // Public view or non-owner: show only public pins
      return initialPins.filter(
        pin => pin.collection_id === collection.id && pin.visibility === 'public'
      );
    }
  }, [initialPins, collection.id, effectiveIsOwner]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header with collection info, edit buttons, and view toggle */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg flex-shrink-0">{collection.emoji}</span>
            <h2 className="text-lg font-semibold text-gray-900 truncate">{collection.title}</h2>
          </div>
          {isOwnProfile && (
            <CollectionPageHeader
              collection={collection}
              username={username}
              isOwnProfile={isOwnProfile}
              showTitle={false}
            />
          )}
        </div>
        
        {/* List/Map View Toggle */}
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-md p-[2px]">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center justify-center gap-1 px-1.5 h-[25px] text-[10px] font-medium rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              aria-label="List view"
            >
              <ListBulletIcon className="w-3 h-3" />
              <span>List</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center justify-center gap-1 px-1.5 h-[25px] text-[10px] font-medium rounded transition-colors ${
                viewMode === 'map'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              aria-label="Map view"
            >
              <MapIcon className="w-3 h-3" />
              <span>Map</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'map' ? (
        <div className="aspect-square w-full relative overflow-hidden">
          <ProfileMap
            pins={filteredPins}
            accountId={accountId}
            isOwnProfile={isOwnProfile}
            accountUsername={accountUsername}
            accountImageUrl={accountImageUrl}
            selectedCollectionId={collection.id}
            collections={collections}
          />
        </div>
      ) : (
        <ProfileMentionsList pins={filteredPins} isOwnProfile={isOwnProfile} />
      )}
    </div>
  );
}
