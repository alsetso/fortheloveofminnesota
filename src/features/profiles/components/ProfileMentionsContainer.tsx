'use client';

import { useState, useCallback, useEffect } from 'react';
import ProfileMap from './ProfileMap';
import ProfileMentionsList from './ProfileMentionsList';
import SimpleProfileCardWithCollections from './SimpleProfileCardWithCollections';
import { MentionService } from '@/features/mentions/services/mentionService';
import { CollectionService } from '@/features/collections/services/collectionService';
import type { ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';

interface ProfileMentionsContainerProps {
  pins: ProfilePin[];
  accountId: string;
  isOwnProfile: boolean;
  accountUsername: string | null;
  accountImageUrl: string | null;
  collections: Collection[];
  onCollectionsUpdate?: () => void;
  viewMode?: 'map' | 'list';
  onViewModeChange?: (mode: 'map' | 'list') => void;
}

export default function ProfileMentionsContainer({
  pins,
  accountId,
  isOwnProfile,
  accountUsername,
  accountImageUrl,
  collections,
  onCollectionsUpdate,
  viewMode: externalViewMode,
  onViewModeChange,
}: ProfileMentionsContainerProps) {
  const [internalViewMode, setInternalViewMode] = useState<'map' | 'list'>('map');
  const viewMode = externalViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [localCollections, setLocalCollections] = useState<Collection[]>(collections);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [localPins, setLocalPins] = useState<ProfilePin[]>(pins);

  // Update local pins and collections when props change
  useEffect(() => {
    setLocalPins(pins);
  }, [pins]);

  useEffect(() => {
    setLocalCollections(collections);
  }, [collections]);

  // Filter pins based on selected collection
  const getFilteredPins = useCallback(() => {
    let filtered = localPins.filter(pin => isOwnProfile || pin.visibility === 'public');
    
    if (selectedCollectionId === 'unassigned') {
      filtered = filtered.filter(pin => !pin.collection_id);
    } else if (selectedCollectionId) {
      filtered = filtered.filter(pin => pin.collection_id === selectedCollectionId);
    }
    
    return filtered;
  }, [localPins, selectedCollectionId, isOwnProfile]);

  const filteredPins = getFilteredPins();

  // Handle pin collection update
  const handlePinUpdate = useCallback(async (pinId: string, collectionId: string | null) => {
    try {
      await MentionService.updateMention(pinId, { collection_id: collectionId });
      // Update local pins state
      setLocalPins(prevPins =>
        prevPins.map(pin =>
          pin.id === pinId ? { ...pin, collection_id: collectionId, updated_at: new Date().toISOString() } : pin
        )
      );
    } catch (error) {
      console.error('Error updating pin collection:', error);
      throw error;
    }
  }, []);

  // Handle collections refresh
  const handleCollectionsUpdate = useCallback(async () => {
    try {
      const updatedCollections = await CollectionService.getCollections(accountId);
      setLocalCollections(updatedCollections);
      onCollectionsUpdate?.();
    } catch (error) {
      console.error('Error refreshing collections:', error);
    }
  }, [accountId, onCollectionsUpdate]);

  if (pins.length === 0 || (filteredPins.length === 0 && !isOwnProfile)) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-xs text-gray-500 mb-1">No public mentions yet</p>
        <p className="text-[10px] text-gray-400">
          {isOwnProfile 
            ? 'Create mentions on maps to see them here'
            : 'This user hasn\'t created any public mentions yet'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Map View */}
      {viewMode === 'map' && (
        <div className="overflow-hidden relative">
          <div className="aspect-square w-full relative overflow-hidden">
            <ProfileMap 
              pins={filteredPins} 
              accountId={accountId}
              isOwnProfile={isOwnProfile}
              accountUsername={accountUsername}
              accountImageUrl={accountImageUrl}
              selectedCollectionId={selectedCollectionId}
              collections={localCollections}
              onPinSelect={setSelectedPinId}
            />
            <SimpleProfileCardWithCollections
              accountUsername={accountUsername}
              accountImageUrl={accountImageUrl}
              collections={localCollections}
              pins={localPins}
              isOwnProfile={isOwnProfile}
              accountId={accountId}
              selectedCollectionId={selectedCollectionId}
              onCollectionSelect={setSelectedCollectionId}
              onCollectionsUpdate={handleCollectionsUpdate}
              onPinUpdate={handlePinUpdate}
              selectedPinId={selectedPinId}
              onPinSelect={setSelectedPinId}
            />
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <ProfileMentionsList 
          pins={filteredPins}
          collections={localCollections}
          isOwnProfile={isOwnProfile}
          onCollectionsUpdate={handleCollectionsUpdate}
        />
      )}
    </div>
  );
}

