'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useToast } from '@/features/ui/hooks/useToast';
import { minnesotaBoundsService } from '../services/minnesotaBoundsService';
import { Address } from '../types';

interface SearchSuggestion {
  id: string;
  place_name: string;
  center: [number, number];
  context?: Array<{
    id: string;
    text: string;
  }>;
}

const STATUS_OPTIONS = [
  'Preforeclosure', 'Foreclosure', 'Foreclosed', 'Auction', 'Redemption',
  'Bank Owned', 'Short Sale', 'Subject To', 'Deed In Lieu', 'Leaseback',
  'For Sale By Owner', 'Listed On MLS', 'Under Contract', 'Sold', 'Off Market'
];

interface FloatingSearchInputProps {
  onSearchComplete?: (address: Address, coordinates?: { lat: number; lng: number }) => void;
  onFlyTo?: (coordinates: { lat: number; lng: number }, zoom?: number) => void;
  onSaveProperty?: (address: Address, coordinates: { lat: number; lng: number }, status: string) => void;
  currentSession?: { id: string; name: string; nodes: unknown[] } | null;
  onAddNode?: (node: unknown) => void;
}

export function FloatingSearchInput({ onSearchComplete, onFlyTo, onSaveProperty, currentSession: propsCurrentSession, onAddNode: propsAddNode }: FloatingSearchInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [showPropertyPopup, setShowPropertyPopup] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('Off Market');
  const [isSaving, setIsSaving] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const onSavePropertyRef = useRef(onSaveProperty);
  const isMountedRef = useRef(true);
  
  // Use props if provided, otherwise fall back to defaults
  const currentSession = propsCurrentSession ?? null;
  const addNodeRef = useRef(propsAddNode ?? (() => {}));
  
  // Update ref when prop changes
  useEffect(() => {
    addNodeRef.current = propsAddNode ?? (() => {});
  }, [propsAddNode]);
  
  const { withApiToast, success, error } = useToast();

  // Keep ref updated with latest onSaveProperty callback
  useEffect(() => {
    onSavePropertyRef.current = onSaveProperty;
  }, [onSaveProperty]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Debounced search for suggestions
  const debouncedSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (!token) {
        console.warn('No Mapbox token available for search suggestions');
        setSuggestions([]);
        return;
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`;
      const params = new URLSearchParams({
        access_token: token,
        country: 'US',
        types: 'address', // Only addresses for single-line results
        limit: '8',
        bbox: '-97.5,43.5,-89.5,49.5', // Minnesota bounds (west,south,east,north)
        proximity: '-94.6859,46.7296' // Center of Minnesota for better relevance
      });

      const response = await fetch(`${url}?${params}`);
      if (!response.ok) throw new Error('Search request failed');

      const data = await response.json();
      const filteredSuggestions = data.features.filter((feature: SearchSuggestion) => {
        // Multiple layers of Minnesota filtering for bulletproof results
        
        // 1. Coordinate-based filtering
        const coordinates = { lat: feature.center[1], lng: feature.center[0] };
        const isWithinBounds = minnesotaBoundsService.isWithinMinnesota(coordinates);
        
        // 2. Context-based filtering (check if state is Minnesota)
        const context = feature.context || [];
        const stateContext = context.find(ctx => ctx.id.startsWith('region'));
        const isMinnesotaState = stateContext ? 
          minnesotaBoundsService.isMinnesotaState(stateContext.text) : false;
        
        // 3. Place name filtering (check if place name contains Minnesota indicators)
        const placeName = feature.place_name.toLowerCase();
        const hasMinnesotaIndicators = placeName.includes('minnesota') || 
                                     placeName.includes(', mn') || 
                                     placeName.includes(' mn ');
        
        // Must pass ALL three checks to be included
        return isWithinBounds && (isMinnesotaState || hasMinnesotaIndicators);
      });

      // Final safety check - ensure no non-Minnesota results slip through
      const finalSuggestions = filteredSuggestions.filter((suggestion: Record<string, unknown>) => {
        const coordinates = { lat: (suggestion.center as number[])[1], lng: (suggestion.center as number[])[0] };
        return minnesotaBoundsService.isWithinMinnesota(coordinates);
      });

      setSuggestions(finalSuggestions);
      setShowSuggestions(finalSuggestions.length > 0);
    } catch (error) {
      console.error('Search suggestions error:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debouncing
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSelectedIndex(-1);

    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new timeout for debounced search
    debounceRef.current = setTimeout(() => {
      debouncedSearch(value);
    }, 300);
  }, [debouncedSearch]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback(async (suggestion: SearchSuggestion) => {
    setSearchQuery(suggestion.place_name);
    setShowSuggestions(false);
    setSelectedIndex(-1);

    const coordinates = { lat: suggestion.center[1], lng: suggestion.center[0] };
    
    // Parse address from suggestion
    const address = parseAddressFromSuggestion(suggestion);
    
    // Validate Minnesota bounds first
    if (!minnesotaBoundsService.isWithinMinnesota(coordinates)) {
      await withApiToast('Minnesota Only', () => Promise.reject('This location is not in Minnesota. Please search for addresses within Minnesota state boundaries.'), {
        errorMessage: 'Not in Minnesota',
      });
      return;
    }

    // Store selected address and coordinates for popup
    setSelectedAddress(address);
    setSelectedCoordinates(coordinates);
    setShowPropertyPopup(true);

    // Perform search actions (non-blocking)
    // Fly to location immediately
    onFlyTo?.(coordinates, 16);

    // Notify parent component immediately with coordinates for pin creation
    onSearchComplete?.(address, coordinates);

    // Add session node asynchronously (fire-and-forget, don't block main flow)
    if (currentSession) {
      // Fire and forget - don't await or let errors block the main flow
      // Wrap in async IIFE to handle both sync and async addNode functions
      (async () => {
        try {
          const nodeData = {
            type: 'start' as const,
            status: 'completed' as const,
            customTitle: `Search: ${suggestion.place_name}`,
            addressData: {
              ...address,
              coordinates: { latitude: coordinates.lat, longitude: coordinates.lng }
            },
            apiName: 'Search History',
            timestamp: new Date().toISOString(),
            mnNodeId: `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            hasCompleted: true,
            metadata: {}
          };
          
          // Call addNode - it may return void or a promise
          const result: unknown = addNodeRef.current(nodeData);
          
          // If it returns a promise, await it; otherwise ignore
          if (result && typeof result === 'object' && 'then' in result) {
            await (result as Promise<unknown>);
          }
        } catch (error) {
          // Silently log session node errors - don't interrupt user flow
          console.warn('Failed to add session node (non-critical):', error);
        }
      })();
    }

    // Collapse search input
    setIsExpanded(false);
  }, [currentSession, onFlyTo, onSearchComplete, withApiToast]);

  // Handle saving property
  const handleSaveProperty = useCallback(async () => {
    // Prevent double-clicks
    if (isSaving) {
      return;
    }

    // Store values in local variables to avoid stale closure issues
    const addressToSave = selectedAddress;
    const coordinatesToSave = selectedCoordinates;
    const statusToSave = selectedStatus;
    const saveHandler = onSavePropertyRef.current;
    
    if (!addressToSave || !coordinatesToSave || !saveHandler) {
      console.warn('Cannot save property: missing required data', {
        hasAddress: !!addressToSave,
        hasCoordinates: !!coordinatesToSave,
        hasOnSave: !!saveHandler
      });
      return;
    }

    setIsSaving(true);

    try {
      console.log('FloatingSearchInput: Saving property...', { 
        address: addressToSave, 
        coordinates: coordinatesToSave, 
        status: statusToSave 
      });
      
      await saveHandler(addressToSave, coordinatesToSave, statusToSave);
      
      // Check if component is still mounted before updating state
      if (!isMountedRef.current) {
        return;
      }
      
      console.log('FloatingSearchInput: Property saved successfully, clearing state');
      
      // Reset loading state immediately before state changes
      setIsSaving(false);
      
      // Clear all state to allow immediate new search
      setShowPropertyPopup(false);
      setSelectedAddress(null);
      setSelectedCoordinates(null);
      setSelectedStatus('Off Market');
      setSearchQuery(''); // Clear search input
      setShowSuggestions(false); // Close suggestions dropdown
      setSuggestions([]); // Clear suggestions
      setSelectedIndex(-1); // Reset selection index
      setIsExpanded(false); // Collapse search input
      
      // Simple success notification
      success('Property Saved', 'Added to your workspace');
      
      // Re-expand search input for next search after a brief delay
      setTimeout(() => {
        if (!isMountedRef.current) return;
        setIsExpanded(true);
        setTimeout(() => {
          if (isMountedRef.current && inputRef.current) {
            inputRef.current.focus();
          }
        }, 50);
      }, 300);
    } catch (err) {
      console.error('FloatingSearchInput: Error saving property:', err);
      // Always reset loading state on error (only if still mounted)
      if (isMountedRef.current) {
        setIsSaving(false);
        error('Save Failed', err instanceof Error ? err.message : 'Please try again');
      }
      // Don't clear state on error - let user try again or cancel
    }
  }, [selectedAddress, selectedCoordinates, selectedStatus, isSaving, success, error]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  }, [showSuggestions, suggestions, selectedIndex, handleSuggestionSelect]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  // Cleanup debounce timeout
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="absolute top-4 left-4 z-30">
      <div className="relative">
        {/* Search Input */}
        <div
          className={`bg-white border border-gray-200 rounded-lg shadow-lg transition-all duration-300 ${
            isExpanded ? 'w-72' : 'w-auto'
          }`}
        >
          {isExpanded ? (
            <div className="flex items-center px-3 py-2">
              <svg
                className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Search Minnesota..."
                className="flex-1 outline-none text-sm placeholder-gray-400 bg-transparent"
              />
              {isLoading && (
                <div className="w-3 h-3 border-2 border-gray-300 border-t-gold-500 rounded-full animate-spin ml-2" />
              )}
              <button
                onClick={() => {
                  setIsExpanded(false);
                  setSearchQuery('');
                  setShowSuggestions(false);
                  setSelectedIndex(-1);
                }}
                className="ml-2 p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsExpanded(true)}
              className="px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2 text-sm font-medium text-gray-700"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span>Search</span>
            </button>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-40"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                onClick={() => handleSuggestionSelect(suggestion)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                  index === selectedIndex ? 'bg-gold-50 text-gold-600' : 'text-gray-700'
                }`}
              >
                <div className="font-medium truncate">
                  {formatAddressSuggestion(suggestion)}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Property Save Popup */}
        {showPropertyPopup && selectedAddress && selectedCoordinates && (
          <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold text-gray-900">Save Property</h3>
                <button
                  onClick={() => {
                    setShowPropertyPopup(false);
                    setSelectedAddress(null);
                    setSelectedCoordinates(null);
                    setSelectedStatus('Off Market');
                    setSearchQuery('');
                    setShowSuggestions(false);
                    setSuggestions([]);
                    setIsSaving(false);
                    setIsExpanded(false);
                  }}
                  disabled={isSaving}
                  className="text-gray-400 hover:text-gray-600 p-0.5 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-2 mb-3">
                {/* Status Selector - First */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gold-500 focus:border-gold-500 bg-white"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Address</label>
                  <div className="text-xs text-gray-900 bg-gray-50 px-2 py-1.5 rounded border">
                    {selectedAddress.street}, {selectedAddress.city}, {selectedAddress.state} {selectedAddress.zip}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Street</label>
                    <div className="text-xs text-gray-900 bg-gray-50 px-2 py-1 rounded border">
                      {selectedAddress.street}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">City</label>
                    <div className="text-xs text-gray-900 bg-gray-50 px-2 py-1 rounded border">
                      {selectedAddress.city}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">State</label>
                    <div className="text-xs text-gray-900 bg-gray-50 px-2 py-1 rounded border">
                      {selectedAddress.state}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">ZIP</label>
                    <div className="text-xs text-gray-900 bg-gray-50 px-2 py-1 rounded border">
                      {selectedAddress.zip}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Latitude</label>
                    <div className="text-xs text-gray-900 bg-gray-50 px-2 py-1 rounded border">
                      {selectedCoordinates.lat.toFixed(6)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Longitude</label>
                    <div className="text-xs text-gray-900 bg-gray-50 px-2 py-1 rounded border">
                      {selectedCoordinates.lng.toFixed(6)}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2 pt-2 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowPropertyPopup(false);
                    setSelectedAddress(null);
                    setSelectedCoordinates(null);
                    setSelectedStatus('Off Market');
                    setSearchQuery('');
                    setShowSuggestions(false);
                    setSuggestions([]);
                    setIsSaving(false);
                    setIsExpanded(false);
                  }}
                  disabled={isSaving}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProperty}
                  disabled={!selectedAddress || !selectedCoordinates || !onSaveProperty || isSaving}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-black rounded hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save Property'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to format address suggestion for display
function formatAddressSuggestion(suggestion: SearchSuggestion): string {
  const context = suggestion.context || [];
  
  // Extract components from context
  const street = suggestion.place_name.split(',')[0] || '';
  const city = context.find(ctx => ctx.id.startsWith('place'))?.text || '';
  const state = context.find(ctx => ctx.id.startsWith('region'))?.text || 'MN';
  const zip = context.find(ctx => ctx.id.startsWith('postcode'))?.text || '';

  // Format as single line: "123 Main St, Minneapolis, MN 55401"
  const parts = [street.trim()];
  if (city) parts.push(city.trim());
  if (state) parts.push(state.trim());
  if (zip) parts.push(zip.trim());
  
  return parts.join(', ');
}

// Helper function to parse address from Mapbox suggestion
function parseAddressFromSuggestion(suggestion: SearchSuggestion): Address {
  const context = suggestion.context || [];
  
  // Extract components from context
  const street = suggestion.place_name.split(',')[0] || '';
  const city = context.find(ctx => ctx.id.startsWith('place'))?.text || '';
  const state = context.find(ctx => ctx.id.startsWith('region'))?.text || 'MN';
  const zip = context.find(ctx => ctx.id.startsWith('postcode'))?.text || '';

  return {
    street: street.trim(),
    city: city.trim(),
    state: state.trim(),
    zip: zip.trim(),
  };
}
