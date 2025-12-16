'use client';

import { useState, useCallback } from 'react';
import {
  BuildingStorefrontIcon,
  BuildingOfficeIcon,
  HomeIcon,
  ShoppingBagIcon,
  MapPinIcon,
  RectangleStackIcon,
} from '@heroicons/react/24/outline';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { MAP_CONFIG } from '@/features/_archive/map/config';

interface CategoryFilter {
  id: string;
  label: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CATEGORIES: CategoryFilter[] = [
  {
    id: 'restaurants',
    label: 'Restaurants',
    category: 'food_and_drink',
    icon: BuildingStorefrontIcon, // Using storefront as closest match for restaurants
  },
  {
    id: 'parking',
    label: 'Parking',
    category: 'motorist',
    icon: RectangleStackIcon, // Using stack icon as parking representation
  },
  {
    id: 'shopping',
    label: 'Shopping',
    category: 'store_like',
    icon: ShoppingBagIcon,
  },
  {
    id: 'buildings',
    label: 'Buildings',
    category: 'place_like',
    icon: BuildingOfficeIcon,
  },
  {
    id: 'hotels',
    label: 'Hotels',
    category: 'lodging',
    icon: HomeIcon,
  },
];

interface TestMapCategoryFiltersProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  onCategorySelect?: (category: string, coordinates: { lat: number; lng: number }) => void;
}

export default function TestMapCategoryFilters({
  map,
  mapLoaded,
  onCategorySelect,
}: TestMapCategoryFiltersProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleCategoryClick = useCallback(async (category: CategoryFilter) => {
    if (!map || !mapLoaded || map.removed || isSearching) return;

    const isActive = activeCategory === category.id;
    
    if (isActive) {
      // Deselect if already active
      setActiveCategory(null);
      return;
    }

    setActiveCategory(category.id);
    setIsSearching(true);

    try {
      // Get current map center
      const center = map.getCenter();
      const lng = center.lng;
      const lat = center.lat;

      // Search for POIs in this category using Mapbox Search Box API
      const token = MAP_CONFIG.MAPBOX_TOKEN;
      if (!token) {
        setIsSearching(false);
        return;
      }

      const url = `https://api.mapbox.com/search/searchbox/v1/category/${category.category}`;
      const params = new URLSearchParams({
        access_token: token,
        proximity: `${lng},${lat}`,
        limit: '20',
        language: 'en',
        bbox: `${MAP_CONFIG.MINNESOTA_BOUNDS.west},${MAP_CONFIG.MINNESOTA_BOUNDS.south},${MAP_CONFIG.MINNESOTA_BOUNDS.east},${MAP_CONFIG.MINNESOTA_BOUNDS.north}`,
        country: 'us',
      });

      const response = await fetch(`${url}?${params}`);
      if (!response.ok) {
        console.error('Search Box API error:', response.status, response.statusText);
        setIsSearching(false);
        return;
      }

      const data = await response.json();
      
      if (data.features && Array.isArray(data.features) && data.features.length > 0) {
        // Fly to the first result
        const firstFeature = data.features[0];
        const coords = firstFeature.geometry?.coordinates || firstFeature.center;
        
        if (coords && Array.isArray(coords) && coords.length >= 2) {
          map.flyTo({
            center: [coords[0], coords[1]],
            zoom: 14,
            duration: 1500,
          });

          // Trigger custom event for location sidebar to handle
          if (onCategorySelect) {
            onCategorySelect(category.category, { lat: coords[1], lng: coords[0] });
          }

          // Dispatch event for other components to listen to
          window.dispatchEvent(new CustomEvent('test-map-category-search', {
            detail: {
              category: category.category,
              results: data.features,
              center: { lat: coords[1], lng: coords[0] },
            },
          }));
        }
      }
    } catch (error) {
      console.error('Error searching category:', error);
    } finally {
      setIsSearching(false);
    }
  }, [map, mapLoaded, activeCategory, isSearching, onCategorySelect]);

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 flex gap-2 flex-wrap justify-center px-4">
      {CATEGORIES.map((category) => {
        const Icon = category.icon;
        const isActive = activeCategory === category.id;
        
        return (
          <button
            key={category.id}
            onClick={() => handleCategoryClick(category)}
            disabled={isSearching || !mapLoaded}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-full
              bg-white border transition-all
              ${isActive 
                ? 'border-gray-900 shadow-md' 
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }
              ${isSearching ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <Icon className={`w-4 h-4 ${isActive ? 'text-gray-900' : 'text-gray-700'}`} />
            <span className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>
              {category.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
