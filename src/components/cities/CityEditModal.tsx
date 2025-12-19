'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { XMarkIcon, MagnifyingGlassIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { City, UpdateCityData } from '@/features/admin/services/cityAdminService';
import { MAP_CONFIG } from '@/features/_archive/map/config';

interface MapboxFeature {
  id: string;
  place_name: string;
  center: [number, number];
  text: string;
}

interface CityEditModalProps {
  isOpen: boolean;
  city: City | null;
  onClose: () => void;
  onSave: () => void;
}

export default function CityEditModal({
  isOpen,
  city,
  onClose,
  onSave,
}: CityEditModalProps) {
  const [formData, setFormData] = useState<UpdateCityData>({
    name: '',
    population: 0,
    county: '',
    lat: null,
    lng: null,
    meta_title: null,
    meta_description: null,
    website_url: null,
    favorite: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Location search state
  const [locationSearch, setLocationSearch] = useState('');
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  // Map state
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (city) {
      setFormData({
        name: city.name,
        population: city.population,
        county: city.county || '',
        lat: city.lat,
        lng: city.lng,
        meta_title: city.meta_title,
        meta_description: city.meta_description,
        website_url: city.website_url,
        favorite: city.favorite,
      });
      // Pre-populate search with city name for convenience
      setLocationSearch(city.name + (city.county ? `, ${city.county} County, MN` : ', MN'));
    }
  }, [city]);

  // Initialize map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current || mapRef.current) return;

    const initMap = async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      // @ts-ignore - CSS import
      await import('mapbox-gl/dist/mapbox-gl.css');

      if (!MAP_CONFIG.MAPBOX_TOKEN) return;

      mapboxgl.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

      const initialLng = formData.lng ?? MAP_CONFIG.DEFAULT_CENTER[0];
      const initialLat = formData.lat ?? MAP_CONFIG.DEFAULT_CENTER[1];
      const initialZoom = formData.lat && formData.lng ? 12 : 6;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: MAP_CONFIG.MAPBOX_STYLE,
        center: [initialLng, initialLat],
        zoom: initialZoom,
      });

      mapRef.current = map;

      // Add marker if coordinates exist
      if (formData.lat && formData.lng) {
        markerRef.current = new mapboxgl.Marker({ color: '#374151' })
          .setLngLat([formData.lng, formData.lat])
          .addTo(map);
      }

      // Click handler to set coordinates
      map.on('click', (e: any) => {
        const { lng, lat } = e.lngLat;
        setFormData(prev => ({ ...prev, lat, lng }));
        
        // Update or create marker
        if (markerRef.current) {
          markerRef.current.setLngLat([lng, lat]);
        } else {
          markerRef.current = new mapboxgl.Marker({ color: '#374151' })
            .setLngLat([lng, lat])
            .addTo(map);
        }
      });
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [isOpen]);

  // Update marker when coordinates change externally
  useEffect(() => {
    if (!mapRef.current || !formData.lat || !formData.lng) return;

    const loadMapboxGL = async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      
      if (markerRef.current) {
        markerRef.current.setLngLat([formData.lng!, formData.lat!]);
      } else {
        markerRef.current = new mapboxgl.Marker({ color: '#374151' })
          .setLngLat([formData.lng!, formData.lat!])
          .addTo(mapRef.current);
      }

      // Fly to location
      mapRef.current.flyTo({
        center: [formData.lng!, formData.lat!],
        zoom: 12,
        duration: 1000,
      });
    };

    loadMapboxGL();
  }, [formData.lat, formData.lng]);

  // Geocoding search
  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        access_token: MAP_CONFIG.MAPBOX_TOKEN,
        types: 'place,locality,neighborhood,address',
        country: 'us',
        limit: '5',
        bbox: '-97.5,43.5,-89.5,49.5', // Minnesota bounds
      });

      const response = await fetch(
        `${MAP_CONFIG.GEOCODING_BASE_URL}/${encodeURIComponent(query)}.json?${params}`
      );

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setSuggestions(data.features || []);
      setShowSuggestions(data.features?.length > 0);
    } catch (err) {
      console.error('Geocoding error:', err);
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchLocation(locationSearch);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [locationSearch, searchLocation]);

  // Handle suggestion selection
  const handleSelectSuggestion = (feature: MapboxFeature) => {
    const [lng, lat] = feature.center;
    setFormData(prev => ({ ...prev, lat, lng }));
    setLocationSearch(feature.place_name);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city) return;

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/admin/cities/${city.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          population: formData.population,
          county: formData.county,
          lat: formData.lat ? parseFloat(formData.lat.toString()) : null,
          lng: formData.lng ? parseFloat(formData.lng.toString()) : null,
          meta_title: formData.meta_title || null,
          meta_description: formData.meta_description || null,
          website_url: formData.website_url || null,
          favorite: formData.favorite,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update city' }));
        throw new Error(errorData.error || 'Failed to update city');
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update city');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !city) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none p-4">
        <div
          className="bg-white rounded-md border border-gray-200 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-[10px] py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Edit City</h2>
            <button
              onClick={onClose}
              disabled={saving}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-[10px] space-y-3">
            {error && (
              <div className="px-[10px] py-2 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs">
                {error}
              </div>
            )}

            {/* Name */}
            <div>
              <label htmlFor="city-name" className="block text-xs font-medium text-gray-700 mb-1.5">
                City Name
              </label>
              <input
                id="city-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-[10px] py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                required
                disabled={saving}
              />
            </div>

            {/* Population and County */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="city-population" className="block text-xs font-medium text-gray-700 mb-1.5">
                  Population
                </label>
                <input
                  id="city-population"
                  type="number"
                  value={formData.population}
                  onChange={(e) => setFormData({ ...formData, population: parseInt(e.target.value) || 0 })}
                  className="w-full px-[10px] py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                  required
                  disabled={saving}
                />
              </div>
              <div>
                <label htmlFor="city-county" className="block text-xs font-medium text-gray-700 mb-1.5">
                  County
                </label>
                <input
                  id="city-county"
                  type="text"
                  value={formData.county}
                  onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                  className="w-full px-[10px] py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                  disabled={saving}
                />
              </div>
            </div>

            {/* Location Search and Map */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700">
                Location
              </label>
              
              {/* Search Input */}
              <div className="relative" ref={suggestionsRef}>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="Search for a location..."
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    disabled={saving}
                  />
                  {isSearching && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.map((feature) => (
                      <button
                        key={feature.id}
                        type="button"
                        onClick={() => handleSelectSuggestion(feature)}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 transition-colors flex items-start gap-2"
                      >
                        <MapPinIcon className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{feature.place_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Mini Map */}
              <div 
                ref={mapContainerRef}
                className="w-full h-48 rounded-md border border-gray-200 overflow-hidden"
              />
              <p className="text-[10px] text-gray-500">
                Search above or click the map to set coordinates
              </p>
            </div>

            {/* Coordinates Display */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="city-lat" className="block text-xs font-medium text-gray-700 mb-1.5">
                  Latitude
                </label>
                <input
                  id="city-lat"
                  type="number"
                  step="0.000001"
                  value={formData.lat ?? ''}
                  onChange={(e) => setFormData({ ...formData, lat: e.target.value ? parseFloat(e.target.value) : null })}
                  className="w-full px-[10px] py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-gray-500 focus:border-gray-500 bg-gray-50"
                  placeholder="44.9778"
                  disabled={saving}
                />
              </div>
              <div>
                <label htmlFor="city-lng" className="block text-xs font-medium text-gray-700 mb-1.5">
                  Longitude
                </label>
                <input
                  id="city-lng"
                  type="number"
                  step="0.000001"
                  value={formData.lng ?? ''}
                  onChange={(e) => setFormData({ ...formData, lng: e.target.value ? parseFloat(e.target.value) : null })}
                  className="w-full px-[10px] py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-gray-500 focus:border-gray-500 bg-gray-50"
                  placeholder="-93.2650"
                  disabled={saving}
                />
              </div>
            </div>

            {/* SEO Fields */}
            <div className="pt-3 border-t border-gray-200 space-y-3">
              <h3 className="text-xs font-semibold text-gray-900">SEO Settings</h3>
              
              <div>
                <label htmlFor="city-meta-title" className="block text-xs font-medium text-gray-700 mb-1.5">
                  SEO Title (optional, max 70 characters)
                </label>
                <input
                  id="city-meta-title"
                  type="text"
                  maxLength={70}
                  value={formData.meta_title || ''}
                  onChange={(e) => setFormData({ ...formData, meta_title: e.target.value || null })}
                  className="w-full px-[10px] py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                  placeholder="Custom SEO title (defaults to generated title if empty)"
                  disabled={saving}
                />
                <p className="mt-0.5 text-xs text-gray-500">
                  {(formData.meta_title?.length || 0)} / 70 characters
                </p>
              </div>

              <div>
                <label htmlFor="city-meta-description" className="block text-xs font-medium text-gray-700 mb-1.5">
                  SEO Description (optional, max 160 characters)
                </label>
                <textarea
                  id="city-meta-description"
                  maxLength={160}
                  rows={3}
                  value={formData.meta_description || ''}
                  onChange={(e) => setFormData({ ...formData, meta_description: e.target.value || null })}
                  className="w-full px-[10px] py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                  placeholder="Custom SEO meta description (defaults to generated description if empty)"
                  disabled={saving}
                />
                <p className="mt-0.5 text-xs text-gray-500">
                  {(formData.meta_description?.length || 0)} / 160 characters
                </p>
              </div>
            </div>

            {/* Website and Favorite Fields */}
            <div className="pt-3 border-t border-gray-200 space-y-3">
              <h3 className="text-xs font-semibold text-gray-900">Additional Settings</h3>
              
              <div>
                <label htmlFor="city-website-url" className="block text-xs font-medium text-gray-700 mb-1.5">
                  Official Website URL
                </label>
                <input
                  id="city-website-url"
                  type="url"
                  value={formData.website_url || ''}
                  onChange={(e) => setFormData({ ...formData, website_url: e.target.value || null })}
                  className="w-full px-[10px] py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                  placeholder="https://www.example.gov/"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.favorite}
                    onChange={(e) => setFormData({ ...formData, favorite: e.target.checked })}
                    className="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
                    disabled={saving}
                  />
                  <span className="text-xs font-medium text-gray-700">Mark as favorite city</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

