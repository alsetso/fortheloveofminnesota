'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { StarIcon } from '@heroicons/react/24/solid';
import React from 'react';
import { usePageView } from '@/hooks/usePageView';
import { formatNumber } from '@/lib/utils/formatting';
import { highlightMatch } from '@/lib/utils/textHighlight';

type City = {
  id: string;
  name: string;
  slug: string;
  population: number | null;
  county: string | null;
  favorite?: boolean | null;
  website_url?: string | null;
};

interface CitiesListViewProps {
  cities: City[];
}

type SortOption = 'name' | 'population' | 'county';

export function CitiesListView({ cities }: CitiesListViewProps) {
  usePageView(); // Track page view
  const router = useRouter();
  const [sortBy, setSortBy] = useState<SortOption>('population');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter and sort cities
  const sortedCities = useMemo(() => {
    // Filter by favorites
    let filtered = showFavoritesOnly 
      ? cities.filter(city => city.favorite)
      : cities;
    
    // Filter by search query (fuzzy search on name and county)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(city => 
        city.name.toLowerCase().includes(query) ||
        (city.county && city.county.toLowerCase().includes(query))
      );
    }
    
    // Sort filtered results
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'population') {
        comparison = (a.population ?? 0) - (b.population ?? 0);
      } else if (sortBy === 'county') {
        comparison = (a.county || '').localeCompare(b.county || '');
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [cities, sortBy, sortOrder, showFavoritesOnly, searchQuery]);

  const handleSort = (field: SortOption) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field === 'population' ? 'desc' : 'asc');
    }
  };

  return (
    <>
      {/* Table Header with Search, Filter and Sort */}
      <div className="mb-3 bg-white rounded-md border border-gray-200 p-[10px] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Cities</h3>
            <span className="text-xs text-gray-500">
              {searchQuery.trim() || showFavoritesOnly
                ? `${sortedCities.length} of ${cities.length}` 
                : `${cities.length} total`}
            </span>
          </div>
        </div>
        <div>
          <input
            type="text"
            placeholder="Search cities or counties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
          />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showFavoritesOnly}
              onChange={(e) => setShowFavoritesOnly(e.target.checked)}
              className="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
            />
            <span className="text-xs font-medium text-gray-700">Show favorites only</span>
          </label>
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
            onClick={() => handleSort('county')}
            className={`px-2 py-0.5 rounded border transition-colors ${
              sortBy === 'county'
                ? 'bg-gray-100 border-gray-300 text-gray-900'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            County {sortBy === 'county' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
        </div>
      </div>

      {/* List View */}
      <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-[10px] py-[10px] text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                City
              </th>
              <th className="px-[10px] py-[10px] text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                Population
              </th>
              <th className="px-[10px] py-[10px] text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                County
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedCities.map((city) => (
              <tr
                key={city.id}
                className=""
              >
                <td className="px-[10px] py-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900">
                      {highlightMatch(city.name, searchQuery)}
                    </span>
                    {city.favorite && (
                      <StarIcon className="w-3 h-3 text-gray-700 flex-shrink-0" aria-label="Featured city" />
                    )}
                  </div>
                </td>
                <td className="px-[10px] py-[10px] text-xs text-gray-600">
                  {city.population !== null ? formatNumber(city.population) : 'N/A'}
                </td>
                <td className="px-[10px] py-[10px] text-xs text-gray-600">
                  {city.county ? highlightMatch(city.county, searchQuery) : city.county}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
