'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { PlusIcon, PencilIcon, XMarkIcon, UserIcon, CheckIcon } from '@heroicons/react/24/outline';
import { CollectionService } from '@/features/collections/services/collectionService';
import CompactActionButton from '@/components/ui/CompactActionButton';
import type { Collection, CreateCollectionData, UpdateCollectionData } from '@/types/collection';
import type { ProfilePin } from '@/types/profile';

interface SimpleProfileCardWithCollectionsProps {
  accountUsername: string | null;
  accountImageUrl: string | null;
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
}

export default function SimpleProfileCardWithCollections({
  accountUsername,
  accountImageUrl,
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
}: SimpleProfileCardWithCollectionsProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCollectionTitle, setNewCollectionTitle] = useState('');
  const [newCollectionEmoji, setNewCollectionEmoji] = useState('📍');
  const [editCollectionTitle, setEditCollectionTitle] = useState('');
  const [editCollectionEmoji, setEditCollectionEmoji] = useState('📍');
  const [isSaving, setIsSaving] = useState(false);
  const [localCollections, setLocalCollections] = useState<Collection[]>(collections);
  const [isOpen, setIsOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalCollections(collections);
  }, [collections]);

  // Set initial collapsed state
  useEffect(() => {
    if (sheetRef.current) {
      sheetRef.current.style.transform = 'translateY(calc(100% - 3rem))';
    }
  }, []);

  // Handle sheet open/close animations
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when sheet is open
      document.body.style.overflow = 'hidden';
      
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        if (sheetRef.current) {
          sheetRef.current.style.transform = 'translateY(0)';
        }
      });
    } else {
      // Restore body scroll
      document.body.style.overflow = '';
      if (sheetRef.current) {
        sheetRef.current.style.transform = 'translateY(calc(100% - 3rem))';
      }
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

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
      const updatedCollections = await CollectionService.getCollections(accountId);
      setLocalCollections(updatedCollections);
      onCollectionsUpdate();
    } catch (error) {
      console.error('Error creating collection:', error);
      alert(error instanceof Error ? error.message : 'Failed to create collection');
    } finally {
      setIsSaving(false);
    }
  }, [newCollectionTitle, newCollectionEmoji, accountId, onCollectionsUpdate]);

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
      const updatedCollections = await CollectionService.getCollections(accountId);
      setLocalCollections(updatedCollections);
      onCollectionsUpdate();
    } catch (error) {
      console.error('Error updating collection:', error);
      alert(error instanceof Error ? error.message : 'Failed to update collection');
    } finally {
      setIsSaving(false);
    }
  }, [editCollectionTitle, editCollectionEmoji, accountId, onCollectionsUpdate]);

  // Handle delete collection
  const handleDeleteCollection = useCallback(async (collectionId: string) => {
    if (!confirm('Delete this collection? Pins will be unassigned.')) return;

    setIsSaving(true);
    try {
      await CollectionService.deleteCollection(collectionId);
      if (selectedCollectionId === collectionId) {
        onCollectionSelect(null);
      }
      const updatedCollections = await CollectionService.getCollections(accountId);
      setLocalCollections(updatedCollections);
      onCollectionsUpdate();
    } catch (error) {
      console.error('Error deleting collection:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete collection');
    } finally {
      setIsSaving(false);
    }
  }, [selectedCollectionId, onCollectionSelect, accountId, onCollectionsUpdate]);

  // Filter collections - show public ones for visitors, all for owners
  const visibleCollections = isOwnProfile 
    ? localCollections 
    : localCollections.filter(c => {
        const collectionPins = pins.filter(p => p.collection_id === c.id);
        return collectionPins.length > 0 && collectionPins.some(p => p.visibility === 'public');
      });

  const allMentionsCount = isOwnProfile 
    ? pins.length 
    : pins.filter(p => p.visibility === 'public').length;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[45] bg-black/20 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* iOS Style Bottom Sheet */}
      <div
        ref={sheetRef}
        className="fixed z-[50] bg-white shadow-2xl transition-all duration-300 ease-out flex flex-col
          bottom-0 left-0 right-0
          rounded-t-3xl"
        style={{
          transform: 'translateY(calc(100% - 3rem))',
          maxHeight: '90vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle bar - Always visible, clickable */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-center pt-2 pb-1 flex-shrink-0 w-full hover:bg-gray-50 transition-colors"
        >
          <div className="w-12 h-1 rounded-full bg-gray-300" />
        </button>

        {/* Collapsed state - Show when closed */}
        {!isOpen && (
          <div className="px-3 py-2 flex items-center justify-between border-b border-gray-200">
            <h3 className="text-xs font-semibold text-gray-900">Collections</h3>
            <span className="text-[10px] text-gray-500">
              {localCollections.length} collection{localCollections.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Expanded content */}
        {isOpen && (
          <>
            {/* Header - Compact */}
            <div className="px-1.5 py-0.5 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
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
        <div className="p-1 space-y-0.5">
          {/* All Mentions */}
          <button
            onClick={() => onCollectionSelect(null)}
            className={`w-full px-1.5 py-1 rounded text-left transition-colors ${
              selectedCollectionId === null
                ? 'bg-gray-100 text-gray-900'
                : 'hover:bg-gray-50 text-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">All Mentions</span>
              <span className="text-[10px] text-gray-500">{allMentionsCount}</span>
            </div>
          </button>

          {/* Assign Pin to Collection (for owners when pin is selected) */}
          {isOwnProfile && selectedPinId && (
            <div className="px-1.5 py-1 border-t border-gray-200 bg-gray-50">
              <div className="text-[10px] text-gray-500 mb-1">Assign to collection:</div>
              <div className="flex flex-wrap gap-0.5">
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
                    className="px-1.5 py-0.5 text-[10px] bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors flex items-center gap-0.5"
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
                <div key={collection.id} className="px-1.5 py-1 border border-gray-200 rounded bg-gray-50">
                  <div className="flex items-center gap-1 mb-1.5">
                    <input
                      type="text"
                      value={editCollectionEmoji}
                      onChange={(e) => setEditCollectionEmoji(e.target.value)}
                      className="w-7 h-6 px-1 py-0.5 text-xs border border-gray-200 rounded text-center"
                      placeholder="📍"
                      maxLength={2}
                    />
                    <input
                      type="text"
                      value={editCollectionTitle}
                      onChange={(e) => setEditCollectionTitle(e.target.value)}
                      className="flex-1 h-6 px-1.5 py-0.5 text-xs border border-gray-200 rounded"
                      placeholder="Collection name"
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => handleUpdateCollection(collection.id)}
                      disabled={!editCollectionTitle.trim() || isSaving}
                      className="px-1.5 py-0.5 h-5 text-[10px] font-medium text-white bg-gray-900 hover:bg-gray-800 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditCollectionTitle('');
                        setEditCollectionEmoji('📍');
                      }}
                      disabled={isSaving}
                      className="px-1.5 py-0.5 h-5 text-[10px] font-medium text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        handleDeleteCollection(collection.id);
                      }}
                      disabled={isSaving}
                      className="px-1.5 py-0.5 h-5 text-[10px] font-medium text-red-600 hover:bg-red-50 rounded disabled:opacity-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={collection.id}
                className={`px-1.5 py-1 rounded transition-colors ${
                  isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <button
                    onClick={() => onCollectionSelect(collection.id)}
                    className="flex-1 text-left flex items-center gap-1.5 min-w-0"
                  >
                    <span className="text-xs flex-shrink-0">{collection.emoji}</span>
                    <span className={`text-xs truncate ${isSelected ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                      {collection.title}
                    </span>
                    {isOwnProfile && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(collection.id);
                          setEditCollectionTitle(collection.title);
                          setEditCollectionEmoji(collection.emoji);
                        }}
                        className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors flex-shrink-0 ml-0.5"
                        title="Edit"
                      >
                        <PencilIcon className="w-3 h-3" />
                      </button>
                    )}
                  </button>
                  <span className="text-[10px] text-gray-500 flex-shrink-0 ml-auto">{count}</span>
                </div>
              </div>
            );
          })}

          {/* Create Collection Form */}
          {isCreating && isOwnProfile && (
            <div className="px-1.5 py-1 border border-gray-200 rounded bg-gray-50">
              <div className="flex items-center gap-1 mb-1.5">
                <input
                  type="text"
                  value={newCollectionEmoji}
                  onChange={(e) => setNewCollectionEmoji(e.target.value)}
                  className="w-7 h-6 px-1 py-0.5 text-xs border border-gray-200 rounded text-center"
                  placeholder="📍"
                  maxLength={2}
                />
                <input
                  type="text"
                  value={newCollectionTitle}
                  onChange={(e) => setNewCollectionTitle(e.target.value)}
                  className="flex-1 h-6 px-1.5 py-0.5 text-xs border border-gray-200 rounded"
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
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleCreateCollection}
                  disabled={!newCollectionTitle.trim() || isSaving}
                  className="px-1.5 py-0.5 h-5 text-[10px] font-medium text-white bg-gray-900 hover:bg-gray-800 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  className="px-1.5 py-0.5 h-5 text-[10px] font-medium text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
          </>
        )}
      </div>
    </>
  );
}
