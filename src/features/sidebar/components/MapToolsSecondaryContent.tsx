'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { HeartIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { MentionService } from '@/features/mentions/services/mentionService';
import type { CreateMentionData } from '@/types/mention';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { CollectionService } from '@/features/collections/services/collectionService';
import type { Collection } from '@/types/collection';
import {
  useFeatureTracking,
  FeatureCard,
  type ExtractedFeature,
} from '@/features/map-metadata';


interface MapToolsSecondaryContentProps {
  map?: MapboxMapInstance | null;
  mapLoaded?: boolean;
}

export default function MapToolsSecondaryContent({ 
  map, 
  mapLoaded = false,
}: MapToolsSecondaryContentProps) {
  const { user, account, activeAccountId } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  
  // Location state - listen to map click events
  const [locationData, setLocationData] = useState<{
    coordinates: { lat: number; lng: number };
    address?: string;
    placeName?: string;
  } | null>(null);
  
  // Feature tracking
  const {
    clickFeature: hookClickFeature,
    clearClickFeature,
  } = useFeatureTracking(map || null, mapLoaded, { throttleMs: 50 });

  const [capturedFeature, setCapturedFeature] = useState<ExtractedFeature | null>(null);


  // Mention form state
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [pinDescription, setPinDescription] = useState('');
  const [pinEventMonth, setPinEventMonth] = useState<string>('');
  const [pinEventDay, setPinEventDay] = useState<string>('');
  const [pinEventYear, setPinEventYear] = useState<string>('');
  const [showPostDateInput, setShowPostDateInput] = useState(false);
  const [pinVisibility, setPinVisibility] = useState<'public' | 'only_me'>('public');
  const [isPinSubmitting, setIsPinSubmitting] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [loadingCollections, setLoadingCollections] = useState(false);

  // Sync hook's captured click feature
  useEffect(() => {
    if (hookClickFeature) {
      setCapturedFeature(hookClickFeature);
    }
  }, [hookClickFeature]);

  // Listen for map click events
  useEffect(() => {
    if (!map || !mapLoaded) return;

    const handleMapClick = (e: any) => {
      const { lng, lat } = e.lngLat;
      setLocationData({
        coordinates: { lat, lng },
      });
      setIsFormExpanded(false);
      setPinDescription('');
      clearClickFeature();
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, mapLoaded, clearClickFeature]);


  // Load collections when account is available
  useEffect(() => {
    if (!activeAccountId) {
      setCollections([]);
      setSelectedCollectionId(null);
      return;
    }

    const loadCollections = async () => {
      setLoadingCollections(true);
      try {
        const data = await CollectionService.getCollections(activeAccountId);
        setCollections(data);
      } catch (err) {
        console.error('[MapToolsSecondaryContent] Error loading collections:', err);
      } finally {
        setLoadingCollections(false);
      }
    };

    loadCollections();
  }, [activeAccountId]);


  const pinFeature = useMemo(() => {
    if (locationData) {
      return capturedFeature;
    }
    return null;
  }, [locationData, capturedFeature]);

  const resetForm = useCallback(() => {
    setIsFormExpanded(false);
    setPinDescription('');
    setPinEventMonth('');
    setPinEventDay('');
    setPinEventYear('');
    setShowPostDateInput(false);
    setPinVisibility('public');
    setPinError(null);
    setSelectedCollectionId(null);
  }, []);

  const handleSubmitMention = useCallback(async () => {
    if (!locationData?.coordinates || !user) return;

    setIsPinSubmitting(true);
    setPinError(null);

    try {
      // Build map meta from captured feature
      const mapMeta = pinFeature ? {
        name: pinFeature.name,
        category: pinFeature.category,
        properties: pinFeature.properties,
      } : null;


      // Build post date
      const postDate = pinEventMonth && pinEventDay && pinEventYear
        ? new Date(parseInt(pinEventYear), parseInt(pinEventMonth) - 1, parseInt(pinEventDay)).toISOString()
        : null;

      const mentionData: CreateMentionData = {
        lat: locationData.coordinates.lat,
        lng: locationData.coordinates.lng,
        description: pinDescription.trim() || null,
        visibility: pinVisibility,
        collection_id: selectedCollectionId || null,
        post_date: postDate,
        map_meta: mapMeta,
      };

      const createdMention = await MentionService.createMention(mentionData, activeAccountId || undefined);
      
      // Trigger refresh
      window.dispatchEvent(new CustomEvent('mention-created', {
        detail: { mention: createdMention }
      }));

      resetForm();
      setLocationData(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create mention';
      setPinError(errorMessage);
    } finally {
      setIsPinSubmitting(false);
    }
  }, [locationData, pinDescription, pinFeature, pinEventMonth, pinEventDay, pinEventYear, pinVisibility, user, activeAccountId, resetForm]);

  return (
    <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-120px)]">
      {/* Location Selection - Show when location is selected */}
      {locationData && (
        <div className="space-y-3">
          {/* Location Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
            <p className="text-xs text-gray-900 font-medium">
              {locationData.address || locationData.placeName || `${locationData.coordinates.lat.toFixed(6)}, ${locationData.coordinates.lng.toFixed(6)}`}
            </p>
          </div>

          {/* Map Meta */}
          {pinFeature && (pinFeature.name || pinFeature.properties?.class || pinFeature.label) && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
              <div className="flex items-center gap-1.5">
                {pinFeature.icon && (
                  <span className="text-xs flex-shrink-0">{pinFeature.icon}</span>
                )}
                <span className="text-[10px] text-gray-700 truncate">
                  {pinFeature.name || (pinFeature.properties?.class ? pinFeature.properties.class.replace(/_/g, ' ') : pinFeature.label)}
                </span>
              </div>
            </div>
          )}

          {/* Feature Card - Detailed feature info */}
          {pinFeature && (
            <FeatureCard feature={pinFeature} />
          )}

          {/* Mention Form */}
          {isFormExpanded ? (
            <div className="space-y-2 border border-gray-200 rounded-md p-3">
              {/* Form Header */}
              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <span className="text-xs font-medium text-gray-900">Create Mention</span>
                <button
                  onClick={resetForm}
                  className="text-gray-500 hover:text-gray-900 transition-colors"
                  disabled={isPinSubmitting}
                >
                  <ChevronUpIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Account Info */}
              {account && account.username && (
                <div className="flex items-center gap-2 pb-2">
                  {account.image_url ? (
                    <img 
                      src={account.image_url} 
                      alt={account.username} 
                      className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-700 font-medium flex-shrink-0">
                      {account.username[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs font-medium text-gray-900 truncate">
                    @{account.username}
                  </span>
                </div>
              )}

              {/* Collection Selector */}
              {activeAccountId && collections.length > 0 && (
                <div>
                  <select
                    value={selectedCollectionId || ''}
                    onChange={(e) => setSelectedCollectionId(e.target.value || null)}
                    disabled={isPinSubmitting}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white text-gray-900 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Unassigned</option>
                    {collections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.emoji} {collection.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Description */}
              <div>
                <textarea
                  value={pinDescription}
                  onChange={(e) => {
                    if (e.target.value.length <= 240) {
                      setPinDescription(e.target.value);
                    }
                  }}
                  maxLength={240}
                  className="w-full px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none resize-none border border-gray-200 rounded-md"
                  placeholder="What's going on here?"
                  rows={5}
                  disabled={isPinSubmitting}
                />
                <div className="flex items-center justify-between mt-1">
                  {/* Date Selector */}
                  <div>
                    {!showPostDateInput ? (
                      <button
                        type="button"
                        onClick={() => setShowPostDateInput(true)}
                        className="text-xs text-gray-600 hover:text-gray-900 underline"
                        disabled={isPinSubmitting}
                      >
                        Post Date
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="grid grid-cols-3 gap-1">
                          <input
                            type="number"
                            value={pinEventMonth}
                            onChange={(e) => {
                              const monthValue = e.target.value;
                              if (!monthValue || (monthValue >= '1' && monthValue <= '12')) {
                                setPinEventMonth(monthValue);
                                setPinError(null);
                              }
                            }}
                            min="1"
                            max="12"
                            placeholder="M"
                            className="w-10 px-2 py-1 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                            disabled={isPinSubmitting}
                          />
                          <input
                            type="number"
                            value={pinEventDay}
                            onChange={(e) => {
                              const dayValue = e.target.value;
                              if (!dayValue || (dayValue >= '1' && dayValue <= '31')) {
                                setPinEventDay(dayValue);
                                setPinError(null);
                              }
                            }}
                            min="1"
                            max="31"
                            placeholder="D"
                            className="w-10 px-2 py-1 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                            disabled={isPinSubmitting}
                          />
                          <input
                            type="number"
                            value={pinEventYear}
                            onChange={(e) => {
                              setPinEventYear(e.target.value);
                              setPinError(null);
                            }}
                            min={new Date().getFullYear() - 100}
                            max={new Date().getFullYear()}
                            placeholder="Y"
                            className="w-12 px-2 py-1 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                            disabled={isPinSubmitting}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPostDateInput(false);
                            setPinEventMonth('');
                            setPinEventDay('');
                            setPinEventYear('');
                          }}
                          className="text-[10px] text-gray-400 hover:text-gray-600"
                          disabled={isPinSubmitting}
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Character Count */}
                  <span className={`text-[10px] ${pinDescription.length >= 240 ? 'text-red-500' : 'text-gray-400'}`}>
                    {pinDescription.length}/240
                  </span>
                </div>
              </div>

              {/* Visibility Toggle */}
              <div className="flex items-center justify-between p-2 border border-gray-200 rounded-md">
                <span className="text-xs text-gray-700">Visibility</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPinVisibility('public')}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      pinVisibility === 'public'
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    disabled={isPinSubmitting}
                  >
                    Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setPinVisibility('only_me')}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      pinVisibility === 'only_me'
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    disabled={isPinSubmitting}
                  >
                    Only Me
                  </button>
                </div>
              </div>

              {/* Error */}
              {pinError && (
                <div className="text-[10px] text-red-600 bg-red-50 p-2 rounded">
                  {pinError}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmitMention}
                disabled={isPinSubmitting || !pinDescription.trim() || !user}
                className="w-full px-3 py-2 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPinSubmitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          ) : (
            /* Create Button */
            <button
              onClick={() => {
                if (!user) {
                  openWelcome();
                  return;
                }
                setIsFormExpanded(true);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
            >
              <span>Create Mention</span>
              <HeartIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* No Location Selected */}
      {!locationData && (
        <div className="text-center py-6 text-xs text-gray-500">
          Click on the map to select a location
        </div>
      )}
    </div>
  );
}

