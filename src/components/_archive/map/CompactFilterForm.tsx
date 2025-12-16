'use client';

import { useState, useEffect } from 'react';
import { Pin } from '@/features/pins/services/pinService';
import { CheckIcon } from '@heroicons/react/24/outline';

interface CompactFilterFormProps {
  pins: Pin[];
  onFilteredPinsChange?: (filteredPins: Pin[]) => void;
  onTagIdsChange?: (tagIds: string[]) => void;
  onVisibilityChange?: (visibility: { public: boolean; private: boolean }) => void;
}

interface FilterState {
  visibility: {
    public: boolean;
    private: boolean;
  };
  selectedTagIds: string[];
}

export function CompactFilterForm({ 
  pins, 
  onFilteredPinsChange,
  onTagIdsChange,
  onVisibilityChange,
}: CompactFilterFormProps) {
  const [filters, setFilters] = useState<FilterState>({
    visibility: {
      public: true,
      private: true,
    },
    selectedTagIds: [],
  });
  // Tags removed - tags table deleted
  const isLoadingTags = false;

  // Notify parent of visibility changes
  useEffect(() => {
    if (onVisibilityChange) {
      onVisibilityChange(filters.visibility);
    }
  }, [filters.visibility, onVisibilityChange]);

  // Notify parent of tag changes
  useEffect(() => {
    if (onTagIdsChange) {
      onTagIdsChange(filters.selectedTagIds);
    }
  }, [filters.selectedTagIds, onTagIdsChange]);

  // Apply filters whenever pins or filter state changes
  useEffect(() => {
    if (!onFilteredPinsChange) return;

    let filtered = [...pins];

    // Filter by visibility
    const visibilityFilters: string[] = [];
    if (filters.visibility.public) visibilityFilters.push('public');
    if (filters.visibility.private) visibilityFilters.push('private');
    
    if (visibilityFilters.length < 2) {
      filtered = filtered.filter(pin => visibilityFilters.includes(pin.visibility));
    }

    // Filter by tags
    if (filters.selectedTagIds.length > 0) {
      filtered = filtered.filter(pin => 
        pin.tag_id && filters.selectedTagIds.includes(pin.tag_id)
      );
    }

    onFilteredPinsChange(filtered);
  }, [pins, filters, onFilteredPinsChange]);

  const toggleVisibility = (key: keyof FilterState['visibility']) => {
    setFilters(prev => ({
      ...prev,
      visibility: {
        ...prev.visibility,
        [key]: !prev.visibility[key],
      },
    }));
  };

  const toggleTag = (tagId: string) => {
    setFilters(prev => ({
      ...prev,
      selectedTagIds: prev.selectedTagIds.includes(tagId)
        ? prev.selectedTagIds.filter(id => id !== tagId)
        : [...prev.selectedTagIds, tagId],
    }));
  };

  return (
    <div className="space-y-3 pointer-events-auto w-full">
      {/* Visibility Filters */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-800 block">Visibility</label>
        <div className="space-y-1">
          <button
            onClick={() => toggleVisibility('public')}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all active:scale-[0.98]"
            style={{
              backgroundColor: filters.visibility.public 
                ? 'rgba(34, 197, 94, 0.15)' 
                : 'rgba(255, 255, 255, 0.1)',
            }}
          >
            {/* iOS-style Checkbox */}
            <div 
              className="flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
              style={{
                borderColor: filters.visibility.public ? '#22c55e' : 'rgba(0, 0, 0, 0.3)',
                backgroundColor: filters.visibility.public ? '#22c55e' : 'transparent',
              }}
            >
              {filters.visibility.public && (
                <CheckIcon className="w-3 h-3 text-white" />
              )}
            </div>
            <span 
              className="flex-1 text-left text-xs font-medium"
              style={{
                color: filters.visibility.public ? 'rgba(34, 197, 94, 0.9)' : 'rgba(0, 0, 0, 0.8)',
              }}
            >
              Public
            </span>
          </button>
          
          <button
            onClick={() => toggleVisibility('private')}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all active:scale-[0.98]"
            style={{
              backgroundColor: filters.visibility.private 
                ? 'rgba(34, 197, 94, 0.15)' 
                : 'rgba(255, 255, 255, 0.1)',
            }}
          >
            {/* iOS-style Checkbox */}
            <div 
              className="flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
              style={{
                borderColor: filters.visibility.private ? '#22c55e' : 'rgba(0, 0, 0, 0.3)',
                backgroundColor: filters.visibility.private ? '#22c55e' : 'transparent',
              }}
            >
              {filters.visibility.private && (
                <CheckIcon className="w-3 h-3 text-white" />
              )}
            </div>
            <span 
              className="flex-1 text-left text-xs font-medium"
              style={{
                color: filters.visibility.private ? 'rgba(34, 197, 94, 0.9)' : 'rgba(0, 0, 0, 0.8)',
              }}
            >
              Private
            </span>
          </button>
        </div>
      </div>

    </div>
  );
}

