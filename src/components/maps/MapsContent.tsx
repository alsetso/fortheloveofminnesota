'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { MapIcon, EyeIcon, HeartIcon, UserGroupIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import MapCard from '@/app/maps/components/MapCard';
import type { MapItem } from '@/app/maps/types';
import { getMapUrl } from '@/lib/maps/urls';

/**
 * Maps Content - Main content area for maps list
 * Displays maps in grid layout with sections
 */
export default function MapsContent() {
  const searchParams = useSearchParams();
  const { account } = useAuthStateSafe();
  const supabase = useSupabaseClient();
  const defaultView = account ? 'my-maps' : 'community';
  const currentView = searchParams.get('view') || defaultView;
  
  // State for my maps grouped by role
  const [myMapsByRole, setMyMapsByRole] = useState<{
    owner: MapItem[];
    manager: MapItem[];
    editor: MapItem[];
  }>({
    owner: [],
    manager: [],
    editor: [],
  });
  const [loadingMyMaps, setLoadingMyMaps] = useState(false);

  // State for community maps (real data)
  const [communityMaps, setCommunityMaps] = useState<MapItem[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(false);

  // Fetch community maps (real data)
  useEffect(() => {
    if (currentView !== 'community') {
      setCommunityMaps([]);
      return;
    }

    const fetchCommunityMaps = async () => {
      setLoadingCommunity(true);
      try {
        const response = await fetch('/api/maps?community=true&limit=50');
        const data = await response.json();

        if (response.ok && data.maps) {
          // Transform API response to MapItem format
          const maps = data.maps.map((map: any) => ({
            ...map,
            name: map.name || map.title,
            slug: map.slug || map.custom_slug,
            href: getMapUrl({ id: map.id, slug: map.slug, custom_slug: map.custom_slug }),
            account_id: map.account_id,
            visibility: map.visibility || 'public',
            view_count: 0, // Will be fetched via stats
            pin_count: 0, // Not in API response
            member_count: map.member_count || 0,
          }));

          // Fetch stats for all maps
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
        }
      } catch (err) {
        console.error('Error fetching community maps:', err);
        setCommunityMaps([]);
      } finally {
        setLoadingCommunity(false);
      }
    };

    fetchCommunityMaps();
  }, [currentView]);

  // Fetch my maps grouped by role
  useEffect(() => {
    if (currentView !== 'my-maps' || !account?.id) {
      setMyMapsByRole({ owner: [], manager: [], editor: [] });
      return;
    }
    
    const fetchMyMaps = async () => {
      setLoadingMyMaps(true);
      try {
        // Fetch maps where user is owner
        const ownedResponse = await fetch(`/api/maps?account_id=${account.id}`);
        const ownedData = ownedResponse.ok ? await ownedResponse.json() : { maps: [] };
        
        // Fetch maps where user is a member (via map_members table)
        const { data: memberMapsData, error: memberError } = await supabase
          .from('map_members')
          .select(`
            map_id,
            role,
            map:map!map_members_map_id_fkey(
              id,
              account_id,
              name,
              description,
              slug,
              custom_slug,
              visibility,
              settings,
              member_count,
              is_active,
              tags,
              created_at,
              updated_at
            )
          `)
          .eq('account_id', account.id)
          .eq('map.is_active', true);

        if (memberError) {
          console.error('Error fetching member maps:', memberError);
        }

        // Combine owned and member maps
        const ownedMaps = (ownedData.maps || []).map((map: any) => ({
          ...map,
          name: map.name || map.title,
          slug: map.slug || map.custom_slug,
          href: getMapUrl({ id: map.id, slug: map.slug, custom_slug: map.custom_slug }),
          account_id: map.account_id,
          visibility: map.visibility || 'public',
          current_user_role: 'owner' as const,
        }));

        const memberMaps = (memberMapsData || [])
          .map((member: any) => {
            const map = member.map;
            if (!map) return null;
            return {
              ...map,
              name: map.name || map.title,
              slug: map.slug || map.custom_slug,
              href: getMapUrl({ id: map.id, slug: map.slug, custom_slug: map.custom_slug }),
              account_id: map.account_id,
              visibility: map.visibility || 'public',
              current_user_role: member.role as 'manager' | 'editor',
            };
          })
          .filter(Boolean);

        // Combine and deduplicate (in case user is both owner and member somehow)
        const allMapsMap = new Map<string, any>();
        [...ownedMaps, ...memberMaps].forEach((map: any) => {
          if (!allMapsMap.has(map.id) || map.current_user_role === 'owner') {
            allMapsMap.set(map.id, map);
          }
        });

        const allMaps = Array.from(allMapsMap.values());
        
        // Fetch stats
        if (allMaps.length > 0) {
          const statsResponse = await fetch(`/api/maps/stats?ids=${allMaps.map((m: any) => m.id).join(',')}`);
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            const withStats = allMaps.map((map: any) => ({
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
              owner: allMaps.filter((m: any) => m.current_user_role === 'owner'),
              manager: allMaps.filter((m: any) => m.current_user_role === 'manager'),
              editor: allMaps.filter((m: any) => m.current_user_role === 'editor'),
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
  }, [currentView, account?.id, supabase]);

  const mapsToDisplay = 
    currentView === 'community' ? communityMaps :
    currentView === 'my-maps' ? [...myMapsByRole.owner, ...myMapsByRole.manager, ...myMapsByRole.editor] :
    [];

  const getViewTitle = () => {
    switch (currentView) {
      case 'community':
        return 'Community Maps';
      case 'my-maps':
        return 'My Maps';
      default:
        return 'My Maps';
    }
  };

  const isLoading = currentView === 'my-maps' ? loadingMyMaps : loadingCommunity;

  return (
    <div className="max-w-[1200px] mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">{getViewTitle()}</h1>
        <p className="text-sm text-foreground-muted">
          {currentView === 'community' && 'Browse maps published to the community'}
          {currentView === 'my-maps' && 'Maps you own, manage, or contribute to'}
        </p>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-sm text-foreground-muted">
            {currentView === 'my-maps' ? 'Loading your maps...' : 'Loading community maps...'}
          </div>
        </div>
      ) : mapsToDisplay.length === 0 ? (
        <div className="text-center py-12 border border-border-muted dark:border-white/10 border-dashed rounded-md bg-surface-accent">
          <MapIcon className="w-16 h-16 text-foreground-subtle mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Maps Found</h3>
          <p className="text-sm text-foreground-muted mb-4">
            {currentView === 'community' && 'No community maps available yet'}
            {currentView === 'my-maps' && 'You are not a member of any maps yet'}
          </p>
          {account && (
            <Link
              href="/maps/new"
              className="inline-block px-4 py-2 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-sm font-medium"
            >
              Create Map
            </Link>
          )}
        </div>
      ) : currentView === 'my-maps' ? (
        // My Maps view - show grouped by role
        <div className="space-y-6">
          {/* Owner Section */}
          {myMapsByRole.owner.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Owner</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {myMapsByRole.owner.map((map) => (
                  <MapCard
                    key={map.id}
                    map={map}
                    account={account}
                    showRoleIcon={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Manager Section */}
          {myMapsByRole.manager.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Manager</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {myMapsByRole.manager.map((map) => (
                  <MapCard
                    key={map.id}
                    map={map}
                    account={account}
                    showRoleIcon={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Editor Section */}
          {myMapsByRole.editor.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Editor</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {myMapsByRole.editor.map((map) => (
                  <MapCard
                    key={map.id}
                    map={map}
                    account={account}
                    showRoleIcon={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state for my maps */}
          {myMapsByRole.owner.length === 0 && myMapsByRole.manager.length === 0 && myMapsByRole.editor.length === 0 && !loadingMyMaps && (
            <div className="text-center py-12 border border-border-muted dark:border-white/10 border-dashed rounded-md bg-surface-accent">
              <MapIcon className="w-16 h-16 text-foreground-subtle mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Maps Found</h3>
              <p className="text-sm text-foreground-muted mb-4">
                You are not a member of any maps yet
              </p>
              {account && (
                <Link
                  href="/maps/new"
                  className="inline-block px-4 py-2 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-sm font-medium"
                >
                  Create Map
                </Link>
              )}
            </div>
          )}
        </div>
      ) : (
        // Community view - show in grid
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {mapsToDisplay.map((map) => (
            <MapCard
              key={map.id}
              map={map}
              account={account}
              showRoleIcon={false}
            />
          ))}
        </div>
      )}

    </div>
  );
}
