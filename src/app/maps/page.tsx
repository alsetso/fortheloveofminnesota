'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MagnifyingGlassIcon, PlusIcon, MapIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { useBillingEntitlementsSafe } from '@/contexts/BillingEntitlementsContext';
import PageWrapper from '@/components/layout/PageWrapper';
import SearchResults from '@/components/layout/SearchResults';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import MapCard from './components/MapCard';
import MapListItem from './components/MapListItem';
import MapDetailsContent from './components/MapDetailsContent';
import MapsPageLayout from './MapsPageLayout';
import { useUnifiedSidebar } from '@/hooks/useUnifiedSidebar';
import { getMapUrl } from '@/lib/maps/urls';
import type { MapItem } from './types';

type ViewType = 'community' | 'my-maps';

export default function MapsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { account } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const { features } = useBillingEntitlementsSafe();
  
  // View state
  const [viewType, setViewType] = useState<ViewType>(() => {
    const param = searchParams.get('view');
    if (param === 'my-maps' && account) return 'my-maps';
    return 'community';
  });
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data state
  const [featuredMaps, setFeaturedMaps] = useState<MapItem[]>([]);
  const [communityMaps, setCommunityMaps] = useState<MapItem[]>([]);
  const [myMapsByRole, setMyMapsByRole] = useState<{
    owner: MapItem[];
    manager: MapItem[];
    editor: MapItem[];
  }>({
    owner: [],
    manager: [],
    editor: [],
  });
  const [loadingFeatured, setLoadingFeatured] = useState(false);
  const [loadingCommunity, setLoadingCommunity] = useState(false);
  const [loadingMyMaps, setLoadingMyMaps] = useState(false);
  
  // Selected map for sidebar
  const [selectedMap, setSelectedMap] = useState<MapItem | null>(null);
  const { activeSidebar, toggleSidebar, closeSidebar } = useUnifiedSidebar();

  // Update view type when URL changes
  useEffect(() => {
    const param = searchParams.get('view');
    if (param === 'my-maps' && account) {
      setViewType('my-maps');
    } else {
      setViewType('community');
    }
  }, [searchParams, account]);

  // Fetch featured maps
  useEffect(() => {
    const fetchFeatured = async () => {
      setLoadingFeatured(true);
      try {
        const response = await fetch('/api/maps?visibility=public&limit=100');
        if (!response.ok) throw new Error('Failed to fetch maps');
        const data = await response.json();
        
        // Filter for featured maps (settings.presentation.is_featured)
        const featured = (data.maps || [])
          .filter((map: any) => map.settings?.presentation?.is_featured === true)
          .map((map: any) => ({
            ...map,
            name: map.name || map.title,
            slug: map.slug || map.custom_slug,
            href: getMapUrl({ id: map.id, slug: map.slug, custom_slug: map.custom_slug }),
            account_id: map.account_id,
            visibility: map.visibility || 'public',
          }));
        
        // Fetch stats
        if (featured.length > 0) {
          const statsResponse = await fetch(`/api/maps/stats?ids=${featured.map((m: any) => m.id).join(',')}`);
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            const withStats = featured.map((map: any) => ({
              ...map,
              view_count: statsData.stats?.[map.id]?.total_views || 0,
            }));
            setFeaturedMaps(withStats);
          } else {
            setFeaturedMaps(featured);
          }
        } else {
          setFeaturedMaps([]);
        }
      } catch (err) {
        console.error('Error fetching featured maps:', err);
        setFeaturedMaps([]);
      } finally {
        setLoadingFeatured(false);
      }
    };
    
    fetchFeatured();
  }, []);

  // Fetch community maps
  useEffect(() => {
    if (viewType !== 'community') return;
    
    const fetchCommunity = async () => {
      setLoadingCommunity(true);
      try {
        const response = await fetch('/api/maps?visibility=public&limit=200');
        if (!response.ok) throw new Error('Failed to fetch maps');
        const data = await response.json();
        
        const maps = (data.maps || [])
          .filter((map: any) => !map.settings?.presentation?.is_featured) // Exclude featured
          .map((map: any) => ({
            ...map,
            name: map.name || map.title,
            slug: map.slug || map.custom_slug,
            href: getMapUrl({ id: map.id, slug: map.slug, custom_slug: map.custom_slug }),
            categories: map.categories || [],
            account_id: map.account_id,
            visibility: map.visibility || 'public',
          }));
        
        // Fetch stats
        if (maps.length > 0) {
          const statsResponse = await fetch(`/api/maps/stats?ids=${maps.map((m: any) => m.id).join(',')}`);
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            const withStats = maps.map((map: any) => ({
              ...map,
              view_count: statsData.stats?.[map.id]?.total_views || 0,
            }));
            setCommunityMaps(withStats);
          } else {
            setCommunityMaps(maps);
          }
        } else {
          setCommunityMaps([]);
        }
      } catch (err) {
        console.error('Error fetching community maps:', err);
        setCommunityMaps([]);
      } finally {
        setLoadingCommunity(false);
      }
    };
    
    fetchCommunity();
  }, [viewType]);

  // Fetch my maps grouped by role
  useEffect(() => {
    if (viewType !== 'my-maps' || !account?.id) {
      setMyMapsByRole({ owner: [], manager: [], editor: [] });
      return;
    }
    
    const fetchMyMaps = async () => {
      setLoadingMyMaps(true);
      try {
        // Fetch maps where user is a member or owner
        const response = await fetch(`/api/maps?account_id=${account.id}`);
        if (!response.ok) throw new Error('Failed to fetch maps');
        const data = await response.json();
        
        const maps = (data.maps || [])
          .map((map: any) => ({
            ...map,
            name: map.name || map.title,
            slug: map.slug || map.custom_slug,
            href: getMapUrl({ id: map.id, slug: map.slug, custom_slug: map.custom_slug }),
            account_id: map.account_id,
            visibility: map.visibility || 'public',
          }));
        
        // Fetch member roles for each map and determine user's role
        const mapsWithRoles = await Promise.all(
          maps.map(async (map: any) => {
            const isOwner = map.account_id === account.id;
            if (isOwner) {
              return {
                ...map,
                current_user_role: 'owner' as const,
              };
            }
            
            try {
              const memberResponse = await fetch(`/api/maps/${map.id}/members`);
              if (memberResponse.ok) {
                const memberData = await memberResponse.json();
                const myMember = memberData.members?.find((m: any) => m.account_id === account.id);
                return {
                  ...map,
                  current_user_role: myMember?.role || null,
                };
              }
            } catch (err) {
              console.error(`Error fetching member role for map ${map.id}:`, err);
            }
            return {
              ...map,
              current_user_role: null,
            };
          })
        );
        
        // Filter to only maps where user has a role
        const mapsWithValidRoles = mapsWithRoles.filter((map: any) => map.current_user_role !== null);
        
        // Fetch stats
        if (mapsWithValidRoles.length > 0) {
          const statsResponse = await fetch(`/api/maps/stats?ids=${mapsWithValidRoles.map((m: any) => m.id).join(',')}`);
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            const withStats = mapsWithValidRoles.map((map: any) => ({
              ...map,
              view_count: statsData.stats?.[map.id]?.total_views || 0,
            }));
            
            // Group by role
            const grouped = {
              owner: withStats.filter((m: any) => m.current_user_role === 'owner'),
              manager: withStats.filter((m: any) => m.current_user_role === 'manager'),
              editor: withStats.filter((m: any) => m.current_user_role === 'editor'),
            };
            
            setMyMapsByRole(grouped);
          } else {
            const grouped = {
              owner: mapsWithValidRoles.filter((m: any) => m.current_user_role === 'owner'),
              manager: mapsWithValidRoles.filter((m: any) => m.current_user_role === 'manager'),
              editor: mapsWithValidRoles.filter((m: any) => m.current_user_role === 'editor'),
            };
            setMyMapsByRole(grouped);
          }
        } else {
          setMyMapsByRole({ owner: [], manager: [], editor: [] });
        }
      } catch (err) {
        console.error('Error fetching my maps:', err);
        setMyMapsByRole({ owner: [], manager: [], editor: [] });
      } finally {
        setLoadingMyMaps(false);
      }
    };
    
    fetchMyMaps();
  }, [viewType, account?.id]);

  // Filter maps by search
  const filteredMapsByRole = useMemo(() => {
    if (viewType === 'community') {
      const filtered = searchQuery.trim()
        ? communityMaps.filter(map => {
            const query = searchQuery.toLowerCase();
            return (map.name || '').toLowerCase().includes(query) ||
                   (map.description || '').toLowerCase().includes(query);
          })
        : communityMaps;
      return { owner: [], manager: [], editor: [], community: filtered };
    }
    
    // For my-maps, filter each role group
    const filterMaps = (maps: MapItem[]) => {
      if (!searchQuery.trim()) return maps;
      const query = searchQuery.toLowerCase();
      return maps.filter(map => 
        (map.name || '').toLowerCase().includes(query) ||
        (map.description || '').toLowerCase().includes(query)
      );
    };
    
    return {
      owner: filterMaps(myMapsByRole.owner),
      manager: filterMaps(myMapsByRole.manager),
      editor: filterMaps(myMapsByRole.editor),
      community: [],
    };
  }, [viewType, communityMaps, myMapsByRole, searchQuery]);
  
  // Total count for my maps
  const totalMyMapsCount = useMemo(() => {
    if (viewType === 'community') return filteredMapsByRole.community.length;
    return filteredMapsByRole.owner.length + filteredMapsByRole.manager.length + filteredMapsByRole.editor.length;
  }, [viewType, filteredMapsByRole]);

  // Get custom_maps feature limit and current owned maps count
  const customMapsFeature = useMemo(() => {
    return features.find(f => f.slug === 'custom_maps');
  }, [features]);

  const ownedMapsCount = useMemo(() => {
    return filteredMapsByRole.owner.length;
  }, [filteredMapsByRole.owner.length]);

  // Check if limit is reached
  const isLimitReached = useMemo(() => {
    if (!customMapsFeature) return false;
    if (customMapsFeature.is_unlimited || customMapsFeature.limit_type === 'unlimited') return false;
    if (customMapsFeature.limit_type === 'count' && customMapsFeature.limit_value !== null) {
      return ownedMapsCount >= customMapsFeature.limit_value;
    }
    return false;
  }, [customMapsFeature, ownedMapsCount]);

  // Format map limit display
  const mapLimitDisplay = useMemo(() => {
    if (!customMapsFeature) return null;
    
    if (customMapsFeature.is_unlimited || customMapsFeature.limit_type === 'unlimited') {
      return `${ownedMapsCount} (unlimited)`;
    }
    
    if (customMapsFeature.limit_type === 'count' && customMapsFeature.limit_value !== null) {
      return `${ownedMapsCount} / ${customMapsFeature.limit_value}`;
    }
    
    return `${ownedMapsCount}`;
  }, [customMapsFeature, ownedMapsCount]);

  const handleMapClick = (map: MapItem) => {
    setSelectedMap(map);
    toggleSidebar('map-details');
  };

  const handleCloseSidebar = useCallback(() => {
    closeSidebar();
    setSelectedMap(null);
  }, [closeSidebar]);

  // Sidebar configurations
  const sidebarConfigs = useMemo(() => {
    if (!selectedMap) return [];

    return [
      {
        type: 'map-details' as const,
        title: 'Map Details',
        content: (
          <MapDetailsContent
            map={selectedMap}
            account={account}
            onClose={handleCloseSidebar}
          />
        ),
        popupType: 'account' as const,
        infoText: 'View map details, statistics, and join options',
      },
    ];
  }, [selectedMap, account, handleCloseSidebar]);

  return (
    <>
      <PageViewTracker />
      <PageWrapper
        headerContent={null}
        searchComponent={null}
        accountDropdownProps={{
          onAccountClick: () => {},
          onSignInClick: openWelcome,
        }}
        searchResultsComponent={<SearchResults />}
      >
        <MapsPageLayout
          activeSidebar={activeSidebar}
          onSidebarClose={handleCloseSidebar}
          sidebarConfigs={sidebarConfigs}
        >
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <MapIcon className="w-4 h-4 text-gray-700" />
              <h1 className="text-sm font-semibold text-gray-900">Maps</h1>
            </div>
          </div>

          {/* Map Feed */}
          <div className="space-y-3">
            {/* Featured Maps Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Featured</h2>
                <span className="text-xs text-gray-500">({featuredMaps.length})</span>
              </div>
              {loadingFeatured ? (
                <div className="text-xs text-gray-500">Loading featured maps...</div>
              ) : featuredMaps.length === 0 ? (
                <div className="text-xs text-gray-500">No featured maps</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 auto-rows-fr">
                  {featuredMaps.map((map) => (
                      <MapCard
                        key={map.id}
                        map={map}
                        account={account}
                        variant="primary"
                        fullWidth={true}
                        onClick={() => handleMapClick(map)}
                        showVisibility={true}
                      />
                    ))}
                </div>
              )}
            </div>

            {/* All Maps */}
            <div className="space-y-2 pt-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <h2 className="text-sm font-semibold text-gray-900">
                    {viewType === 'community' ? 'All Maps' : 'My Maps'}
                  </h2>
                  {/* View Toggle */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setViewType('community');
                        router.push('/maps?view=community');
                      }}
                      className={`text-xs font-medium transition-colors ${
                        viewType === 'community'
                          ? 'text-gray-900'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Community
                    </button>
                    {account && (
                      <button
                        onClick={() => {
                          setViewType('my-maps');
                          router.push('/maps?view=my-maps');
                        }}
                        className={`text-xs font-medium transition-colors ${
                          viewType === 'my-maps'
                            ? 'text-gray-900'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        My Maps
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Search */}
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search maps..."
                      className="pl-7 pr-2 py-1.5 text-xs bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                    />
                  </div>
                  {viewType === 'my-maps' && account && (
                    <div className="flex items-center gap-2">
                      {mapLimitDisplay && (
                        <span className={`text-xs ${isLimitReached ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                          {mapLimitDisplay}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          if (isLimitReached) {
                            router.push('/billing');
                          } else {
                            router.push('/maps/new');
                          }
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          isLimitReached
                            ? 'text-white bg-red-600 hover:bg-red-700'
                            : 'text-white bg-indigo-600 hover:bg-indigo-700'
                        }`}
                        title={isLimitReached ? 'Map limit reached. Click to upgrade.' : 'Create a new map'}
                      >
                        <PlusIcon className="w-3 h-3" />
                        <span>{isLimitReached ? 'Upgrade' : 'Create Map'}</span>
                      </button>
                    </div>
                  )}
                  <span className="text-xs text-gray-500">
                    ({viewType === 'community' ? filteredMapsByRole.community.length : totalMyMapsCount})
                  </span>
                </div>
              </div>
              {viewType === 'my-maps' && loadingMyMaps ? (
                <div className="text-xs text-gray-500">Loading your maps...</div>
              ) : viewType === 'community' && loadingCommunity ? (
                <div className="text-xs text-gray-500">Loading maps...</div>
              ) : viewType === 'my-maps' ? (
                <div className="space-y-4">
                  {/* Owner Section */}
                  {filteredMapsByRole.owner.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-gray-900">Owner</h3>
                        {(() => {
                          const mapFeature = features.find(f => f.slug === 'map' || f.slug === 'custom_maps');
                          if (!mapFeature) return null;
                          
                          const limitDisplay = mapFeature.is_unlimited
                            ? `${ownedMapsCount} (unlimited)`
                            : mapFeature.limit_value !== null
                              ? `${ownedMapsCount} / ${mapFeature.limit_value}`
                              : `${ownedMapsCount}`;
                          
                          return (
                            <span className={`text-xs ${ownedMapsCount >= (mapFeature.limit_value || Infinity) ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                              {limitDisplay}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="space-y-2">
                        {filteredMapsByRole.owner.map((map) => (
                          <MapListItem
                            key={map.id}
                            map={map}
                            account={account}
                            onClick={() => handleMapClick(map)}
                            showRoleIcon={true}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Manager Section */}
                  {filteredMapsByRole.manager.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-gray-900">Manager</h3>
                      <div className="space-y-2">
                        {filteredMapsByRole.manager.map((map) => (
                          <MapListItem
                            key={map.id}
                            map={map}
                            account={account}
                            onClick={() => handleMapClick(map)}
                            showRoleIcon={true}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Editor Section */}
                  {filteredMapsByRole.editor.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-gray-900">Editor</h3>
                      <div className="space-y-2">
                        {filteredMapsByRole.editor.map((map) => (
                          <MapListItem
                            key={map.id}
                            map={map}
                            account={account}
                            onClick={() => handleMapClick(map)}
                            showRoleIcon={true}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Empty state */}
                  {totalMyMapsCount === 0 && (
                    <div className="text-xs text-gray-500 text-center py-8">
                      {searchQuery
                        ? 'No maps match your search'
                        : 'You are not a member of any maps yet'}
                    </div>
                  )}
                </div>
              ) : filteredMapsByRole.community.length === 0 ? (
                <div className="text-xs text-gray-500 text-center py-8">
                  {searchQuery ? 'No maps match your search' : 'No maps found'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredMapsByRole.community.map((map) => (
                    <MapListItem
                      key={map.id}
                      map={map}
                      account={account}
                      onClick={() => handleMapClick(map)}
                      showRoleIcon={false}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        </MapsPageLayout>
      </PageWrapper>
    </>
  );
}
