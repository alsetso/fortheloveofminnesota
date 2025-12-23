'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase';
import { generateSlug, type AtlasEntityType } from '../services/atlasService';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface CreateAtlasDialogProps {
  isOpen: boolean;
  onClose: () => void;
  map: MapboxMapInstance | null;
  tableName: AtlasEntityType;
}

interface City {
  id: string;
  name: string;
  slug: string;
}

export default function CreateAtlasDialog({
  isOpen,
  onClose,
  map,
  tableName,
}: CreateAtlasDialogProps) {
  const [name, setName] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get map center for lat/lng
  const getMapCenter = () => {
    if (!map) return null;
    const center = map.getCenter();
    return { lat: center.lat, lng: center.lng };
  };

  // Search cities
  useEffect(() => {
    if (!citySearch || citySearch.length < 2) {
      setCities([]);
      return;
    }

    const searchCities = async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('id, name, slug')
        .ilike('name', `%${citySearch}%`)
        .limit(10)
        .order('name');

      if (error) {
        console.error('Error searching cities:', error);
        return;
      }

      setCities(data || []);
    };

    const timeoutId = setTimeout(searchCities, 300);
    return () => clearTimeout(timeoutId);
  }, [citySearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const center = getMapCenter();
      const slug = generateSlug(name);
      
      const payload: Record<string, any> = {
        name: name.trim(),
        slug,
        city_id: selectedCityId || null,
        lat: center?.lat || null,
        lng: center?.lng || null,
      };

      // Use API route for admin creation
      const response = await fetch(`/api/admin/atlas/${tableName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create atlas entity' }));
        throw new Error(errorData.error || 'Failed to create atlas entity');
      }

      // Reset form
      setName('');
      setCitySearch('');
      setSelectedCityId(null);
      setCities([]);
      onClose();
    } catch (err) {
      console.error('Error creating atlas entity:', err);
      setError(err instanceof Error ? err.message : 'Failed to create atlas entity');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-md border border-gray-200 w-full max-w-md mx-4 p-[10px] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Create {tableName.replace('_', ' ')}
          </h3>
          <button
            onClick={onClose}
            className="p-0.5 hover:bg-gray-100 rounded transition-colors"
          >
            <XMarkIcon className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="Enter name"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">
              City (optional)
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                type="text"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 pl-7 focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="Search cities..."
              />
              {selectedCityId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCityId(null);
                    setCitySearch('');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              )}
            </div>
            {cities.length > 0 && !selectedCityId && (
              <div className="mt-1 border border-gray-200 rounded bg-white max-h-40 overflow-y-auto">
                {cities.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => {
                      setSelectedCityId(city.id);
                      setCitySearch(city.name);
                      setCities([]);
                    }}
                    className="w-full text-left text-xs px-2 py-1.5 hover:bg-gray-50 transition-colors"
                  >
                    {city.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

