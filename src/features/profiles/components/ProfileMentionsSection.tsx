'use client';

import { useState, useMemo } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { ProfilePin } from '@/types/profile';
import ProfileMap from './ProfileMap';
import ProfilePinsList from './ProfilePinsList';

import type { Collection } from '@/types/collection';

interface ProfileMentionsSectionProps {
  pins: ProfilePin[];
  collections?: Collection[];
  isOwnProfile: boolean;
  onPinClick?: (pin: ProfilePin) => void;
  onPinUpdated?: () => void;
}

type VisibilityFilter = 'all' | 'public' | 'only_me';

export default function ProfileMentionsSection({
  pins,
  collections = [],
  isOwnProfile,
  onPinClick,
  onPinUpdated,
}: ProfileMentionsSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');

  const formatCoordinates = (lat: number, lng: number): string => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  // Filter pins based on search and visibility
  const filteredPins = useMemo(() => {
    let filtered = pins;

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
  }, [pins, searchQuery, visibilityFilter, isOwnProfile]);

  if (pins.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Map */}
      <ProfileMap
        pins={pins}
        isOwnProfile={isOwnProfile}
        searchQuery={searchQuery}
        visibilityFilter={visibilityFilter}
      />

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
        pins={pins}
        collections={collections}
        isOwnProfile={isOwnProfile}
        onPinClick={onPinClick}
        onPinUpdated={onPinUpdated}
        searchQuery={searchQuery}
        visibilityFilter={visibilityFilter}
        onSearchQueryChange={setSearchQuery}
        onVisibilityFilterChange={setVisibilityFilter}
      />
    </div>
  );
}
