'use client';

import { useState, useEffect } from 'react';
import { CollectionService } from '@/features/collections/services/collectionService';
import type { Collection } from '@/types/collection';

interface CollectionsListProps {
  accountId: string;
  isOwner: boolean;
  darkMode?: boolean;
  onCollectionClick?: (collection: Collection) => void;
}

/**
 * Collections list component for viewing collections
 * - Owner: Shows full management (uses CollectionsManagement)
 * - Viewer: Shows read-only list, clickable to filter
 */
export default function CollectionsList({ accountId, isOwner, darkMode = false, onCollectionClick }: CollectionsListProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCollections = async () => {
      try {
        setLoading(true);
        const data = await CollectionService.getCollections(accountId);
        setCollections(data);
      } catch (err) {
        console.error('Error loading collections:', err);
      } finally {
        setLoading(false);
      }
    };

    if (accountId) {
      loadCollections();
    }
  }, [accountId]);

  if (loading) {
    return (
      <div className={`text-xs py-3 ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>
        Loading collections...
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className={`text-xs py-3 ${darkMode ? 'text-white/60' : 'text-gray-500'}`}>
        No collections yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {collections.map((collection) => (
        <button
          key={collection.id}
          onClick={() => onCollectionClick?.(collection)}
          className={`w-full flex items-start gap-2 p-2 rounded-md transition-colors text-left ${
            darkMode
              ? 'hover:bg-white/10 border border-white/20'
              : 'hover:bg-gray-50 border border-gray-200'
          }`}
        >
          <span className="text-xl flex-shrink-0">{collection.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-semibold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {collection.title}
            </div>
            {collection.description && (
              <div className={`text-xs truncate ${darkMode ? 'text-white/70' : 'text-gray-600'}`}>
                {collection.description}
              </div>
            )}
            <div className={`text-[10px] mt-0.5 ${darkMode ? 'text-white/50' : 'text-gray-500'}`}>
              {collection.mention_count || 0} {collection.mention_count === 1 ? 'mention' : 'mentions'}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
