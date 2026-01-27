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
import { useUnifiedSidebar } from '@/hooks/useUnifiedSidebar';
import HomePageLayout from './HomePageLayout';
import HomeMapsSidebar from './components/HomeMapsSidebar';
import HomeAnalyticsSidebar from './components/HomeAnalyticsSidebar';
import SidebarHeaderButtons from '@/components/layout/SidebarHeaderButtons';
import { MapIcon, ChartBarIcon } from '@heroicons/react/24/outline';

export default function Home() {
  const { account, userEmail } = useAccountData(true, 'profile');
  const { account: authAccount } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  
  // Sidebar state management
  const {
    activeSidebar: leftSidebar,
    toggleSidebar: toggleLeftSidebar,
    closeSidebar: closeLeftSidebar,
    openSidebar: openLeftSidebar,
  } = useUnifiedSidebar();
  
  const [rightSidebar, setRightSidebar] = useState<string | null>(null);
  
  const toggleRightSidebar = () => {
    setRightSidebar(prev => prev === 'analytics' ? null : 'analytics');
  };
  
  const closeRightSidebar = () => {
    setRightSidebar(null);
  };

  // Quick stats for profile card
  const [quickStats, setQuickStats] = useState<{
    mapsCount?: number;
    mentionsCount?: number;
  }>({});
  const [loadingStats, setLoadingStats] = useState(false);

  // Auto-open sidebars on desktop when user is logged in
  useEffect(() => {
    if (!authAccount) return;

    const checkAndOpenSidebars = () => {
      // Check if we're on desktop (lg breakpoint is 1024px)
      const isDesktop = window.innerWidth >= 1024;
      
      if (isDesktop) {
        // Auto-open left sidebar (maps)
        openLeftSidebar('maps');
        // Auto-open right sidebar (analytics)
        setRightSidebar('analytics');
      }
    };

    // Check on mount and when authAccount changes
    checkAndOpenSidebars();

    // Also check on window resize (debounced to avoid too many calls)
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const isDesktop = window.innerWidth >= 1024;
        if (isDesktop) {
          // Open sidebars on desktop
          openLeftSidebar('maps');
          setRightSidebar((prev) => prev || 'analytics');
        } else {
          // On mobile, close sidebars (they'll be popups)
          closeLeftSidebar();
          setRightSidebar(null);
        }
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [authAccount, openLeftSidebar, closeLeftSidebar]); // Include sidebar functions

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

  // Fetch quick stats for profile card
  useEffect(() => {
    if (!authAccount?.id) {
      setQuickStats({});
      return;
    }

    const fetchQuickStats = async () => {
      setLoadingStats(true);
      try {
        // Fetch maps count
        const mapsResponse = await fetch(`/api/maps?account_id=${authAccount.id}`);
        if (mapsResponse.ok) {
          const mapsData = await mapsResponse.json();
          const mapsCount = mapsData.maps?.length || 0;

          // Fetch mentions count (map_pins on live map)
          // First get live map ID
          const liveMapResponse = await fetch('/api/maps?slug=live');
          if (liveMapResponse.ok) {
            const liveMapData = await liveMapResponse.json();
            const liveMap = liveMapData.maps?.[0];
            const liveMapId = liveMap?.id;

            if (liveMapId) {
              // Fetch pins for this account on live map (we'll count them)
              const mentionsResponse = await fetch(
                `/api/maps/${liveMapId}/pins`,
                { credentials: 'include' }
              );
              if (mentionsResponse.ok) {
                const mentionsData = await mentionsResponse.json();
                // Filter to only this account's pins
                const accountPins = mentionsData.pins?.filter((pin: any) => pin.account_id === authAccount.id) || [];
                const mentionsCount = accountPins.length;

                setQuickStats({
                  mapsCount,
                  mentionsCount,
                });
                return;
              }
            }
          }

          // Fallback: just set maps count
          setQuickStats({ mapsCount });
        }
      } catch (err) {
        console.error('Error fetching quick stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchQuickStats();
  }, [authAccount?.id]);

  // Sidebar configurations
  const leftSidebarConfigs = useMemo(() => [
    {
      type: 'maps' as const,
      title: 'My Maps',
      content: <HomeMapsSidebar />,
      popupType: 'settings' as const,
      infoText: 'Manage your maps',
    },
  ], []);

  const rightSidebarConfigs = useMemo(() => [
    {
      type: 'analytics' as const,
      title: 'Analytics',
      content: <HomeAnalyticsSidebar />,
      popupType: 'analytics' as const,
      infoText: 'View analytics and statistics',
    },
  ], []);

  // If not authenticated, show landing page
  if (!authAccount) {
    return <LandingPage />;
  }

  // If authenticated, show dashboard with sidebars
  return (
    <PageWrapper
      headerContent={
        authAccount ? (
          <SidebarHeaderButtons
            onFilterClick={() => toggleLeftSidebar('maps')}
            onSettingsClick={toggleRightSidebar}
            showFilter={true}
            showSettings={true}
            filterIcon={MapIcon}
            settingsIcon={ChartBarIcon}
            filterLabel="Maps"
            settingsLabel="Analytics"
          />
        ) : null
      }
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
      <HomePageLayout
        leftSidebar={leftSidebar}
        rightSidebar={rightSidebar}
        onLeftSidebarClose={closeLeftSidebar}
        onRightSidebarClose={closeRightSidebar}
        leftSidebarConfigs={leftSidebarConfigs}
        rightSidebarConfigs={rightSidebarConfigs}
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
                    showActionButtons={true}
                    showQuickStats={true}
                    quickStats={quickStats}
                  />
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                  <div className="h-[200px] flex items-center justify-center">
                    <p className="text-xs text-gray-500">Loading profile...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </HomePageLayout>
    </PageWrapper>
  );
}
