'use client';

import { useState, useEffect } from 'react';
import { CalendarIcon, PlusIcon, MapPinIcon, ClockIcon, UserIcon, ChevronUpIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { EventService } from '../services/eventService';
import type { Event, CreateEventData } from '@/types/event';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { MAP_CONFIG } from '@/features/map/config';
import { LocationLookupService } from '@/features/map/services/locationLookupService';

export default function EventsPageClient() {
  const { account, user } = useAuthStateSafe();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

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

  // Fetch events on mount
  useEffect(() => {
    fetchEvents();
  }, []);

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

  // Handle location selection
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

  // Clear location
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

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get public events and user's own events
      const publicEvents = await EventService.getEvents({ 
        visibility: 'public',
        archived: false 
      });
      
      // If user is logged in, also get their private events
      let myEvents: Event[] = [];
      if (account) {
        myEvents = await EventService.getEvents({ 
          account_id: account.id,
          visibility: 'only_me',
          archived: false 
        });
      }

      // Combine and sort by start_date
      const allEvents = [...publicEvents, ...myEvents].sort((a, b) => {
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      });

      setEvents(allEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (!user || !account) {
      setError('You must be signed in to create events');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      // Validate required fields
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
        location_name: formData.location_name?.trim() || null,
        location_address: formData.location_address?.trim() || null,
        end_date: formData.end_date || null,
      }, account.id);

      // Reset form and refresh events
      resetForm();
      await fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatDateRange = (start: string, end: string | null) => {
    try {
      const startDate = new Date(start);
      const endDate = end ? new Date(end) : null;
      
      if (!endDate) {
        return formatDate(start);
      }

      // Same day
      if (startDate.toDateString() === endDate.toDateString()) {
        return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      }

      // Different days
      return `${formatDate(start)} - ${formatDate(end)}`;
    } catch {
      return `${start}${end ? ` - ${end}` : ''}`;
    }
  };

  const isPastEvent = (startDate: string) => {
    return new Date(startDate) < new Date();
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
    setShowCreateForm(false);
    setError(null);
    setSelectedLocation(null);
    setLocationSearchQuery('');
    setLocationSuggestions([]);
    setShowLocationSuggestions(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
      {/* Left Column - Primary Content */}
      <div className="lg:col-span-8 space-y-3">
        {/* Create Event Section */}
        {user && account && (
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            {!showCreateForm ? (
              /* Create Button */
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
              >
                <span>Create Event</span>
                <CalendarIcon className="w-5 h-5" />
              </button>
            ) : (
              /* Inline Form */
              <div className="space-y-2">
                {/* Form Header */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <span className="text-xs font-medium text-gray-900">Create Event</span>
                  <button
                    onClick={resetForm}
                    className="text-gray-500 hover:text-gray-900 transition-colors"
                    disabled={creating}
                  >
                    <ChevronUpIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Account Info */}
                {account && (
                  <div className="flex items-center gap-2 pb-2">
                    <ProfilePhoto account={account} size="sm" />
                    <span className="text-xs font-medium text-gray-900 truncate">
                      {account.username ? `@${account.username}` : account.first_name || 'User'}
                    </span>
                  </div>
                )}

                {/* Title */}
                <div>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none resize-none border border-gray-200 rounded-md"
                    placeholder="Event title"
                    required
                    disabled={creating}
                  />
                </div>

                {/* Description */}
                <div>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none resize-none border border-gray-200 rounded-md"
                    placeholder="Event description"
                    rows={3}
                    disabled={creating}
                  />
                </div>

                {/* Date/Time Inputs */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="datetime-local"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-3 py-2 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                      placeholder="Start date"
                      required
                      disabled={creating}
                    />
                  </div>
                  <div>
                    <input
                      type="datetime-local"
                      value={formData.end_date || ''}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-3 py-2 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                      placeholder="End date (optional)"
                      disabled={creating}
                    />
                  </div>
                </div>

                {/* Location Search */}
                <div className="relative">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                    <input
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
                      className="w-full pl-8 pr-2 py-2 text-xs text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                      placeholder="Search for location or address"
                      disabled={creating}
                    />
                    {selectedLocation && (
                      <button
                        type="button"
                        onClick={clearLocation}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        disabled={creating}
                      >
                        <span className="text-xs">×</span>
                      </button>
                    )}
                  </div>

                  {/* Location Suggestions Dropdown */}
                  {showLocationSuggestions && locationSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {locationSuggestions.map((feature, index) => (
                        <button
                          key={feature.id || index}
                          type="button"
                          onClick={() => handleLocationSelect(feature)}
                          className="w-full px-3 py-2 text-left text-xs text-gray-900 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-start gap-2">
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
                    <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded-md">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {selectedLocation.name}
                          </p>
                          <p className="text-[10px] text-gray-600 truncate mt-0.5">
                            {selectedLocation.address}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={clearLocation}
                          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                          disabled={creating}
                        >
                          <span className="text-xs">×</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Loading State */}
                  {isSearchingLocation && (
                    <p className="mt-1 text-[10px] text-gray-500">Searching...</p>
                  )}
                </div>

                {/* Visibility Toggle */}
                <div className="flex items-center justify-between p-2 border border-gray-200 rounded-md">
                  <span className="text-xs text-gray-700">Visibility</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, visibility: 'public' })}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
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
                      className={`px-2 py-1 text-xs rounded transition-colors ${
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
                  <div className="text-[10px] text-red-600 bg-red-50 p-2 rounded">
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleCreateEvent}
                  disabled={creating || !formData.title.trim() || !formData.start_date}
                  className="w-full px-3 py-2 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <p className="text-xs text-gray-600">Loading events...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-white border border-red-200 rounded-md p-[10px]">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* Events List */}
        {!loading && events.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-900">
                Events ({events.length})
              </h2>
            </div>
            <div className="space-y-2">
              {events.map((event) => {
                const isPast = isPastEvent(event.start_date);
                const accountData = event.accounts;
                
                return (
                  <div
                    key={event.id}
                    className={`bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 transition-colors ${
                      isPast ? 'opacity-75' : ''
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                            {event.title}
                          </h3>
                          {event.description && (
                            <p className="text-xs text-gray-600 mt-0.5 line-clamp-3">
                              {event.description}
                            </p>
                          )}
                        </div>
                        {event.visibility === 'only_me' && account && event.account_id === account.id && (
                          <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                            Private
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <ClockIcon className="w-3 h-3" />
                          <span>{formatDateRange(event.start_date, event.end_date)}</span>
                        </div>

                        {(event.location_name || event.location_address) && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <MapPinIcon className="w-3 h-3" />
                            <span className="line-clamp-1">
                              {event.location_name || event.location_address}
                            </span>
                          </div>
                        )}

                        {accountData && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 pt-0.5">
                            <UserIcon className="w-3 h-3" />
                            <span>
                              {accountData.username || accountData.first_name || 'User'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && events.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <div className="flex flex-col items-center justify-center py-6 space-y-2 text-center">
              <CalendarIcon className="w-8 h-8 text-gray-400" />
              <p className="text-xs font-medium text-gray-900">No events yet</p>
              <p className="text-xs text-gray-600">
                {user 
                  ? 'Create an event to get started.'
                  : 'Sign in to create events or view community events.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right Column - Info */}
      <div className="lg:col-span-4 space-y-3">
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
          <h3 className="text-xs font-semibold text-gray-900">About Events</h3>
          <div className="space-y-1.5 text-xs text-gray-600">
            <p>
              Share events with the Minnesota community or keep them private.
            </p>
            <p>
              Public events are visible to everyone. Private events are only visible to you.
            </p>
            {!user && (
              <div className="pt-1.5 border-t border-gray-200">
                <p className="font-medium text-gray-900 mb-0.5">Sign In Required</p>
                <p className="text-gray-600">Sign in to create and manage your events.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

