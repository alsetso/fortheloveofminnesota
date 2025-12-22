'use client';

import { useState, useMemo } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { MapPin } from '@/types/map-pin';

interface ProfilePinsListProps {
  pins: MapPin[];
  isOwnProfile: boolean;
  onPinClick?: (pin: MapPin) => void;
}

type VisibilityFilter = 'all' | 'public' | 'only_me';

export default function ProfilePinsList({ pins, isOwnProfile, onPinClick }: ProfilePinsListProps) {
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
      filtered = filtered.filter(pin => pin.visibility === visibilityFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(pin => 
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
      {/* Search and Filters */}
      <div className="space-y-2">
        {/* Search Input */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pins..."
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

      {/* Pins List */}
      {filteredPins.length === 0 ? (
        <div className="text-xs text-gray-500 py-3">
          {searchQuery || visibilityFilter !== 'all' ? 'No pins match your filters.' : 'No pins found.'}
        </div>
      ) : (
        <div className="space-y-0">
          {filteredPins.map((pin, index) => (
            <div 
              key={pin.id} 
              className={`relative flex gap-2 ${onPinClick ? 'cursor-pointer hover:bg-gray-50 rounded transition-colors' : ''}`}
              onClick={onPinClick ? () => onPinClick(pin) : undefined}
            >
              {/* Timeline Thread */}
              <div className="flex flex-col items-center flex-shrink-0 w-3">
                {/* Timeline Dot */}
                <div className="w-2 h-2 rounded-full bg-gray-500 flex-shrink-0 mt-1.5" />
                {/* Timeline Line - only show if not last item */}
                {index < filteredPins.length - 1 && (
                  <div className="w-px h-full bg-gray-200 flex-1 min-h-[60px]" />
                )}
              </div>

              {/* Pin Content */}
              <div className="flex-1 pb-3 space-y-1.5">
                {/* Caption */}
                {pin.description && (
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {pin.description}
                  </p>
                )}
                
                {/* Coordinates */}
                {pin.lat && pin.lng && (
                  <div className="text-[10px] text-gray-500 font-mono">
                    {formatCoordinates(pin.lat, pin.lng)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

