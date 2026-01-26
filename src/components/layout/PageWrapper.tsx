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
import { useNativeIOSApp } from '@/hooks/useNativeIOSApp';
import { supabase } from '@/lib/supabase';
import MapDetailsModal from './MapDetailsModal';
import MapsSelectorDropdown from './MapsSelectorDropdown';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import { XCircleIcon, EyeIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  HomeIcon, 
  MapIcon, 
  UsersIcon,
  SparklesIcon,
  Bars3Icon,
  PlusIcon,
  CreditCardIcon
} from '@heroicons/react/24/outline';
import { 
  HomeIcon as HomeIconSolid, 
  MapIcon as MapIconSolid, 
  UsersIcon as UsersIconSolid,
  SparklesIcon as SparklesIconSolid,
  Bars3Icon as Bars3IconSolid,
  PlusIcon as PlusIconSolid,
  CreditCardIcon as CreditCardIconSolid
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
  const router = useRouter();
  // Initialize as false to avoid hydration mismatch - will be set correctly on client mount
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isNativeIOSApp = useNativeIOSApp();
  
  // Check if we're on a custom map page (/map/[id] or /map/[slug])
  // Exclude /map/new (create page) and /maps (list page)
  const isMapPage = pathname?.startsWith('/map/') && pathname !== '/map/new' && pathname !== '/maps';
  const isMapsPage = pathname === '/maps' || pathname === '/map';
  
  // Extract map ID/slug from pathname
  const mapIdOrSlug = isMapPage ? pathname.replace('/map/', '') : null;
  
  // Fetch map info when on a custom map page
  const [mapInfo, setMapInfo] = useState<{ 
    name: string; 
    emoji: string;
    id?: string;
    description?: string | null;
    account?: any;
    viewCount?: number | null;
    visibility?: string;
    created_at?: string;
    updated_at?: string;
    hideCreator?: boolean;
  } | null>(null);
  const [isMapDetailsModalOpen, setIsMapDetailsModalOpen] = useState(false);
  
  // Fetch selected mention types from URL parameters (for header display)
  const [selectedMentionTypes, setSelectedMentionTypes] = useState<Array<{ id: string; name: string; emoji: string; slug: string }>>([]);
  
  useEffect(() => {
    if (!isMapPage || !mapIdOrSlug || !mounted) {
      setMapInfo(null);
      setSelectedMentionTypes([]);
      return;
    }
    
    const fetchMapInfo = async () => {
      try {
        // Check if it's a UUID or custom slug
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mapIdOrSlug);
        
        // Use public client (works for both authenticated and unauthenticated users)
        // RLS policies will handle visibility (public maps visible to all, private to owners)
        let query = supabase
          .from('map')
          .select('id, title, description, visibility, created_at, updated_at, hide_creator, meta, account:accounts(id, username, first_name, last_name, image_url)');
        
        if (isUUID) {
          query = query.eq('id', mapIdOrSlug);
        } else {
          query = query.eq('custom_slug', mapIdOrSlug);
        }
        
        const { data, error } = await query.single();
        
        if (error || !data) {
          setMapInfo(null);
          return;
        }
        
        // If map is not public and user is not authenticated, don't show info
        // (RLS should handle this, but double-check for better UX)
        if (data.visibility !== 'public') {
          // For non-public maps, we'd need auth check, but RLS should block access anyway
          // Continue - if RLS blocked it, data would be null
        }
        
        // Fetch view count from API
        let viewCount: number | null = null;
        try {
          const statsResponse = await fetch(`/api/maps/${data.id}/stats`);
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            viewCount = statsData.stats?.total_views || null;
          }
        } catch {
          // View count not available, continue without it
        }
        
        const emoji = (data.meta as any)?.emoji || '🗺️';
        setMapInfo({ 
          name: data.title || 'Map', 
          emoji,
          id: data.id,
          description: data.description,
          account: data.account,
          viewCount,
          visibility: data.visibility,
          created_at: data.created_at,
          updated_at: data.updated_at,
          hideCreator: data.hide_creator || false,
        });
      } catch (err) {
        setMapInfo(null);
      }
    };
    
    const fetchSelectedTypes = async () => {
      const typeParam = searchParams.get('type');
      const typesParam = searchParams.get('types');
      
      if (typesParam) {
        const slugs = typesParam.split(',').map(s => s.trim());
        const { data: allTypes } = await supabase
          .from('mention_types')
          .select('id, name, emoji')
          .eq('is_active', true);
        
        if (allTypes) {
          const selected = slugs
            .map(slug => {
              const matchingType = allTypes.find(type => {
                const typeSlug = mentionTypeNameToSlug(type.name);
                return typeSlug === slug;
              });
              return matchingType ? { ...matchingType, slug } : null;
            })
            .filter(Boolean) as Array<{ id: string; name: string; emoji: string; slug: string }>;
          
          setSelectedMentionTypes(selected);
        }
      } else if (typeParam) {
        const { data: allTypes } = await supabase
          .from('mention_types')
          .select('id, name, emoji')
          .eq('is_active', true);
        
        if (allTypes) {
          const matchingType = allTypes.find(type => {
            const typeSlug = mentionTypeNameToSlug(type.name);
            return typeSlug === typeParam;
          });
          
          if (matchingType) {
            setSelectedMentionTypes([{ ...matchingType, slug: typeParam }]);
          }
        }
      }
    };
    
    fetchMapInfo();
    fetchSelectedTypes();
  }, [isMapPage, mapIdOrSlug, mounted, searchParams]);
  
  // Remove a mention type filter
  const handleRemoveType = (slugToRemove: string) => {
    if (!isMapPage || !pathname) return;
    
    const params = new URLSearchParams(searchParams.toString());
    const typeParam = params.get('type');
    const typesParam = params.get('types');
    
    if (typesParam) {
      const slugs = typesParam.split(',').map(s => s.trim()).filter(s => s !== slugToRemove);
      if (slugs.length === 0) {
        params.delete('types');
      } else if (slugs.length === 1) {
        params.delete('types');
        params.set('type', slugs[0]);
      } else {
        params.set('types', slugs.join(','));
      }
    } else if (typeParam && typeParam === slugToRemove) {
      params.delete('type');
    }
    
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };
  
  // Get selected content type for label
  const selectedContentType = searchParams.get('content_type');
  const contentTypeLabels: Record<string, string> = {
    posts: 'Posts',
    mentions: 'Mentions',
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
    { label: 'Maps', href: '/maps', icon: MapIcon, iconSolid: MapIconSolid },
    { label: 'People', href: '/people', icon: UsersIcon, iconSolid: UsersIconSolid },
    { label: 'Add', href: '/add', icon: PlusIcon, iconSolid: PlusIconSolid },
    { label: 'Plans', href: '/plans', icon: CreditCardIcon, iconSolid: CreditCardIconSolid },
    { label: 'More', href: null, icon: Bars3Icon, iconSolid: Bars3IconSolid, isButton: true },
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
        className={`relative flex flex-col z-40 ${className}`} 
        style={{ 
          width: '100vw', 
          height: '100vh', 
          maxWidth: '100vw', 
          maxHeight: '100vh',
          overflow: 'hidden',
          backgroundColor: '#000000' 
        }}
      >
      {/* Header - Flexible height based on content, black background */}
      <header 
        className="flex flex-col flex-shrink-0 border-b border-white/5"
        style={{ backgroundColor: '#000000' }}
      >
        {/* Notification window placeholder - 30px height, only on iOS native app */}
        {!isSearchMode && isNativeIOSApp && (
          <div className="w-full" style={{ height: '30px' }} />
        )}
        
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          {/* Top Row: Logo, Search, Nav, Account - Hidden completely in search mode */}
          {!isSearchMode && (
            <div className="grid grid-cols-12 gap-6 items-center transition-all duration-300 h-14">
            {/* 1st Column: Logo & Map Name & Search (Aligns with left sidebar) - Hide search when type param exists */}
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
          
          {/* Maps Selector or Search Input - Show maps selector on /map or /maps routes */}
          {isMapsPage || isMapPage ? (
            <div className="flex-1 max-w-[200px] sm:max-w-[250px] transition-all duration-300">
              <MapsSelectorDropdown />
            </div>
          ) : searchComponent ? (
            <div className="flex-1 max-w-[180px] transition-all duration-300">
              {searchComponent}
            </div>
          ) : null}
            </div>
          
            {/* Mobile Header Layout (Logo, Maps Selector/Map Name, Search, Header Content, Account) */}
            <div className="lg:hidden col-span-12 flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0">
                  <button
                    onClick={() => setIsMenuOpen(true)}
                    aria-label="Open menu"
                  >
                    <img src="/white-logo.png" alt="Logo" className="w-6 h-6" />
                  </button>
                </div>
                {/* Maps Selector - shown on /map or /maps routes, next to logo */}
                {(isMapsPage || isMapPage) && (
                  <MapsSelectorDropdown />
                )}
              </div>
              {/* Search Input on mobile - Hidden when on maps page or custom map page */}
              {!isMapsPage && !isMapPage && searchComponent && (
                <div className="flex-1 flex justify-center px-2">
                  <div className="w-full max-w-sm">{searchComponent}</div>
                </div>
              )}
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
            
            {/* 2nd Column: Nav Icons or Mention Type Filters (Aligns with center feed, max-width 800px) */}
            {isMapPage ? (
              <div className="hidden lg:flex lg:col-span-6 justify-center items-center px-4">
                <div className="flex flex-wrap items-center gap-2 justify-center">
                  {/* Mention Type Filters - Only show when type parameters exist */}
                  {selectedMentionTypes.length > 0 && (
                    <>
                      {selectedMentionTypes.map((type) => (
                        <div
                          key={type.id}
                          className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-md text-xs border whitespace-nowrap bg-white/10 border-white/30 text-white"
                        >
                          <span className="text-base flex-shrink-0">{type.emoji}</span>
                          <span className="font-medium leading-none">{type.name}</span>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRemoveType(type.slug);
                            }}
                            className="hover:opacity-70 transition-opacity flex items-center justify-center flex-shrink-0 leading-none ml-0.5 text-white"
                            aria-label={`Remove ${type.name} filter`}
                          >
                            <XCircleIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="hidden lg:flex lg:col-span-6 justify-center px-4">
                <div className="flex items-center justify-around w-full max-w-[800px]">
                  {navItems.map((item) => {
                    // Home is active on both '/' and '/feed' routes
                    const isActive = item.href === '/' 
                      ? (pathname === '/' || pathname === '/feed')
                      : (item.href && (pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href))));
                    const Icon = isActive ? item.iconSolid : item.icon;
                    
                    // Handle button type (e.g., "More" hamburger menu)
                    if (item.isButton) {
                      return (
                        <button
                          key={item.label}
                          onClick={() => setIsMenuOpen(true)}
                          className="flex items-center justify-center w-full h-10 transition-colors hover:bg-white/10 rounded-md"
                        >
                          <Icon className="w-5 h-5 text-white/50" />
                        </button>
                      );
                    }
                    
                    return (
                      <Link
                        key={item.label}
                        href={item.href!}
                        className="flex items-center justify-center w-full h-10 transition-colors hover:bg-white/10 rounded-md"
                      >
                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/50'}`} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
            
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
              {/* Logo - Left of search input */}
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
        {/* Scrollable Content Container - Hidden scrollbar, with bottom padding on mobile for fixed nav */}
        {/* Disable scrolling for map pages (except live map) - map container handles its own scrolling */}
        <div 
          className={`flex-1 overflow-x-hidden scrollbar-hide lg:pb-0 ${
            isMapPage ? 'overflow-hidden pb-0' : 'overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))]'
          }`}
          style={{ minHeight: 0 }}
        >
          {isSearchMode && searchResultsComponent ? searchResultsComponent : children}
        </div>
      </div>

      {/* Floating Mobile Nav (Visible only on mobile) */}
      {!isSearchMode && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
          <div className="backdrop-blur-lg border-t border-white/10 rounded-t-2xl shadow-2xl px-2 py-1" style={{ backgroundColor: '#000000', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {isMapPage && mapInfo ? (
              <div className="flex flex-col gap-2 px-2 py-1.5">
                {/* Map Card Info - Similar to MapInfoCard collapsed state */}
                <button
                  onClick={() => setIsMapDetailsModalOpen(true)}
                  className="w-full flex items-center gap-2 px-2 py-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                  {/* Owner Avatar */}
                  {mapInfo.account && !mapInfo.hideCreator && (
                    <div className="flex-shrink-0">
                      {mapInfo.account.image_url ? (
                        <Image
                          src={mapInfo.account.image_url}
                          alt={mapInfo.account.username || mapInfo.account.first_name || 'User'}
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-full object-cover border border-white/20"
                          unoptimized
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                          <span className="text-xs text-white/70 font-medium">
                            {(mapInfo.account.first_name?.[0] || mapInfo.account.username?.[0] || 'U').toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Title & Owner */}
                  <div className="flex-1 min-w-0 text-left">
                    {mapInfo.name && (
                      <div className="text-xs font-semibold text-white truncate">
                        {mapInfo.name}
                      </div>
                    )}
                    {mapInfo.account && !mapInfo.hideCreator && (
                      <div className="text-[10px] text-white/70 truncate">
                        {mapInfo.account.username 
                          ? `@${mapInfo.account.username}`
                          : mapInfo.account.first_name && mapInfo.account.last_name
                          ? `${mapInfo.account.first_name} ${mapInfo.account.last_name}`
                          : mapInfo.account.first_name || 'User'}
                      </div>
                    )}
                  </div>

                  {/* View Count */}
                  {mapInfo.viewCount !== null && mapInfo.viewCount !== undefined && (
                    <div className="flex items-center gap-1 text-[10px] text-white/70 flex-shrink-0">
                      <EyeIcon className="w-3.5 h-3.5" />
                      <span>{mapInfo.viewCount.toLocaleString()}</span>
                    </div>
                  )}
                </button>
                
                {/* Mention Type Filters */}
                {selectedMentionTypes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 justify-center pt-1 border-t border-white/10">
                    {selectedMentionTypes.map((type) => (
                      <div
                        key={type.id}
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-md text-xs border whitespace-nowrap bg-white/10 border-white/30 text-white"
                      >
                        <span className="text-base flex-shrink-0">{type.emoji}</span>
                        <span className="font-medium leading-none">{type.name}</span>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemoveType(type.slug);
                          }}
                          className="hover:opacity-70 transition-opacity flex items-center justify-center flex-shrink-0 leading-none ml-0.5 text-white"
                          aria-label={`Remove ${type.name} filter`}
                        >
                          <XCircleIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-around">
                {navItems.map((item) => {
                  // Home is active on both '/' and '/feed' routes
                  const isActive = item.href === '/' 
                    ? (pathname === '/' || pathname === '/feed')
                    : (item.href && (pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href))));
                  const Icon = isActive ? item.iconSolid : item.icon;
                  
                  // Handle button type (e.g., "More" hamburger menu)
                  if (item.isButton) {
                    return (
                      <button
                        key={item.label}
                        onClick={() => setIsMenuOpen(true)}
                        className="flex items-center justify-center flex-1 h-9 transition-colors hover:bg-white/10 rounded-xl"
                      >
                        <Icon className="w-5 h-5 text-white/60" />
                      </button>
                    );
                  }
                  
                  return (
                    <Link
                      key={item.label}
                      href={item.href!}
                      className="flex items-center justify-center flex-1 h-9 transition-colors hover:bg-white/10 rounded-xl"
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/60'}`} />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Map Details Modal */}
      {mapInfo && mapInfo.id && (
        <MapDetailsModal
          isOpen={isMapDetailsModalOpen}
          onClose={() => setIsMapDetailsModalOpen(false)}
          mapInfo={{
            id: mapInfo.id,
            name: mapInfo.name,
            emoji: mapInfo.emoji,
            description: mapInfo.description || null,
            account: mapInfo.account ? {
              id: mapInfo.account.id,
              username: mapInfo.account.username,
              first_name: mapInfo.account.first_name,
              last_name: mapInfo.account.last_name,
              image_url: mapInfo.account.image_url,
            } : null,
            viewCount: mapInfo.viewCount || null,
            visibility: (mapInfo.visibility as 'public' | 'private' | 'shared') || 'public',
            created_at: mapInfo.created_at || new Date().toISOString(),
            updated_at: mapInfo.updated_at || new Date().toISOString(),
            hideCreator: mapInfo.hideCreator || false,
          }}
        />
      )}

      {/* Full Screen Menu */}
      <HamburgerMenu isOpen={isMenuOpen} onOpenChange={setIsMenuOpen} />
    </div>
    </>
  );
}
