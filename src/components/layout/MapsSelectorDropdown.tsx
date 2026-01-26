'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronDownIcon, MapIcon, EyeIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import type { MapItem } from '@/app/maps/types';

interface MapsSelectorDropdownProps {
  className?: string;
  onMapClick?: () => void; // Callback when map card is clicked (for opening modal)
}

type TabType = 'community' | 'my-maps';

export default function MapsSelectorDropdown({ className = '' }: MapsSelectorDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { account } = useAuthStateSafe();
  const [isOpen, setIsOpen] = useState(false);
  const [maps, setMaps] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('community');
  const [communityMaps, setCommunityMaps] = useState<MapItem[]>([]);
  const [userMaps, setUserMaps] = useState<MapItem[]>([]);
  const [loadingCommunityMaps, setLoadingCommunityMaps] = useState(false);
  const [loadingUserMaps, setLoadingUserMaps] = useState(false);
  const [selectedMapViewCount, setSelectedMapViewCount] = useState<number | null>(null);
  const [selectedMapName, setSelectedMapName] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reset to community tab when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('community');
    }
  }, [isOpen]);

  // Fetch maps on mount
  useEffect(() => {
    const fetchMaps = async () => {
      setLoading(true);
      try {
        // Fetch primary maps and popular maps
        const response = await fetch('/api/maps?visibility=public&limit=50');
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
        const response = await fetch('/api/maps?collection_type=community&visibility=public');
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

  // Check if we're on a map page (any /map/[slug] except /map/new and /maps)
  const isMapPage = pathname?.startsWith('/map/') && pathname !== '/map/new' && pathname !== '/maps';
  const isMapsPage = pathname === '/maps';
  
  const displayText = selectedMap 
    ? `${selectedMap.tags?.[0]?.emoji || '🗺️'} ${selectedMap.name || selectedMap.title}`
    : isMapsPage
    ? 'Choose map'
    : 'Maps';

  // On map page: unified button that opens dropdown
  if (isMapPage && selectedMapId) {
    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-white/10 transition-colors text-xs font-medium text-white whitespace-nowrap group"
        >
          <span className="truncate max-w-[140px] sm:max-w-[180px]">
            {selectedMap?.name || selectedMapName || selectedMapId || 'Map'}
          </span>
          {(selectedMap?.view_count !== undefined || selectedMapViewCount !== null) && (
            <div className="flex items-center gap-0.5 text-white/70 flex-shrink-0">
              <EyeIcon className="w-3 h-3" />
              <span className="text-[10px]">
                {(selectedMap?.view_count ?? selectedMapViewCount ?? 0).toLocaleString()}
              </span>
            </div>
          )}
          <ChevronDownIcon className={`w-3 h-3 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-all ${isOpen ? 'rotate-180 opacity-100' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 sm:w-80 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-[400px] overflow-hidden flex flex-col">
            {/* Tabs */}
            <div className="flex items-center border-b border-gray-200">
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
              {account && (
                <button
                  onClick={() => setActiveTab('my-maps')}
                  className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === 'my-maps'
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  My Maps
                </button>
              )}
            </div>

            {/* Maps List */}
            <div className="overflow-y-auto flex-1">
              {activeTab === 'community' ? (
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
          </div>
        )}
      </div>
    );
  }

  // On /maps page or other pages: single button without emoji
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white transition-colors whitespace-nowrap max-w-[200px] sm:max-w-[250px]"
      >
        <MapIcon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{displayText}</span>
        <ChevronDownIcon className={`w-3 h-3 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 sm:w-80 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-[400px] overflow-hidden flex flex-col">
          {/* Tabs */}
          <div className="flex items-center border-b border-gray-200">
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
            {account && (
              <button
                onClick={() => setActiveTab('my-maps')}
                className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === 'my-maps'
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                My Maps
              </button>
            )}
          </div>

          {/* Maps List */}
          <div className="overflow-y-auto flex-1">
            {activeTab === 'community' ? (
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
        </div>
      )}
    </div>
  );
}
