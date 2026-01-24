'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MagnifyingGlassIcon, PlusIcon, MapIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import MapCard from './components/MapCard';
import { COMMUNITY_MAPS, PROFESSIONAL_MAPS } from './constants';
import type { MapItem } from './types';

type TabType = 'my-maps' | 'community' | 'professional';

export default function MapsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { account } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const [userMaps, setUserMaps] = useState<MapItem[]>([]);
  const [accountMaps, setAccountMaps] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAccountMaps, setLoadingAccountMaps] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [communityMaps, setCommunityMaps] = useState<MapItem[]>(() => 
    COMMUNITY_MAPS.map(m => ({ ...m, view_count: 0 }))
  );
  // Track which tabs have been fetched
  const fetchedTabsRef = useRef<Set<TabType | 'user-generated'>>(new Set());
  const hasFetchedAccountMapsRef = useRef<string | null>(null);
  
  // Get initial tab from URL or default
  const getInitialTab = (): TabType => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['my-maps', 'community', 'professional'].includes(tabParam)) {
      return tabParam as TabType;
    }
    return account ? 'my-maps' : 'community';
  };
  
  // Active tab state - default to first available tab or URL param
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
  
  // Update active tab when URL param or account changes
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['my-maps', 'community', 'professional'].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
    } else if (account) {
      setActiveTab('my-maps');
    } else {
      setActiveTab('community');
    }
  }, [searchParams, account?.id]);
  const [professionalMaps, setProfessionalMaps] = useState<MapItem[]>(() => 
    PROFESSIONAL_MAPS.map(m => ({ ...m, view_count: 0 }))
  );
  const [loadingProfessionalMaps, setLoadingProfessionalMaps] = useState(false);

  // Filter maps based on search query
  const filteredCommunityMaps = useMemo(() => {
    if (!searchQuery.trim()) return communityMaps;
    const query = searchQuery.toLowerCase();
    return communityMaps.filter(map => 
      map.title.toLowerCase().includes(query) ||
      (map.description && map.description.toLowerCase().includes(query))
    );
  }, [communityMaps, searchQuery]);

  const filteredProfessionalMaps = useMemo(() => {
    if (!searchQuery.trim()) return professionalMaps;
    const query = searchQuery.toLowerCase();
    return professionalMaps.filter(map => 
      map.title.toLowerCase().includes(query) ||
      (map.description && map.description.toLowerCase().includes(query))
    );
  }, [professionalMaps, searchQuery]);

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



  // Fetch user-generated maps and stats - only when 'community' tab is selected
  useEffect(() => {
    if (activeTab !== 'community' || fetchedTabsRef.current.has('user-generated')) {
      return;
    }

    fetchedTabsRef.current.add('user-generated');

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
      } catch (err) {
        console.error('Error fetching maps:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMapsAndStats();
  }, [activeTab]);

  // Fetch community map stats - only when 'community' tab is selected
  useEffect(() => {
    if (activeTab !== 'community' || fetchedTabsRef.current.has('community')) {
      return;
    }

    fetchedTabsRef.current.add('community');

    const fetchCommunityStats = async () => {
      try {
        const mentionStats = await fetch('/api/analytics/special-map-stats?map_identifier=mention').then(r => r.json());

        setCommunityMaps(prev => prev.map(map => {
          if (map.id === 'mention') {
            return { ...map, view_count: mentionStats.stats?.total_views || 0 };
          }
          return map;
        }));
      } catch (err) {
        console.error('Error fetching community map stats:', err);
      }
    };

    fetchCommunityStats();
  }, [activeTab]);

  // Fetch account's maps (all visibilities) - only when 'my-maps' tab is selected
  useEffect(() => {
    if (activeTab !== 'my-maps' || !account?.id) {
      if (!account?.id) {
        setAccountMaps([]);
        hasFetchedAccountMapsRef.current = null;
      }
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
  }, [activeTab, account?.id]);


  // Fetch professional map stats - only when 'professional' tab is selected
  useEffect(() => {
    if (activeTab !== 'professional' || fetchedTabsRef.current.has('professional')) {
      return;
    }

    fetchedTabsRef.current.add('professional');

    const fetchProfessionalStats = async () => {
      setLoadingProfessionalMaps(true);
      try {
        const [fraudStats, realestateStats, skipTracingStats] = await Promise.all([
          fetch('/api/analytics/special-map-stats?map_identifier=fraud').then(r => r.json()).catch(() => ({ stats: { total_views: 0 } })),
          fetch('/api/analytics/special-map-stats?map_identifier=realestate').then(r => r.json()).catch(() => ({ stats: { total_views: 0 } })),
          fetch('/api/analytics/special-map-stats?map_identifier=skip-tracing').then(r => r.json()).catch(() => ({ stats: { total_views: 0 } })),
        ]);

        setProfessionalMaps(prev => prev.map(map => {
          if (map.id === 'fraud') {
            return { ...map, view_count: fraudStats.stats?.total_views || 0 };
          }
          if (map.id === 'realestate') {
            return { ...map, view_count: realestateStats.stats?.total_views || 0 };
          }
          if (map.id === 'skip-tracing') {
            return { ...map, view_count: skipTracingStats.stats?.total_views || 0 };
          }
          return map;
        }));
      } catch (err) {
        console.error('Error fetching professional map stats:', err);
      } finally {
        setLoadingProfessionalMaps(false);
      }
    };

    fetchProfessionalStats();
  }, [activeTab]);

  // Get current tab's maps and loading state
  const getCurrentTabData = () => {
    switch (activeTab) {
      case 'my-maps':
        return {
          maps: filteredAccountMaps,
          loading: loadingAccountMaps,
          emptyMessage: searchQuery ? 'No maps found' : 'You haven\'t created any maps yet',
        };
      case 'community':
        return {
          maps: filteredCommunityMaps,
          loading: false,
          emptyMessage: 'No maps found',
        };
      case 'professional':
        return {
          maps: filteredProfessionalMaps,
          loading: loadingProfessionalMaps,
          emptyMessage: 'No professional maps found',
        };
      default:
        return {
          maps: [],
          loading: false,
          emptyMessage: 'No maps found',
        };
    }
  };

  const currentTabData = getCurrentTabData();

  // Get tab count
  const getTabCount = (tab: TabType) => {
    switch (tab) {
      case 'my-maps':
        return filteredAccountMaps.length;
      case 'community':
        return filteredCommunityMaps.length + filteredUserMaps.length;
      case 'professional':
        return filteredProfessionalMaps.length;
      default:
        return 0;
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
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="w-full space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-gray-700" />
                <h1 className="text-sm font-semibold text-gray-900">Maps</h1>
              </div>
              {activeTab === 'my-maps' && (
                <button
                  onClick={() => router.push('/maps/new')}
                  className="flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                >
                  <PlusIcon className="w-3 h-3" />
                  <span>Create</span>
                </button>
              )}
            </div>

            {/* Tabs and Content */}
            <div className="space-y-3">
              {/* Tabs */}
              <div className="flex items-center gap-1 border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('community')}
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === 'community'
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Community <span className="text-gray-500">({getTabCount('community')})</span>
                </button>
                <button
                  onClick={() => setActiveTab('professional')}
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === 'professional'
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Professional <span className="text-gray-500">({getTabCount('professional')})</span>
                </button>
                {account && (
                  <button
                    onClick={() => setActiveTab('my-maps')}
                    className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                      activeTab === 'my-maps'
                        ? 'border-gray-900 text-gray-900'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    My Maps <span className="text-gray-500">({getTabCount('my-maps')})</span>
                  </button>
                )}
              </div>

              {/* Search */}
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search maps..."
                  className="w-full pl-7 pr-2 py-1.5 text-xs bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors"
                />
              </div>

              {/* Maps Grid */}
                {activeTab === 'community' ? (
                  <div className="space-y-3">
                    {/* Featured Community Maps (Mentions) */}
                    {filteredCommunityMaps.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2">
                        {filteredCommunityMaps.map((map) => (
                          <MapCard 
                            key={map.id} 
                            map={map} 
                            account={account} 
                            isFeatured={map.id === 'mention'}
                          />
                        ))}
                      </div>
                    )}
                    
                    {/* Border separator */}
                    {filteredCommunityMaps.length > 0 && filteredUserMaps.length > 0 && (
                      <div className="border-t border-gray-200 pt-3">
                        <h3 className="text-xs font-semibold text-gray-900 mb-2">Made by users like you</h3>
                        {loading ? (
                          <div className="text-xs text-gray-500">Loading maps...</div>
                        ) : filteredUserMaps.length === 0 ? (
                          <div className="text-xs text-gray-500">No user-generated maps yet</div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-2">
                            {filteredUserMaps.map((map) => (
                              <MapCard 
                                key={map.id} 
                                map={map} 
                                account={account} 
                                isSmall={true}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* User-generated maps only (if no community maps) */}
                    {filteredCommunityMaps.length === 0 && (
                      <>
                        <h3 className="text-xs font-semibold text-gray-900 mb-2">Made by users like you</h3>
                        {loading ? (
                          <div className="text-xs text-gray-500">Loading maps...</div>
                        ) : filteredUserMaps.length === 0 ? (
                          <div className="text-xs text-gray-500">No user-generated maps yet</div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-2">
                            {filteredUserMaps.map((map) => (
                              <MapCard 
                                key={map.id} 
                                map={map} 
                                account={account} 
                                isSmall={true}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : currentTabData.loading ? (
                  <div className="text-xs text-gray-500">Loading maps...</div>
                ) : currentTabData.maps.length === 0 ? (
                  <div className="text-xs text-gray-500">{currentTabData.emptyMessage}</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:flex xl:flex-wrap gap-2">
                    {currentTabData.maps.map((map) => (
                      <MapCard 
                        key={map.id} 
                        map={map} 
                        account={account} 
                      />
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>
      </PageWrapper>
    </>
  );
}
