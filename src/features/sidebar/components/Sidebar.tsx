'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  AdjustmentsHorizontalIcon,
  NewspaperIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { Account } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import SecondarySidebar from './SecondarySidebar';
import Map3DControlsSecondaryContent from './Map3DControlsSecondaryContent';
import MapToolsSecondaryContent from './MapToolsSecondaryContent';
import NewsSecondaryContent from './NewsSecondaryContent';
import GovSecondaryContent from './GovSecondaryContent';
import LocationSecondaryContent from './LocationSecondaryContent';
import ProfileAccountsSecondaryContent from './ProfileAccountsSecondaryContent';
import { useSidebarTabState, type SidebarTab } from '../hooks/useSidebarTabState';

import type { MapboxMapInstance } from '@/types/mapbox-events';

interface SidebarProps {
  account: Account | null;
  map: MapboxMapInstance | null;
  pointsOfInterestVisible?: boolean;
  onPointsOfInterestVisibilityChange?: (visible: boolean) => void;
  atlasLayerVisible?: boolean;
  onAtlasLayerVisibilityChange?: (visible: boolean) => void;
  onLocationSelect?: (coordinates: { lat: number; lng: number }) => void;
  selectedAtlasEntity?: {
    id: string;
    name: string;
    table_name: string;
    lat: number;
    lng: number;
  } | null;
  onAtlasEntityClear?: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }> | React.ReactElement;
  secondaryContent?: React.ReactNode;
}

// Heart Icon Component
const HeartIcon = ({ className }: { className?: string }) => (
  <Image
    src="/heart.png"
    alt="Heart"
    width={20}
    height={20}
    className={className}
    unoptimized
  />
);

// Map href to tab identifier for URL params
const hrefToTab: Record<string, SidebarTab> = {
  '/': null as any,
  '/map': null as any,
  '/location': null as any,
  '/gov': null as any,
  '#profile': 'profile' as SidebarTab,
  '#controls': 'controls' as SidebarTab,
  '#news': 'news' as SidebarTab,
};

// Main navigation items (route-based)
const mainNavItems: NavItem[] = [
  { 
    href: '/location', 
    label: 'Location', 
    icon: <HeartIcon className="w-5 h-5" />,
    secondaryContent: <LocationSecondaryContent />,
  },
  { 
    href: '#news', 
    label: 'News', 
    icon: NewspaperIcon,
    secondaryContent: <NewsSecondaryContent />,
  },
  { 
    href: '/gov', 
    label: 'Gov', 
    icon: BuildingOfficeIcon,
    secondaryContent: <GovSecondaryContent />,
  },
];

