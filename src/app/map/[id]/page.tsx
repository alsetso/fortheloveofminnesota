'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useToast } from '@/features/ui/hooks/useToast';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import MapIDBox from './components/MapIDBox';
import MapPageLayout from './MapPageLayout';
import MapPageHeaderButtons from './MapPageHeaderButtons';
import { generateUUID } from '@/lib/utils/uuid';

export interface MapTag {
  emoji: string;
  text: string;
}

export interface MapLayers {
  congressional_districts?: boolean;
  ctu_boundaries?: boolean;
  state_boundary?: boolean;
  county_boundaries?: boolean;
}

interface MapData {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  visibility: 'public' | 'private' | 'shared';
  map_style: 'street' | 'satellite' | 'light' | 'dark';
  map_layers?: MapLayers | null;
  type?: 'user' | 'community' | 'gov' | 'professional' | 'atlas' | 'user-generated' | null;
  collection_type?: 'community' | 'professional' | 'user' | 'atlas' | 'gov' | null;
  custom_slug?: string | null;
  is_primary?: boolean;
  hide_creator?: boolean;
  tags?: MapTag[] | null;
  meta?: {
    buildingsEnabled?: boolean;
    pitch?: number;
    terrainEnabled?: boolean;
    center?: [number, number];
    zoom?: number;
  } | null;
  created_at: string;
  updated_at: string;
  account: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  };
}

