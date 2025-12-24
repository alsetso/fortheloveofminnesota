'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  GlobeAltIcon,
  AdjustmentsHorizontalIcon,
  QuestionMarkCircleIcon,
  NewspaperIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { Account } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import AccountDropdown from '@/features/auth/components/AccountDropdown';
import NavSearch from './NavSearch';
import SecondarySidebar from './SecondarySidebar';
import ExploreSecondaryContent from './ExploreSecondaryContent';
import Map3DControlsSecondaryContent from './Map3DControlsSecondaryContent';
import FAQsSecondaryContent from './FAQsSecondaryContent';
import NewsSecondaryContent from './NewsSecondaryContent';
import { useSidebarTabState, type SidebarTab } from '../hooks/useSidebarTabState';

import type { MapboxMapInstance } from '@/types/mapbox-events';

interface SidebarProps {
  account: Account | null;
  map: MapboxMapInstance | null;
  pointsOfInterestVisible?: boolean;
  onPointsOfInterestVisibilityChange?: (visible: boolean) => void;
  atlasLayerVisible?: boolean;
  onAtlasLayerVisibilityChange?: (visible: boolean) => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  secondaryContent?: React.ReactNode;
}

// Map href to tab identifier for URL params
const hrefToTab: Record<string, SidebarTab> = {
  '#explore': 'explore' as SidebarTab,
  '#controls': 'controls' as SidebarTab,
  '#faqs': 'faqs' as SidebarTab,
  '#news': 'news' as SidebarTab,
};

const allNavItems: NavItem[] = [
  { 
    href: '#explore', 
    label: 'Explore', 
    icon: GlobeAltIcon,
    secondaryContent: <ExploreSecondaryContent />,
  },
  { 
    href: '#news', 
    label: 'News', 
    icon: NewspaperIcon,
    secondaryContent: <NewsSecondaryContent />,
  },
  { 
    href: '#faqs', 
    label: 'FAQs', 
    icon: QuestionMarkCircleIcon,
    secondaryContent: <FAQsSecondaryContent />,
  },
];

