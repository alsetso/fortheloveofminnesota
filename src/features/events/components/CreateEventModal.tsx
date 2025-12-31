'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, MapPinIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { EventService } from '../services/eventService';
import type { CreateEventData, EventTag } from '@/types/event';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { MAP_CONFIG } from '@/features/map/config';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated: () => void;
}

export default function CreateEventModal({ isOpen, onClose, onEventCreated }: CreateEventModalProps) {
  const { account, user } = useAuthStateSafe();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAllDay, setIsAllDay] = useState(false);
  const [hasAddress, setHasAddress] = useState(false);
  const [tags, setTags] = useState<EventTag[]>([]);
  
  // Predefined tags
  const predefinedTags: EventTag[] = [
    { emoji: '🎉', text: 'Celebration' },
    { emoji: '🎵', text: 'Music' },
    { emoji: '🍕', text: 'Food' },
    { emoji: '🏃', text: 'Sports' },
    { emoji: '🎨', text: 'Arts' },
    { emoji: '📚', text: 'Education' },
    { emoji: '🌳', text: 'Outdoor' },
    { emoji: '👨‍👩‍👧‍👦', text: 'Family' },
    { emoji: '💼', text: 'Business' },
    { emoji: '🏛️', text: 'Government' },
    { emoji: '🗺️', text: 'Explore' },
    { emoji: '📍', text: 'Mention' },
    { emoji: '🏪', text: 'Garage Sale' },
    { emoji: '🎪', text: 'Festival' },
    { emoji: '🍺', text: 'Social' },
  ];

  // Location search state
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    name: string;
    address: string;
    lat: number;
    lng: number;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateEventData>({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    location_name: '',
    location_address: '',
    lat: null,
    lng: null,
    visibility: 'public',
  });

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  // Debounced location search
  useEffect(() => {
    const searchLocations = async (query: string) => {
      if (!query.trim() || query.length < 2) {
        setLocationSuggestions([]);
        setShowLocationSuggestions(false);
        return;
      }

      setIsSearchingLocation(true);
      try {
        const token = MAP_CONFIG.MAPBOX_TOKEN;
        if (!token) throw new Error('Mapbox token not configured');

        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`;
        const params = new URLSearchParams({
          access_token: token,
          country: 'us',
          bbox: `${MAP_CONFIG.MINNESOTA_BOUNDS.west},${MAP_CONFIG.MINNESOTA_BOUNDS.south},${MAP_CONFIG.MINNESOTA_BOUNDS.east},${MAP_CONFIG.MINNESOTA_BOUNDS.north}`,
          types: 'address,poi,place',
          limit: '8',
          proximity: `${MAP_CONFIG.DEFAULT_CENTER[0]},${MAP_CONFIG.DEFAULT_CENTER[1]}`,
        });

        const response = await fetch(`${url}?${params}`);
        if (!response.ok) throw new Error('Location search failed');

        const data = await response.json();
        const filteredFeatures = (data.features || []).filter((feature: any) => {
          const context = feature.context || [];
          const stateContext = context.find((c: { id?: string }) => c.id && c.id.startsWith('region.'));
          return stateContext && (
            stateContext.short_code === 'US-MN' || stateContext.text === 'Minnesota'
          );
        });

        setLocationSuggestions(filteredFeatures);
        setShowLocationSuggestions(filteredFeatures.length > 0);
      } catch (error) {
        console.error('Location search error:', error);
        setLocationSuggestions([]);
        setShowLocationSuggestions(false);
      } finally {
        setIsSearchingLocation(false);
      }
    };

    const timeoutId = setTimeout(() => {
      if (locationSearchQuery) {
        searchLocations(locationSearchQuery);
      } else {
        setLocationSuggestions([]);
        setShowLocationSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [locationSearchQuery]);

  const handleLocationSelect = (feature: any) => {
    const [lng, lat] = feature.center;
    const placeName = feature.place_name || feature.text;
    
    setSelectedLocation({
      name: feature.text || placeName,
      address: placeName,
      lat,
      lng,
    });
    
    setFormData({
      ...formData,
      location_name: feature.text || null,
      location_address: placeName,
      lat,
      lng,
    });
    
    setLocationSearchQuery(placeName);
    setShowLocationSuggestions(false);
  };

  const clearLocation = () => {
    setSelectedLocation(null);
    setLocationSearchQuery('');
    setFormData({
      ...formData,
      location_name: null,
      location_address: null,
      lat: null,
      lng: null,
    });
  };

  const formatDateTimeLocal = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}`;
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !account) {
      setError('You must be signed in to create events');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      if (!formData.title.trim()) {
        throw new Error('Title is required');
      }
      if (!formData.start_date) {
        throw new Error('Start date is required');
      }

      await EventService.createEvent({
        ...formData,
        title: formData.title.trim(),
        description: formData.description?.trim() || null,
        location_name: hasAddress ? (formData.location_name?.trim() || null) : null,
        location_address: hasAddress ? (formData.location_address?.trim() || null) : null,
        lat: hasAddress ? formData.lat : null,
        lng: hasAddress ? formData.lng : null,
        end_date: formData.end_date || null,
        tags: tags.length > 0 ? tags : undefined,
      }, account.id);

      resetForm();
      onEventCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      start_date: '',
      end_date: '',
      location_name: null,
      location_address: null,
      lat: null,
      lng: null,
      visibility: 'public',
    });
    setIsAllDay(false);
    setHasAddress(false);
    setTags([]);
    setError(null);
    setSelectedLocation(null);
    setLocationSearchQuery('');
    setLocationSuggestions([]);
    setShowLocationSuggestions(false);
  };

  const toggleTag = (tag: EventTag) => {
    const isSelected = tags.some(t => t.emoji === tag.emoji && t.text === tag.text);
    if (isSelected) {
      setTags(tags.filter(t => !(t.emoji === tag.emoji && t.text === tag.text)));
    } else {
      setTags([...tags, tag]);
    }
  };

  if (!isOpen) return null;

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
          className="bg-white rounded-md border border-gray-200 shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-[10px] py-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-900">Create Event</h2>
            <button
              onClick={onClose}
              disabled={creating}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleCreateEvent} className="p-[10px] space-y-2">
            {/* Account Info */}
            {account && (
              <div className="flex items-center gap-1.5 pb-1">
                <ProfilePhoto account={account} size="sm" />
                <span className="text-xs font-medium text-gray-900 truncate">
                  {account.username ? `@${account.username}` : account.first_name || 'User'}
                </span>
              </div>
            )}

            {/* Title */}
            <div>
              <label htmlFor="event-title" className="block text-xs font-medium text-gray-700 mb-0.5">
                Event Title *
              </label>
              <input
                id="event-title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-2 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400"
                placeholder="Event title"
                required
                disabled={creating}
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="event-description" className="block text-xs font-medium text-gray-700 mb-0.5">
                Description
              </label>
              <textarea
                id="event-description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-2 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none resize-none border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400"
                placeholder="Event description"
                rows={2}
                disabled={creating}
              />
            </div>

            {/* All Day Checkbox */}
            <div className="flex items-center gap-1.5">
              <input
                type="checkbox"
                id="all-day"
                checked={isAllDay}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsAllDay(checked);
                  
                  if (checked) {
                    if (formData.start_date) {
                      const startDate = new Date(formData.start_date);
                      const startOfDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0);
                      const endOfDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 23, 59, 59);
                      
                      setFormData({
                        ...formData,
                        start_date: formatDateTimeLocal(startOfDay),
                        end_date: formatDateTimeLocal(endOfDay),
                      });
                    }
                  }
                }}
                className="w-3 h-3 text-gray-900 border-gray-200 rounded focus:ring-gray-400"
                disabled={creating}
              />
              <label htmlFor="all-day" className="text-xs text-gray-700 cursor-pointer">
                All day
              </label>
            </div>

            {/* Date/Time Inputs */}
            {isAllDay ? (
              <div>
                <label htmlFor="event-date" className="block text-xs font-medium text-gray-700 mb-0.5">
                  Date *
                </label>
                <input
                  id="event-date"
                  type="date"
                  value={formData.start_date ? (() => {
                    try {
                      const date = new Date(formData.start_date);
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      return `${year}-${month}-${day}`;
                    } catch {
                      return '';
                    }
                  })() : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [year, month, day] = e.target.value.split('-').map(Number);
                      const startOfDay = new Date(year, month - 1, day, 0, 0, 0);
                      const endOfDay = new Date(year, month - 1, day, 23, 59, 59);
                      
                      setFormData({
                        ...formData,
                        start_date: formatDateTimeLocal(startOfDay),
                        end_date: formatDateTimeLocal(endOfDay),
                      });
                    }
                  }}
                  className="w-full px-2 py-1.5 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                  required
                  disabled={creating}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="event-start" className="block text-xs font-medium text-gray-700 mb-0.5">
                    Start *
                  </label>
                  <input
                    id="event-start"
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                    required
                    disabled={creating}
                  />
                </div>
                <div>
                  <label htmlFor="event-end" className="block text-xs font-medium text-gray-700 mb-0.5">
                    End
                  </label>
                  <input
                    id="event-end"
                    type="datetime-local"
                    value={formData.end_date || ''}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                    disabled={creating}
                  />
                </div>
              </div>
            )}

            {/* Has Address Checkbox */}
            <div className="flex items-center gap-1.5">
              <input
                type="checkbox"
                id="has-address"
                checked={hasAddress}
                onChange={(e) => {
                  setHasAddress(e.target.checked);
                  if (!e.target.checked) {
                    clearLocation();
                  }
                }}
                className="w-3 h-3 text-gray-900 border-gray-200 rounded focus:ring-gray-400"
                disabled={creating}
              />
              <label htmlFor="has-address" className="text-xs text-gray-700 cursor-pointer">
                Has address
              </label>
            </div>

            {/* Location Search */}
            {hasAddress && (
              <div>
                <label htmlFor="event-location" className="block text-xs font-medium text-gray-700 mb-0.5">
                  Location
                </label>
                <div className="relative">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                  <input
                    id="event-location"
                    type="text"
                    value={locationSearchQuery}
                    onChange={(e) => {
                      setLocationSearchQuery(e.target.value);
                      setShowLocationSuggestions(true);
                      if (!e.target.value) {
                        clearLocation();
                      }
                    }}
                    onFocus={() => {
                      if (locationSuggestions.length > 0) {
                        setShowLocationSuggestions(true);
                      }
                    }}
                    className="w-full pl-8 pr-2 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                    placeholder="Search location"
                    disabled={creating}
                  />
                  {selectedLocation && (
                    <button
                      type="button"
                      onClick={clearLocation}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      disabled={creating}
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Location Suggestions Dropdown */}
                {showLocationSuggestions && locationSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-0.5 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {locationSuggestions.map((feature, index) => (
                      <button
                        key={feature.id || index}
                        type="button"
                        onClick={() => handleLocationSelect(feature)}
                        className="w-full px-2 py-1.5 text-left text-xs text-gray-900 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-start gap-1.5">
                          <MapPinIcon className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{feature.text}</p>
                            <p className="text-gray-500 text-[10px] truncate">{feature.place_name}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected Location Display */}
                {selectedLocation && (
                  <div className="mt-1.5 p-1.5 bg-gray-50 border border-gray-200 rounded-md">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {selectedLocation.name}
                        </p>
                        <p className="text-[10px] text-gray-600 truncate mt-0.5">
                          {selectedLocation.address}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={clearLocation}
                        className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                        disabled={creating}
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                {isSearchingLocation && (
                  <p className="mt-0.5 text-[10px] text-gray-500">Searching...</p>
                )}
                </div>
              </div>
            )}

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Tags
              </label>
              <div className="flex flex-wrap gap-1">
                {predefinedTags.map((tag, index) => {
                  const isSelected = tags.some(t => t.emoji === tag.emoji && t.text === tag.text);
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      disabled={creating}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border transition-colors ${
                        isSelected
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                      } disabled:opacity-50`}
                    >
                      <span>{tag.emoji}</span>
                      <span>{tag.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visibility Toggle */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Visibility
              </label>
              <div className="flex items-center gap-1.5 p-1.5 border border-gray-200 rounded-md">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, visibility: 'public' })}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                    formData.visibility === 'public'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={creating}
                >
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, visibility: 'only_me' })}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                    formData.visibility === 'only_me'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={creating}
                >
                  Only Me
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded-md">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center gap-2 pt-1.5 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                disabled={creating}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !formData.title.trim() || !formData.start_date}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

