'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { PencilIcon, CheckIcon, XMarkIcon, TrashIcon, PlusIcon, UserIcon } from '@heroicons/react/24/outline';
import { CollectionService } from '@/features/collections/services/collectionService';
import { useToast } from '@/features/ui/hooks/useToast';
import { supabase } from '@/lib/supabase';
import { useAuthStateSafe } from '@/features/auth';
import type { Collection, CreateCollectionData } from '@/types/collection';

const COMMON_EMOJIS = [
  '📍', '❤️', '👍', '😊', '🎉',
  '🔥', '⭐', '💯', '🎯', '✨',
  '🚀', '💪', '🎨', '🏆', '🌟',
  '💡', '🎪', '🎭', '🎬', '🎵',
  '🏠', '🌲', '🌊', '⛰️', '🌅',
  '🍕', '☕', '🎸', '📷', '🎨'
];

/**
 * Collections management component for bottom button popup
 * Allows creating, editing, and deleting collections
 */
export default function CollectionsManagement() {
  const { account } = useAuthStateSafe();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxCollections, setMaxCollections] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ emoji: string; title: string; description: string }>({
    emoji: '📍',
    title: '',
    description: '',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerFor, setEmojiPickerFor] = useState<'create' | string | null>(null);
  const [customEmojiInput, setCustomEmojiInput] = useState('');
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const createEmojiButtonRef = useRef<HTMLButtonElement>(null);
  const editEmojiButtonRef = useRef<HTMLButtonElement>(null);
  const { success, error: showError } = useToast();

  // Close emoji picker when clicking outside
  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      const clickedButton = 
        (createEmojiButtonRef.current && createEmojiButtonRef.current.contains(e.target as Node)) ||
        (editEmojiButtonRef.current && editEmojiButtonRef.current.contains(e.target as Node));
      
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node) &&
        !clickedButton
      ) {
        setShowEmojiPicker(false);
        setEmojiPickerFor(null);
        setCustomEmojiInput('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  const loadAccountPlan = useCallback(async () => {
    if (!account) return;
    try {
      const plan = account.plan || 'hobby';
      setMaxCollections((plan === 'contributor' || plan === 'plus') ? null : 3); // null means unlimited for Contributor
    } catch (err) {
      console.error('Error loading account plan:', err);
    }
  }, [account]);

  const loadCollections = useCallback(async () => {
    if (!account) return;
    try {
      setLoading(true);
      const data = await CollectionService.getCollections(account.id);
      setCollections(data);
    } catch (err) {
      console.error('Error loading collections:', err);
      showError('Error', 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, [account, showError]);

  useEffect(() => {
    if (account) {
      loadCollections();
      loadAccountPlan();
    }
  }, [account, loadCollections, loadAccountPlan]);


  const startEditing = (collection: Collection) => {
    setEditingId(collection.id);
    setEditData({
      emoji: collection.emoji,
      title: collection.title,
      description: collection.description || '',
    });
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditData({
      emoji: '📍',
      title: '',
      description: '',
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData({ emoji: '📍', title: '', description: '' });
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setEditData({ emoji: '📍', title: '', description: '' });
  };

  const saveCollection = async (collectionId: string) => {
    if (isSaving) return;
    if (!editData.title.trim()) {
      showError('Error', 'Title is required');
      return;
    }

    setIsSaving(true);
    try {
      await CollectionService.updateCollection(collectionId, {
        emoji: editData.emoji,
        title: editData.title.trim(),
        description: editData.description.trim() || null,
      });
      setEditingId(null);
      setEditData({ emoji: '📍', title: '', description: '' });
      await loadCollections();
      success('Updated', 'Collection updated');
    } catch (err) {
      console.error('Error updating collection:', err);
      showError('Error', 'Failed to update collection');
    } finally {
      setIsSaving(false);
    }
  };

  const createCollection = async () => {
    if (isSaving) return;
    if (!editData.title.trim()) {
      showError('Error', 'Title is required');
      return;
    }

    setIsSaving(true);
    try {
      await CollectionService.createCollection({
        emoji: editData.emoji,
        title: editData.title.trim(),
        description: editData.description.trim() || null,
      });
      setIsCreating(false);
      setEditData({ emoji: '📍', title: '', description: '' });
      await loadCollections();
      success('Created', 'Collection created');
    } catch (err: any) {
      console.error('Error creating collection:', err);
      const errorMessage = err?.message || 'Failed to create collection';
      showError('Error', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCollection = async (collectionId: string) => {
    if (!confirm('Are you sure you want to delete this collection? Mentions in this collection will not be deleted.')) {
      return;
    }

    if (deletingId) return;
    setDeletingId(collectionId);

    try {
      await CollectionService.deleteCollection(collectionId);
      await loadCollections();
      success('Deleted', 'Collection deleted');
    } catch (err) {
      console.error('Error deleting collection:', err);
      showError('Error', 'Failed to delete collection');
    } finally {
      setDeletingId(null);
    }
  };

  if (!account) {
    return (
      <div className="text-xs text-gray-500 py-3">Please sign in to manage collections.</div>
    );
  }

  if (loading) {
    return (
      <div className="text-xs text-gray-500 py-3">Loading collections...</div>
    );
  }

  const canCreateMore = maxCollections === null || collections.length < maxCollections;
  const isAtLimit = maxCollections !== null && collections.length >= maxCollections;

  const handleUpgrade = async () => {
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Error creating checkout session:', err);
      showError('Error', err instanceof Error ? err.message : 'Failed to start checkout');
    }
  };

  const openEmojiPicker = (forId: 'create' | string) => {
    setEmojiPickerFor(forId);
    setShowEmojiPicker(true);
    setCustomEmojiInput('');
  };

  const selectEmoji = (emoji: string) => {
    if (emojiPickerFor === 'create') {
      setEditData(prev => ({ ...prev, emoji }));
    } else if (emojiPickerFor) {
      setEditData(prev => ({ ...prev, emoji }));
    }
    setShowEmojiPicker(false);
    setEmojiPickerFor(null);
    setCustomEmojiInput('');
  };

  const handleCustomEmojiSubmit = () => {
    if (customEmojiInput.trim()) {
      selectEmoji(customEmojiInput.trim());
    }
  };

  return (
    <div className="space-y-3">
      {/* Account info with + button */}
      <div className="flex items-center justify-between">
        {account && (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200 flex-shrink-0">
              {account.image_url ? (
                <Image
                  src={account.image_url}
                  alt={account.username || 'Account'}
                  width={20}
                  height={20}
                  className="w-full h-full object-cover"
                  unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
                />
              ) : (
                <UserIcon className="w-3 h-3 text-gray-500" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              {account.username && (
                <span className="text-xs font-medium text-gray-900 truncate">
                  @{account.username}
                </span>
              )}
              {maxCollections !== null && (
                <div className="text-[10px] text-gray-500">
                  {collections.length} / {maxCollections}
                </div>
              )}
            </div>
          </div>
        )}
        {canCreateMore && (
          <button
            onClick={startCreating}
            className="p-1 hover:bg-gray-100 rounded transition-colors flex items-center justify-center flex-shrink-0"
            title="Create collection"
          >
            <PlusIcon className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      {/* Upgrade CTA when at limit */}
      {isAtLimit && (
        <div className="border border-gray-200 rounded-md p-[10px] bg-gray-50">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-gray-900">Collection limit reached</div>
            <div className="text-[10px] text-gray-600">
              {maxCollections === 3 
                ? 'Hobby plan allows 3 collections. Upgrade to Contributor for unlimited collections.'
                : 'Contributor plan allows unlimited collections.'}
            </div>
            {maxCollections === 3 && (
              <button
                onClick={handleUpgrade}
                className="w-full px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 transition-colors"
              >
                Upgrade to Contributor
              </button>
            )}
          </div>
        </div>
      )}

      {collections.length === 0 && !isCreating ? (
        <div className="text-xs text-gray-500 py-3">
          No collections yet. Create one to organize your mentions.
        </div>
      ) : (
        <div className="space-y-2">
          {isCreating && (
            <div className="border border-gray-200 rounded-md p-[10px] bg-white">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      ref={createEmojiButtonRef}
                      type="button"
                      onClick={() => openEmojiPicker('create')}
                      className="w-8 h-8 text-center text-xs border border-gray-200 rounded px-1 py-0.5 hover:bg-gray-50 transition-colors flex items-center justify-center"
                    >
                      {editData.emoji || '📍'}
                    </button>
                    {showEmojiPicker && emojiPickerFor === 'create' && (
                      <div
                        ref={emojiPickerRef}
                        className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-md shadow-lg p-2"
                        style={{ minWidth: '240px' }}
                      >
                        <div className="space-y-2">
                          <div className="grid grid-cols-6 gap-1">
                            {COMMON_EMOJIS.map((emoji, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => selectEmoji(emoji)}
                                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded transition-colors"
                                aria-label={`Select emoji ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                          <div className="border-t border-gray-200 pt-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={customEmojiInput}
                                onChange={(e) => setCustomEmojiInput(e.target.value)}
                                placeholder="Enter emoji"
                                className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-400"
                                maxLength={2}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleCustomEmojiSubmit();
                                  }
                                }}
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={handleCustomEmojiSubmit}
                                className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={editData.title}
                    onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Collection title"
                    className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    autoFocus
                  />
                </div>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Description (optional)"
                  className="w-full text-xs text-gray-600 border border-gray-200 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
                  rows={2}
                />
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={createCollection}
                    disabled={isSaving || !editData.title.trim()}
                    className="p-0.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    <CheckIcon className="w-3 h-3 text-gray-600" />
                  </button>
                  <button
                    onClick={cancelCreating}
                    className="p-0.5 hover:bg-gray-100 rounded transition-colors flex items-center justify-center"
                  >
                    <XMarkIcon className="w-3 h-3 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {collections.map((collection) => (
            <div
              key={collection.id}
              className="border border-gray-200 rounded-md p-[10px] bg-white hover:bg-gray-50 transition-colors"
            >
              {editingId === collection.id ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        ref={editEmojiButtonRef}
                        type="button"
                        onClick={() => openEmojiPicker(collection.id)}
                        className="w-8 h-8 text-center text-xs border border-gray-200 rounded px-1 py-0.5 hover:bg-gray-50 transition-colors flex items-center justify-center"
                      >
                        {editData.emoji || '📍'}
                      </button>
                      {showEmojiPicker && emojiPickerFor === collection.id && (
                        <div
                          ref={emojiPickerRef}
                          className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-md shadow-lg p-2"
                          style={{ minWidth: '240px' }}
                        >
                          <div className="space-y-2">
                            <div className="grid grid-cols-6 gap-1">
                              {COMMON_EMOJIS.map((emoji, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => selectEmoji(emoji)}
                                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded transition-colors"
                                  aria-label={`Select emoji ${emoji}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                            <div className="border-t border-gray-200 pt-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={customEmojiInput}
                                  onChange={(e) => setCustomEmojiInput(e.target.value)}
                                  placeholder="Enter emoji"
                                  className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-400"
                                  maxLength={2}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleCustomEmojiSubmit();
                                    }
                                  }}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={handleCustomEmojiSubmit}
                                  className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      value={editData.title}
                      onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                      className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-400"
                      autoFocus
                    />
                  </div>
                  <textarea
                    value={editData.description}
                    onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Description (optional)"
                    className="w-full text-xs text-gray-600 border border-gray-200 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
                    rows={2}
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => saveCollection(collection.id)}
                      disabled={isSaving || !editData.title.trim()}
                      className="p-0.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      <CheckIcon className="w-3 h-3 text-gray-600" />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="p-0.5 hover:bg-gray-100 rounded transition-colors flex items-center justify-center"
                    >
                      <XMarkIcon className="w-3 h-3 text-gray-600" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <span className="text-sm flex-shrink-0">{collection.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-medium text-gray-900 truncate">{collection.title}</h4>
                        {collection.description && (
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{collection.description}</p>
                        )}
                      </div>
                    </div>
                    <div 
                      className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => startEditing(collection)}
                        className="p-0.5 hover:bg-gray-100 rounded transition-colors flex items-center justify-center"
                        title="Edit collection"
                      >
                        <PencilIcon className="w-3 h-3 text-gray-400" />
                      </button>
                      <button
                        onClick={() => deleteCollection(collection.id)}
                        disabled={deletingId === collection.id}
                        className="p-0.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 flex items-center justify-center"
                        title="Delete collection"
                      >
                        {deletingId === collection.id ? (
                          <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <TrashIcon className="w-3 h-3 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
