'use client';

import { useState, useMemo, useEffect } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { ProfilePin } from '@/types/profile';
import ProfileMap from './ProfileMap';
import ProfilePinsList from './ProfilePinsList';
import CreateMentionModal from '@/features/map/components/CreateMentionModal';
import { MentionService } from '@/features/mentions/services/mentionService';
import type { Mention } from '@/types/mention';

import type { Collection } from '@/types/collection';

interface ProfileMentionsSectionProps {
  pins: ProfilePin[];
  collections?: Collection[];
  isOwnProfile: boolean;
  onPinClick?: (pin: ProfilePin) => void;
  onPinUpdated?: () => void;
  selectedCollectionId?: string | null;
}

type VisibilityFilter = 'all' | 'public' | 'only_me';

export default function ProfileMentionsSection({
  pins = [],
  collections = [],
  isOwnProfile,
  onPinClick,
  onPinUpdated,
  selectedCollectionId = null,
}: ProfileMentionsSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createCoordinates, setCreateCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [localPins, setLocalPins] = useState<ProfilePin[]>(pins || []);

  const formatCoordinates = (lat: number, lng: number): string => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  // Update local pins when props change
  useEffect(() => {
    setLocalPins(pins || []);
  }, [pins]);

  // Filter pins based on search and visibility
  const filteredPins = useMemo(() => {
    let filtered = localPins;

    // Apply visibility filter (only for owners)
    if (isOwnProfile && visibilityFilter !== 'all') {
      filtered = filtered.filter((pin) => pin.visibility === visibilityFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (pin) =>
          pin.description?.toLowerCase().includes(query) ||
          formatCoordinates(pin.lat, pin.lng).includes(query)
      );
    }

    return filtered;
  }, [localPins, searchQuery, visibilityFilter, isOwnProfile]);


  const handleMentionCreated = (mention?: Mention) => {
    if (mention) {
      // Convert Mention to ProfilePin format
      const newPin: ProfilePin = {
        id: mention.id,
        lat: mention.lat,
        lng: mention.lng,
        description: mention.description,
        collection_id: mention.collection_id || null,
        visibility: mention.visibility as 'public' | 'only_me',
        created_at: mention.created_at,
        updated_at: mention.updated_at,
      };
      
      setLocalPins(prev => [newPin, ...prev]);
      onPinUpdated?.();
    }
    setCreateModalOpen(false);
    setCreateCoordinates(null);
  };

  const handleCloseModal = () => {
    setCreateModalOpen(false);
    setCreateCoordinates(null);
  };

  return (
    <div className="space-y-3">
      {/* Map */}
      <ProfileMap pins={filteredPins} />

      {/* Create Mention Modal */}
      {isOwnProfile && (
        <CreateMentionModal
          isOpen={createModalOpen}
          onClose={handleCloseModal}
          coordinates={createCoordinates}
          onMentionCreated={handleMentionCreated}
        />
      )}

      {/* Search and Filters */}
      <div className="space-y-2">
        {/* Search Input */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search mentions..."
            className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
          />
        </div>

        {/* Visibility Filter - Only for owners */}
        {isOwnProfile && (
          <div className="flex gap-1.5">
            <button
              onClick={() => setVisibilityFilter('all')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                visibilityFilter === 'all'
                  ? 'bg-gray-200 text-gray-900 font-medium'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setVisibilityFilter('public')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                visibilityFilter === 'public'
                  ? 'bg-gray-200 text-gray-900 font-medium'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              Public
            </button>
            <button
              onClick={() => setVisibilityFilter('only_me')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                visibilityFilter === 'only_me'
                  ? 'bg-gray-200 text-gray-900 font-medium'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              Private
            </button>
          </div>
        )}
      </div>

      {/* Mentions List */}
      <ProfilePinsList
        pins={localPins}
        collections={collections}
        isOwnProfile={isOwnProfile}
        onPinClick={onPinClick}
        onPinUpdated={() => {
          onPinUpdated?.();
        }}
        searchQuery={searchQuery}
        visibilityFilter={visibilityFilter}
        onSearchQueryChange={setSearchQuery}
        onVisibilityFilterChange={setVisibilityFilter}
      />
    </div>
  );
}