export default function Sidebar({ account, map, pointsOfInterestVisible, onPointsOfInterestVisibilityChange, atlasLayerVisible = true, onAtlasLayerVisibilityChange }: SidebarProps) {
  const navItems = allNavItems;
  const pathname = usePathname();
  const { openAccount, openWelcome, openUpgrade } = useAppModalContextSafe();
  const [clickedNavItem, setClickedNavItem] = useState<string | null>(null);
  const isHomepage = pathname === '/';
  
  // URL-based tab state (for all tabs on homepage)
  const { urlTab, updateUrl } = useSidebarTabState({
    syncToUrl: isHomepage,
    onTabChange: (tab) => {
      // Open tab when URL param is present
      if (tab === 'explore') {
        setClickedNavItem('#explore');
      } else if (tab === 'controls') {
        setClickedNavItem('#controls');
      } else if (tab === 'faqs') {
        setClickedNavItem('#faqs');
      } else if (tab === 'news') {
        setClickedNavItem('#news');
      }
    },
  });

  const isActive = (href: string) => {
    // Hash-based tabs are active when clickedNavItem matches
    if (href.startsWith('#')) {
      return clickedNavItem === href;
    }
    // Route-based tabs (if any remain)
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const handleNavItemClick = (href: string) => {
    const tab = hrefToTab[href];
    
    // Toggle: if clicking the same item, close it; otherwise open the clicked item
    if (clickedNavItem === href) {
      setClickedNavItem(null);
      // Update URL: remove tab param on homepage
      if (isHomepage && tab) {
        updateUrl(null);
      }
    } else {
      setClickedNavItem(href);
      // Update URL: set tab param on homepage
      if (isHomepage && tab) {
        updateUrl(tab);
      }
    }
  };
  
  // Sync URL param to tab state (when URL changes externally)
  useEffect(() => {
    if (!isHomepage) return;
    
    const tabFromUrl = urlTab;
    const expectedHref = tabFromUrl ? `#${tabFromUrl}` : null;
    
    if (tabFromUrl && clickedNavItem !== expectedHref) {
      setClickedNavItem(expectedHref);
    } else if (!tabFromUrl && clickedNavItem && clickedNavItem.startsWith('#')) {
      // URL param was removed, close tab
      setClickedNavItem(null);
    }
  }, [urlTab, isHomepage, clickedNavItem, updateUrl]);


  // Prevent body scroll when secondary sidebar is open
  useEffect(() => {
    if (clickedNavItem) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [clickedNavItem]);

  return (
    <>
      {/* Top Nav - Shows on all screens */}
      <nav className="fixed top-0 left-0 right-0 z-[100] h-14 bg-white border-b border-gray-200">
        <div className="relative flex items-center justify-between h-full px-3">
          {/* Logo - Left */}
          <Link href="/">
            <Image
              src="/logo.png"
              alt="Logo"
              width={24}
              height={24}
              className="w-6 h-6"
              unoptimized
            />
          </Link>

          {/* Search - Center */}
          <NavSearch map={map} />

          {/* Right side - Atlas Toggle, Upgrade Button & Account Dropdown */}
          <div className="flex items-center gap-2">
            {/* Atlas Layer Toggle */}
            {onAtlasLayerVisibilityChange && (
              <button
                onClick={() => onAtlasLayerVisibilityChange(!atlasLayerVisible)}
                className={`p-1.5 rounded-md transition-colors ${
                  atlasLayerVisible
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
                title={atlasLayerVisible ? 'Hide atlas layers' : 'Show atlas layers'}
                aria-label={atlasLayerVisible ? 'Hide atlas layers' : 'Show atlas layers'}
              >
                {atlasLayerVisible ? (
                  <EyeIcon className="w-4 h-4" />
                ) : (
                  <EyeSlashIcon className="w-4 h-4" />
                )}
              </button>
            )}
            {account?.plan === 'hobby' && (
              <button
                onClick={() => openUpgrade()}
                className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
              >
                Upgrade
              </button>
            )}
            <AccountDropdown
              variant="light"
              onAccountClick={() => openAccount('settings')}
              onSignInClick={() => openWelcome()}
            />
          </div>
        </div>
      </nav>

      {/* Secondary Sidebar - Full screen overlay for all screens */}
      {clickedNavItem && (() => {
        // Handle controls separately
        if (clickedNavItem === '#controls') {
          return (
            <SecondarySidebar
              isOpen={true}
              label="Controls"
              onClose={() => {
                const tab = clickedNavItem ? hrefToTab[clickedNavItem] : null;
                setClickedNavItem(null);
                // Remove URL param when closing tab on homepage
                if (isHomepage && tab) {
                  updateUrl(null);
                }
              }}
            >
              <Map3DControlsSecondaryContent 
                map={map} 
                pointsOfInterestVisible={pointsOfInterestVisible}
                onPointsOfInterestVisibilityChange={onPointsOfInterestVisibilityChange}
              />
            </SecondarySidebar>
          );
        }

        // Handle other nav items
        const navItem = navItems.find(item => item.href === clickedNavItem);
        const content = navItem?.secondaryContent;
        if (!content) return null;
        
        return (
          <SecondarySidebar
            isOpen={true}
            label={navItem?.label || ''}
            onClose={() => {
              const tab = clickedNavItem ? hrefToTab[clickedNavItem] : null;
              setClickedNavItem(null);
              // Remove URL param when closing tab on homepage
              if (isHomepage && tab) {
                updateUrl(null);
              }
            }}
          >
            {React.isValidElement(content)
              ? React.cloneElement(content as React.ReactElement<any>, { map, mapLoaded: !!map })
              : content
            }
          </SecondarySidebar>
        );
      })()}
    </>
  );
}


