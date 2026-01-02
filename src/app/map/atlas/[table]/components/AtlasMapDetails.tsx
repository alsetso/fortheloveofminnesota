'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { AtlasType } from '@/features/atlas/services/atlasTypesService';
import AtlasMapEntityList from './AtlasMapEntityList';
import AtlasMapEntityDetail from './AtlasMapEntityDetail';

interface AtlasMapDetailsProps {
  atlasType: AtlasType;
  stats: { total: number; withCoords: number } | null;
  loading: boolean;
  selectedEntityId: string | null;
  onBackToList: () => void;
  viewStats: { total_views: number; unique_viewers: number } | null;
}

export default function AtlasMapDetails({
  atlasType,
  stats,
  loading,
  selectedEntityId,
  onBackToList,
  viewStats,
}: AtlasMapDetailsProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Show entity detail view if entity is selected
  if (selectedEntityId) {
    return (
      <AtlasMapEntityDetail
        tableName={atlasType.slug}
        entityId={selectedEntityId}
        onBack={onBackToList}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Atlas Type Info */}
      <div className="space-y-1.5">
        <h2 className="text-sm font-semibold text-gray-900">Atlas Details</h2>
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-1.5">
          <div className="flex items-center gap-2">
            {atlasType.icon_path && (
              <Image
                src={atlasType.icon_path}
                alt={atlasType.name}
                width={16}
                height={16}
                className="w-4 h-4 flex-shrink-0"
                unoptimized
              />
            )}
            <div className="flex-1">
              <div className="text-xs font-medium text-gray-900">{atlasType.name}</div>
              {atlasType.description && (
                <div className="text-xs text-gray-600 mt-0.5">{atlasType.description}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium text-gray-500">Statistics</div>
          <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Total Records</span>
              <span className="text-xs font-medium text-gray-900">{stats.total.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">With Coordinates</span>
              <span className="text-xs font-medium text-gray-900">{stats.withCoords.toLocaleString()}</span>
            </div>
            {viewStats && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Total Views</span>
                  <span className="text-xs font-medium text-gray-900">{viewStats.total_views.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Unique Viewers</span>
                  <span className="text-xs font-medium text-gray-900">{viewStats.unique_viewers.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-medium text-gray-500">Search</div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="w-3 h-3 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by name or city..."
            value={searchQuery}
            onChange={(e) => {
              const query = e.target.value;
              setSearchQuery(query);
              // Dispatch search event to map
              window.dispatchEvent(new CustomEvent('atlas-search', {
                detail: { query }
              }));
            }}
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
          />
        </div>
      </div>

      {/* Entity List */}
      <AtlasMapEntityList
        tableName={atlasType.slug}
        searchQuery={searchQuery}
      />
    </div>
  );
}

