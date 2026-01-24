'use client';

import { ReactNode, useState, useEffect, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { Toaster } from 'react-hot-toast';
import AccountDropdown from '@/features/auth/components/AccountDropdown';
import HamburgerMenu from './HamburgerMenu';
import ContentTypeFilters from './ContentTypeFilters';
import { usePageView } from '@/hooks/usePageView';
import { 
  HomeIcon, 
  MapIcon, 
  BuildingLibraryIcon, 
  UserGroupIcon,
  UsersIcon,
  SparklesIcon,
  RssIcon
} from '@heroicons/react/24/outline';
import { 
  HomeIcon as HomeIconSolid, 
  MapIcon as MapIconSolid, 
  BuildingLibraryIcon as BuildingLibraryIconSolid, 
  UserGroupIcon as UserGroupIconSolid,
  UsersIcon as UsersIconSolid,
  SparklesIcon as SparklesIconSolid,
  RssIcon as RssIconSolid
} from '@heroicons/react/24/solid';

interface AccountDropdownProps {
  onAccountClick?: () => void;
  onSignInClick?: () => void;
}

interface PageWrapperProps {
  children: ReactNode;
  headerContent?: ReactNode;
  searchComponent?: ReactNode;
  showAccountDropdown?: boolean;
  accountDropdownProps?: AccountDropdownProps;
  searchResultsComponent?: ReactNode;
  className?: string;
  /** Enable automatic page view tracking. Default: true */
  trackPageView?: boolean;
}

// Default empty handlers to reduce prop boilerplate
const defaultAccountDropdownProps: AccountDropdownProps = {
  onAccountClick: () => {},
  onSignInClick: () => {},
};

/**
 * Global page wrapper with 10vh header and 90vh content area
 * - Header: 10vh, black background (or 20vh when #search is active)
 * - Content: 90vh, white background, rounded top corners, scrollable (or 80vh when #search is active)
 * - When #search is active: Header expands to 20vh with full-width search and mention type filters
 */
export default function PageWrapper({ 
  children, 
  headerContent, 
  searchComponent, 
  showAccountDropdown = true, 
  accountDropdownProps = defaultAccountDropdownProps, 
  searchResultsComponent, 
  className = '',
  trackPageView = true
}: PageWrapperProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Initialize as false to avoid hydration mismatch - will be set correctly on client mount
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Get selected content type for label
  const selectedContentType = searchParams.get('content_type');
  const contentTypeLabels: Record<string, string> = {
    posts: 'Posts',
    mentions: 'Mentions',
    groups: 'Groups',
    users: 'Users',
    news: 'News',
  };
  const selectedLabel = selectedContentType ? contentTypeLabels[selectedContentType] : null;

  // Automatically track page views for all pages using PageWrapper
  // Uses current pathname, tracks once per page load
  usePageView({ 
    page_url: pathname || '/', 
    enabled: trackPageView 
  });

  // Initialize Facebook Pixel on client side
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).fbq) {
      // Facebook Pixel is already initialized in layout.tsx, but ensure it's available
      // Track page view for Facebook Pixel
      if ((window as any).fbq) {
        (window as any).fbq('track', 'PageView');
      }
    }
  }, [pathname]);

  // Memoize navItems to prevent recreation on every render
  const navItems = useMemo(() => [
    { label: 'Home', href: '/', icon: HomeIcon, iconSolid: HomeIconSolid },
    { label: 'Live', href: '/live', icon: MapIcon, iconSolid: MapIconSolid },
    { label: 'Maps', href: '/maps', icon: MapIcon, iconSolid: MapIconSolid },
    { label: 'News', href: '/news', icon: RssIcon, iconSolid: RssIconSolid },
    { label: 'People', href: '/people', icon: UsersIcon, iconSolid: UsersIconSolid },
    { label: 'Gov', href: '/gov', icon: BuildingLibraryIcon, iconSolid: BuildingLibraryIconSolid },
    { label: 'Groups', href: '/groups', icon: UserGroupIcon, iconSolid: UserGroupIconSolid },
  ], []);

  // Set mounted flag on client side only
  useEffect(() => {
    setMounted(true);
  }, []);

  // Consolidated hash checking - handles all hash change scenarios in one effect
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    const checkHash = () => {
      setIsSearchMode(window.location.hash === '#search');
    };

    // Initial check
    checkHash();

    // Listen for hashchange events (browser navigation and manual dispatches)
    window.addEventListener('hashchange', checkHash);
    
    // Listen for popstate (browser back/forward)
    window.addEventListener('popstate', checkHash);

    return () => {
      window.removeEventListener('hashchange', checkHash);
      window.removeEventListener('popstate', checkHash);
    };
  }, [mounted, pathname]); // Include pathname to check hash when route changes

  // Track Facebook Pixel page views on route changes
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'PageView');
    }
  }, [pathname]);

  return (
    <>
      {/* Global Toast System - react-hot-toast (same as admin billing page) */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            fontSize: '12px',
            padding: '10px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      
      <div 
        className={`relative w-full h-screen overflow-hidden flex flex-col ${className}`} 
        style={{ maxWidth: '100vw', backgroundColor: '#000000' }}
      >
      {/* Header - Flexible height based on content, black background */}
      <header 
        className="flex flex-col flex-shrink-0 border-b border-white/5"
        style={{ backgroundColor: '#000000' }}
      >
        {/* Notification window placeholder - 20px height */}
        <div className="h-5 w-full" style={{ height: '20px' }} />
        
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          {/* Top Row: Logo, Search, Nav, Account - Hidden completely in search mode */}
          {!isSearchMode && (
            <div className="grid grid-cols-12 gap-6 items-center transition-all duration-300 h-14">
            {/* 1st Column: Logo & Search (Aligns with left sidebar) */}
            <div className="hidden lg:flex lg:col-span-3 items-center gap-3 min-w-0">
          <div className="flex-shrink-0">
            <button
              onClick={() => setIsMenuOpen(true)}
              className="flex items-center justify-center hover:opacity-80 transition-opacity"
              aria-label="Open menu"
            >
              <img
                src="/white-logo.png"
                alt="For the Love of Minnesota"
                    className="w-7 h-7"
              />
            </button>
          </div>
          
              {/* Compact Search Input (Normal Mode) */}
          {searchComponent && (
                <div className="flex-1 max-w-[180px] transition-all duration-300">
              {searchComponent}
            </div>
          )}
            </div>
          
            {/* Mobile Header Layout (Logo, Search, Header Content, Account) */}
            <div className="lg:hidden col-span-12 flex items-center justify-between gap-2 px-1">
              <div className="flex-shrink-0">
                <button
                  onClick={() => setIsMenuOpen(true)}
                  aria-label="Open menu"
                >
                  <img src="/white-logo.png" alt="Logo" className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 flex justify-center px-2">
                {searchComponent && <div className="w-full max-w-sm">{searchComponent}</div>}
              </div>
              <div className="flex-shrink-0 flex items-center gap-1">
                {headerContent}
                {showAccountDropdown && (
                  <AccountDropdown 
                    variant="dark"
                    onAccountClick={accountDropdownProps?.onAccountClick}
                    onSignInClick={accountDropdownProps?.onSignInClick}
                  />
                )}
              </div>
            </div>
            
            {/* 2nd Column: Nav Icons (Aligns with center feed, max-width 800px) */}
            <div className="hidden lg:flex lg:col-span-6 justify-center px-4">
              <div className="flex items-center justify-around w-full max-w-[800px]">
                {navItems.map((item) => {
                  // Home is active on both '/' and '/feed' routes
                  const isActive = item.href === '/' 
                    ? (pathname === '/' || pathname === '/feed')
                    : (pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href)));
                  const Icon = isActive ? item.iconSolid : item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex flex-col items-center justify-center w-full h-10 transition-colors hover:bg-white/10 rounded-md"
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/50'}`} />
                      <span className={`text-[8px] font-bold leading-none mt-0.5 ${isActive ? 'text-white' : 'text-white/50'}`}>
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
            
            {/* 3rd Column: Header Content, Account Dropdown (Aligns with right sidebar) */}
            <div className="hidden lg:flex lg:col-span-3 justify-end items-center gap-2">
              {headerContent}
              {showAccountDropdown && (
                <AccountDropdown 
                  variant="dark"
                  onAccountClick={accountDropdownProps?.onAccountClick}
                  onSignInClick={accountDropdownProps?.onSignInClick}
                />
              )}
            </div>
            </div>
          )}
        </div>

        {/* Search Mode Header (Transitions in when isSearchMode is true) */}
        {isSearchMode && (
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300 pt-1">
            <div className="flex items-center gap-2">
              {/* Label area - shows selected content type */}
              {selectedLabel && (
                <div className="flex-shrink-0 px-2 py-1 text-xs font-semibold text-white bg-white/10 rounded-md">
                  {selectedLabel}
                </div>
              )}
              <div className="flex-1">
                {searchComponent}
              </div>
              <button
                onClick={() => {
                  const newUrl = pathname + window.location.search;
                  window.history.pushState({}, '', newUrl);
                  window.dispatchEvent(new HashChangeEvent('hashchange'));
                }}
                className="lg:hidden text-white/70 text-xs font-medium px-2 py-1"
              >
                Cancel
              </button>
            </div>
            
            {/* Bottom Row: Content Type Filters */}
            <div className="flex-shrink-0 px-2 pt-1 pb-1 flex justify-center border-t border-white/5">
              <ContentTypeFilters />
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area - Flex to fill remaining space, white background, rounded top corners */}
      <div 
        className="bg-white rounded-t-3xl flex-1 overflow-hidden relative flex flex-col"
        style={{ minHeight: 0 }}
      >
        {/* Content - Direct children, fills 100% of content area */}
        <div className="flex-1 bg-white overflow-hidden" style={{ minHeight: 0, height: '100%', width: '100%' }}>
          {isSearchMode && searchResultsComponent ? searchResultsComponent : children}
        </div>
      </div>

      {/* Floating Mobile Nav (Visible only on mobile) */}
      {!isSearchMode && (
        <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[400px]">
          <div className="backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl px-2 py-2 flex items-center justify-around" style={{ backgroundColor: '#000000' }}>
            {navItems.map((item) => {
              // Home is active on both '/' and '/feed' routes
              const isActive = item.href === '/' 
                ? (pathname === '/' || pathname === '/feed')
                : (pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href)));
              const Icon = isActive ? item.iconSolid : item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center flex-1 h-12 transition-colors hover:bg-white/10 rounded-xl"
                >
                  <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-white/60'}`} />
                  <span className={`text-[10px] font-bold leading-none mt-1 ${isActive ? 'text-white' : 'text-white/60'}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Screen Menu */}
      <HamburgerMenu isOpen={isMenuOpen} onOpenChange={setIsMenuOpen} />
    </div>
    </>
  );
}
