'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronDownIcon, MapIcon, EyeIcon, UserGroupIcon, GlobeAltIcon, LockClosedIcon, XMarkIcon, MapPinIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { useAuthStateSafe } from '@/features/auth';
import BottomButtonsPopup from '@/components/layout/BottomButtonsPopup';
import type { MapItem } from '@/app/maps/types';

interface MapsSelectorDropdownProps {
  className?: string;
  onMapClick?: () => void; // Callback when map card is clicked (for opening modal)
  /** When true, use dark grey text (for default/light header). When false, use white (dark header). */
  darkText?: boolean;
}

type TabType = 'community' | 'my-maps' | 'about';

export default function MapsSelectorDropdown({ className = '', darkText = false }: MapsSelectorDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { account } = useAuthStateSafe();
  
  // Check if we're on a map page (any /map/[slug] except /map/new and /maps)
  const isMapPage = pathname?.startsWith('/map/') && pathname !== '/map/new' && pathname !== '/maps';
  const isMapsPage = pathname === '/maps';
  const isLiveMapPage = pathname === '/map/live' || pathname?.startsWith('/map/live/');
  
  const [isOpen, setIsOpen] = useState(false);
  const [maps, setMaps] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>(isMapPage ? 'about' : 'community');
  const [communityMaps, setCommunityMaps] = useState<MapItem[]>([]);
  const [userMaps, setUserMaps] = useState<MapItem[]>([]);
  const [loadingCommunityMaps, setLoadingCommunityMaps] = useState(false);
  const [loadingUserMaps, setLoadingUserMaps] = useState(false);
  const [selectedMapViewCount, setSelectedMapViewCount] = useState<number | null>(null);
  const [selectedMapName, setSelectedMapName] = useState<string | null>(null);
  const [currentMapData, setCurrentMapData] = useState<any>(null);
  const [loadingMapData, setLoadingMapData] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Detect mobile screen size (lg breakpoint is 1024px)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Reset to community tab when dropdown opens (unless on map page, then default to about)
  useEffect(() => {
    if (isOpen) {
      setActiveTab(isMapPage ? 'about' : 'community');
    }
  }, [isOpen, isMapPage]);

  // Fetch maps on mount
  useEffect(() => {
    const fetchMaps = async () => {
      setLoading(true);
      try {
        // Fetch primary maps and popular maps (published to community)
        const response = await fetch('/api/maps?community=true&limit=50');
        if (!response.ok) {
          throw new Error('Failed to fetch maps');
        }
        const data = await response.json();
        
        if (data.maps && data.maps.length > 0) {
          const transformedMaps = data.maps.map((map: any) => ({
            ...map,
            map_type: (map.collection_type || map.type || 'community') as 'community' | 'professional' | 'user' | 'atlas',
            href: map.slug ? `/map/${map.slug}` : (map.custom_slug ? `/map/${map.custom_slug}` : `/map/${map.id}`),
          }));
          
          // Sort: by name (is_primary column was removed)
          const sorted = transformedMaps.sort((a: any, b: any) => {
            const nameA = a.name || a.title || '';
            const nameB = b.name || b.title || '';
            return nameA.localeCompare(nameB);
          });
          
          setMaps(sorted);
        }
      } catch (err) {
        console.error('Error fetching maps:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMaps();
  }, []);

  // Fetch community maps when tab is selected
  useEffect(() => {
    if (activeTab !== 'community' || !isOpen) return;

    const fetchCommunityMaps = async () => {
      setLoadingCommunityMaps(true);
      try {
        const response = await fetch('/api/maps?community=true&limit=50');
        if (!response.ok) throw new Error('Failed to fetch community maps');
        const data = await response.json();
        
        if (data.maps && data.maps.length > 0) {
          const transformedMaps = data.maps.map((map: any) => ({
            ...map,
            map_type: 'community' as const,
            href: map.custom_slug ? `/map/${map.custom_slug}` : `/map/${map.id}`,
          }));

          const mapIds = transformedMaps.map((map: any) => map.id);
          if (mapIds.length > 0) {
            const statsResponse = await fetch(`/api/maps/stats?ids=${mapIds.join(',')}`);
            if (statsResponse.ok) {
              const statsData = await statsResponse.json();
              const mapsWithStats = transformedMaps.map((map: any) => ({
                ...map,
                view_count: statsData.stats?.[map.id]?.total_views || 0,
              }));
              setCommunityMaps(mapsWithStats);
            } else {
              setCommunityMaps(transformedMaps);
            }
          } else {
            setCommunityMaps(transformedMaps);
          }
        } else {
          setCommunityMaps([]);
        }
      } catch (err) {
        console.error('Error fetching community maps:', err);
        setCommunityMaps([]);
      } finally {
        setLoadingCommunityMaps(false);
      }
    };

    fetchCommunityMaps();
  }, [activeTab, isOpen]);

  // Fetch current map data when About tab is selected
  useEffect(() => {
    if (activeTab !== 'about' || !isOpen || !selectedMapId) {
      return;
    }

    const fetchMapData = async () => {
      setLoadingMapData(true);
      try {
        const mapResponse = await fetch(`/api/maps/${selectedMapId}`);
        if (mapResponse.ok) {
          const data = await mapResponse.json();
          const map = data.map || data;
          
          // Fetch stats
          const statsResponse = await fetch(`/api/maps/${map.id}/stats`);
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            map.view_count = statsData.stats?.total_views || 0;
          }
          
          // Fetch member count
          const membersResponse = await fetch(`/api/maps/${map.id}/members`);
          if (membersResponse.ok) {
            const membersData = await membersResponse.json();
            map.member_count = membersData.members?.length || 0;
          }
          
          // Fetch pins count
          const pinsResponse = await fetch(`/api/maps/${map.id}/pins`);
          if (pinsResponse.ok) {
            const pinsData = await pinsResponse.json();
            map.pins_count = pinsData.pins?.length || 0;
          }
          
          // Fetch areas count
          const areasResponse = await fetch(`/api/maps/${map.id}/areas`);
          if (areasResponse.ok) {
            const areasData = await areasResponse.json();
            map.areas_count = areasData.areas?.length || 0;
          }
          
          setCurrentMapData(map);
        }
      } catch (err) {
        console.error('Error fetching map data:', err);
        setCurrentMapData(null);
      } finally {
        setLoadingMapData(false);
      }
    };

    fetchMapData();
  }, [activeTab, isOpen, selectedMapId]);

  // Fetch user maps when tab is selected
  useEffect(() => {
    if (activeTab !== 'my-maps' || !isOpen || !account?.id) {
      if (!account?.id) {
        setUserMaps([]);
      }
      return;
    }

    const fetchUserMaps = async () => {
      setLoadingUserMaps(true);
      try {
        const response = await fetch(`/api/maps?account_id=${account.id}`);
        if (!response.ok) throw new Error('Failed to fetch user maps');
        const data = await response.json();
        
        if (data.maps && data.maps.length > 0) {
          const transformedMaps = data.maps.map((map: any) => ({
            ...map,
            map_type: 'user' as const,
          }));

          const mapIds = transformedMaps.map((map: any) => map.id);
          if (mapIds.length > 0) {
            const statsResponse = await fetch(`/api/maps/stats?ids=${mapIds.join(',')}`);
            if (statsResponse.ok) {
              const statsData = await statsResponse.json();
              const mapsWithStats = transformedMaps.map((map: any) => ({
                ...map,
                view_count: statsData.stats?.[map.id]?.total_views || 0,
              }));
              setUserMaps(mapsWithStats);
            } else {
              setUserMaps(transformedMaps);
            }
          } else {
            setUserMaps(transformedMaps);
          }
        } else {
          setUserMaps([]);
        }
      } catch (err) {
        console.error('Error fetching user maps:', err);
        setUserMaps([]);
      } finally {
        setLoadingUserMaps(false);
      }
    };

    fetchUserMaps();
  }, [activeTab, isOpen, account?.id]);

  // Detect current map from pathname and fetch view count and name
  useEffect(() => {
    if (pathname?.startsWith('/map/')) {
      const mapIdOrSlug = pathname.replace('/map/', '');
      // Handle all custom slugs and UUIDs, but exclude 'new' (create page)
      if (mapIdOrSlug && mapIdOrSlug !== 'new') {
        setSelectedMapId(mapIdOrSlug);
        
        // Fetch map info (name and view count) for selected map
        const fetchMapInfo = async () => {
          try {
            // First try to find the map in our existing maps to get the ID
            const foundMap = maps.find(m => 
              m.id === mapIdOrSlug || 
              m.slug === mapIdOrSlug ||
              m.custom_slug === mapIdOrSlug ||
              m.href?.replace('/map/', '') === mapIdOrSlug
            );
            
            if (foundMap) {
              // Use map from our list
              setSelectedMapName(foundMap.name || foundMap.title || null);
              if (foundMap.view_count !== undefined) {
                setSelectedMapViewCount(foundMap.view_count);
              } else {
                // Fetch view count if not available
                const statsResponse = await fetch(`/api/maps/stats?ids=${foundMap.id}`);
                if (statsResponse.ok) {
                  const statsData = await statsResponse.json();
                  const viewCount = statsData.stats?.[foundMap.id]?.total_views || 0;
                  setSelectedMapViewCount(viewCount);
                }
              }
              return;
            }
            
            // Map not in our list, fetch from API
            const mapId = mapIdOrSlug;
            const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
            
            if (!isUUID(mapId)) {
              // If it's a slug, fetch map data first
              try {
                const mapResponse = await fetch(`/api/maps/${mapId}`);
                if (mapResponse.ok) {
                  const mapData = await mapResponse.json();
                  const resolvedId = mapData.id;
                  const mapName = mapData.name || mapData.title || null;
                  setSelectedMapName(mapName);
                  
                  if (resolvedId && isUUID(resolvedId)) {
                    const statsResponse = await fetch(`/api/maps/stats?ids=${resolvedId}`);
                    if (statsResponse.ok) {
                      const statsData = await statsResponse.json();
                      const viewCount = statsData.stats?.[resolvedId]?.total_views || 0;
                      setSelectedMapViewCount(viewCount);
                    }
                  }
                }
              } catch (err) {
                // Skip if can't resolve
              }
              return;
            }
            
            // Fetch map data and stats for UUID
            try {
              const mapResponse = await fetch(`/api/maps/${mapId}`);
              if (mapResponse.ok) {
                const mapData = await mapResponse.json();
                const mapName = mapData.name || mapData.title || null;
                setSelectedMapName(mapName);
              }
            } catch (err) {
              // Skip if can't fetch map data
            }
            
            const statsResponse = await fetch(`/api/maps/stats?ids=${mapId}`);
            if (statsResponse.ok) {
              const statsData = await statsResponse.json();
              const viewCount = statsData.stats?.[mapId]?.total_views || 0;
              setSelectedMapViewCount(viewCount);
            } else {
              setSelectedMapViewCount(null);
            }
          } catch (err) {
            console.error('Error fetching map info:', err);
            setSelectedMapViewCount(null);
            setSelectedMapName(null);
          }
        };
        
        fetchMapInfo();
      } else {
        setSelectedMapId(null);
        setSelectedMapViewCount(null);
        setSelectedMapName(null);
      }
    } else if (pathname !== '/maps') {
      // Clear selection when not on /maps or /map pages
      setSelectedMapId(null);
      setSelectedMapViewCount(null);
      setSelectedMapName(null);
    }
  }, [pathname, maps]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedMap = maps.find(m => {
    if (!selectedMapId) return false;
    // Match by ID
    if (m.id === selectedMapId) return true;
    // Match by custom slug
    if (m.custom_slug === selectedMapId) return true;
    // Match by href (extract slug from /map/[slug] or /map/[id])
    if (m.href) {
      const hrefSlug = m.href.replace('/map/', '');
      if (hrefSlug === selectedMapId) return true;
    }
    return false;
  });

  // Fetch view count and name for selected map if not already available
  useEffect(() => {
    if (selectedMapId && selectedMap) {
      // Set name from selectedMap
      if (selectedMap.name || selectedMap.title) {
        setSelectedMapName(selectedMap.name || selectedMap.title || null);
      }
      
      if (selectedMap.view_count === undefined) {
        const fetchViewCount = async () => {
          try {
            const statsResponse = await fetch(`/api/maps/stats?ids=${selectedMap.id}`);
            if (statsResponse.ok) {
              const statsData = await statsResponse.json();
              const viewCount = statsData.stats?.[selectedMap.id]?.total_views || 0;
              setSelectedMapViewCount(viewCount);
              // Also update the map in the maps array
              setMaps(prevMaps => 
                prevMaps.map(m => 
                  m.id === selectedMap.id 
                    ? { ...m, view_count: viewCount }
                    : m
                )
              );
            }
          } catch (err) {
            console.error('Error fetching view count:', err);
          }
        };
        fetchViewCount();
      } else {
        setSelectedMapViewCount(selectedMap.view_count);
      }
    }
  }, [selectedMapId, selectedMap]);

  const handleMapSelect = (map: MapItem) => {
    if (map.href) {
      router.push(map.href);
    } else if (map.map_type === 'user') {
      router.push(`/map/${map.id}`);
    }
    setIsOpen(false);
  };

  // Render dropdown content (used for both desktop and mobile)
  const renderDropdownContent = () => (
    <>
      {/* Tabs */}
      <div className="flex items-center border-b border-gray-200">
        {isMapPage && (
          <button
            onClick={() => setActiveTab('about')}
            className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'about'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            About
          </button>
        )}
        <button
          onClick={() => setActiveTab('community')}
          className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'community'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Community
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1">
        {activeTab === 'about' ? (
          loadingMapData ? (
            <div className="p-3 text-xs text-gray-500 text-center">Loading map info...</div>
          ) : currentMapData ? (
            <div className="p-3 space-y-3">
              {/* Title */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium text-gray-500">Title</div>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
                  <div className="text-xs text-gray-900">{currentMapData.name || currentMapData.title}</div>
                </div>
              </div>
              
              {/* Description */}
              {currentMapData.description && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium text-gray-500">Description</div>
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
                    <div className="text-xs text-gray-600 whitespace-pre-wrap break-words">{currentMapData.description}</div>
                  </div>
                </div>
              )}
              
              {/* Owner */}
              {currentMapData.account && !currentMapData.settings?.presentation?.hide_creator && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium text-gray-500">Owner</div>
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
                    <div className="flex items-center gap-2">
                      {currentMapData.account.image_url ? (
                        <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
                          <Image
                            src={currentMapData.account.image_url}
                            alt={currentMapData.account.username || 'User'}
                            width={24}
                            height={24}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] text-gray-500">
                            {(currentMapData.account.first_name?.[0] || currentMapData.account.username?.[0] || 'U').toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="text-xs font-medium text-gray-900 truncate flex-1">
                        {currentMapData.account.first_name && currentMapData.account.last_name
                          ? `${currentMapData.account.first_name} ${currentMapData.account.last_name}`
                          : currentMapData.account.username
                          ? `@${currentMapData.account.username}`
                          : 'User'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Stats */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium text-gray-500">Statistics</div>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px] space-y-1.5">
                  {currentMapData.member_count !== undefined && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <UserGroupIcon className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-600">Members</span>
                      </div>
                      <span className="text-xs font-medium text-gray-900">{currentMapData.member_count}</span>
                    </div>
                  )}
                  {currentMapData.pins_count !== undefined && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <MapPinIcon className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-600">Pins</span>
                      </div>
                      <span className="text-xs font-medium text-gray-900">{currentMapData.pins_count}</span>
                    </div>
                  )}
                  {currentMapData.areas_count !== undefined && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <PencilSquareIcon className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-600">Areas</span>
                      </div>
                      <span className="text-xs font-medium text-gray-900">{currentMapData.areas_count}</span>
                    </div>
                  )}
                  {currentMapData.view_count !== undefined && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <EyeIcon className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-600">Views</span>
                      </div>
                      <span className="text-xs font-medium text-gray-900">
                        {currentMapData.view_count.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Visibility */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium text-gray-500">Visibility</div>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
                  <div className="flex items-center gap-1.5">
                    {currentMapData.visibility === 'public' ? (
                      <>
                        <GlobeAltIcon className="w-3 h-3 text-gray-500" />
                        <span className="text-xs font-medium text-gray-900 capitalize">Public</span>
                      </>
                    ) : (
                      <>
                        <LockClosedIcon className="w-3 h-3 text-gray-500" />
                        <span className="text-xs font-medium text-gray-900 capitalize">Private</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Categories */}
              {currentMapData.categories && currentMapData.categories.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium text-gray-500">Categories</div>
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
                    <div className="flex flex-wrap gap-1">
                      {currentMapData.categories.map((cat: string) => (
                        <span
                          key={cat}
                          className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-700 rounded border border-gray-200 capitalize"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 text-xs text-gray-500 text-center">Map info not available</div>
          )
        ) : activeTab === 'community' ? (
          loadingCommunityMaps ? (
            <div className="p-3 text-xs text-gray-500 text-center">Loading maps...</div>
          ) : communityMaps.length === 0 ? (
            <div className="p-3 text-xs text-gray-500 text-center">No maps found</div>
          ) : (
            <div className="py-1">
              {communityMaps.map((map) => {
                const isSelected = selectedMapId === map.id || selectedMapId === map.custom_slug;
                return (
                  <button
                    key={map.id}
                    onClick={() => handleMapSelect(map)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-indigo-50 text-indigo-900' : 'text-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{map.name || map.title}</span>
                      {map.view_count !== undefined && (
                        <div className="flex items-center gap-0.5 text-gray-500 flex-shrink-0">
                          <EyeIcon className="w-3 h-3" />
                          <span className="text-[10px]">{map.view_count.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          loadingUserMaps ? (
            <div className="p-3 text-xs text-gray-500 text-center">Loading maps...</div>
          ) : userMaps.length === 0 ? (
            <div className="p-3 text-xs text-gray-500 text-center">No maps found</div>
          ) : (
            <div className="py-1">
              {userMaps.map((map) => {
                const isSelected = selectedMapId === map.id || selectedMapId === map.custom_slug;
                return (
                  <button
                    key={map.id}
                    onClick={() => handleMapSelect(map)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-indigo-50 text-indigo-900' : 'text-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{map.name || map.title}</span>
                      {map.view_count !== undefined && (
                        <div className="flex items-center gap-0.5 text-gray-500 flex-shrink-0">
                          <EyeIcon className="w-3 h-3" />
                          <span className="text-[10px]">{map.view_count.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )
        )}
      </div>
    </>
  );
  
  const displayText = selectedMap 
    ? `${selectedMap.tags?.[0]?.emoji || '🗺️'} ${selectedMap.name || selectedMap.title}`
    : isMapsPage
    ? 'Choose map'
    : 'Maps';

  const triggerTextClass = darkText ? 'text-gray-700' : 'text-white';
  const triggerMutedClass = darkText ? 'text-gray-500' : 'text-white/70';
  const triggerHoverClass = darkText ? 'hover:bg-black/5' : 'hover:bg-white/10';

  // On map page: unified button that opens dropdown
  if (isMapPage && selectedMapId) {
    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md ${triggerHoverClass} transition-colors font-medium ${triggerTextClass} whitespace-nowrap group`}
        >
          {isLiveMapPage && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0"
              aria-hidden
            />
          )}
          <span className="truncate max-w-[160px] sm:max-w-[220px] text-sm">
            {selectedMap?.name || selectedMapName || selectedMapId || 'Map'}
          </span>
          <ChevronDownIcon className={`w-3 h-3 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-all ${isOpen ? 'rotate-180 opacity-100' : ''} ${triggerMutedClass}`} />
        </button>

        {/* Desktop Dropdown */}
        {!isMobile && isOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 sm:w-80 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-[400px] overflow-hidden flex flex-col">
            {renderDropdownContent()}
          </div>
        )}

        {/* Mobile Popup */}
        {isMobile && (
          <BottomButtonsPopup
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            type="account"
            height="full"
            darkMode={false}
            containerRelative={false}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-[10px] py-[10px] border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-3xl">
              <h2 className="text-sm font-semibold text-gray-900">Maps</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center w-8 h-8 hover:bg-gray-100 rounded-md transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex flex-col h-full">
              {renderDropdownContent()}
            </div>
          </BottomButtonsPopup>
        )}
      </div>
    );
  }

  // On /maps page or other pages: single button without emoji
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md ${triggerHoverClass} text-xs font-medium ${triggerTextClass} transition-colors whitespace-nowrap max-w-[200px] sm:max-w-[250px]`}
      >
        <MapIcon className={`w-3.5 h-3.5 flex-shrink-0 ${triggerMutedClass}`} />
        <span className="truncate">{displayText}</span>
        <ChevronDownIcon className={`w-3 h-3 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${triggerMutedClass}`} />
      </button>

      {/* Desktop Dropdown */}
      {!isMobile && isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 sm:w-80 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-[400px] overflow-hidden flex flex-col">
          {renderDropdownContent()}
        </div>
      )}

      {/* Mobile Popup */}
      {isMobile && (
        <BottomButtonsPopup
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          type="account"
          height="full"
          darkMode={false}
          containerRelative={false}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-[10px] py-[10px] border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-3xl">
            <h2 className="text-sm font-semibold text-gray-900">Maps</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center w-8 h-8 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          
          {/* Content */}
          <div className="flex flex-col h-full">
            {renderDropdownContent()}
          </div>
        </BottomButtonsPopup>
      )}
    </div>
  );
}
