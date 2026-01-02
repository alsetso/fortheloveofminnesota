'use client';

import { useState, useMemo, useRef, useEffect, type KeyboardEvent } from 'react';
import { MagnifyingGlassIcon, PencilIcon, CheckIcon, XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';
import { MentionService } from '@/features/mentions/services/mentionService';
import { useToast } from '@/features/ui/hooks/useToast';

type VisibilityFilter = 'all' | 'public' | 'only_me';

interface ProfilePinsListProps {
  pins: ProfilePin[];
  collections?: Collection[];
  isOwnProfile: boolean;
  onPinClick?: (pin: ProfilePin) => void;
  onPinUpdated?: () => void;
  searchQuery?: string;
  visibilityFilter?: VisibilityFilter;
  onSearchQueryChange?: (query: string) => void;
  onVisibilityFilterChange?: (filter: VisibilityFilter) => void;
}

export default function ProfilePinsList({
  pins: initialPins,
  collections = [],
  isOwnProfile,
  onPinClick,
  onPinUpdated,
  searchQuery: externalSearchQuery,
  visibilityFilter: externalVisibilityFilter,
  onSearchQueryChange,
  onVisibilityFilterChange,
}: ProfilePinsListProps) {
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [internalVisibilityFilter, setInternalVisibilityFilter] = useState<VisibilityFilter>('all');

  // Use external state if provided, otherwise use internal state
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const visibilityFilter = externalVisibilityFilter !== undefined ? externalVisibilityFilter : internalVisibilityFilter;
  
  const setSearchQuery = onSearchQueryChange || setInternalSearchQuery;
  const setVisibilityFilter = onVisibilityFilterChange || setInternalVisibilityFilter;
  const [pins, setPins] = useState<ProfilePin[]>(initialPins);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingPinId, setDeletingPinId] = useState<string | null>(null);
  const [updatingCollectionId, setUpdatingCollectionId] = useState<string | null>(null);
  const [editingCollectionPinId, setEditingCollectionPinId] = useState<string | null>(null);
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
      await MentionService.updateMention(pinId, {
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
      success('Updated', 'Mention description updated');
      onPinUpdated?.();
    } catch (err) {
      console.error('Error updating pin:', err);
      showError('Error', 'Failed to update mention description');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchivePin = async (pinId: string) => {
    if (!confirm('Are you sure you want to archive this mention?')) {
      return;
    }

    if (deletingPinId) return;
    setDeletingPinId(pinId);

    try {
      // Archive the mention by updating archived = true
      await MentionService.updateMention(pinId, { archived: true });
      
      // Remove pin from local state
      setPins(prevPins => prevPins.filter(pin => pin.id !== pinId));
      
      success('Archived', 'Mention archived');
      onPinUpdated?.();
    } catch (err) {
      console.error('Error archiving pin:', err);
      showError('Error', 'Failed to archive mention');
    } finally {
      setDeletingPinId(null);
    }
  };

  const handleCollectionChange = async (pinId: string, collectionId: string | null) => {
    if (updatingCollectionId) return;
    setUpdatingCollectionId(pinId);

    try {
      await MentionService.updateMention(pinId, { collection_id: collectionId });
      setPins(prevPins =>
        prevPins.map(pin =>
          pin.id === pinId ? { ...pin, collection_id: collectionId, updated_at: new Date().toISOString() } : pin
        )
      );
      setEditingCollectionPinId(null); // Close edit mode after successful update
      success('Updated', 'Collection updated');
      onPinUpdated?.();
    } catch (err) {
      console.error('Error updating collection:', err);
      showError('Error', 'Failed to update collection');
    } finally {
      setUpdatingCollectionId(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent, pinId: string) => {
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
      {/* Pins List */}
      {filteredPins.length === 0 ? (
        <div className="text-xs text-gray-500 py-3">
          {searchQuery || visibilityFilter !== 'all' ? 'No mentions match your filters.' : 'No mentions found.'}
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
                            handleArchivePin(pin.id);
                          }}
                          disabled={deletingPinId === pin.id}
                          className="p-0.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                          title="Archive mention"
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
                
                {/* Collection Assignment - Only for owners */}
                {isOwnProfile && (
                  <div className="mt-1.5">
                    {editingCollectionPinId === pin.id ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="text-[10px] text-gray-500">Collections:</div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCollectionPinId(null);
                            }}
                            className="text-[10px] text-gray-500 hover:text-gray-700"
                          >
                            Done
                          </button>
                        </div>
                        {collections.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {collections.map((collection) => {
                              const isSelected = pin.collection_id === collection.id;
                              return (
                                <button
                                  key={collection.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCollectionChange(
                                      pin.id,
                                      isSelected ? null : collection.id
                                    );
                                  }}
                                  disabled={updatingCollectionId === pin.id}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded transition-colors ${
                                    isSelected
                                      ? 'bg-gray-200 text-gray-900 border border-gray-300 font-medium'
                                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                                  } disabled:opacity-50`}
                                  title={isSelected ? 'Click to remove from collection' : 'Click to add to collection'}
                                >
                                  <span>{collection.emoji}</span>
                                  <span>{collection.title}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-[10px] text-gray-400">
                            No collections yet. Create one in the right column.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {pin.collection_id ? (
                          <>
                            {(() => {
                              const currentCollection = collections.find(c => c.id === pin.collection_id);
                              return currentCollection ? (
                                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-gray-50 text-gray-600 border border-gray-200 rounded">
                                  <span>{currentCollection.emoji}</span>
                                  <span>{currentCollection.title}</span>
                                </div>
                              ) : null;
                            })()}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCollectionPinId(pin.id);
                              }}
                              className="text-[10px] text-gray-400 hover:text-gray-600"
                            >
                              Edit
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCollectionPinId(pin.id);
                            }}
                            className="text-[10px] text-gray-400 hover:text-gray-600"
                          >
                            Add to collection
                          </button>
                        )}
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