export default function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { account } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const { pro: proToast } = useToast();
  const mapInstanceRef = useRef<any>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewCount, setViewCount] = useState<number>(0);
  const [mapId, setMapId] = useState<string | null>(null);
  const [hasRecordedView, setHasRecordedView] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | 'all'>('7d');
  const [showDistricts, setShowDistricts] = useState(false);
  const [showCTU, setShowCTU] = useState(false);
  const [showStateBoundary, setShowStateBoundary] = useState(false);
  const [showCountyBoundaries, setShowCountyBoundaries] = useState(false);

  // Keep boundary toggles in sync with persisted map_layers
  useEffect(() => {
    const layers = mapData?.map_layers || {};
    setShowDistricts(Boolean(layers.congressional_districts));
    setShowCTU(Boolean(layers.ctu_boundaries));
    setShowStateBoundary(Boolean(layers.state_boundary));
    setShowCountyBoundaries(Boolean(layers.county_boundaries));
  }, [mapData?.map_layers]);

  // Get map ID from params
  useEffect(() => {
    params.then(({ id }) => {
      setMapId(id);
    });
  }, [params]);

  // Derived state
  const isOwner = useMemo(() => {
    return mapData && account ? mapData.account_id === account.id : false;
  }, [mapData, account]);

  // Stable map load handler so Mapbox is only initialized once per mount
  const handleMapLoad = useCallback((map: any) => {
    mapInstanceRef.current = map;
  }, []);

  const handleSettingsClick = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  const handleFilterClick = () => {
    setIsFilterOpen(!isFilterOpen);
  };

  // Ensure Mapbox canvas resizes when sidebars animate (desktop 3-col layout)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof map.resize !== 'function') return;

    let rafId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Resize immediately, then again after the width transition completes (300ms)
    rafId = window.requestAnimationFrame(() => {
      try {
        map.resize();
      } catch {
        // ignore
      }
    });

    timeoutId = setTimeout(() => {
      try {
        map.resize();
      } catch {
        // ignore
      }
    }, 340);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isFilterOpen, isSettingsOpen]);

  const handleTimeFilterChange = (filter: '24h' | '7d' | 'all') => {
    setTimeFilter(filter);
    window.dispatchEvent(new CustomEvent('mention-time-filter-change', {
      detail: { timeFilter: filter }
    }));
  };

  // Sync boundary state with map via events
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('map-boundaries-change', {
      detail: {
        showDistricts,
        showCTU,
        showStateBoundary,
        showCountyBoundaries,
      }
    }));
  }, [showDistricts, showCTU, showStateBoundary, showCountyBoundaries]);

  // Fetch map data, stats, and record view - runs once per mapId
  useEffect(() => {
    if (!mapId) return;

    let cancelled = false;

    const fetchMapAndStats = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch map data (RLS handles permissions)
        const response = await fetch(`/api/maps/${mapId}`);
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          if (response.status === 404) {
            setError('Map not found');
          } else if (response.status === 403) {
            setError('You do not have access to this map');
          } else {
            setError(data.error || 'Failed to load map');
          }
          setLoading(false);
          return;
        }

        // Validate response structure
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid map data received');
        }
        
        const map: MapData = data;
        setMapData(map);

        // Fetch stats and record view in parallel
        const [statsResponse] = await Promise.allSettled([
          fetch(`/api/maps/${mapId}/stats`),
          // Record view (only once per page load)
          !hasRecordedView && (async () => {
            setHasRecordedView(true);
            let sessionId: string | null = null;
            if (typeof window !== 'undefined') {
              sessionId = localStorage.getItem('analytics_device_id') || generateUUID();
              if (!localStorage.getItem('analytics_device_id')) {
                localStorage.setItem('analytics_device_id', sessionId);
              }
            }
            return fetch('/api/analytics/map-view', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                map_id: map.id,
                referrer_url: typeof window !== 'undefined' ? document.referrer || null : null,
                session_id: sessionId,
                user_agent: typeof window !== 'undefined' ? navigator.userAgent : null,
              }),
            }).catch(err => {
              console.error('Error recording map view:', err);
              return null;
            });
          })(),
        ]);

        if (cancelled) return;

        // Handle stats response
        if (statsResponse.status === 'fulfilled' && statsResponse.value) {
          try {
            if (!statsResponse.value.ok) {
              console.warn('Failed to fetch map stats:', statsResponse.value.statusText);
              setViewCount(0);
            } else {
              const statsData = await statsResponse.value.json();
              setViewCount(statsData.stats?.total_views || 0);
            }
          } catch (err) {
            console.error('Error parsing map stats:', err);
            setViewCount(0);
          }
        } else {
          setViewCount(0);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching map:', err);
        setError(err instanceof Error ? err.message : 'Failed to load map');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchMapAndStats();

    return () => {
      cancelled = true;
    };
  }, [mapId, hasRecordedView]);

  return (
    <>
      <PageWrapper
        headerContent={
          <MapPageHeaderButtons
            onSettingsClick={handleSettingsClick}
            onFilterClick={handleFilterClick}
            showSettings={isOwner}
          />
        }
        searchComponent={
          <MapSearchInput
            map={mapInstanceRef.current}
            onLocationSelect={(coordinates, placeName) => {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.flyTo({
                  center: [coordinates.lng, coordinates.lat],
                  zoom: 15,
                  duration: 1500,
                });
              }
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
        <div className="relative h-full w-full">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-50">
              <div className="text-center">
                <div className="w-6 h-6 border-4 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-600">Loading map...</p>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 p-[10px] z-50">
              <div className="bg-white border border-red-200 rounded-md p-[10px] max-w-md w-full">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">Access Denied</h2>
                <p className="text-xs text-gray-600 mb-3">{error}</p>
                <button
                  onClick={() => router.push('/maps')}
                  className="text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md py-1.5 px-3 transition-colors"
                >
                  Back to Maps
                </button>
              </div>
            </div>
          )}

          {mapData && !loading && (
            <MapPageLayout
              initialMap={mapData}
              onMapUpdated={(updated) => {
                setMapData(prev => prev ? { ...prev, ...updated } : updated);
              }}
              isFilterOpen={isFilterOpen}
              isSettingsOpen={isSettingsOpen}
              onFilterToggle={handleFilterClick}
              onSettingsToggle={handleSettingsClick}
              showSettings={isOwner}
            >
              <MapIDBox 
                mapStyle={mapData.map_style}
                mapId={mapData.id}
                isOwner={isOwner}
                meta={mapData.meta}
                showDistricts={showDistricts}
                showCTU={showCTU}
                showStateBoundary={showStateBoundary}
                showCountyBoundaries={showCountyBoundaries}
                title={mapData.title}
                description={mapData.description}
                visibility={mapData.visibility}
                account={mapData.account}
                viewCount={viewCount}
                hideCreator={mapData.hide_creator || false}
                map_account_id={mapData.account_id}
                current_account_id={account?.id || null}
                created_at={mapData.created_at}
                updated_at={mapData.updated_at}
                onMapLoad={handleMapLoad}
                onMapUpdate={(updatedData) => {
                  // Update local state with new data
                  setMapData(prev => prev ? { ...prev, ...updatedData } : null);
                }}
              />
            </MapPageLayout>
          )}
        </div>
      </PageWrapper>
    </>
  );
}

