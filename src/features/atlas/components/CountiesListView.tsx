'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { StarIcon } from '@heroicons/react/24/solid';
import React from 'react';
import { usePageView } from '@/hooks/usePageView';
import { formatNumber, formatArea } from '@/lib/utils/formatting';
import { highlightMatch } from '@/lib/utils/textHighlight';

type County = {
  id: string;
  name: string;
  slug: string | null;
  population: number;
  area_sq_mi: number | null;
  favorite?: boolean | null;
};

interface CountiesListViewProps {
  counties: County[];
}

type SortOption = 'name' | 'population' | 'area';

export function CountiesListView({ counties }: CountiesListViewProps) {
  usePageView(); // Track page view
  const router = useRouter();
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter and sort counties
  const sortedCounties = useMemo(() => {
    // Filter by search query (fuzzy search on name)
    let filtered = counties;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = counties.filter(county => 
        county.name.toLowerCase().includes(query)
      );
    }
    
    // Sort filtered results
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'population') {
        comparison = a.population - b.population;
      } else if (sortBy === 'area') {
        comparison = (a.area_sq_mi ?? 0) - (b.area_sq_mi ?? 0);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [counties, sortBy, sortOrder, searchQuery]);

  const handleSort = (field: SortOption) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <>
      {/* Table Header with Search and Sort */}
      <div className="mb-3 bg-white rounded-md border border-gray-200 p-[10px] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Counties</h3>
            <span className="text-xs text-gray-500">
              {searchQuery.trim() 
                ? `${sortedCounties.length} of ${counties.length}` 
                : `${counties.length} total`}
            </span>
          </div>
        </div>
        <div>
          <input
            type="text"
            placeholder="Search counties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
          />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">Sort by:</span>
          <button
            onClick={() => handleSort('name')}
            className={`px-2 py-0.5 rounded border transition-colors ${
              sortBy === 'name'
                ? 'bg-gray-100 border-gray-300 text-gray-900'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            onClick={() => handleSort('population')}
            className={`px-2 py-0.5 rounded border transition-colors ${
              sortBy === 'population'
                ? 'bg-gray-100 border-gray-300 text-gray-900'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Population {sortBy === 'population' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            onClick={() => handleSort('area')}
            className={`px-2 py-0.5 rounded border transition-colors ${
              sortBy === 'area'
                ? 'bg-gray-100 border-gray-300 text-gray-900'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Area {sortBy === 'area' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
        </div>
      </div>

      {/* List View */}
      <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-[10px] py-[10px] text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                County
              </th>
              <th className="px-[10px] py-[10px] text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                Population
              </th>
              <th className="px-[10px] py-[10px] text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                Area
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedCounties.map((county) => (
              <tr
                key={county.id}
                onClick={() => county.slug && router.push(`/explore/county/${county.slug}`)}
                className={county.slug ? "hover:bg-gray-50 transition-colors cursor-pointer" : ""}
              >
                <td className="px-[10px] py-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900">
                      {highlightMatch(county.name, searchQuery)}
                    </span>
                    {county.favorite && (
                      <StarIcon className="w-3 h-3 text-gray-700 flex-shrink-0" aria-label="Featured county" />
                    )}
                  </div>
                </td>
                <td className="px-[10px] py-[10px] text-xs text-gray-600">
                  {formatNumber(county.population)}
                </td>
                <td className="px-[10px] py-[10px] text-xs text-gray-600">
                  {county.area_sq_mi !== null ? formatArea(county.area_sq_mi) : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

