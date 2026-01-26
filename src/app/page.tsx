'use client';

import { useMemo, useState, useEffect } from 'react';
import { useAccountData } from '@/features/account/hooks/useAccountData';
import ProfileCard from '@/features/profiles/components/ProfileCard';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import LandingPage from '@/components/landing/LandingPage';
import { useAuthStateSafe } from '@/features/auth';
import type { ProfileAccount } from '@/types/profile';
import MapListItem from '@/app/maps/components/MapListItem';
import { getMapUrl } from '@/lib/maps/urls';
import type { MapItem } from '@/app/maps/types';
import Link from 'next/link';
import { ChartBarIcon, EyeIcon } from '@heroicons/react/24/outline';

export default function Home() {
  const { account, userEmail } = useAccountData(true, 'profile');
  const { account: authAccount } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
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

  // Convert Account to ProfileAccount format
  const profileAccount: ProfileAccount | null = useMemo(() => {
    if (!account) return null;
    
    return {
      id: account.id,
      username: account.username,
      first_name: account.first_name,
      last_name: account.last_name,
      email: userEmail,
      phone: account.phone,
      image_url: account.image_url,
      cover_image_url: account.cover_image_url,
      bio: account.bio,
      city_id: account.city_id,
      view_count: account.view_count || 0,
      traits: account.traits,
      user_id: account.user_id,
      created_at: account.created_at,
      plan: account.plan,
    };
  }, [account, userEmail]);

  // Fetch my maps grouped by role
  useEffect(() => {
    if (!authAccount?.id) {
      setMyMapsByRole({ owner: [], manager: [], editor: [] });
      return;
    }
    
    const fetchMyMaps = async () => {
      setLoadingMaps(true);
      try {
        // Fetch maps where user is a member or owner
        const response = await fetch(`/api/maps?account_id=${authAccount.id}`);
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
            const isOwner = map.account_id === authAccount.id;
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
                const myMember = memberData.members?.find((m: any) => m.account_id === authAccount.id);
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
        setLoadingMaps(false);
      }
    };
    
    fetchMyMaps();
  }, [authAccount?.id]);

  // If not authenticated, show landing page
  if (!authAccount) {
    return <LandingPage />;
  }

  // If authenticated, show profile card
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
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-md mx-auto space-y-3">
            {/* Profile Card */}
            {profileAccount ? (
              <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                <ProfileCard 
                  account={profileAccount} 
                  isOwnProfile={true}
                  showViewProfile={false}
                />
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                <div className="h-[200px] flex items-center justify-center">
                  <p className="text-xs text-gray-500">Loading profile...</p>
                </div>
              </div>
            )}

            {/* My Maps Sections */}
            {authAccount && (
              <div className="space-y-3">
                {/* Owner Section */}
                {myMapsByRole.owner.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                    <h3 className="text-xs font-semibold text-gray-900 mb-2">Own</h3>
                    <div className="space-y-2">
                      {myMapsByRole.owner.map((map) => (
                        <MapListItem
                          key={map.id}
                          map={map}
                          account={authAccount}
                          showRoleIcon={true}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Manager Section */}
                {myMapsByRole.manager.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                    <h3 className="text-xs font-semibold text-gray-900 mb-2">Manager of</h3>
                    <div className="space-y-2">
                      {myMapsByRole.manager.map((map) => (
                        <MapListItem
                          key={map.id}
                          map={map}
                          account={authAccount}
                          showRoleIcon={true}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Editor Section */}
                {myMapsByRole.editor.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                    <h3 className="text-xs font-semibold text-gray-900 mb-2">Editor of</h3>
                    <div className="space-y-2">
                      {myMapsByRole.editor.map((map) => (
                        <MapListItem
                          key={map.id}
                          map={map}
                          account={authAccount}
                          showRoleIcon={true}
                        />
                      ))}
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
                {!loadingMaps && 
                 myMapsByRole.owner.length === 0 && 
                 myMapsByRole.manager.length === 0 && 
                 myMapsByRole.editor.length === 0 && (
                  <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                    <p className="text-xs text-gray-500 text-center py-4">You are not a member of any maps yet</p>
                  </div>
                )}
              </div>
            )}

            {/* Analytics Section */}
            {authAccount && (
              <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                <Link
                  href="/analytics"
                  className="block hover:bg-gray-50 transition-colors rounded-md -m-[10px] p-[10px]"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center gap-2">
                      <ChartBarIcon className="w-4 h-4 text-gray-600" />
                      <h3 className="text-xs font-semibold text-gray-900">Analytics</h3>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-gray-600">
                      View your profile, mention, post, and map analytics
                    </p>

                    {/* CTA */}
                    <div className="pt-1.5 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">View analytics</span>
                        <EyeIcon className="w-3 h-3 text-gray-500" />
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
