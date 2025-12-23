'use client';

import { useState, useEffect, useRef } from 'react';
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { 
  GlobeAltIcon,
  BuildingLibraryIcon,
  Bars3Icon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  MapPinIcon,
  QuestionMarkCircleIcon,
  NewspaperIcon,
} from '@heroicons/react/24/outline';
import { Account } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import AccountDropdown from '@/features/auth/components/AccountDropdown';
import SecondarySidebar from './SecondarySidebar';
import ExploreSecondaryContent from './ExploreSecondaryContent';
import Map3DControlsSecondaryContent from './Map3DControlsSecondaryContent';
import POISecondaryContent from './POISecondaryContent';
import FAQsSecondaryContent from './FAQsSecondaryContent';
import NewsSecondaryContent from './NewsSecondaryContent';
import { useSidebarTabState, type SidebarTab } from '../hooks/useSidebarTabState';

import type { MapboxMapInstance } from '@/types/mapbox-events';

interface SidebarProps {
  account: Account | null;
  map: MapboxMapInstance | null;
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
  '#poi': 'poi' as SidebarTab,
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
    href: '#poi', 
    label: 'POI', 
    icon: MapPinIcon,
    secondaryContent: <POISecondaryContent />,
  },
  { 
    href: '#faqs', 
    label: 'FAQs', 
    icon: QuestionMarkCircleIcon,
    secondaryContent: <FAQsSecondaryContent />,
  },
  { 
    href: '#news', 
    label: 'News', 
    icon: NewspaperIcon,
    secondaryContent: <NewsSecondaryContent />,
  },
];

