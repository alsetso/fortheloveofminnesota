'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MagnifyingGlassIcon, PlusIcon, MapIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { useBillingEntitlementsSafe } from '@/contexts/BillingEntitlementsContext';
import PageWrapper from '@/components/layout/PageWrapper';
import SearchResults from '@/components/layout/SearchResults';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import MapCard from './components/MapCard';
import MapsPageLayout from './MapsPageLayout';
import { useUnifiedSidebar } from '@/hooks/useUnifiedSidebar';
import { getMapUrl } from '@/lib/maps/urls';
import type { MapItem } from './types';
import { MAP_FEATURE_SLUG, calculateMapLimitState } from '@/lib/billing/mapLimits';

type ViewType = 'featured' | 'community' | 'my-maps';
type ViewAsRole = 'non-member' | 'member' | 'owner';

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
    if (param === 'community') return 'community';
    return 'featured';
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
  
  // View As role state
  const [viewAsRole, setViewAsRole] = useState<ViewAsRole>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('maps_view_as_role') as ViewAsRole | null;
      if (stored && ['non-member', 'member', 'owner'].includes(stored)) {
        return stored;
      }
    }
    return 'non-member';
  });
  const [isViewAsOpen, setIsViewAsOpen] = useState(false);
  
  const { activeSidebar } = useUnifiedSidebar();
  
  // Persist viewAsRole to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('maps_view_as_role', viewAsRole);
    }
  }, [viewAsRole]);

  // Update view type when URL changes
  useEffect(() => {
    const param = searchParams.get('view');
    if (param === 'my-maps' && account) {
      setViewType('my-maps');
    } else if (param === 'community') {
      setViewType('community');
    } else {
      setViewType('featured');
    }
  }, [searchParams, account]);

  // Fetch featured maps
  useEffect(() => {
    if (viewType !== 'featured') return;
    
    const fetchFeatured = async () => {
      setLoadingFeatured(true);
      try {
        // Only fetch maps that are published to community
        const response = await fetch('/api/maps?community=true&limit=100');
        if (!response.ok) throw new Error('Failed to fetch maps');
        const data = await response.json();
        
        // Filter for featured maps (settings.presentation.is_featured) that are also published
        const featured = (data.maps || [])
          .filter((map: any) => map.settings?.presentation?.is_featured === true && map.published_to_community === true)
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
  }, [viewType]);

  // Fetch community maps
  useEffect(() => {
    if (viewType !== 'community') return;
    
    const fetchCommunity = async () => {
      setLoadingCommunity(true);
      try {
        // Use community=true to filter by published_to_community
        const response = await fetch('/api/maps?community=true&limit=200');
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
            published_to_community: map.published_to_community || false,
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
    if (viewType === 'featured') {
      const filtered = searchQuery.trim()
        ? featuredMaps.filter(map => {
            const query = searchQuery.toLowerCase();
            return (map.name || '').toLowerCase().includes(query) ||
                   (map.description || '').toLowerCase().includes(query);
          })
        : featuredMaps;
      return { owner: [], manager: [], editor: [], community: [], featured: filtered };
    }
    
    if (viewType === 'community') {
      const filtered = searchQuery.trim()
        ? communityMaps.filter(map => {
            const query = searchQuery.toLowerCase();
            return (map.name || '').toLowerCase().includes(query) ||
                   (map.description || '').toLowerCase().includes(query);
          })
        : communityMaps;
      return { owner: [], manager: [], editor: [], community: filtered, featured: [] };
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
      featured: [],
    };
  }, [viewType, featuredMaps, communityMaps, myMapsByRole, searchQuery]);
  
  // Total count for current view
  const totalCount = useMemo(() => {
    if (viewType === 'featured') return filteredMapsByRole.featured.length;
    if (viewType === 'community') return filteredMapsByRole.community.length;
    return filteredMapsByRole.owner.length + filteredMapsByRole.manager.length + filteredMapsByRole.editor.length;
  }, [viewType, filteredMapsByRole]);

  // Get custom_maps feature using canonical slug (invariant enforcement)
  const customMapsFeature = useMemo(() => {
    return features.find(f => f.slug === MAP_FEATURE_SLUG);
  }, [features]);

  // Owned maps count is source of truth (invariant)
  const ownedMapsCount = useMemo(() => {
    return filteredMapsByRole.owner.length;
  }, [filteredMapsByRole.owner.length]);

  // Use centralized limit calculation (invariant enforcement)
  const limitState = useMemo(() => {
    return calculateMapLimitState(ownedMapsCount, customMapsFeature || null);
  }, [ownedMapsCount, customMapsFeature]);

  // Backward compatibility: isLimitReached and mapLimitDisplay
  const isLimitReached = limitState.isAtLimit;
  const mapLimitDisplay = limitState.displayText;

  const handleCloseSidebar = useCallback(() => {
    // Sidebar disabled - no action needed
  }, []);

  // Sidebar configurations - empty to disable sidebar
  const sidebarConfigs = useMemo(() => {
    return [];
  }, []);

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
            {/* All Maps */}
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <h2 className="text-sm font-semibold text-gray-900">
                    {viewType === 'featured' ? 'Featured' : viewType === 'community' ? 'All Maps' : 'My Maps'}
                  </h2>
                  {/* View Toggle */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setViewType('featured');
                        router.push('/maps?view=featured');
                      }}
                      className={`text-xs font-medium transition-colors ${
                        viewType === 'featured'
                          ? 'text-gray-900'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Featured
                    </button>
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
                  {/* View As Selector */}
                  <div className="relative">
                    <button
                      onClick={() => setIsViewAsOpen(!isViewAsOpen)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                      title="View maps as different role"
                    >
                      <span className="text-[10px] text-gray-500 uppercase tracking-wide">View As:</span>
                      <span className="capitalize">{viewAsRole === 'non-member' ? 'Non Member' : viewAsRole}</span>
                      <ChevronDownIcon 
                        className={`w-3 h-3 transition-transform duration-200 ${isViewAsOpen ? 'rotate-180' : ''}`} 
                      />
                    </button>

                    {isViewAsOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setIsViewAsOpen(false)}
                          aria-hidden="true"
                        />
                        <div className="absolute top-full right-0 mt-1 z-20 bg-white border border-gray-200 rounded-md shadow-lg min-w-[140px]">
                          {[
                            { value: 'non-member' as ViewAsRole, label: 'Non Member' },
                            { value: 'member' as ViewAsRole, label: 'Member' },
                            { value: 'owner' as ViewAsRole, label: 'Owner' },
                          ].map((role) => (
                            <button
                              key={role.value}
                              onClick={() => {
                                setViewAsRole(role.value);
                                setIsViewAsOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${
                                viewAsRole === role.value
                                  ? 'bg-indigo-50 text-indigo-900 font-medium'
                                  : 'text-gray-900'
                              }`}
                            >
                              {role.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  
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
                  {account && (
                    <div className="flex items-center gap-2">
                      {!limitState.canCreate ? (
                        <>
                          <button
                            onClick={() => {
                              router.push('/billing');
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors text-white bg-red-600 hover:bg-red-700"
                            title="Map limit reached. Click to upgrade."
                          >
                            <PlusIcon className="w-3 h-3" />
                            <span>Upgrade</span>
                          </button>
                          {customMapsFeature?.limit_value !== null && customMapsFeature?.limit_value !== undefined && (
                            <span className="text-xs text-gray-500">
                              ({customMapsFeature.limit_value})
                            </span>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            router.push('/maps/new');
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors text-white bg-indigo-600 hover:bg-indigo-700"
                          title="Create a new map"
                        >
                          <PlusIcon className="w-3 h-3" />
                          <span>Create Map</span>
                        </button>
                      )}
                    </div>
                  )}
                  <span className="text-xs text-gray-500">
                    ({totalCount})
                  </span>
                </div>
              </div>
              {viewType === 'featured' && loadingFeatured ? (
                <div className="text-xs text-gray-500">Loading featured maps...</div>
              ) : viewType === 'my-maps' && loadingMyMaps ? (
                <div className="text-xs text-gray-500">Loading your maps...</div>
              ) : viewType === 'community' && loadingCommunity ? (
                <div className="text-xs text-gray-500">Loading maps...</div>
              ) : viewType === 'featured' ? (
                filteredMapsByRole.featured.length === 0 ? (
                  <div className="text-xs text-gray-500 text-center py-8">
                    {searchQuery ? 'No featured maps match your search' : 'No featured maps'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 auto-rows-fr">
                    {filteredMapsByRole.featured.map((map) => (
                      <MapCard
                        key={map.id}
                        map={map}
                        account={account}
                        showRoleIcon={false}
                        viewAsRole={viewAsRole}
                      />
                    ))}
                  </div>
                )
              ) : viewType === 'my-maps' ? (
                <div className="space-y-4">
                  {/* Owner Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-gray-900">Owner</h3>
                      {(() => {
                        const mapFeature = features.find(f => f.slug === 'custom_maps');
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 auto-rows-fr">
                      {/* Placeholder Create Map Card */}
                      {account && (
                        <div
                          onClick={() => {
                            if (!limitState.canCreate) {
                              router.push('/billing');
                              return;
                            }
                            router.push('/maps/new');
                          }}
                          className={`bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors cursor-pointer group overflow-hidden relative ${
                            !limitState.canCreate ? 'opacity-60' : ''
                          }`}
                        >
                          <div className="w-full h-48 bg-gray-100 relative overflow-hidden flex items-center justify-center">
                            {!limitState.canCreate ? (
                              <div className="flex flex-col items-center justify-center gap-2 p-[10px]">
                                <div className="text-xs font-semibold text-red-600">Limit Reached</div>
                                <div className="text-[10px] text-gray-500 text-center">
                                  {customMapsFeature?.limit_value !== null && customMapsFeature?.limit_value !== undefined
                                    ? `(${customMapsFeature.limit_value})`
                                    : ''}
                                </div>
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors">
                                  <PlusIcon className="w-3 h-3" />
                                  <span>Upgrade</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-2 p-[10px]">
                                <PlusIcon className="w-8 h-8 text-gray-400" />
                                <div className="text-xs font-semibold text-gray-700">Create Map</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {filteredMapsByRole.owner.map((map) => (
                        <MapCard
                          key={map.id}
                          map={map}
                          account={account}
                          showRoleIcon={true}
                          viewAsRole={viewAsRole}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Manager Section */}
                  {filteredMapsByRole.manager.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-gray-900">Manager</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 auto-rows-fr">
                        {filteredMapsByRole.manager.map((map) => (
                          <MapCard
                            key={map.id}
                            map={map}
                            account={account}
                            showRoleIcon={true}
                            viewAsRole={viewAsRole}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Editor Section */}
                  {filteredMapsByRole.editor.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-gray-900">Editor</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 auto-rows-fr">
                        {filteredMapsByRole.editor.map((map) => (
                          <MapCard
                            key={map.id}
                            map={map}
                            account={account}
                            showRoleIcon={true}
                            viewAsRole={viewAsRole}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Empty state */}
                  {totalCount === 0 && (
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 auto-rows-fr">
                  {filteredMapsByRole.community.map((map) => (
                    <MapCard
                      key={map.id}
                      map={map}
                      account={account}
                      showRoleIcon={false}
                      viewAsRole={viewAsRole}
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
