'use client';

import { useState, useEffect, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { MentionService } from '@/features/mentions/services/mentionService';
import type { Mention } from '@/types/mention';
import { CollectionService } from '@/features/collections/services/collectionService';
import type { Collection } from '@/types/collection';
import { useAuthStateSafe } from '@/features/auth';
import { useToast } from '@/features/ui/hooks/useToast';

interface EditMentionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mentionId: string | null;
  onMentionUpdated?: () => void;
}

export default function EditMentionModal({
  isOpen,
  onClose,
  mentionId,
  onMentionUpdated,
}: EditMentionModalProps) {
  const { activeAccountId } = useAuthStateSafe();
  const { success, error: showError } = useToast();
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mention, setMention] = useState<Mention | null>(null);
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [loadingCollections, setLoadingCollections] = useState(false);

  // Load collections
  const loadCollections = useCallback(async () => {
    if (!activeAccountId) {
      setCollections([]);
      return;
    }

    setLoadingCollections(true);
    try {
      const data = await CollectionService.getCollections(activeAccountId);
      setCollections(data);
    } catch (err) {
      console.error('[EditMentionModal] Error loading collections:', err);
    } finally {
      setLoadingCollections(false);
    }
  }, [activeAccountId]);

  // Load collections when account is available and modal opens
  useEffect(() => {
    if (isOpen && activeAccountId) {
      loadCollections();
    }
  }, [isOpen, activeAccountId, loadCollections]);

  // Load mention data when modal opens
  useEffect(() => {
    if (isOpen && mentionId) {
      loadMention();
    } else {
      setMention(null);
      setDescription('');
      setSelectedCollectionId(null);
      setError(null);
    }
  }, [isOpen, mentionId]);

  const loadMention = async () => {
    if (!mentionId) return;

    setLoading(true);
    try {
      const mentions = await MentionService.getMentions({ account_id: activeAccountId || undefined });
      const foundMention = mentions.find(m => m.id === mentionId);
      
      if (foundMention) {
        setMention(foundMention);
        setDescription(foundMention.description || '');
        setSelectedCollectionId(foundMention.collection_id || null);
      } else {
        setError('Mention not found');
      }
    } catch (err) {
      console.error('[EditMentionModal] Error loading mention:', err);
      setError('Failed to load mention');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mentionId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await MentionService.updateMention(mentionId, {
        description: description.trim() || null,
        collection_id: selectedCollectionId,
      });

      success('Updated', 'Mention updated successfully');
      onMentionUpdated?.();
      onClose();
    } catch (err: any) {
      console.error('[EditMentionModal] Error updating mention:', err);
      setError(err.message || 'Failed to update mention');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Edit Mention</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="text-xs text-gray-500 py-4 text-center">Loading...</div>
          ) : error && !mention ? (
            <div className="text-xs text-red-600 py-4 text-center">{error}</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 resize-none"
                  placeholder="What makes this place special?"
                />
              </div>

              {/* Collection */}
              {!loadingCollections && collections.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Collection
                  </label>
                  <select
                    value={selectedCollectionId || ''}
                    onChange={(e) => setSelectedCollectionId(e.target.value || null)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                  >
                    <option value="">No collection</option>
                    {collections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.emoji} {collection.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="text-xs text-red-600">{error}</div>
              )}

              {/* Submit button */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
