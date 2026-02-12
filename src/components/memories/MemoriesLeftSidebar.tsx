'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  PhotoIcon,
  MapPinIcon,
  CalendarIcon,
  TagIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';

/**
 * Left Sidebar for Memories page
 * Collections, filters, search, view options
 */
export default function MemoriesLeftSidebar() {
  const pathname = usePathname();
  const { account } = useAuthStateSafe();
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  const collections = [
    { id: '1', name: 'Lake Superior', count: 24, icon: '🌊' },
    { id: '2', name: 'State Fair', count: 18, icon: '🎡' },
    { id: '3', name: 'North Woods', count: 32, icon: '🌲' },
    { id: '4', name: 'Twin Cities', count: 45, icon: '🏙️' },
    { id: '5', name: 'Family', count: 67, icon: '👨‍👩‍👧‍👦' },
  ];

  const filters = [
    { id: 'recent', label: 'Recent', icon: CalendarIcon },
    { id: 'locations', label: 'By Location', icon: MapPinIcon },
    { id: 'tags', label: 'By Tag', icon: TagIcon },
    { id: 'year', label: 'By Year', icon: CalendarIcon },
  ];

  const viewOptions = [
    { id: 'timeline', label: 'Timeline', icon: CalendarIcon },
    { id: 'grid', label: 'Grid', icon: PhotoIcon },
    { id: 'map', label: 'Map', icon: MapPinIcon },
  ];

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Search */}
      <div className="p-3 border-b border-white/10">
        <div className="relative">
          <input
            type="text"
            placeholder="Search memories..."
            className="w-full h-9 px-3 pl-9 bg-surface-accent rounded-lg text-sm text-white placeholder:text-white/60 border-none focus:outline-none focus:ring-2 focus:ring-lake-blue"
          />
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
        </div>
      </div>

      {/* Collections */}
      <div className="p-3 space-y-1">
        <div className="flex items-center justify-between px-2 mb-2">
          <h3 className="text-xs font-semibold text-white/60">Collections</h3>
          <button className="text-xs text-white/50 hover:text-white/70">
            + New
          </button>
        </div>
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

      {/* Filters */}
      <div className="px-3 pt-3 border-t border-white/10">
        <h3 className="text-xs font-semibold text-white/60 mb-2 px-2">Filters</h3>
        <div className="space-y-1">
          {filters.map((filter) => {
            const Icon = filter.icon;
            return (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id === selectedFilter ? null : filter.id)}
                className={`w-full flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors ${
                  selectedFilter === filter.id
                    ? 'bg-surface-accent text-white'
                    : 'text-white/70 hover:bg-surface-accent hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{filter.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* View Options */}
      <div className="px-3 pt-3 border-t border-white/10">
        <h3 className="text-xs font-semibold text-white/60 mb-2 px-2">View</h3>
        <div className="space-y-1">
          {viewOptions.map((view) => {
            const Icon = view.icon;
            return (
              <button
                key={view.id}
                className="w-full flex items-center gap-3 px-2 py-2 text-sm rounded-md text-white/70 hover:bg-surface-accent hover:text-white transition-colors"
              >
                <Icon className="w-5 h-5" />
                <span>{view.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Analytics (Admin only) */}
      {account?.role === 'admin' && (
        <div className="px-3 pt-3 border-t border-white/10">
          <Link
            href="/analytics"
            className={`w-full flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors ${
              pathname === '/analytics' || pathname?.startsWith('/analytics')
                ? 'bg-surface-accent text-white'
                : 'text-white/70 hover:bg-surface-accent hover:text-white'
            }`}
          >
            <ChartBarIcon className="w-5 h-5" />
            <span>Analytics</span>
          </Link>
        </div>
      )}

      {/* Upload Button */}
      <div className="px-3 pt-3 border-t border-white/10">
        <button className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-sm font-medium">
          <PhotoIcon className="w-5 h-5" />
          <span>Upload Memory</span>
        </button>
      </div>
    </div>
  );
}
