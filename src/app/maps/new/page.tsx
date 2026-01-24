'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MapIcon, GlobeAltIcon, BuildingOfficeIcon, MapPinIcon, SunIcon, MoonIcon, ChevronLeftIcon, ChevronRightIcon, LockClosedIcon, UserIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { useAuthStateSafe } from '@/features/auth';
import { AccountService } from '@/features/auth';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import { addBuildingExtrusions, removeBuildingExtrusions } from '@/features/map/utils/addBuildingExtrusions';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import PageViewTracker from '@/components/analytics/PageViewTracker';

export default function NewMapPage() {
  const router = useRouter();
  const { account, user } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'shared'>('private');
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite' | 'light' | 'dark'>('street');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [mapLimit, setMapLimit] = useState<{current: number; max: number | null; type: string} | null>(null);
  const isAdmin = account?.role === 'admin';
  const totalSteps = isAdmin ? 7 : 6; // Add admin step if user is admin
  
  // Admin-only settings
  const [isPrimary, setIsPrimary] = useState(false);
  const [hideCreator, setHideCreator] = useState(false);
  const [collectionType, setCollectionType] = useState<'community' | 'professional' | 'user' | 'atlas' | 'gov' | null>(null);
  const [customSlug, setCustomSlug] = useState('');

  // Meta settings
  const [meta, setMeta] = useState<{
    buildingsEnabled: boolean;
    pitch: number;
    terrainEnabled: boolean;
    center?: [number, number];
    zoom?: number;
  }>({
    buildingsEnabled: false,
    pitch: 60,
    terrainEnabled: false,
  });

  // Fetch map limit on mount
  useEffect(() => {
    if (!user || !account) return;
    
    const fetchMapLimit = async () => {
      try {
        // Get user's map count
        const mapsResponse = await fetch(`/api/maps?account_id=${account.id}`);
        if (mapsResponse.ok) {
          const mapsData = await mapsResponse.json();
          const currentCount = mapsData.maps?.length || 0;
          
          // Get account features to find map limit (account-scoped; includes limits)
          const featuresResponse = await fetch('/api/billing/user-features');
          if (featuresResponse.ok) {
            const featuresData = await featuresResponse.json();
            const features: any[] = Array.isArray(featuresData.features) ? featuresData.features : [];

            const limited = features.find((f) => f.slug === 'custom_maps');

            if (limited && (limited.is_unlimited || limited.limit_type === 'unlimited')) {
              setMapLimit({ current: currentCount, max: null, type: 'unlimited' });
              return;
            }

            if (limited) {
              setMapLimit({
                current: currentCount,
                max: limited.limit_value ?? null,
                type: limited.limit_type || 'count',
              });
              return;
            }

            // No explicit entitlement row returned (treat as no access)
            setMapLimit({ current: currentCount, max: 0, type: 'count' });
          }
        }
      } catch (err) {
        console.error('Failed to fetch map limit:', err);
      }
    };
    
    fetchMapLimit();
  }, [user, account]);

  // Mapbox state
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);

  // Initialize mapbox once - map preview stays static
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainer.current || mapInstanceRef.current) return;

    let mounted = true;

    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      return;
    }

    const initMap = async () => {
      if (!mounted || !mapContainer.current || mapInstanceRef.current) return;

      try {
        await import('mapbox-gl/dist/mapbox-gl.css');
        const mapbox = await loadMapboxGL();
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!mapContainer.current || !mounted || mapInstanceRef.current) return;

        const getStyleUrl = () => {
          switch (mapStyle) {
            case 'satellite':
              return MAP_CONFIG.STRATEGIC_STYLES.satellite;
            case 'light':
              return MAP_CONFIG.STRATEGIC_STYLES.light;
            case 'dark':
              return MAP_CONFIG.STRATEGIC_STYLES.dark;
            default:
              return MAP_CONFIG.STRATEGIC_STYLES.streets;
          }
        };

        const mapInstance = new mapbox.Map({
          container: mapContainer.current,
          style: getStyleUrl(),
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
          pitch: meta.pitch,
          maxZoom: MAP_CONFIG.MAX_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
        });

        mapInstanceRef.current = mapInstance as MapboxMapInstance;

        mapInstance.on('load', () => {
          if (mounted) {
            setTimeout(() => {
              if (mapInstance && !(mapInstance as MapboxMapInstance)._removed) {
                mapInstance.resize();
                // Apply initial meta settings
                applyMetaSettings(mapInstance as MapboxMapInstance, meta);
              }
            }, 100);
            setMapLoaded(true);
          }
        });
      } catch (err) {
        console.error('Failed to initialize map:', err);
      }
    };

    initMap();

    return () => {
      mounted = false;
      // Cleanup map instance on unmount
      if (mapInstanceRef.current) {
        try {
          const mapboxMap = mapInstanceRef.current as any;
          if (!mapboxMap.removed) {
            mapInstanceRef.current.remove();
          }
        } catch (err) {
          // Ignore cleanup errors
        }
        mapInstanceRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Helper function to apply meta settings - memoized to prevent recreation
  const applyMetaSettings = useCallback((map: MapboxMapInstance, settings: typeof meta) => {
    const mapboxMap = map as any;
    if (mapboxMap.removed) return;
    
    // Apply pitch
    if (settings.pitch !== undefined) {
      mapboxMap.setPitch(settings.pitch);
    }

    // Apply buildings
    if (settings.buildingsEnabled) {
      addBuildingExtrusions(map, { opacity: 0.6 });
    } else {
      removeBuildingExtrusions(map);
    }
  }, []);

  // Update map style when mapStyle changes
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;

    const getStyleUrl = () => {
      switch (mapStyle) {
        case 'satellite':
          return MAP_CONFIG.STRATEGIC_STYLES.satellite;
        case 'light':
          return MAP_CONFIG.STRATEGIC_STYLES.light;
        case 'dark':
          return MAP_CONFIG.STRATEGIC_STYLES.dark;
        default:
          return MAP_CONFIG.STRATEGIC_STYLES.streets;
      }
    };

    mapInstanceRef.current.setStyle(getStyleUrl());
    
    // Reapply meta settings after style loads
    mapInstanceRef.current.once('style.load', () => {
      if (mapInstanceRef.current) {
        applyMetaSettings(mapInstanceRef.current, meta);
      }
    });
  }, [mapStyle, mapLoaded, meta, applyMetaSettings]);

  // Update map when meta changes
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;
    applyMetaSettings(mapInstanceRef.current, meta);
  }, [meta, mapLoaded, applyMetaSettings]);

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent form submission on Enter key unless on final step
    if (e.key === 'Enter' && currentStep < totalSteps - 1) {
      e.preventDefault();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Only allow submission on the final step
    if (currentStep < totalSteps - 1) {
      return;
    }

    if (!user) {
      setError('Please sign in to create maps');
      return;
    }

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Capture current map center and zoom if map is loaded
      const finalMeta = { ...meta };
      if (mapInstanceRef.current && mapLoaded) {
        try {
          const center = mapInstanceRef.current.getCenter();
          const zoom = mapInstanceRef.current.getZoom();
          finalMeta.center = [center.lng, center.lat];
          finalMeta.zoom = zoom;
        } catch (err) {
          console.warn('[NewMapPage] Failed to get map center/zoom:', err);
        }
      }

      const response = await fetch('/api/maps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          visibility,
          map_style: mapStyle,
          meta: finalMeta,
          ...(isAdmin && {
            is_primary: isPrimary,
            hide_creator: hideCreator,
            collection_type: collectionType,
            custom_slug: customSlug.trim() || null,
          }),
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create map';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `${errorMessage}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      const createdMap = data.map || data;

      // Success - navigate to the created map (use slug if available, otherwise id)
      const mapUrl = createdMap.custom_slug 
        ? `/map/${createdMap.custom_slug}`
        : `/map/${createdMap.id}`;
      router.push(mapUrl);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create map';
      console.error('[NewMapPage] Error creating map:', errorMessage, err);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Get Started
        return (
          <div className="space-y-3">
            <div className="text-center space-y-2">
              <h2 className="text-sm font-semibold text-gray-900">Create Your Map</h2>
              <p className="text-xs text-gray-600">
                Build a custom map of Minnesota with your own pins, markers, and settings.
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 space-y-2">
              <div className="flex items-start gap-2">
                <MapIcon className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-900">Map Customization</p>
                  <p className="text-xs text-gray-600">
                    Choose from different map styles, adjust the viewing angle, and enable 3D buildings.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <BuildingOfficeIcon className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-900">Tip: Zoom In to See Buildings</p>
                  <p className="text-xs text-gray-600">
                    3D buildings appear when you zoom in close. Try zooming in on the map preview to see them!
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 1: // Map Style
        return (
          <div className="space-y-3">
            <div className="text-center space-y-1">
              <h2 className="text-sm font-semibold text-gray-900">Choose Map Style</h2>
              <p className="text-xs text-gray-600">Select a style for your map</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMapStyle('street');
                }}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium border rounded-md transition-colors ${
                  mapStyle === 'street'
                    ? 'bg-gray-100 border-gray-300 text-gray-900'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <MapIcon className="w-4 h-4" />
                <span>Street</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMapStyle('satellite');
                }}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium border rounded-md transition-colors ${
                  mapStyle === 'satellite'
                    ? 'bg-gray-100 border-gray-300 text-gray-900'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <GlobeAltIcon className="w-4 h-4" />
                <span>Satellite</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMapStyle('light');
                }}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium border rounded-md transition-colors ${
                  mapStyle === 'light'
                    ? 'bg-gray-100 border-gray-300 text-gray-900'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <SunIcon className="w-4 h-4" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMapStyle('dark');
                }}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium border rounded-md transition-colors ${
                  mapStyle === 'dark'
                    ? 'bg-gray-100 border-gray-300 text-gray-900'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <MoonIcon className="w-4 h-4" />
                <span>Dark</span>
              </button>
            </div>
          </div>
        );

      case 2: // Pitch
        return (
          <div className="space-y-3">
            <div className="text-center space-y-1">
              <h2 className="text-sm font-semibold text-gray-900">Set Map Pitch</h2>
              <p className="text-xs text-gray-600">Adjust the tilt angle of your map</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-1.5">
                <MapPinIcon className="w-4 h-4 text-gray-600" />
                <span className="text-xs font-medium text-gray-900">Pitch: {meta.pitch}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={meta.pitch}
                onChange={(e) => setMeta(prev => ({ ...prev, pitch: parseInt(e.target.value) }))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        );

      case 3: // 3D Buildings
        return (
          <div className="space-y-3">
            <div className="text-center space-y-1">
              <h2 className="text-sm font-semibold text-gray-900">3D Buildings</h2>
              <p className="text-xs text-gray-600">Enable 3D building extrusions</p>
            </div>
            <select
              value={meta.buildingsEnabled ? 'enabled' : 'disabled'}
              onChange={(e) => setMeta(prev => ({ ...prev, buildingsEnabled: e.target.value === 'enabled' }))}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
            >
              <option value="disabled">Disabled</option>
              <option value="enabled">Enabled</option>
            </select>
          </div>
        );

      case 4: // Visibility
        return (
          <div className="space-y-3">
            <div className="text-center space-y-1">
              <h2 className="text-sm font-semibold text-gray-900">Set Visibility</h2>
              <p className="text-xs text-gray-600">Choose who can see this map</p>
            </div>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'public' | 'private' | 'shared')}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
              <option value="shared">Shared</option>
            </select>
            <p className="text-[10px] text-gray-500 text-center">
              {visibility === 'private' && 'Only you can see this map'}
              {visibility === 'public' && 'Everyone can see this map'}
              {visibility === 'shared' && 'You can share this map with specific accounts'}
            </p>
          </div>
        );

      case 5: // Title and Description
        return (
          <div className="space-y-3">
            <div className="text-center space-y-1">
              <h2 className="text-sm font-semibold text-gray-900">Map Details</h2>
              <p className="text-xs text-gray-600">Give your map a title and description</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="title" className="text-xs font-medium text-gray-900">
                Title *
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                placeholder="Enter map title"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="description" className="text-xs font-medium text-gray-900">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 resize-none"
                placeholder="Optional description"
              />
            </div>
          </div>
        );

      case 6: // Admin Settings (only visible to admins)
        if (!isAdmin) {
          // Skip this step if not admin
          return null;
        }
        return (
          <div className="space-y-3">
            <div className="text-center space-y-1">
              <h2 className="text-sm font-semibold text-gray-900">Admin Settings</h2>
              <p className="text-xs text-gray-600">Configure advanced map settings</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="is_primary" className="text-xs font-medium text-gray-900">
                  Mark as Primary
                </label>
                <select
                  id="is_primary"
                  value={isPrimary ? 'yes' : 'no'}
                  onChange={(e) => setIsPrimary(e.target.value === 'yes')}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
                <p className="text-[10px] text-gray-500">
                  Mark this map as the primary/canonical map
                </p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="hide_creator" className="text-xs font-medium text-gray-900">
                  Hide Creator
                </label>
                <select
                  id="hide_creator"
                  value={hideCreator ? 'yes' : 'no'}
                  onChange={(e) => setHideCreator(e.target.value === 'yes')}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
                <p className="text-[10px] text-gray-500">
                  Hide the creator badge on the map card
                </p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="collection_type" className="text-xs font-medium text-gray-900">
                  Collection Type
                </label>
                <select
                  id="collection_type"
                  value={collectionType || ''}
                  onChange={(e) => setCollectionType(e.target.value as typeof collectionType || null)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                >
                  <option value="">None</option>
                  <option value="community">Community</option>
                  <option value="professional">Professional</option>
                  <option value="user">User</option>
                  <option value="atlas">Atlas</option>
                  <option value="gov">Government</option>
                </select>
                <p className="text-[10px] text-gray-500">
                  Categorize this map for the maps listing page
                </p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="custom_slug" className="text-xs font-medium text-gray-900">
                  Custom Slug
                </label>
                <input
                  id="custom_slug"
                  type="text"
                  value={customSlug}
                  onChange={(e) => {
                    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                    setCustomSlug(value);
                  }}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                  placeholder="my-custom-map-slug"
                  pattern="[a-z0-9-]+"
                  minLength={3}
                  maxLength={100}
                />
                <p className="text-[10px] text-gray-500">
                  Custom URL slug (lowercase, alphanumeric and hyphens only, 3-100 characters). If set, map will be accessible at /map/{customSlug || 'slug'}
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <PageViewTracker />
      <PageWrapper
        headerContent={null}
        searchComponent={
          <MapSearchInput
            onLocationSelect={() => {
              // Handle location selection if needed
            }}
          />
        }
        accountDropdownProps={{
          onAccountClick: () => {
            // Handle account click
          },
          onSignInClick: openWelcome,
        }}
        searchResultsComponent={<SearchResults />}
      >
        <div className="max-w-7xl mx-auto px-4 py-6 overflow-y-auto">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Left Side - Form Steps */}
            <div className="flex-1 lg:max-w-md w-full">
              <div className="space-y-3">
                {/* Map Limit Indicator */}
                {mapLimit && !isAdmin && mapLimit.type !== 'unlimited' && (
                  <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-900">Maps Created</span>
                      <span className="text-xs font-semibold text-gray-700">
                        {mapLimit.current} / {mapLimit.max === null ? '∞' : mapLimit.max}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          mapLimit.max !== null && mapLimit.current >= mapLimit.max
                            ? 'bg-red-500'
                            : mapLimit.max !== null && mapLimit.current / mapLimit.max > 0.8
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{
                          width: mapLimit.max !== null
                            ? `${Math.min((mapLimit.current / mapLimit.max) * 100, 100)}%`
                            : '0%'
                        }}
                      />
                    </div>
                    {mapLimit.max !== null && mapLimit.current >= mapLimit.max && (
                      <p className="text-[10px] text-red-600 mt-1.5">
                        Map limit reached. <a href="/billing" className="underline font-medium">Upgrade your plan</a> to create more maps.
                      </p>
                    )}
                  </div>
                )}
                
                {/* Header */}
                <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                  <h1 className="text-sm font-semibold text-gray-900">Create New Map</h1>
                  <div className="mt-2 flex items-center gap-1">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 h-1 rounded-full ${
                          i <= currentStep ? 'bg-indigo-600' : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Step Content */}
                <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="bg-white border border-gray-200 rounded-md p-[10px]">
                  {renderStepContent()}

                  {/* Navigation */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-200">
                    {currentStep > 0 && (
                      <button
                        type="button"
                        onClick={handleBack}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      >
                        <ChevronLeftIcon className="w-4 h-4" />
                        <span>Back</span>
                      </button>
                    )}
                    <div className="flex-1" />
                    {currentStep < totalSteps - 1 ? (
                      <button
                        type="button"
                        onClick={handleNext}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                      >
                        <span>Next</span>
                        <ChevronRightIcon className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={isSubmitting || !title.trim()}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Creating...' : 'Create Map'}
                      </button>
                    )}
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="mt-3 bg-red-50 border border-red-200 rounded-md p-2">
                      <p className="text-xs text-red-600">{error}</p>
                    </div>
                  )}
                </form>
              </div>
            </div>

            {/* Right Side - Map Preview */}
            <div className="flex-1 lg:max-w-2xl w-full">
              <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-900">
                    Map Preview
                  </label>
                  <div className="relative w-full border border-gray-200 rounded-md overflow-hidden bg-gray-50 h-[300px] sm:h-[400px] lg:h-[500px]">
                    <div 
                      ref={mapContainer} 
                      className="w-full h-full"
                      style={{ margin: 0, padding: 0 }}
                    />
                    {!mapLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                        <div className="text-center">
                          <div className="w-6 h-6 border-4 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          <div className="text-gray-600 text-xs font-medium">Loading map...</div>
                        </div>
                      </div>
                    )}
                    
                    {/* Floating User Info - Top Right */}
                    {account && mapLoaded && (
                      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-md px-2 py-1">
                        <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                          {account.image_url ? (
                            <Image
                              src={account.image_url}
                              alt={AccountService.getDisplayName(account) || 'User'}
                              width={20}
                              height={20}
                              className="w-full h-full object-cover"
                              unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
                            />
                          ) : (
                            <UserIcon className="w-3 h-3 text-gray-500" />
                          )}
                        </div>
                        <span className="text-xs font-medium text-gray-900">
                          {account.username || AccountService.getDisplayName(account) || 'User'}
                        </span>
                      </div>
                    )}

                    {/* Floating Privacy Label - Bottom Right */}
                    {mapLoaded && (
                      <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-md px-2 py-1">
                        {visibility === 'private' ? (
                          <>
                            <LockClosedIcon className="w-3 h-3 text-gray-600" />
                            <span className="text-xs text-gray-700">Private</span>
                          </>
                        ) : visibility === 'public' ? (
                          <>
                            <GlobeAltIcon className="w-3 h-3 text-gray-600" />
                            <span className="text-xs text-gray-700">Public</span>
                          </>
                        ) : (
                          <>
                            <UserIcon className="w-3 h-3 text-gray-600" />
                            <span className="text-xs text-gray-700">Shared</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 text-center mt-1.5">
                    Zoom and drag the map to reposition for your Maps card image.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageWrapper>
    </>
  );
}

