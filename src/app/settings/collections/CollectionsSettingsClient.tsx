'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { 
  PencilIcon, 
  TrashIcon, 
  PlusIcon,
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  XMarkIcon,
  Square3Stack3DIcon,
} from '@heroicons/react/24/outline';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import { CollectionService } from '@/features/collections/services/collectionService';
import { useToast } from '@/features/ui/hooks/useToast';
import { collectionTitleToSlug } from '@/features/collections/collectionSlug';
import type { Collection, CreateCollectionData } from '@/types/collection';

const COMMON_EMOJIS = [
  '📍', '❤️', '👍', '😊', '🎉',
  '🔥', '⭐', '💯', '🎯', '✨',
  '🚀', '💪', '🎨', '🏆', '🌟',
  '💡', '🎪', '🎭', '🎬', '🎵',
  '🏠', '🌲', '🌊', '⛰️', '🌅',
  '🍕', '☕', '🎸', '📷', '🎨'
];

export default function CollectionsSettingsClient() {
  const { account } = useSettings();
  const { success, error: showError } = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    emoji: '',
    title: '',
    description: '',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    emoji: '📍',
    title: '',
    description: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerFor, setEmojiPickerFor] = useState<'create' | string | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (account?.id) {
      fetchCollections();
    }
  }, [account?.id]);

  const fetchCollections = async () => {
    if (!account?.id) return;
    setLoading(true);
    try {
      const data = await CollectionService.getCollections(account.id);
      setCollections(data);
    } catch (err) {
      console.error('Error fetching collections:', err);
      showError('Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!account?.id || !createForm.title.trim()) return;
    
    setIsSaving(true);
    try {
      const data: CreateCollectionData = {
        emoji: createForm.emoji || '📍',
        title: createForm.title.trim(),
        description: createForm.description.trim() || null,
      };
      
      await CollectionService.createCollection(data);
      success('Collection created');
      setCreateForm({ emoji: '📍', title: '', description: '' });
      setIsCreating(false);
      fetchCollections();
    } catch (err: any) {
      console.error('Error creating collection:', err);
      showError(err.message || 'Failed to create collection');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async (collectionId: string) => {
    if (!editForm.title.trim()) return;
    
    setIsSaving(true);
    try {
      const data: CreateCollectionData = {
        emoji: editForm.emoji || '📍',
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
      };
      
      await CollectionService.updateCollection(collectionId, data);
      success('Collection updated');
      setEditingId(null);
      setEditForm({ emoji: '', title: '', description: '' });
      fetchCollections();
    } catch (err: any) {
      console.error('Error updating collection:', err);
      showError(err.message || 'Failed to update collection');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (collectionId: string) => {
    if (!confirm('Are you sure you want to delete this collection? Pins in this collection will be unassigned.')) {
      return;
    }
    
    setDeletingId(collectionId);
    try {
      await CollectionService.deleteCollection(collectionId);
      success('Collection deleted');
      fetchCollections();
    } catch (err: any) {
      console.error('Error deleting collection:', err);
      showError(err.message || 'Failed to delete collection');
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (collection: Collection) => {
    setEditingId(collection.id);
    setEditForm({
      emoji: collection.emoji || '📍',
      title: collection.title,
      description: collection.description || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ emoji: '', title: '', description: '' });
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
        setEmojiPickerFor(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  return (
    <div className="space-y-3">
      {/* Collections List */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="flex items-center justify-between px-[10px] py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Collections</h3>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            <PlusIcon className="w-3 h-3" />
            <span>Create</span>
          </button>
        </div>
        
        {loading ? (
          <div className="px-[10px] py-4 text-xs text-gray-500">Loading...</div>
        ) : collections.length === 0 ? (
          <div className="px-[10px] py-4 text-xs text-gray-500">
            <div className="flex flex-col items-center justify-center py-8">
              <Square3Stack3DIcon className="w-8 h-8 text-gray-300 mb-2" />
              <p>No collections yet.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-[10px] py-2 font-semibold text-gray-900">Emoji</th>
                  <th className="text-left px-[10px] py-2 font-semibold text-gray-900">Title</th>
                  <th className="text-left px-[10px] py-2 font-semibold text-gray-900">Description</th>
                  <th className="text-left px-[10px] py-2 font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((collection) => (
                  <tr key={collection.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
                    <td className="px-[10px] py-2">
                      {editingId === collection.id ? (
                        <div className="relative">
                          <button
                            onClick={() => {
                              setShowEmojiPicker(true);
                              setEmojiPickerFor(collection.id);
                            }}
                            className="text-lg"
                          >
                            {editForm.emoji}
                          </button>
                          {showEmojiPicker && emojiPickerFor === collection.id && (
                            <div
                              ref={emojiPickerRef}
                              className="absolute z-10 bg-white border border-gray-200 rounded-md p-2 shadow-lg grid grid-cols-6 gap-1 max-h-48 overflow-y-auto"
                            >
                              {COMMON_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => {
                                    setEditForm({ ...editForm, emoji });
                                    setShowEmojiPicker(false);
                                    setEmojiPickerFor(null);
                                  }}
                                  className="text-lg hover:bg-gray-100 rounded p-1"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-lg">{collection.emoji || '📍'}</span>
                      )}
                    </td>
                    <td className="px-[10px] py-2">
                      {editingId === collection.id ? (
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                          placeholder="Collection title"
                        />
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-900">{collection.title}</span>
                          {account?.username && (
                            <Link
                              href={`/${encodeURIComponent(account.username)}/${encodeURIComponent(collectionTitleToSlug(collection.title))}`}
                              className="text-gray-400 hover:text-gray-600"
                              target="_blank"
                            >
                              <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-[10px] py-2 text-gray-600">
                      {editingId === collection.id ? (
                        <input
                          type="text"
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                          placeholder="Description (optional)"
                        />
                      ) : (
                        <span className="truncate block max-w-xs">{collection.description || '-'}</span>
                      )}
                    </td>
                    <td className="px-[10px] py-2">
                      {editingId === collection.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(collection.id)}
                            disabled={isSaving || !editForm.title.trim()}
                            className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <CheckIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={isSaving}
                            className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(collection)}
                            className="p-1 text-gray-600 hover:text-gray-900"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(collection.id)}
                            disabled={deletingId === collection.id}
                            className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Collection Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md p-[10px] w-full max-w-md">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Create Collection</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Emoji</label>
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowEmojiPicker(true);
                      setEmojiPickerFor('create');
                    }}
                    className="text-2xl px-2 py-1 border border-gray-300 rounded"
                  >
                    {createForm.emoji}
                  </button>
                  {showEmojiPicker && emojiPickerFor === 'create' && (
                    <div
                      ref={emojiPickerRef}
                      className="absolute z-10 bg-white border border-gray-200 rounded-md p-2 shadow-lg grid grid-cols-6 gap-1 max-h-48 overflow-y-auto mt-1"
                    >
                      {COMMON_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            setCreateForm({ ...createForm, emoji });
                            setShowEmojiPicker(false);
                            setEmojiPickerFor(null);
                          }}
                          className="text-lg hover:bg-gray-100 rounded p-1"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Title *</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                  placeholder="Collection title"
                />
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Description</label>
                <input
                  type="text"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                  placeholder="Description (optional)"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setIsCreating(false);
                  setCreateForm({ emoji: '📍', title: '', description: '' });
                }}
                disabled={isSaving}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isSaving || !createForm.title.trim()}
                className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
