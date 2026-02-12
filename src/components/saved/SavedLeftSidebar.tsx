'use client';

import { useState } from 'react';
import { 
  BookmarkIcon,
  MapPinIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  PhotoIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkIconSolid } from '@heroicons/react/24/solid';

/**
 * Left Sidebar for Saved page
 * Filters by content type, collections, search
 */
export default function SavedLeftSidebar() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);

  const contentTypes = [
    { id: 'all', label: 'All Saved', icon: BookmarkIconSolid, count: 127 },
    { id: 'pins', label: 'Pins', icon: MapPinIcon, count: 45 },
    { id: 'posts', label: 'Posts', icon: DocumentTextIcon, count: 38 },
    { id: 'mentions', label: 'Mentions', icon: ChatBubbleLeftRightIcon, count: 24 },
    { id: 'photos', label: 'Photos', icon: PhotoIcon, count: 20 },
  ];

  const collections = [
    { id: '1', name: 'Favorite Places', count: 18, icon: '📍' },
    { id: '2', name: 'Inspiration', count: 12, icon: '✨' },
    { id: '3', name: 'To Visit', count: 25, icon: '🗺️' },
    { id: '4', name: 'Recipes', count: 8, icon: '🍽️' },
    { id: '5', name: 'Stories', count: 15, icon: '📖' },
  ];

  const sortOptions = [
    { id: 'recent', label: 'Recently Saved' },
    { id: 'oldest', label: 'Oldest First' },
    { id: 'popular', label: 'Most Popular' },
  ];

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Search */}
      <div className="p-3 border-b border-white/10">
        <div className="relative">
          <input
            type="text"
            placeholder="Search saved items..."
            className="w-full h-9 px-3 pl-9 bg-surface-accent rounded-lg text-sm text-white placeholder:text-white/60 border-none focus:outline-none focus:ring-2 focus:ring-lake-blue"
          />
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
        </div>
      </div>

      {/* Content Types */}
      <div className="p-3 space-y-1">
        <h3 className="text-xs font-semibold text-white/60 mb-2 px-2">Content Type</h3>
        {contentTypes.map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id === selectedType ? null : type.id)}
              className={`w-full flex items-center justify-between gap-3 px-2 py-2 text-sm rounded-md transition-colors ${
                selectedType === type.id
                  ? 'bg-surface-accent text-white'
                  : 'text-white/70 hover:bg-surface-accent hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" />
                <span>{type.label}</span>
              </div>
              <span className="text-xs text-white/50">{type.count}</span>
            </button>
          );
        })}
      </div>

      {/* Collections */}
      <div className="px-3 pt-3 border-t border-white/10">
        <div className="flex items-center justify-between px-2 mb-2">
          <h3 className="text-xs font-semibold text-white/60">Collections</h3>
          <button className="text-xs text-white/50 hover:text-white/70">
            + New
          </button>
        </div>
        <div className="space-y-1">
          {collections.map((collection) => (
            <button
              key={collection.id}
              onClick={() => setSelectedCollection(collection.id === selectedCollection ? null : collection.id)}
              className={`w-full flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors ${
                selectedCollection === collection.id
                  ? 'bg-surface-accent text-white'
                  : 'text-white/70 hover:bg-surface-accent hover:text-white'
              }`}
            >
              <span className="text-lg">{collection.icon}</span>
              <span className="flex-1 text-left truncate">{collection.name}</span>
              <span className="text-xs text-white/50">{collection.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sort Options */}
      <div className="px-3 pt-3 border-t border-white/10">
        <h3 className="text-xs font-semibold text-white/60 mb-2 px-2">Sort By</h3>
        <div className="space-y-1">
          {sortOptions.map((option) => (
            <button
              key={option.id}
              className="w-full text-left px-2 py-1.5 text-sm rounded-md text-white/70 hover:bg-surface-accent hover:text-white transition-colors"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-auto px-3 pt-3 border-t border-white/10">
        <div className="bg-surface-accent rounded-md p-3">
          <div className="text-xs text-white/60 mb-1">Total Saved</div>
          <div className="text-2xl font-bold text-white">127</div>
          <div className="text-xs text-white/50 mt-1">items from community</div>
        </div>
      </div>
    </div>
  );
}