export default function Sidebar({ account, map }: SidebarProps) {
  // Filter nav items based on admin role - POI is admin-only
  const navItems = allNavItems.filter((item) => {
    if (item.href === '#poi') {
      return account?.role === 'admin';
    }
    return true;
  });
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openAccount, openWelcome } = useAppModalContextSafe();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [clickedNavItem, setClickedNavItem] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const isHomepage = pathname === '/';
  
  // URL-based tab state (for all tabs on homepage)
  const { urlTab, updateUrl } = useSidebarTabState({
    syncToUrl: isHomepage,
    onTabChange: (tab) => {
      // Open tab when URL param is present
      // Prevent POI tab from opening if user is not admin
      if (tab === 'poi' && account?.role !== 'admin') {
        // Remove POI tab from URL if not admin
        updateUrl(null);
        return;
      }
      
      if (tab === 'explore') {
        setClickedNavItem('#explore');
      } else if (tab === 'controls') {
        setClickedNavItem('#controls');
      } else if (tab === 'poi') {
        setClickedNavItem('#poi');
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
    
    // Prevent POI from opening if user is not admin
    if (href === '#poi' && account?.role !== 'admin') {
      return;
    }
    
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
    
    // Prevent POI tab from opening if user is not admin
    if (tabFromUrl === 'poi' && account?.role !== 'admin') {
      updateUrl(null);
      if (clickedNavItem === '#poi') {
        setClickedNavItem(null);
      }
      return;
    }
    
    const expectedHref = tabFromUrl ? `#${tabFromUrl}` : null;
    
    if (tabFromUrl && clickedNavItem !== expectedHref) {
      setClickedNavItem(expectedHref);
    } else if (!tabFromUrl && clickedNavItem && clickedNavItem.startsWith('#')) {
      // URL param was removed, close tab
      setClickedNavItem(null);
    }
  }, [urlTab, isHomepage, clickedNavItem, account?.role, updateUrl]);
  
  // Close POI tab if it's open and user is not admin (e.g., role changed)
  useEffect(() => {
    if (clickedNavItem === '#poi' && account?.role !== 'admin') {
      setClickedNavItem(null);
      if (isHomepage) {
        updateUrl(null);
      }
    }
  }, [account?.role, clickedNavItem, isHomepage, updateUrl]);

  // Close sidebar when clicking outside (desktop only - mobile uses overlay)
  useEffect(() => {
    if (!clickedNavItem) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // On mobile, secondary sidebar is full-screen overlay - don't close on outside click
      // User must use back button or close button
      if (window.innerWidth < 1024) return;
      
      if (
        clickedNavItem &&
        sidebarRef.current &&
        !sidebarRef.current.contains(target)
      ) {
        // Check if click is not on the secondary sidebar
        const secondarySidebar = target.closest('[data-secondary-sidebar]');
        
        // Check if click is on the map (mapbox canvas or map container)
        const isMapClick = target.closest('.mapboxgl-canvas') || 
                          target.closest('[class*="mapbox"]') ||
                          target.closest('[class*="map-container"]');
        
        // Don't close if clicking on map or secondary sidebar
        if (!secondarySidebar && !isMapClick) {
          const tab = hrefToTab[clickedNavItem];
          setClickedNavItem(null);
          // Remove URL param when closing tab on homepage
          if (isHomepage && tab) {
            updateUrl(null);
          }
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clickedNavItem, isHomepage, updateUrl]);

  // Prevent body scroll when mobile secondary sidebar is open
  useEffect(() => {
    if (clickedNavItem && window.innerWidth < 1024) {
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
      {/* Mobile Top Nav */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-[100] bg-white border-b border-gray-200 h-14">
        <div className="relative flex items-center justify-between h-full px-3">
          {/* Left side - Hamburger */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (clickedNavItem) {
                  // If secondary sidebar is open, close it
                  const tab = clickedNavItem ? hrefToTab[clickedNavItem] : null;
                  setClickedNavItem(null);
                  if (isHomepage && tab) {
                    updateUrl(null);
                  }
                } else {
                  // Toggle mobile menu
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                }
              }}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              aria-label={clickedNavItem ? "Close" : "Toggle menu"}
            >
              {clickedNavItem || isMobileMenuOpen ? (
                <XMarkIcon className="w-6 h-6" />
              ) : (
                <Bars3Icon className="w-6 h-6" />
              )}
            </button>
          </div>

          {/* Logo - Centered */}
          <Link href="/" className="absolute left-1/2 -translate-x-1/2">
            <Image
              src="/logo.png"
              alt="Logo"
              width={24}
              height={24}
              className="w-6 h-6"
              unoptimized
            />
          </Link>

          {/* Right side - Account Dropdown */}
          <div className="flex items-center gap-2">
            <AccountDropdown
              variant="light"
              onAccountClick={() => openAccount('settings')}
              onSignInClick={() => openWelcome()}
            />
          </div>
        </div>

        {/* Mobile Menu Dropdown - Only show when no secondary content is open */}
        {isMobileMenuOpen && !clickedNavItem && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-[101]">
              <div className="py-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  const tab = hrefToTab[item.href];
                  const hasSecondaryContent = !!item.secondaryContent;

                  return (
                    <div
                      key={item.href}
                      onClick={() => {
                        // If item has secondary content, open it (menu will hide automatically)
                        if (hasSecondaryContent) {
                          if (clickedNavItem === item.href) {
                            setClickedNavItem(null);
                            if (isHomepage && tab) updateUrl(null);
                          } else {
                            setClickedNavItem(item.href);
                            if (isHomepage && tab) updateUrl(tab);
                          }
                        } else {
                          // No secondary content, close menu
                          setIsMobileMenuOpen(false);
                          if (clickedNavItem === item.href) {
                            setClickedNavItem(null);
                            if (isHomepage && tab) updateUrl(null);
                          } else {
                            setClickedNavItem(item.href);
                            if (isHomepage && tab) updateUrl(tab);
                          }
                        }
                      }}
                      className={`
                        flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors cursor-pointer
                        ${
                          active || clickedNavItem === item.href
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }
                      `}
                    >
                      <Icon className="w-6 h-6" />
                      <span>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
        )}
      </nav>

      {/* Desktop Sidebar */}
      <aside ref={sidebarRef} className="hidden lg:flex relative w-16 flex-shrink-0 flex-col h-screen bg-white border-r border-gray-200">
        {/* Container 1: Logo */}
        <div className="flex-shrink-0 p-2 border-b border-gray-200">
          <Link
            href="/"
            className="flex flex-col items-center justify-center w-full px-1 group"
            title="Home"
          >
            <div className="w-10 h-10 flex items-center justify-center rounded-md transition-colors group-hover:bg-gray-100">
              <Image
                src="/logo.png"
                alt="Logo"
                width={28}
                height={28}
                className="w-7 h-7"
                unoptimized
              />
            </div>
          </Link>
        </div>

        {/* Container 2: Navigation items */}
        <nav className="flex-1 flex flex-col overflow-y-auto p-2">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const isOpen = clickedNavItem === item.href;
              const hasSecondaryContent = !!item.secondaryContent;

              return (
                <li key={item.href}>
                  <button
                    onClick={() => hasSecondaryContent && handleNavItemClick(item.href)}
                    className="flex flex-col items-center justify-center gap-1 px-1 py-2 group cursor-pointer w-full"
                    title={item.label}
                    type="button"
                  >
                    <div className={`
                      w-8 h-8 flex items-center justify-center rounded-md transition-colors
                      ${
                        isOpen || active
                          ? 'bg-gray-200'
                          : 'group-hover:bg-gray-100'
                      }
                    `}>
                      <Icon className={`w-5 h-5 ${
                        isOpen || active ? 'text-gray-900' : 'text-gray-600 group-hover:text-gray-900'
                      }`} />
                    </div>
                    <span className={`text-[10px] leading-tight text-center ${
                      isOpen || active ? 'text-gray-900' : 'text-gray-600'
                    }`}>
                      {item.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Container 3: Controls button at bottom */}
        <div className="flex-shrink-0 p-2 border-t border-gray-200">
          <button
            onClick={() => handleNavItemClick('#controls')}
            className="flex flex-col items-center justify-center gap-1 px-1 py-2 group cursor-pointer w-full"
            title="Controls"
            type="button"
          >
            <div className={`
              w-8 h-8 flex items-center justify-center rounded-md transition-colors
              ${
                clickedNavItem === '#controls'
                  ? 'bg-gray-200'
                  : 'group-hover:bg-gray-100'
              }
            `}>
              <AdjustmentsHorizontalIcon className={`w-5 h-5 ${
                clickedNavItem === '#controls' ? 'text-gray-900' : 'text-gray-600 group-hover:text-gray-900'
              }`} />
            </div>
            <span className={`text-[10px] leading-tight text-center ${
              clickedNavItem === '#controls' ? 'text-gray-900' : 'text-gray-600'
            }`}>
              Controls
            </span>
          </button>
        </div>

        {/* Desktop Secondary Sidebar - Shows on click */}
        {clickedNavItem && (() => {
          // Handle controls separately
          if (clickedNavItem === '#controls') {
            return (
              <SecondarySidebar
                isOpen={true}
                label="Controls"
                onMouseEnter={() => {}} // Keep open when hovering over secondary sidebar
                onMouseLeave={() => {}} // Don't close on mouse leave
                onClose={() => {
                  const tab = clickedNavItem ? hrefToTab[clickedNavItem] : null;
                  setClickedNavItem(null);
                  // Remove URL param when closing tab on homepage
                  if (isHomepage && tab) {
                    updateUrl(null);
                  }
                }}
              >
                <Map3DControlsSecondaryContent map={map} />
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
              onMouseEnter={() => {}} // Keep open when hovering over secondary sidebar
              onMouseLeave={() => {}} // Don't close on mouse leave
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
      </aside>

      {/* Mobile Secondary Sidebar - Full screen overlay */}
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
              <Map3DControlsSecondaryContent map={map} />
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


