'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { PlusIcon, PencilIcon, XMarkIcon, UserIcon } from '@heroicons/react/24/outline';
import { CollectionService } from '@/features/collections/services/collectionService';
import CompactActionButton from '@/components/ui/CompactActionButton';
import type { Collection, CreateCollectionData, UpdateCollectionData } from '@/types/collection';
import type { ProfilePin } from '@/types/profile';

interface CollectionsPanelProps {
  collections: Collection[];
  pins: ProfilePin[];
  isOwnProfile: boolean;
  accountId: string;
  selectedCollectionId: string | null;
  onCollectionSelect: (collectionId: string | null) => void;
  onCollectionsUpdate: () => void;
  onPinUpdate: (pinId: string, collectionId: string | null) => Promise<void>;
  selectedPinId?: string | null;
  onPinSelect?: (pinId: string | null) => void;
  accountUsername?: string | null;
  accountImageUrl?: string | null;
}

export default function CollectionsPanel({
  collections,
  pins,
  isOwnProfile,
  accountId,
  selectedCollectionId,
  onCollectionSelect,
  onCollectionsUpdate,
  onPinUpdate,
  selectedPinId,
  onPinSelect,
  accountUsername,
  accountImageUrl,
}: CollectionsPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCollectionTitle, setNewCollectionTitle] = useState('');
  const [newCollectionEmoji, setNewCollectionEmoji] = useState('📍');
  const [editCollectionTitle, setEditCollectionTitle] = useState('');
  const [editCollectionEmoji, setEditCollectionEmoji] = useState('📍');
  const [isSaving, setIsSaving] = useState(false);

  // Get pin counts per collection
  const getCollectionPinCount = useCallback((collectionId: string | null) => {
    return pins.filter(pin => pin.collection_id === collectionId).length;
  }, [pins]);

  // Handle create collection
  const handleCreateCollection = useCallback(async () => {
    if (!newCollectionTitle.trim()) return;

    setIsSaving(true);
    try {
      const data: CreateCollectionData = {
        emoji: newCollectionEmoji || '📍',
        title: newCollectionTitle.trim(),
      };
      await CollectionService.createCollection(data);
      setNewCollectionTitle('');
      setNewCollectionEmoji('📍');
      setIsCreating(false);
      onCollectionsUpdate();
    } catch (error) {
      console.error('Error creating collection:', error);
      alert(error instanceof Error ? error.message : 'Failed to create collection');
    } finally {
      setIsSaving(false);
    }
  }, [newCollectionTitle, newCollectionEmoji, onCollectionsUpdate]);

  // Handle update collection
  const handleUpdateCollection = useCallback(async (collectionId: string) => {
    if (!editCollectionTitle.trim()) return;

    setIsSaving(true);
    try {
      const data: UpdateCollectionData = {
        emoji: editCollectionEmoji || '📍',
        title: editCollectionTitle.trim(),
      };
      await CollectionService.updateCollection(collectionId, data);
      setEditingId(null);
      setEditCollectionTitle('');
      setEditCollectionEmoji('📍');
      onCollectionsUpdate();
    } catch (error) {
      console.error('Error updating collection:', error);
      alert(error instanceof Error ? error.message : 'Failed to update collection');
    } finally {
      setIsSaving(false);
    }
  }, [editCollectionTitle, editCollectionEmoji, onCollectionsUpdate]);

  // Handle delete collection
  const handleDeleteCollection = useCallback(async (collectionId: string) => {
    if (!confirm('Delete this collection? Pins will be unassigned.')) return;

    setIsSaving(true);
    try {
      await CollectionService.deleteCollection(collectionId);
      if (selectedCollectionId === collectionId) {
        onCollectionSelect(null);
      }
      onCollectionsUpdate();
    } catch (error) {
      console.error('Error deleting collection:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete collection');
    } finally {
      setIsSaving(false);
    }
  }, [selectedCollectionId, onCollectionSelect, onCollectionsUpdate]);

  // Start editing
  const startEditing = useCallback((collection: Collection) => {
    setEditingId(collection.id);
    setEditCollectionTitle(collection.title);
    setEditCollectionEmoji(collection.emoji);
  }, []);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditCollectionTitle('');
    setEditCollectionEmoji('📍');
  }, []);

  // Filter collections - show public ones for visitors, all for owners
  const visibleCollections = isOwnProfile 
    ? collections 
    : collections.filter(c => {
        // For visitors, only show collections that have public pins
        const collectionPins = pins.filter(p => p.collection_id === c.id);
        return collectionPins.length > 0 && collectionPins.some(p => p.visibility === 'public');
      });

  // Get unassigned count
  const unassignedCount = pins.filter(p => !p.collection_id && (isOwnProfile || p.visibility === 'public')).length;

  return (
    <div className="absolute top-2 left-2 z-20 bg-white border border-gray-200 rounded-md shadow-sm max-w-[280px] w-full max-h-[calc(100%-16px)] overflow-hidden flex flex-col">
      {/* Account Info */}
      {(accountUsername || accountImageUrl) && (
        <div className="px-1.5 py-1 border-b border-gray-200">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200 flex-shrink-0">
              {accountImageUrl ? (
                <Image
                  src={accountImageUrl}
                  alt={accountUsername || 'Account'}
                  width={20}
                  height={20}
                  className="w-full h-full object-cover"
                  unoptimized={accountImageUrl.startsWith('data:') || accountImageUrl.includes('supabase.co')}
                />
              ) : (
                <UserIcon className="w-3 h-3 text-gray-500" />
              )}
            </div>
            {accountUsername && (
              <span className="text-xs font-medium text-gray-900 truncate">
                @{accountUsername}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Header - Compact */}
      <div className="px-1.5 py-0.5 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-900">Collections</h3>
        {isOwnProfile && (
          <CompactActionButton
            onClick={() => {
              setIsCreating(true);
              setNewCollectionTitle('');
              setNewCollectionEmoji('📍');
            }}
            title="Add Collection"
          >
            <PlusIcon className="w-2.5 h-2.5 text-gray-600" />
          </CompactActionButton>
        )}
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1">
        <div className="p-0.5 space-y-0.5">
          {/* All Pins */}
          <button
            onClick={() => onCollectionSelect(null)}
            className={`w-full px-1.5 py-0.5 rounded text-left transition-colors ${
              selectedCollectionId === null
                ? 'bg-gray-100 text-gray-900'
                : 'hover:bg-gray-50 text-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">All Mentions</span>
              <span className="text-[10px] text-gray-500">
                {isOwnProfile ? pins.length : pins.filter(p => p.visibility === 'public').length}
              </span>
            </div>
          </button>

          {/* Assign Pin to Collection (for owners when pin is selected) */}
          {isOwnProfile && selectedPinId && (
            <div className="px-1.5 py-0.5 border-t border-gray-200 bg-gray-50">
              <div className="text-[10px] text-gray-500 mb-1">Assign to collection:</div>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={async () => {
                    try {
                      await onPinUpdate(selectedPinId, null);
                      onPinSelect?.(null);
                    } catch (error) {
                      console.error('Error assigning pin:', error);
                    }
                  }}
                  className="px-1.5 py-0.5 text-[10px] bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                >
                  None
                </button>
                {visibleCollections.map((collection) => (
                  <button
                    key={collection.id}
                    onClick={async () => {
                      try {
                        await onPinUpdate(selectedPinId, collection.id);
                        onPinSelect?.(null);
                      } catch (error) {
                        console.error('Error assigning pin:', error);
                      }
                    }}
                    className="px-1.5 py-0.5 text-[10px] bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors flex items-center gap-1"
                  >
                    <span>{collection.emoji}</span>
                    <span>{collection.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Collections */}
          {visibleCollections.map((collection) => {
            const count = getCollectionPinCount(collection.id);
            const isSelected = selectedCollectionId === collection.id;
            const isEditing = editingId === collection.id;

            if (isEditing && isOwnProfile) {
              return (
                <div key={collection.id} className="px-1.5 py-0.5 border border-gray-200 rounded bg-gray-50">
                  <div className="flex items-center gap-1 mb-1.5">
                    <input
                      type="text"
                      value={editCollectionEmoji}
                      onChange={(e) => setEditCollectionEmoji(e.target.value)}
                      className="w-6 px-1 py-0.5 text-xs border border-gray-200 rounded"
                      placeholder="📍"
                      maxLength={2}
                    />
                    <input
                      type="text"
                      value={editCollectionTitle}
                      onChange={(e) => setEditCollectionTitle(e.target.value)}
                      className="flex-1 px-1.5 py-0.5 text-xs border border-gray-200 rounded"
                      placeholder="Collection name"
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleUpdateCollection(collection.id)}
                      disabled={!editCollectionTitle.trim() || isSaving}
                      className="px-2 py-0.5 text-[10px] font-medium text-white bg-gray-900 hover:bg-gray-800 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      disabled={isSaving}
                      className="px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={collection.id}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => onCollectionSelect(collection.id)}
                    className="flex-1 text-left flex items-center gap-1.5 min-w-0"
                  >
                    <span className="text-xs flex-shrink-0">{collection.emoji}</span>
                    <span className={`text-xs truncate ${isSelected ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                      {collection.title}
                    </span>
                  </button>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-500">{count}</span>
                    {isOwnProfile && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(collection);
                          }}
                          className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="Edit"
                        >
                          <PencilIcon className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCollection(collection.id);
                          }}
                          className="p-0.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded transition-colors"
                          title="Delete"
                        >
                          <XMarkIcon className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Create Collection Form */}
          {isCreating && isOwnProfile && (
            <div className="px-1.5 py-0.5 border border-gray-200 rounded bg-gray-50">
              <div className="flex items-center gap-1 mb-1.5">
                <input
                  type="text"
                  value={newCollectionEmoji}
                  onChange={(e) => setNewCollectionEmoji(e.target.value)}
                  className="w-6 px-1 py-0.5 text-xs border border-gray-200 rounded"
                  placeholder="📍"
                  maxLength={2}
                />
                <input
                  type="text"
                  value={newCollectionTitle}
                  onChange={(e) => setNewCollectionTitle(e.target.value)}
                  className="flex-1 px-1.5 py-0.5 text-xs border border-gray-200 rounded"
                  placeholder="Collection name"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateCollection();
                    } else if (e.key === 'Escape') {
                      setIsCreating(false);
                      setNewCollectionTitle('');
                      setNewCollectionEmoji('📍');
                    }
                  }}
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCreateCollection}
                  disabled={!newCollectionTitle.trim() || isSaving}
                  className="px-2 py-0.5 text-[10px] font-medium text-white bg-gray-900 hover:bg-gray-800 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewCollectionTitle('');
                    setNewCollectionEmoji('📍');
                  }}
                  disabled={isSaving}
                  className="px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