export default function Sidebar({ account, map, pointsOfInterestVisible, onPointsOfInterestVisibilityChange, atlasLayerVisible = true, onAtlasLayerVisibilityChange, onLocationSelect, selectedAtlasEntity, onAtlasEntityClear }: SidebarProps) {
  const pathname = usePathname();
  const { openAccount, openWelcome, openUpgrade } = useAppModalContextSafe();
  const [clickedNavItem, setClickedNavItem] = useState<string | null>(null);
  const isHomepage = pathname === '/';
  
  // Auto-open Location sidebar when atlas entity is selected
  useEffect(() => {
    if (selectedAtlasEntity && clickedNavItem !== '/location') {
      setClickedNavItem('/location');
    }
  }, [selectedAtlasEntity, clickedNavItem]);
  
  // URL-based tab state (for all tabs on homepage)
  const { urlTab, updateUrl } = useSidebarTabState({
    syncToUrl: isHomepage,
    onTabChange: (tab) => {
      // Open tab when URL param is present
      if (tab === 'controls') {
        setClickedNavItem('#controls');
      } else if (tab === 'news') {
        setClickedNavItem('#news');
      } else if (tab === 'profile') {
        setClickedNavItem('#profile');
      }
    },
  });

  const isActive = (href: string) => {
    // Hash-based tabs are active when clickedNavItem matches
    if (href.startsWith('#')) {
      return clickedNavItem === href;
    }
    // Route-based tabs
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const handleNavItemClick = (href: string, e?: React.MouseEvent) => {
    // If it's a route-based link, navigate normally
    if (href.startsWith('/') && !href.startsWith('/#')) {
      // Check if it has secondary content - if so, open sidebar instead of navigating
      const navItem = mainNavItems.find(item => item.href === href);
      if (navItem?.secondaryContent) {
        e?.preventDefault();
        const tab = hrefToTab[href];
        
        // Toggle: if clicking the same item, close it; otherwise open the clicked item
        if (clickedNavItem === href) {
          setClickedNavItem(null);
          if (isHomepage && tab) {
            updateUrl(null);
          }
        } else {
          setClickedNavItem(href);
          if (isHomepage && tab) {
            updateUrl(tab);
          }
        }
      }
      // Otherwise let the link navigate normally
    } else {
      // Hash-based navigation
      const tab = hrefToTab[href];
      
      if (clickedNavItem === href) {
        setClickedNavItem(null);
        if (isHomepage && tab) {
          updateUrl(null);
        }
      } else {
        setClickedNavItem(href);
        if (isHomepage && tab) {
          updateUrl(tab);
        }
      }
    }
  };
  
  // Sync URL param to tab state (when URL changes externally)
  useEffect(() => {
    if (!isHomepage) return;
    
    const tabFromUrl = urlTab;
    // Hash-based tabs use # prefix, route-based use /
    const expectedHref = tabFromUrl 
      ? (tabFromUrl === 'controls' || tabFromUrl === 'profile' || tabFromUrl === 'news'
          ? `#${tabFromUrl}` 
          : `/${tabFromUrl}`)
      : null;
    
    if (tabFromUrl && clickedNavItem !== expectedHref) {
      setClickedNavItem(expectedHref);
    } else if (!tabFromUrl && clickedNavItem && (clickedNavItem.startsWith('#') || clickedNavItem === '#controls' || clickedNavItem === '#profile' || clickedNavItem === '#news')) {
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
      {/* Left Sidebar - Shows on all screens */}
      <aside className="fixed left-0 top-0 bottom-0 z-[100] w-16 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo - Top */}
        <div className="flex items-center justify-center h-14">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <Image
              src="/logo.png"
              alt="Logo"
              width={24}
              height={24}
              className="w-6 h-6"
              unoptimized
            />
          </Link>
        </div>

        {/* Main Navigation Icons */}
        <nav className="flex-1 flex flex-col py-2" aria-label="Main navigation">
          {mainNavItems.map((item) => {
            const active = isActive(item.href);
            const isReactNode = React.isValidElement(item.icon);
            const IconComponent = isReactNode ? null : item.icon as React.ComponentType<{ className?: string }>;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavItemClick(item.href, e)}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-2 transition-colors ${
                  active
                    ? 'text-gray-900 bg-gray-100'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
                title={item.label}
                aria-label={item.label}
              >
                {isReactNode ? (
                  item.icon as React.ReactElement
                ) : IconComponent ? (
                  <IconComponent className="w-5 h-5" />
                ) : null}
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section - Profile & Controls */}
        <div className="border-t border-gray-200 py-2 space-y-1">
          {/* Profile Button */}
          <button
            onClick={() => handleNavItemClick('#profile')}
            className={`w-full flex flex-col items-center justify-center gap-1 py-2 px-2 transition-colors ${
              clickedNavItem === '#profile'
                ? 'text-gray-900 bg-gray-100'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
            title="Profile"
            aria-label="Profile"
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium">Profile</span>
          </button>

          {/* Controls Button */}
          <button
            onClick={() => handleNavItemClick('#controls')}
            className={`w-full flex flex-col items-center justify-center gap-1 py-2 px-2 transition-colors ${
              clickedNavItem === '#controls'
                ? 'text-gray-900 bg-gray-100'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
            title="Controls"
            aria-label="Controls"
          >
            <AdjustmentsHorizontalIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium">Controls</span>
          </button>
        </div>
      </aside>

      {/* Secondary Sidebar - Full screen overlay for all screens */}
      {clickedNavItem && (() => {
        // Handle profile separately
        if (clickedNavItem === '#profile') {
          return (
            <SecondarySidebar
              isOpen={true}
              label="Profile"
              onClose={() => {
                const tab = clickedNavItem ? hrefToTab[clickedNavItem] : null;
                setClickedNavItem(null);
                // Remove URL param when closing tab on homepage
                if (isHomepage && tab) {
                  updateUrl(null);
                }
              }}
            >
              <ProfileAccountsSecondaryContent />
            </SecondarySidebar>
          );
        }

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
              <div className="space-y-6">
                {/* Map Tools - Mention Form, Map Meta, Atlas Meta */}
                <MapToolsSecondaryContent 
                  map={map} 
                  mapLoaded={!!map}
                />
                
                {/* Map 3D Controls */}
                <div className="border-t border-gray-200 pt-6">
                  <Map3DControlsSecondaryContent 
                    map={map} 
                    pointsOfInterestVisible={pointsOfInterestVisible}
                    onPointsOfInterestVisibilityChange={onPointsOfInterestVisibilityChange}
                  />
                </div>
              </div>
            </SecondarySidebar>
          );
        }

        // Handle other nav items
        const navItem = mainNavItems.find(item => item.href === clickedNavItem);
        const content = navItem?.secondaryContent;
        if (!content) return null;
        
        return (
          <SecondarySidebar
            isOpen={true}
            label={navItem?.label || ''}
            onClose={() => {
              const tab = clickedNavItem ? hrefToTab[clickedNavItem] : null;
              setClickedNavItem(null);
              // Clear selected atlas entity when closing Location sidebar
              if (clickedNavItem === '/location' && onAtlasEntityClear) {
                onAtlasEntityClear();
              }
              // Remove URL param when closing tab on homepage
              if (isHomepage && tab) {
                updateUrl(null);
              }
            }}
          >
            {React.isValidElement(content)
              ? React.cloneElement(content as React.ReactElement<any>, { 
                  map, 
                  mapLoaded: !!map,
                  onLocationSelect: clickedNavItem === '/location' ? onLocationSelect : undefined,
                  selectedAtlasEntity: clickedNavItem === '/location' ? selectedAtlasEntity : undefined,
                  onAtlasEntityClear: clickedNavItem === '/location' ? onAtlasEntityClear : undefined,
                })
              : content
            }
          </SecondarySidebar>
        );
      })()}
    </>
  );
}


