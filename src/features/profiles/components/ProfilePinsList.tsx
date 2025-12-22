'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, PencilIcon, CheckIcon, XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import { MapPin } from '@/types/map-pin';
import { PublicMapPinService } from '@/features/map-pins/services/publicMapPinService';
import { useToast } from '@/features/ui/hooks/useToast';

interface ProfilePinsListProps {
  pins: MapPin[];
  isOwnProfile: boolean;
  onPinClick?: (pin: MapPin) => void;
  onPinUpdated?: () => void;
}

type VisibilityFilter = 'all' | 'public' | 'only_me';

export default function ProfilePinsList({ pins: initialPins, isOwnProfile, onPinClick, onPinUpdated }: ProfilePinsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [pins, setPins] = useState<MapPin[]>(initialPins);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingPinId, setDeletingPinId] = useState<string | null>(null);
  const { success, error: showError } = useToast();
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Update local pins when initialPins changes
  useEffect(() => {
    setPins(initialPins);
  }, [initialPins]);

  const formatCoordinates = (lat: number, lng: number): string => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const startEditing = (pinId: string, currentDescription: string | null) => {
    setEditingPinId(pinId);
    setEditValue(currentDescription || '');
    setTimeout(() => {
      if (descriptionTextareaRef.current) {
        descriptionTextareaRef.current.focus();
      }
    }, 10);
  };

  const cancelEditing = () => {
    setEditingPinId(null);
    setEditValue('');
  };

  const savePin = async (pinId: string) => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const value = editValue.trim() || null;
      await PublicMapPinService.updatePin(pinId, {
        description: value,
      });

      // Update local state
      setPins(prevPins =>
        prevPins.map(pin =>
          pin.id === pinId ? { ...pin, description: value, updated_at: new Date().toISOString() } : pin
        )
      );

      setEditingPinId(null);
      setEditValue('');
      success('Updated', 'Pin description updated');
      onPinUpdated?.();
    } catch (err) {
      console.error('Error updating pin:', err);
      showError('Error', 'Failed to update pin description');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePin = async (pinId: string) => {
    if (!confirm('Are you sure you want to delete this pin?')) {
      return;
    }

    if (deletingPinId) return;
    setDeletingPinId(pinId);

    try {
      await PublicMapPinService.deletePin(pinId);
      
      // Remove pin from local state
      setPins(prevPins => prevPins.filter(pin => pin.id !== pinId));
      
      success('Deleted', 'Pin deleted');
      onPinUpdated?.();
    } catch (err) {
      console.error('Error deleting pin:', err);
      showError('Error', 'Failed to delete pin');
    } finally {
      setDeletingPinId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, pinId: string) => {
    if (e.key === 'Escape') {
      cancelEditing();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      savePin(pinId);
    }
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
              className={`relative flex gap-2 ${onPinClick && !isOwnProfile ? 'cursor-pointer hover:bg-gray-50 rounded transition-colors' : ''}`}
              onClick={onPinClick && !isOwnProfile ? () => onPinClick(pin) : undefined}
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
                {/* Description - Editable for owners */}
                {editingPinId === pin.id ? (
                  <div className="space-y-1">
                    <textarea
                      ref={descriptionTextareaRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, pin.id)}
                      onBlur={() => savePin(pin.id)}
                      className="text-xs text-gray-600 leading-relaxed border border-gray-300 rounded px-1.5 py-1 w-full resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
                      rows={3}
                      disabled={isSaving}
                      autoFocus
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => savePin(pin.id)}
                        disabled={isSaving}
                        className="p-0.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                      >
                        <CheckIcon className="w-3 h-3 text-gray-600" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={cancelEditing}
                        className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                      >
                        <XMarkIcon className="w-3 h-3 text-gray-600" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group">
                    {pin.description ? (
                      <p className="text-xs text-gray-600 leading-relaxed">{pin.description}</p>
                    ) : isOwnProfile ? (
                      <button
                        onClick={() => startEditing(pin.id, null)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Add description
                      </button>
                    ) : null}
                    {isOwnProfile && (
                      <div className="inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all ml-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(pin.id, pin.description);
                          }}
                          className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                          title="Edit description"
                        >
                          <PencilIcon className="w-3 h-3 text-gray-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePin(pin.id);
                          }}
                          disabled={deletingPinId === pin.id}
                          className="p-0.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                          title="Delete pin"
                        >
                          {deletingPinId === pin.id ? (
                            <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <TrashIcon className="w-3 h-3 text-gray-400" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
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

