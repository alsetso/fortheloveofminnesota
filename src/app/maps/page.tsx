'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlassIcon, PlusIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import MapCard from './components/MapCard';
import { COMMUNITY_MAPS, PROFESSIONAL_MAPS } from './constants';
import type { MapItem } from './types';

export default function MapsPage() {
  const router = useRouter();
  const { account } = useAuthStateSafe();
  const [userMaps, setUserMaps] = useState<MapItem[]>([]);
  const [accountMaps, setAccountMaps] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAccountMaps, setLoadingAccountMaps] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [communityMaps, setCommunityMaps] = useState<MapItem[]>(() => 
    COMMUNITY_MAPS.map(m => ({ ...m, view_count: 0 }))
  );
  const hasFetchedRef = useRef(false);
  const hasFetchedAccountMapsRef = useRef<string | null>(null);
  
  // Accordion state for each section
  const [isMyMapsOpen, setIsMyMapsOpen] = useState(true);
  const [isCommunityOpen, setIsCommunityOpen] = useState(true);
  const [isUserGeneratedOpen, setIsUserGeneratedOpen] = useState(true);

  // Professional maps are static - memoized to prevent recreation
  const professionalMaps: MapItem[] = useMemo(() => 
    PROFESSIONAL_MAPS.map(m => ({ ...m, view_count: 0 })),
    []
  );

  // Combine community and professional maps
  const allCommunityMaps = useMemo(() => 
    [...communityMaps, ...professionalMaps],
    [communityMaps, professionalMaps]
  );

  // Filter maps based on search query - includes both community and professional
  const filteredCommunityMaps = useMemo(() => {
    if (!searchQuery.trim()) return allCommunityMaps;
    const query = searchQuery.toLowerCase();
    return allCommunityMaps.filter(map => 
      map.title.toLowerCase().includes(query) ||
      (map.description && map.description.toLowerCase().includes(query))
    );
  }, [allCommunityMaps, searchQuery]);

  const filteredUserMaps = useMemo(() => {
    if (!searchQuery.trim()) return userMaps;
    const query = searchQuery.toLowerCase();
    return userMaps.filter(map => 
      map.title.toLowerCase().includes(query) ||
      (map.description && map.description.toLowerCase().includes(query))
    );
  }, [userMaps, searchQuery]);

  const filteredAccountMaps = useMemo(() => {
    if (!searchQuery.trim()) return accountMaps;
    const query = searchQuery.toLowerCase();
    return accountMaps.filter(map => 
      map.title.toLowerCase().includes(query) ||
      (map.description && map.description.toLowerCase().includes(query))
    );
  }, [accountMaps, searchQuery]);

  // Fetch user-generated maps and stats - only once on mount
  useEffect(() => {
    if (hasFetchedRef.current) {
      return;
    }

    hasFetchedRef.current = true;

    const fetchMapsAndStats = async () => {
      setLoading(true);
      try {
        // Fetch maps
      const response = await fetch('/api/maps?visibility=public');
      if (!response.ok) {
        throw new Error(`Failed to fetch maps: ${response.statusText}`);
      }
      const data = await response.json();
      
      if (!data.maps || data.maps.length === 0) {
        setUserMaps([]);
        setLoading(false);
        return;
      }

        // Transform maps and collect map IDs
        const transformedMaps = data.maps.map((map: any) => ({
          ...map,
          map_type: 'user' as const,
        }));

        const mapIds = transformedMaps.map((map: any) => map.id);

        // Fetch stats for all maps in batch
        const statsResponse = await fetch(`/api/maps/stats?ids=${mapIds.join(',')}`);
        if (!statsResponse.ok) {
          console.warn('Failed to fetch map stats, continuing without stats');
        }
        const statsData = await statsResponse.json();

        // Combine maps with stats
        const mapsWithStats = transformedMaps.map((map: any) => ({
          ...map,
          view_count: statsData.stats?.[map.id]?.total_views || 0,
        }));

        setUserMaps(mapsWithStats);

        // Fetch special map stats
        try {
          const [mentionStats, fraudStats] = await Promise.all([
            fetch('/api/analytics/special-map-stats?map_identifier=mention').then(r => r.json()),
            fetch('/api/analytics/special-map-stats?map_identifier=fraud').then(r => r.json()),
          ]);

          setCommunityMaps(prev => prev.map(map => {
            if (map.id === 'mention') {
              return { ...map, view_count: mentionStats.stats?.total_views || 0 };
            }
            if (map.id === 'fraud') {
              return { ...map, view_count: fraudStats.stats?.total_views || 0 };
            }
            return map;
          }));
        } catch (err) {
          console.error('Error fetching special map stats:', err);
        }
      } catch (err) {
        console.error('Error fetching maps:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMapsAndStats();
  }, []); // Empty dependency array - only fetch once on mount

  // Fetch account's maps (all visibilities) - only once per account
  useEffect(() => {
    if (!account?.id) {
      setAccountMaps([]);
      hasFetchedAccountMapsRef.current = null;
      return;
    }

    // If we've already fetched for this account, skip
    if (hasFetchedAccountMapsRef.current === account.id) {
      return;
    }

    hasFetchedAccountMapsRef.current = account.id;

    const fetchAccountMaps = async () => {
      setLoadingAccountMaps(true);
      try {
        // Fetch all maps for this account (RLS will return all visibilities)
        const response = await fetch(`/api/maps?account_id=${account.id}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch account maps: ${response.statusText}`);
        }
        const data = await response.json();
        
        if (!data.maps || data.maps.length === 0) {
          setAccountMaps([]);
          setLoadingAccountMaps(false);
          return;
        }

        // Transform maps and collect map IDs
        const transformedMaps = data.maps.map((map: any) => ({
          ...map,
          map_type: 'user' as const,
        }));

        const mapIds = transformedMaps.map((map: any) => map.id);

        // Fetch stats for all maps in batch
        if (mapIds.length > 0) {
          const statsResponse = await fetch(`/api/maps/stats?ids=${mapIds.join(',')}`);
          if (!statsResponse.ok) {
            console.warn('Failed to fetch account map stats, continuing without stats');
          }
          const statsData = await statsResponse.json();

          // Combine maps with stats
          const mapsWithStats = transformedMaps.map((map: any) => ({
            ...map,
            view_count: statsData.stats?.[map.id]?.total_views || 0,
          }));

          setAccountMaps(mapsWithStats);
        } else {
          setAccountMaps(transformedMaps);
        }
      } catch (err) {
        console.error('Error fetching account maps:', err);
      } finally {
        setLoadingAccountMaps(false);
      }
    };

    fetchAccountMaps();
  }, [account?.id]);


  return (
    <>
      <PageViewTracker />
      <SimplePageLayout containerMaxWidth="7xl" backgroundColor="bg-[#f4f2ef]" contentPadding="px-[10px] py-3">
        <div className="max-w-7xl mx-auto">
          <div className="w-full space-y-3">
            {/* Hero Area */}
            <div className="bg-white border border-gray-200 rounded-md p-[10px]">
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-gray-900">Maps of Minnesota</h1>
                <p className="text-xs text-gray-600">Join, explore and share within maps of all kinds across Minnesota</p>
              </div>
            </div>

            {/* Search and Create */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search maps..."
                  className="w-full pl-7 pr-2 py-1.5 text-xs bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
                />
              </div>
              <button
                onClick={() => router.push('/maps/new')}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
              >
                <PlusIcon className="w-3 h-3" />
                <span>Create</span>
              </button>
            </div>

            {/* My Maps - Only show if user is logged in */}
            {account && (
              <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                <button
                  onClick={() => setIsMyMapsOpen(!isMyMapsOpen)}
                  className="w-full flex items-center justify-between p-[10px] hover:bg-gray-50 transition-colors"
                >
                  <h2 className="text-sm font-semibold text-gray-900">
                    My Maps <span className="text-xs font-normal text-gray-500">({filteredAccountMaps.length})</span>
                  </h2>
                  <ChevronDownIcon
                    className={`w-4 h-4 text-gray-500 transition-transform ${isMyMapsOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isMyMapsOpen && (
                  <div className="p-[10px] pt-0">
                    {loadingAccountMaps ? (
                      <div className="text-xs text-gray-500">Loading your maps...</div>
                    ) : filteredAccountMaps.length === 0 ? (
                      <div className="text-xs text-gray-500">
                        {searchQuery ? 'No maps found' : 'You haven\'t created any maps yet'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                        {filteredAccountMaps.map((map) => (
                          <MapCard key={map.id} map={map} account={account} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Community Maps */}
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <button
                onClick={() => setIsCommunityOpen(!isCommunityOpen)}
                className="w-full flex items-center justify-between p-[10px] hover:bg-gray-50 transition-colors"
              >
                <h2 className="text-sm font-semibold text-gray-900">
                  Community <span className="text-xs font-normal text-gray-500">({filteredCommunityMaps.length})</span>
                </h2>
                <ChevronDownIcon
                  className={`w-4 h-4 text-gray-500 transition-transform ${isCommunityOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isCommunityOpen && (
                <div className="p-[10px] pt-0">
                  {filteredCommunityMaps.length === 0 ? (
                    <div className="text-xs text-gray-500">No maps found</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      {filteredCommunityMaps.map((map) => (
                        <MapCard key={map.id} map={map} account={account} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Generated Maps */}
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <button
                onClick={() => setIsUserGeneratedOpen(!isUserGeneratedOpen)}
                className="w-full flex items-center justify-between p-[10px] hover:bg-gray-50 transition-colors"
              >
                <h2 className="text-sm font-semibold text-gray-900">
                  User Generated (Public) <span className="text-xs font-normal text-gray-500">({filteredUserMaps.length})</span>
                </h2>
                <ChevronDownIcon
                  className={`w-4 h-4 text-gray-500 transition-transform ${isUserGeneratedOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isUserGeneratedOpen && (
                <div className="p-[10px] pt-0">
                  {loading ? (
                    <div className="text-xs text-gray-500">Loading maps...</div>
                  ) : filteredUserMaps.length === 0 ? (
                    <div className="text-xs text-gray-500">
                      {searchQuery ? 'No maps found' : 'No public maps yet'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      {filteredUserMaps.map((map) => (
                        <MapCard key={map.id} map={map} account={account} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </SimplePageLayout>
    </>
  );
}
