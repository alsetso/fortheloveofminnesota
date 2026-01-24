'use client';

import { useState, useEffect, useMemo } from 'react';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import GovPageViewTracker from './components/GovPageViewTracker';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useAuthStateSafe } from '@/features/auth';
import Link from 'next/link';
import { UserIcon, ChartBarIcon, MapIcon } from '@heroicons/react/24/outline';
import MapCard from '@/app/maps/components/MapCard';
import type { MapItem } from '@/app/maps/types';

export default function GovPageClient() {
  const { openWelcome } = useAppModalContextSafe();
  const { account } = useAuthStateSafe();
  const [govMaps, setGovMaps] = useState<MapItem[]>([]);
  const [loadingGovMaps, setLoadingGovMaps] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Limit maps based on viewport: 2x4 (8) on mobile, 3x3 (9) on desktop
  const displayedMaps = useMemo(() => {
    return isMobile ? govMaps.slice(0, 8) : govMaps.slice(0, 9);
  }, [govMaps, isMobile]);

  // Fetch government maps on mount with caching
  useEffect(() => {
    const CACHE_KEY = 'gov_maps_cache';
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    const fetchGovMaps = async () => {
      // Check cache first
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setGovMaps(data);
            setLoadingGovMaps(false);
            return;
          }
        }
      } catch (err) {
        // Cache read failed, continue with fetch
      }

      setLoadingGovMaps(true);
      try {
        const response = await fetch('/api/maps?collection_type=gov&visibility=public');
        if (!response.ok) {
          throw new Error(`Failed to fetch gov maps: ${response.statusText}`);
        }
        const data = await response.json();
        
        if (!data.maps || data.maps.length === 0) {
          setGovMaps([]);
          setLoadingGovMaps(false);
          return;
        }

        const transformedMaps = data.maps.map((map: any) => ({
          ...map,
          map_type: 'gov' as const,
          href: map.custom_slug ? `/map/${map.custom_slug}` : `/map/${map.id}`,
        }));

        const mapIds = transformedMaps.map((map: any) => map.id);

        if (mapIds.length > 0) {
          const statsResponse = await fetch(`/api/maps/stats?ids=${mapIds.join(',')}`);
          if (!statsResponse.ok) {
            // Continue without stats if fetch fails
          } else {
            const statsData = await statsResponse.json();
            const mapsWithStats = transformedMaps.map((map: any) => ({
              ...map,
              view_count: statsData.stats?.[map.id]?.total_views || 0,
            }));
            
            // Cache the result
            try {
              sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                data: mapsWithStats,
                timestamp: Date.now(),
              }));
            } catch (err) {
              // Cache write failed, continue
            }
            
            setGovMaps(mapsWithStats);
            setLoadingGovMaps(false);
            return;
          }
        }
        
        // Cache maps without stats
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            data: transformedMaps,
            timestamp: Date.now(),
          }));
        } catch (err) {
          // Cache write failed, continue
        }
        
        setGovMaps(transformedMaps);
      } catch (err) {
        // Silent fail - maps section just won't show
        setGovMaps([]);
      } finally {
        setLoadingGovMaps(false);
      }
    };

    fetchGovMaps();
  }, []);

  return (
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
      <div className="h-full overflow-y-auto scrollbar-hide">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <GovPageViewTracker />
          
          {/* Header */}
          <div className="mb-3 space-y-1.5">
            <h1 className="text-sm font-semibold text-gray-900">
              Minnesota Government Directory
            </h1>
            <p className="text-xs text-gray-600">
              A community-maintained directory of Minnesota state government organizations, officials, and their roles.
            </p>
          </div>

          {/* Dataset Cards */}
          <div className="space-y-2">
            <Link
              href="/gov/people"
              className="group bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors block"
            >
              <div className="flex items-start gap-2">
                <div className="p-[10px] bg-gray-100 rounded-md group-hover:bg-gray-200 transition-colors flex-shrink-0">
                  <UserIcon className="w-4 h-4 text-gray-700" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xs font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">
                      People
                    </h2>
                    <svg className="w-3 h-3 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-600">
                    View all Minnesota government officials and elected representatives. Search, filter, and edit person details.
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href="/gov/checkbook"
              className="group bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors block"
            >
              <div className="flex items-start gap-2">
                <div className="p-[10px] bg-gray-100 rounded-md group-hover:bg-gray-200 transition-colors flex-shrink-0">
                  <ChartBarIcon className="w-4 h-4 text-gray-700" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xs font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">
                      State Checkbook
                    </h2>
                    <svg className="w-3 h-3 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-600">
                    Government financial data including contracts, payments, payroll, and budget information.
                  </p>
                </div>
              </div>
            </Link>
          </div>

          {/* Government Maps Section */}
          {govMaps.length > 0 && (
            <div className="mt-3 bg-white border border-gray-200 rounded-md p-[10px]">
              <div className="flex items-center gap-1.5 mb-2">
                <MapIcon className="w-3 h-3 text-gray-600" />
                <h2 className="text-xs font-semibold text-gray-900">Government Maps</h2>
              </div>
              {loadingGovMaps ? (
                <p className="text-xs text-gray-500">Loading maps...</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 w-full">
                  {displayedMaps.map((map) => (
                    <MapCard 
                      key={map.id} 
                      map={map} 
                      account={account}
                      fullWidth={true}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
