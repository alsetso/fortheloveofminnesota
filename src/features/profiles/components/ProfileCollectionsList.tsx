'use client';

import { useState, useEffect } from 'react';
import { PencilIcon, CheckIcon, XMarkIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import { CollectionService } from '@/features/collections/services/collectionService';
import { useToast } from '@/features/ui/hooks/useToast';
import { supabase } from '@/lib/supabase';
import type { Collection, CreateCollectionData } from '@/types/collection';

interface ProfileCollectionsListProps {
  accountId: string;
  isOwnProfile: boolean;
  onCollectionUpdated?: () => void;
  selectedCollectionId?: string | null;
  onCollectionClick?: (collectionId: string | null) => void;
}

export default function ProfileCollectionsList({
  accountId,
  isOwnProfile,
  onCollectionUpdated,
  selectedCollectionId = null,
  onCollectionClick,
}: ProfileCollectionsListProps) {
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
  const { success, error: showError } = useToast();

  useEffect(() => {
    loadCollections();
    if (isOwnProfile) {
      loadAccountPlan();
    }
  }, [accountId, isOwnProfile]);

  const loadAccountPlan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: account } = await supabase
        .from('accounts')
        .select('plan')
        .eq('user_id', user.id)
        .single();

      if (account) {
        const plan = (account as { plan: string | null }).plan || 'hobby';
        setMaxCollections(plan === 'pro' ? 10 : 3);
      }
    } catch (err) {
      console.error('Error loading account plan:', err);
    }
  };

  const loadCollections = async () => {
    try {
      setLoading(true);
      const data = await CollectionService.getCollections(accountId);
      setCollections(data);
    } catch (err) {
      console.error('Error loading collections:', err);
      showError('Error', 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

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
      onCollectionUpdated?.();
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
      onCollectionUpdated?.();
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
      onCollectionUpdated?.();
    } catch (err) {
      console.error('Error deleting collection:', err);
      showError('Error', 'Failed to delete collection');
    } finally {
      setDeletingId(null);
    }
  };

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Collections</h3>
          {isOwnProfile && maxCollections !== null && (
            <div className="text-[10px] text-gray-500 mt-0.5">
              {collections.length} / {maxCollections}
            </div>
          )}
        </div>
        {isOwnProfile && canCreateMore && (
          <button
            onClick={startCreating}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Create collection"
          >
            <PlusIcon className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      {/* Upgrade CTA when at limit */}
      {isOwnProfile && isAtLimit && (
        <div className="border border-gray-200 rounded-md p-[10px] bg-gray-50">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-gray-900">Collection limit reached</div>
            <div className="text-[10px] text-gray-600">
              {maxCollections === 3 
                ? 'Hobby plan allows 3 collections. Upgrade to Pro for 10 collections.'
                : 'Pro plan allows 10 collections.'}
            </div>
            {maxCollections === 3 && (
              <button
                onClick={handleUpgrade}
                className="w-full px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 transition-colors"
              >
                Upgrade to Pro
              </button>
            )}
          </div>
        </div>
      )}

      {collections.length === 0 && !isCreating ? (
        <div className="text-xs text-gray-500 py-3">
          {isOwnProfile ? 'No collections yet. Create one to organize your mentions.' : 'No collections.'}
        </div>
      ) : (
        <div className="space-y-2">
          {isCreating && (
            <div className="border border-gray-200 rounded-md p-[10px] bg-white">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editData.emoji}
                    onChange={(e) => setEditData(prev => ({ ...prev, emoji: e.target.value }))}
                    placeholder="📍"
                    className="w-8 text-center text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    maxLength={2}
                  />
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
                    className="p-0.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                  >
                    <CheckIcon className="w-3 h-3 text-gray-600" />
                  </button>
                  <button
                    onClick={cancelCreating}
                    className="p-0.5 hover:bg-gray-100 rounded transition-colors"
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
              className={`border rounded-md p-[10px] bg-white hover:bg-gray-50 transition-colors ${
                selectedCollectionId === collection.id
                  ? 'border-gray-900'
                  : 'border-gray-200'
              }`}
            >
              {editingId === collection.id ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editData.emoji}
                      onChange={(e) => setEditData(prev => ({ ...prev, emoji: e.target.value }))}
                      placeholder="📍"
                      className="w-8 text-center text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
                      maxLength={2}
                    />
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
                      className="p-0.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                    >
                      <CheckIcon className="w-3 h-3 text-gray-600" />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                    >
                      <XMarkIcon className="w-3 h-3 text-gray-600" />
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className="group cursor-pointer"
                  onClick={() => onCollectionClick?.(collection.id)}
                >
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
                    {isOwnProfile && (
                      <div 
                        className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => startEditing(collection)}
                          className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                          title="Edit collection"
                        >
                          <PencilIcon className="w-3 h-3 text-gray-400" />
                        </button>
                        <button
                          onClick={() => deleteCollection(collection.id)}
                          disabled={deletingId === collection.id}
                          className="p-0.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                          title="Delete collection"
                        >
                          {deletingId === collection.id ? (
                            <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <TrashIcon className="w-3 h-3 text-gray-400" />
                          )}
                        </button>
                      </div>
                    )}
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

