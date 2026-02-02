'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { CollectionService } from '@/features/collections/services/collectionService';
import { collectionTitleToSlug } from '@/features/collections/collectionSlug';
import type { Collection } from '@/types/collection';
import type { UpdateCollectionData } from '@/types/collection';
import { useToast } from '@/features/ui/hooks/useToast';

interface CollectionPageHeaderProps {
  collection: Collection;
  username: string;
  isOwnProfile: boolean;
  showTitle?: boolean;
}

export default function CollectionPageHeader({ collection, username, isOwnProfile, showTitle = true }: CollectionPageHeaderProps) {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editEmoji, setEditEmoji] = useState(collection.emoji);
  const [editTitle, setEditTitle] = useState(collection.title);
  const [editDescription, setEditDescription] = useState(collection.description ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const openEditModal = () => {
    setEditEmoji(collection.emoji);
    setEditTitle(collection.title);
    setEditDescription(collection.description ?? '');
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (!saving) setEditModalOpen(false);
  };

  const handleSave = async () => {
    if (!editTitle.trim()) {
      showError('Error', 'Title is required');
      return;
    }
    setSaving(true);
    try {
      const data: UpdateCollectionData = {
        emoji: editEmoji || '📍',
        title: editTitle.trim(),
        description: editDescription.trim() || null,
      };
      await CollectionService.updateCollection(collection.id, data);
      setEditModalOpen(false);
      success('Updated', 'Collection updated');
      const newSlug = collectionTitleToSlug(editTitle.trim());
      if (newSlug !== collectionTitleToSlug(collection.title)) {
        router.replace(`/${encodeURIComponent(username)}/${encodeURIComponent(newSlug)}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'Failed to update collection');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this collection? Pins will be unassigned.')) return;
    setDeleting(true);
    try {
      await CollectionService.deleteCollection(collection.id);
      success('Deleted', 'Collection deleted');
      router.replace(`/${encodeURIComponent(username)}`);
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'Failed to delete collection');
    } finally {
      setDeleting(false);
    }
  };

  const editButtons = isOwnProfile ? (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button
        type="button"
        onClick={openEditModal}
        disabled={saving || deleting}
        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
        aria-label="Edit collection"
      >
        <PencilIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={saving || deleting}
        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
        aria-label="Delete collection"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  ) : null;

  if (!showTitle) {
    return (
      <>
        {editButtons}
        {editModalOpen &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50"
              onClick={closeEditModal}
              onKeyDown={(e) => e.key === 'Escape' && closeEditModal()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-collection-title"
            >
              <div
                className="bg-white border border-gray-200 rounded-md w-full max-w-sm shadow-lg overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.key === 'Escape' && closeEditModal()}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                  <h2 id="edit-collection-title" className="text-sm font-semibold text-gray-900">
                    Edit collection
                  </h2>
                  <button
                    type="button"
                    onClick={closeEditModal}
                    disabled={saving}
                    className="p-1 -m-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 rounded transition-colors"
                    aria-label="Close"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <div className="flex gap-2 items-end">
                    <div className="w-14 flex-shrink-0">
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">Emoji</label>
                      <input
                        type="text"
                        value={editEmoji}
                        onChange={(e) => setEditEmoji(e.target.value.slice(0, 2))}
                        className="w-full h-9 px-2 text-center text-base border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                        maxLength={2}
                        placeholder="📍"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">Title</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full h-9 px-2.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 placeholder:text-gray-400"
                        placeholder="Collection name"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Description (optional)</label>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full h-9 px-2.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 placeholder:text-gray-400"
                      placeholder="Short description"
                    />
                  </div>
                </div>
                <div className="flex gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    disabled={saving}
                    className="flex-1 h-9 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !editTitle.trim()}
                    className="flex-1 h-9 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </>
    );
  }

  return (
    <>
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg flex-shrink-0">{collection.emoji}</span>
          <h2 className="text-lg font-semibold text-gray-900 truncate">{collection.title}</h2>
        </div>
        {editButtons}
      </div>

      {editModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50"
            onClick={closeEditModal}
            onKeyDown={(e) => e.key === 'Escape' && closeEditModal()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-collection-title"
          >
            <div
              className="bg-white border border-gray-200 rounded-md w-full max-w-sm shadow-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.key === 'Escape' && closeEditModal()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h2 id="edit-collection-title" className="text-sm font-semibold text-gray-900">
                  Edit collection
                </h2>
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={saving}
                  className="p-1 -m-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 rounded transition-colors"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 py-3 space-y-3">
                <div className="flex gap-2 items-end">
                  <div className="w-14 flex-shrink-0">
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Emoji</label>
                    <input
                      type="text"
                      value={editEmoji}
                      onChange={(e) => setEditEmoji(e.target.value.slice(0, 2))}
                      className="w-full h-9 px-2 text-center text-base border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                      maxLength={2}
                      placeholder="📍"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full h-9 px-2.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 placeholder:text-gray-400"
                      placeholder="Collection name"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 placeholder:text-gray-400"
                    placeholder="Short description"
                  />
                </div>
              </div>
              <div className="flex gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={saving}
                  className="flex-1 h-9 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !editTitle.trim()}
                  className="flex-1 h-9 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
