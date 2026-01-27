'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStateSafe } from '@/features/auth';
import MapCard from '@/app/maps/components/MapCard';
import { getMapUrl } from '@/lib/maps/urls';
import type { MapItem } from '@/app/maps/types';
import Link from 'next/link';
import { PlusIcon, ExclamationTriangleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useBillingEntitlementsSafe } from '@/contexts/BillingEntitlementsContext';
import { supabase } from '@/lib/supabase';

export default function HomeMapsSidebar() {
  const { account: authAccount } = useAuthStateSafe();
  const { features, getFeature } = useBillingEntitlementsSafe();
  const [myMapsByRole, setMyMapsByRole] = useState<{
    owner: MapItem[];
    manager: MapItem[];
    editor: MapItem[];
  }>({
    owner: [],
    manager: [],
    editor: [],
  });
  const [loadingMaps, setLoadingMaps] = useState(false);
  const [mapUsage, setMapUsage] = useState<number>(0);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<Array<{
    map_id: string;
    map: MapItem;
    status: 'pending';
    created_at: string;
  }>>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Get map feature limit
  const mapFeature = useMemo(() => {
    return getFeature('custom_maps') || getFeature('map') || getFeature('unlimited_maps');
  }, [features, getFeature]);

  // Fetch map usage count
  useEffect(() => {
    if (!authAccount?.id) {
      setMapUsage(0);
      return;
    }

    const fetchUsage = async () => {
      setLoadingUsage(true);
      try {
        const response = await fetch('/api/billing/usage', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setMapUsage(data.usage?.custom_maps || data.usage?.maps || data.usage?.map || 0);
        }
      } catch (err) {
        console.error('Error fetching map usage:', err);
      } finally {
        setLoadingUsage(false);
      }
    };

    fetchUsage();
  }, [authAccount?.id]);

  // Fetch my maps grouped by role
  useEffect(() => {
    if (!authAccount?.id) {
      setMyMapsByRole({ owner: [], manager: [], editor: [] });
      setPendingRequests([]);
      return;
    }
    
    const fetchMyMaps = async () => {
      setLoadingMaps(true);
      try {
        // Fetch maps where user is owner
        const ownedResponse = await fetch(`/api/maps?account_id=${authAccount.id}`);
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
              visibility,
              settings,
              member_count,
              is_active,
              tags,
              created_at,
              updated_at,
              account:accounts!map_account_id_fkey(
                id,
                username,
                first_name,
                last_name,
                image_url
              )
            )
          `)
          .eq('account_id', authAccount.id)
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
        setLoadingMaps(false);
      }
    };
    
    fetchMyMaps();
  }, [authAccount?.id]);

  // Fetch pending membership requests
  useEffect(() => {
    if (!authAccount?.id) {
      setPendingRequests([]);
      return;
    }

    const fetchPendingRequests = async () => {
      setLoadingRequests(true);
      try {
        // Fetch all pending requests for this account
        const { data: requestsData, error } = await supabase
          .from('map_membership_requests')
          .select(`
            id,
            map_id,
            status,
            created_at,
            map:map!map_membership_requests_map_id_fkey(
              id,
              account_id,
              name,
              description,
              slug,
              visibility,
              settings,
              member_count,
              is_active,
              tags,
              created_at,
              updated_at,
              account:accounts!map_account_id_fkey(
                id,
                username,
                first_name,
                last_name,
                image_url
              )
            )
          `)
          .eq('account_id', authAccount.id)
          .eq('status', 'pending')
          .eq('map.is_active', true)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching pending requests:', error);
          setPendingRequests([]);
          return;
        }

        // Transform to MapItem format
        const requests = (requestsData || [])
          .map((req: any) => {
            const map = req.map;
            if (!map) return null;
            const mapItem: MapItem = {
              id: map.id,
              name: map.name || 'Unnamed Map',
              slug: map.slug || map.id, // Use ID as fallback if no slug
              href: getMapUrl({ id: map.id, slug: map.slug }),
              visibility: (map.visibility || 'public') as 'public' | 'private',
              description: map.description || null,
              settings: map.settings || {},
              member_count: map.member_count || 0,
              view_count: 0,
            };
            return {
              map_id: req.map_id,
              map: mapItem,
              status: req.status as 'pending',
              created_at: req.created_at,
            };
          })
          .filter((req): req is { map_id: string; map: MapItem; status: 'pending'; created_at: string } => req !== null);

        setPendingRequests(requests);
      } catch (err) {
        console.error('Error fetching pending requests:', err);
        setPendingRequests([]);
      } finally {
        setLoadingRequests(false);
      }
    };

    fetchPendingRequests();
  }, [authAccount?.id]);

  const allMaps = [
    ...myMapsByRole.owner,
    ...myMapsByRole.manager,
    ...myMapsByRole.editor,
  ];

  // Format plan name for display
  const planDisplayName = useMemo(() => {
    if (!authAccount?.plan) return null;
    const plan = authAccount.plan.toLowerCase();
    if (plan === 'contributor') return 'Contributor';
    if (plan === 'professional') return 'Professional';
    if (plan === 'business') return 'Business';
    if (plan === 'plus') return 'Pro+';
    if (plan === 'hobby') return 'Hobby';
    // Fallback: capitalize first letter
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  }, [authAccount?.plan]);

  // Calculate limit display
  const limitDisplay = useMemo(() => {
    if (!mapFeature) return null;
    const planText = planDisplayName ? ` (${planDisplayName} Plan)` : '';
    if (mapFeature.is_unlimited) {
      return { text: `${mapUsage} maps (unlimited)${planText}`, isAtLimit: false };
    }
    if (mapFeature.limit_type === 'count' && mapFeature.limit_value !== null) {
      const isAtLimit = mapUsage >= mapFeature.limit_value;
      return {
        text: `${mapUsage} / ${mapFeature.limit_value} maps${planText}`,
        isAtLimit,
        limit: mapFeature.limit_value,
      };
    }
    return null;
  }, [mapFeature, mapUsage, planDisplayName]);

  const canCreateMore = useMemo(() => {
    if (!mapFeature) return false;
    if (mapFeature.is_unlimited) return true;
    if (mapFeature.limit_type === 'count' && mapFeature.limit_value !== null) {
      return mapUsage < mapFeature.limit_value;
    }
    return false;
  }, [mapFeature, mapUsage]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-hide p-[10px] space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-900">My Maps</h2>
          <Link
            href="/map/new"
            className={`flex items-center gap-1 text-xs transition-colors ${
              canCreateMore
                ? 'text-gray-600 hover:text-gray-900'
                : 'text-gray-400 cursor-not-allowed'
            }`}
            onClick={(e) => {
              if (!canCreateMore) {
                e.preventDefault();
              }
            }}
            title={!canCreateMore ? 'Map limit reached' : 'Create new map'}
          >
            <PlusIcon className="w-3 h-3" />
            <span>New</span>
          </Link>
        </div>

        {/* Plan Limit Display */}
        {limitDisplay && (
          <div className={`bg-white border rounded-md p-[10px] ${
            limitDisplay.isAtLimit
              ? 'border-amber-200 bg-amber-50'
              : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {limitDisplay.isAtLimit && (
                  <ExclamationTriangleIcon className="w-3 h-3 text-amber-600" />
                )}
                <span className={`text-xs ${
                  limitDisplay.isAtLimit ? 'text-amber-900 font-medium' : 'text-gray-600'
                }`}>
                  {limitDisplay.text}
                </span>
              </div>
              {limitDisplay.isAtLimit && (
                <Link
                  href="/billing"
                  className="text-xs font-medium text-amber-700 hover:text-amber-900"
                >
                  Upgrade
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loadingMaps && (
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <p className="text-xs text-gray-500 text-center py-4">Loading maps...</p>
          </div>
        )}

        {/* Empty State */}
        {!loadingMaps && allMaps.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <p className="text-xs text-gray-500 text-center py-4">You are not a member of any maps yet</p>
            <Link
              href="/map/new"
              className="block mt-2 text-center text-xs font-medium text-gray-900 hover:text-gray-700"
            >
              Create your first map
            </Link>
          </div>
        )}

        {/* Grouped by Role */}
        {!loadingMaps && allMaps.length > 0 && (
          <div className="space-y-3">
            {/* Owner Section */}
            {myMapsByRole.owner.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-900 mb-2">Own</h3>
                <div className="space-y-2">
                  {myMapsByRole.owner.map((map) => (
                    <MapCard
                      key={map.id}
                      map={map}
                      account={authAccount}
                      showRoleIcon={true}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Apart of Section (Manager + Editor combined) */}
            {(myMapsByRole.manager.length > 0 || myMapsByRole.editor.length > 0) && (
              <div>
                <h3 className="text-xs font-semibold text-gray-900 mb-2">Apart of</h3>
                <div className="space-y-2">
                  {myMapsByRole.manager.map((map) => (
                    <MapCard
                      key={map.id}
                      map={map}
                      account={authAccount}
                      showRoleIcon={true}
                    />
                  ))}
                  {myMapsByRole.editor.map((map) => (
                    <MapCard
                      key={map.id}
                      map={map}
                      account={authAccount}
                      showRoleIcon={true}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Pending Requests Section */}
            {pendingRequests.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                  <ClockIcon className="w-3 h-3 text-gray-500" />
                  <span>Pending</span>
                </h3>
                <div className="space-y-2">
                  {pendingRequests.map((req) => (
                    <div key={req.map_id} className="relative">
                      <MapCard
                        map={req.map}
                        account={authAccount}
                        showRoleIcon={false}
                      />
                      <div className="absolute top-2 right-2 bg-amber-100 border border-amber-200 rounded-md px-1.5 py-0.5 flex items-center justify-center">
                        <span className="text-[10px] font-medium text-amber-700 text-center">Pending</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
