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
import type { MapItem } from './types';

type TabType = 'my-maps' | 'community' | 'professional' | 'gov';

export default function MapsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { account } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const [accountMaps, setAccountMaps] = useState<MapItem[]>([]);
  const [loadingAccountMaps, setLoadingAccountMaps] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [communityMaps, setCommunityMaps] = useState<MapItem[]>([]);
  const [professionalMaps, setProfessionalMaps] = useState<MapItem[]>([]);
  const [userMapsCollection, setUserMapsCollection] = useState<MapItem[]>([]);
  const [atlasMaps, setAtlasMaps] = useState<MapItem[]>([]);
  const [govMaps, setGovMaps] = useState<MapItem[]>([]);
  const [loadingCommunityMaps, setLoadingCommunityMaps] = useState(false);
  const [loadingProfessionalMaps, setLoadingProfessionalMaps] = useState(false);
  const [loadingUserMapsCollection, setLoadingUserMapsCollection] = useState(false);
  const [loadingAtlasMaps, setLoadingAtlasMaps] = useState(false);
  const [loadingGovMaps, setLoadingGovMaps] = useState(false);
  // Track which tabs have been fetched
  const fetchedTabsRef = useRef<Set<TabType>>(new Set());
  const hasFetchedAccountMapsRef = useRef<string | null>(null);
  
  // Get initial tab from URL or default
  const getInitialTab = (): TabType => {
    const tabParam = searchParams.get('tab');
    // Redirect 'user' and 'atlas' tabs to 'community'
    if (tabParam === 'user' || tabParam === 'atlas') {
      return 'community';
    }
    if (tabParam && ['my-maps', 'community', 'professional', 'gov'].includes(tabParam)) {
      return tabParam as TabType;
    }
    return account ? 'my-maps' : 'community';
  };
  
  // Active tab state - default to first available tab or URL param
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
  
  // Update active tab when URL param or account changes
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    // Redirect 'user' and 'atlas' tabs to 'community'
    if (tabParam === 'user' || tabParam === 'atlas') {
      router.push('/maps?tab=community');
      setActiveTab('community');
      return;
    }
    if (tabParam && ['my-maps', 'community', 'professional', 'gov'].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
    } else if (account) {
      setActiveTab('my-maps');
    } else {
      setActiveTab('community');
    }
  }, [searchParams, account?.id, router]);

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

  const filteredAccountMaps = useMemo(() => {
    if (!searchQuery.trim()) return accountMaps;
    const query = searchQuery.toLowerCase();
    return accountMaps.filter(map => 
      map.title.toLowerCase().includes(query) ||
      (map.description && map.description.toLowerCase().includes(query))
    );
  }, [accountMaps, searchQuery]);




  // Fetch community maps - only when 'community' tab is selected
  useEffect(() => {
    if (activeTab !== 'community' || fetchedTabsRef.current.has('community')) {
      return;
    }

    fetchedTabsRef.current.add('community');

    const fetchCommunityMaps = async () => {
      setLoadingCommunityMaps(true);
      try {
        const response = await fetch('/api/maps?collection_type=community&visibility=public');
        if (!response.ok) {
          throw new Error(`Failed to fetch community maps: ${response.statusText}`);
        }
        const data = await response.json();
        
        if (!data.maps || data.maps.length === 0) {
          setCommunityMaps([]);
          setLoadingCommunityMaps(false);
          return;
        }

        const transformedMaps = data.maps.map((map: any) => ({
          ...map,
          map_type: 'community' as const,
          href: map.custom_slug ? `/map/${map.custom_slug}` : `/map/${map.id}`,
        }));

        const mapIds = transformedMaps.map((map: any) => map.id);

        if (mapIds.length > 0) {
          const statsResponse = await fetch(`/api/maps/stats?ids=${mapIds.join(',')}`);
          if (!statsResponse.ok) {
            console.warn('Failed to fetch community map stats, continuing without stats');
          }
          const statsData = await statsResponse.json();

          const mapsWithStats = transformedMaps.map((map: any) => ({
            ...map,
            view_count: statsData.stats?.[map.id]?.total_views || 0,
          }));

          setCommunityMaps(mapsWithStats);
        } else {
          setCommunityMaps(transformedMaps);
        }
      } catch (err) {
        console.error('Error fetching community maps:', err);
      } finally {
        setLoadingCommunityMaps(false);
      }
    };

    fetchCommunityMaps();
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


  // Fetch professional maps - only when 'professional' tab is selected
  useEffect(() => {
    if (activeTab !== 'professional' || fetchedTabsRef.current.has('professional')) {
      return;
    }

    fetchedTabsRef.current.add('professional');

    const fetchProfessionalMaps = async () => {
      setLoadingProfessionalMaps(true);
      try {
        const response = await fetch('/api/maps?collection_type=professional&visibility=public');
        if (!response.ok) {
          throw new Error(`Failed to fetch professional maps: ${response.statusText}`);
        }
        const data = await response.json();
        
        if (!data.maps || data.maps.length === 0) {
          setProfessionalMaps([]);
          setLoadingProfessionalMaps(false);
          return;
        }

        const transformedMaps = data.maps.map((map: any) => ({
          ...map,
          map_type: 'professional' as const,
          requiresPro: true,
          href: map.custom_slug ? `/map/${map.custom_slug}` : `/map/${map.id}`,
        }));

        const mapIds = transformedMaps.map((map: any) => map.id);

        if (mapIds.length > 0) {
          const statsResponse = await fetch(`/api/maps/stats?ids=${mapIds.join(',')}`);
          if (!statsResponse.ok) {
            console.warn('Failed to fetch professional map stats, continuing without stats');
          }
          const statsData = await statsResponse.json();

          const mapsWithStats = transformedMaps.map((map: any) => ({
            ...map,
            view_count: statsData.stats?.[map.id]?.total_views || 0,
          }));

          setProfessionalMaps(mapsWithStats);
        } else {
          setProfessionalMaps(transformedMaps);
        }
      } catch (err) {
        console.error('Error fetching professional maps:', err);
      } finally {
        setLoadingProfessionalMaps(false);
      }
    };

    fetchProfessionalMaps();
  }, [activeTab]);

  // Fetch atlas maps - only when 'atlas' tab is selected
  useEffect(() => {
    if (activeTab !== 'atlas' || fetchedTabsRef.current.has('atlas')) {
      return;
    }

    fetchedTabsRef.current.add('atlas');

    const fetchAtlasMaps = async () => {
      setLoadingAtlasMaps(true);
      try {
        const response = await fetch('/api/maps?collection_type=atlas&visibility=public');
        if (!response.ok) {
          throw new Error(`Failed to fetch atlas maps: ${response.statusText}`);
        }
        const data = await response.json();
        
        if (!data.maps || data.maps.length === 0) {
          setAtlasMaps([]);
          setLoadingAtlasMaps(false);
          return;
        }

        const transformedMaps = data.maps.map((map: any) => ({
          ...map,
          map_type: 'atlas' as const,
          href: map.custom_slug ? `/map/${map.custom_slug}` : `/map/${map.id}`,
        }));

        const mapIds = transformedMaps.map((map: any) => map.id);

        if (mapIds.length > 0) {
          const statsResponse = await fetch(`/api/maps/stats?ids=${mapIds.join(',')}`);
          if (!statsResponse.ok) {
            console.warn('Failed to fetch atlas map stats, continuing without stats');
          }
          const statsData = await statsResponse.json();

          const mapsWithStats = transformedMaps.map((map: any) => ({
            ...map,
            view_count: statsData.stats?.[map.id]?.total_views || 0,
          }));

          setAtlasMaps(mapsWithStats);
        } else {
          setAtlasMaps(transformedMaps);
        }
      } catch (err) {
        console.error('Error fetching atlas maps:', err);
      } finally {
        setLoadingAtlasMaps(false);
      }
    };

    fetchAtlasMaps();
  }, [activeTab]);

  // Fetch user collection maps - only when 'user' tab is selected
  useEffect(() => {
    if (activeTab !== 'user' || fetchedTabsRef.current.has('user')) {
      return;
    }

    fetchedTabsRef.current.add('user');

    const fetchUserMapsCollection = async () => {
      setLoadingUserMapsCollection(true);
      try {
        const response = await fetch('/api/maps?collection_type=user&visibility=public');
        if (!response.ok) {
          throw new Error(`Failed to fetch user collection maps: ${response.statusText}`);
        }
        const data = await response.json();
        
        if (!data.maps || data.maps.length === 0) {
          setUserMapsCollection([]);
          setLoadingUserMapsCollection(false);
          return;
        }

        const transformedMaps = data.maps.map((map: any) => ({
          ...map,
          map_type: 'user' as const,
          href: map.custom_slug ? `/map/${map.custom_slug}` : `/map/${map.id}`,
        }));

        const mapIds = transformedMaps.map((map: any) => map.id);

        if (mapIds.length > 0) {
          const statsResponse = await fetch(`/api/maps/stats?ids=${mapIds.join(',')}`);
          if (!statsResponse.ok) {
            console.warn('Failed to fetch user collection map stats, continuing without stats');
          }
          const statsData = await statsResponse.json();

          const mapsWithStats = transformedMaps.map((map: any) => ({
            ...map,
            view_count: statsData.stats?.[map.id]?.total_views || 0,
          }));

          setUserMapsCollection(mapsWithStats);
        } else {
          setUserMapsCollection(transformedMaps);
        }
      } catch (err) {
        console.error('Error fetching user collection maps:', err);
      } finally {
        setLoadingUserMapsCollection(false);
      }
    };

    fetchUserMapsCollection();
  }, [activeTab]);

  // Fetch gov maps - only when 'gov' tab is selected
  useEffect(() => {
    if (activeTab !== 'gov' || fetchedTabsRef.current.has('gov')) {
      return;
    }

    fetchedTabsRef.current.add('gov');

    const fetchGovMaps = async () => {
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
            console.warn('Failed to fetch gov map stats, continuing without stats');
          }
          const statsData = await statsResponse.json();

          const mapsWithStats = transformedMaps.map((map: any) => ({
            ...map,
            view_count: statsData.stats?.[map.id]?.total_views || 0,
          }));

          setGovMaps(mapsWithStats);
        } else {
          setGovMaps(transformedMaps);
        }
      } catch (err) {
        console.error('Error fetching gov maps:', err);
      } finally {
        setLoadingGovMaps(false);
      }
    };

    fetchGovMaps();
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
          loading: loadingCommunityMaps,
          emptyMessage: 'No community maps found',
        };
      case 'professional':
        return {
          maps: filteredProfessionalMaps,
          loading: loadingProfessionalMaps,
          emptyMessage: 'No professional maps found',
        };
      case 'gov':
        return {
          maps: govMaps.filter(map => 
            !searchQuery.trim() || 
            map.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (map.description && map.description.toLowerCase().includes(searchQuery.toLowerCase()))
          ),
          loading: loadingGovMaps,
          emptyMessage: 'No government maps found',
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
        return filteredCommunityMaps.length;
      case 'professional':
        return filteredProfessionalMaps.length;
      case 'gov':
        return govMaps.length;
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
              <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => {
                    setActiveTab('community');
                    router.push('/maps?tab=community');
                  }}
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'community'
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Community <span className="text-gray-500">({getTabCount('community')})</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('professional');
                    router.push('/maps?tab=professional');
                  }}
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'professional'
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Professional <span className="text-gray-500">({getTabCount('professional')})</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('gov');
                    router.push('/maps?tab=gov');
                  }}
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'gov'
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Government <span className="text-gray-500">({getTabCount('gov')})</span>
                </button>
                {account && (
                  <button
                    onClick={() => {
                      setActiveTab('my-maps');
                      router.push('/maps?tab=my-maps');
                    }}
                    className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
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
                {currentTabData.loading ? (
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
