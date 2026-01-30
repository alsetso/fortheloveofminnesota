'use client';

import { ReactNode, useState, useEffect, useMemo, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { Toaster } from 'react-hot-toast';
import AccountDropdown from '@/features/auth/components/AccountDropdown';
import ContentTypeFilters from './ContentTypeFilters';
import { usePageView } from '@/hooks/usePageView';
import { useNativeIOSApp } from '@/hooks/useNativeIOSApp';
import { supabase } from '@/lib/supabase';
import { useAuthStateSafe } from '@/features/auth';
import { HeaderThemeProvider } from '@/contexts/HeaderThemeContext';
import MapsSelectorDropdown from './MapsSelectorDropdown';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import { XCircleIcon, EyeIcon, UserPlusIcon, MapPinIcon, Square3Stack3DIcon, DocumentTextIcon, GlobeAltIcon, LockClosedIcon, XMarkIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  HomeIcon, 
  MapIcon, 
  UsersIcon,
  UserCircleIcon,
  SparklesIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { 
  HomeIcon as HomeIconSolid, 
  MapIcon as MapIconSolid, 
  UsersIcon as UsersIconSolid,
  UserCircleIcon as UserCircleIconSolid,
  SparklesIcon as SparklesIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid
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
  /** View As role - when provided, gradient only shows if role is 'owner' */
  viewAsRole?: 'owner' | 'manager' | 'editor' | 'non-member';
  /** Map settings - used to get role-based colors */
  mapSettings?: {
    colors?: {
      owner?: string;
      manager?: string;
      editor?: string;
      'non-member'?: string;
    };
  } | null;
  /** Initial auth data from server (optional - avoids blocking) */
  initialAuth?: {
    userId: string | null;
    accountId: string | null;
    role: 'general' | 'admin' | null;
    name: string | null;
  } | null;
  /** Initial billing data from server (optional - avoids blocking) */
  initialBilling?: {
    accountId: string | null;
    features: Array<{
      slug: string;
      name: string;
      limit_value: number | null;
      limit_type: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
      is_unlimited: boolean;
      category: string | null;
    }>;
  } | null;
  /** Map membership info (for non-member join experience) */
  mapMembership?: {
    isMember: boolean;
    isOwner: boolean;
    onJoinClick?: () => void;
    mapData?: {
      id: string;
      name: string;
      description?: string | null;
      visibility?: 'public' | 'private' | 'shared';
      auto_approve_members?: boolean;
      membership_questions?: Array<{ id: number; question: string }>;
      membership_rules?: string | null;
      settings?: {
        collaboration?: {
          allow_pins?: boolean;
          allow_areas?: boolean;
          allow_posts?: boolean;
          pin_permissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
          area_permissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
          post_permissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
        };
      };
    } | null;
    onJoinSuccess?: () => void;
  } | null;
}

// Default empty handlers to reduce prop boilerplate
const defaultAccountDropdownProps: AccountDropdownProps = {
  onAccountClick: () => {},
  onSignInClick: () => {},
};

/** Desktop horizontal inset for main content; sidebars, popups, and header use this to align. */
const CONTENT_INSET_DESKTOP = '10px';

/**
 * Global page wrapper with 10vh header and 90vh content area
 * - Header: 10vh, default iOS light gray background (or 20vh when #search is active; custom map overrides via mapSettings.colors)
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
  trackPageView = true,
  viewAsRole,
  mapSettings,
  initialAuth,
  initialBilling,
  mapMembership
}: PageWrapperProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  // Initialize as false to avoid hydration mismatch - will be set correctly on client mount
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isNativeIOSApp = useNativeIOSApp();
  const { account, activeAccountId } = useAuthStateSafe();
  
  // Check if we're on localhost (only after mount to avoid hydration issues)
  const [isLocalhost, setIsLocalhost] = useState(false);
  
  useEffect(() => {
    setIsLocalhost(
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1'
    );
  }, []);
  
  // Check if we're on a custom map page (/map/[id] or /map/[slug])
  // Exclude /map/new (create page) and /maps (list page)
  const isMapPage = pathname?.startsWith('/map/') && pathname !== '/map/new' && pathname !== '/maps';
  const isMapsPage = pathname === '/maps' || pathname === '/map';
  const isOnboardingPage = pathname === '/onboarding';
  
  // Extract map ID/slug from pathname
  const mapIdOrSlug = isMapPage ? pathname.replace('/map/', '').split('/')[0] : null;
  
  // Fetch map info when on a custom map page
  const [mapInfo, setMapInfo] = useState<{ 
    name: string; 
    emoji: string;
    id?: string;
    account_id?: string;
    description?: string | null;
    account?: any;
    viewCount?: number | null;
    pinCount?: number | null;
    memberCount?: number | null;
    visibility?: string;
    created_at?: string;
    updated_at?: string;
    hideCreator?: boolean;
  } | null>(null);
  const [selectedMentionTypes, setSelectedMentionTypes] = useState<Array<{ id: string; name: string; emoji: string; slug: string }>>([]);

  useEffect(() => {
    if (!isMapPage || !mapIdOrSlug || !mounted) {
      setMapInfo(null);
      setSelectedMentionTypes([]);
      return;
    }
    
    const fetchMapInfo = async () => {
      try {
        // Use API endpoint instead of direct Supabase query to handle auth/RLS properly
        const response = await fetch(`/api/maps/${mapIdOrSlug}`);
        
        if (!response.ok) {
          setMapInfo(null);
          return;
        }
        
        const result = await response.json();
        
        // API returns map directly, not wrapped in { map: ... }
        const data = result;
        
        if (!data || !data.id) {
          setMapInfo(null);
          return;
        }
        
        // Fetch view count, pin count, and member count from API
        let viewCount: number | null = null;
        let pinCount: number | null = null;
        let memberCount: number | null = null;
        
        try {
          const statsResponse = await fetch(`/api/maps/${data.id}/stats`);
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            viewCount = statsData.stats?.total_views || null;
          }
        } catch {
          // View count not available, continue without it
        }
        
        // Fetch pin count
        try {
          const pinsResponse = await fetch(`/api/maps/${data.id}/pins`);
          if (pinsResponse.ok) {
            const pinsData = await pinsResponse.json();
            pinCount = pinsData.pins?.length || 0;
          }
        } catch {
          // Pin count not available, continue without it
        }
        
        // Get member count from map data or fetch separately
        memberCount = data.member_count || null;
        if (memberCount === null) {
          try {
            const membersResponse = await fetch(`/api/maps/${data.id}/members`);
            if (membersResponse.ok) {
              const membersData = await membersResponse.json();
              memberCount = membersData.members?.length || 0;
            }
          } catch {
            // Member count not available, continue without it
          }
        }
        
        const emoji = (data.settings as any)?.meta?.emoji || (data.meta as any)?.emoji || '🗺️';
        setMapInfo({ 
          name: data.name || data.title || 'Map', 
          emoji,
          id: data.id,
          account_id: data.account_id,
          description: data.description,
          account: data.account,
          viewCount,
          pinCount,
          memberCount,
          visibility: data.visibility,
          created_at: data.created_at,
          updated_at: data.updated_at,
          hideCreator: (data.settings as any)?.presentation?.hide_creator || data.hide_creator || false,
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

  // Track current hash for active state (only after mount to avoid hydration mismatch)
  const [currentHash, setCurrentHash] = useState<string>('');
  
  // Update hash state after mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentHash(window.location.hash);
      
      const handleHashChange = () => {
        setCurrentHash(window.location.hash);
      };
      
      window.addEventListener('hashchange', handleHashChange);
      return () => window.removeEventListener('hashchange', handleHashChange);
    }
    return undefined;
  }, []);

  // Memoize navItems to prevent recreation on every render
  // Only show "Add" button on map pages
  const navItems = useMemo(() => {
    const items: Array<{
      label: string;
      href: string | null;
      icon: typeof HomeIcon;
      iconSolid: typeof HomeIconSolid;
      onClick?: (e: React.MouseEvent) => void;
    }> = [
      { label: 'Home', href: '/', icon: HomeIcon, iconSolid: HomeIconSolid },
      { label: 'Maps', href: '/maps', icon: MapIcon, iconSolid: MapIconSolid },
    ];
    
    // Only show "People" link when on a map page
    // Links to current map page with #people hash to show members sidebar
    if (isMapPage && mapIdOrSlug) {
      items.push({
        label: 'People',
        href: `#people`,
        icon: UsersIcon,
        iconSolid: UsersIconSolid,
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          if (typeof window !== 'undefined') {
            window.location.hash = 'people';
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          }
        }
      });
    }

    // Profile: link to /:username when username is set
    if (account?.username) {
      items.push({
        label: 'Profile',
        href: `/${encodeURIComponent(account.username)}`,
        icon: UserCircleIcon,
        iconSolid: UserCircleIconSolid,
      });
    }

    // Settings: link to settings page
    items.push({ label: 'Settings', href: '/settings', icon: Cog6ToothIcon, iconSolid: Cog6ToothIconSolid });

    return items;
  }, [isMapPage, mapIdOrSlug, account?.username]);

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

  // Check if user owns the current map
  const currentAccountId = activeAccountId || account?.id || null;
  const isOwnedMap = useMemo(() => {
    if (!isMapPage || !currentAccountId || !mapInfo) return false;
    // Check both account_id directly and account.id (fallback)
    const mapAccountId = mapInfo.account_id || mapInfo.account?.id;
    return mapAccountId === currentAccountId;
  }, [isMapPage, mapInfo?.account_id, mapInfo?.account?.id, currentAccountId]);

  // Determine background color based on viewAsRole and mapSettings
  // Priority: mapSettings.colors[role] > default gradient (owner) > default iOS light gray (others)
  const backgroundStyle = useMemo(() => {
    // If we have mapSettings and viewAsRole, use the color from settings
    if (mapSettings?.colors && viewAsRole !== undefined) {
      const roleColor = mapSettings.colors[viewAsRole];
      // Check if roleColor exists and is not empty string
      if (roleColor && roleColor.trim() !== '') {
        return {
          background: roleColor,
          backgroundColor: roleColor.startsWith('linear-gradient') ? 'transparent' : roleColor,
        };
      }
    }
    
    // Fallback to default behavior: gradient for owned maps when viewing as owner
    if (isOwnedMap) {
      if (viewAsRole === undefined || viewAsRole === 'owner') {
        return {
          background: 'linear-gradient(to right, #FFB700, #DD4A00, #5C0F2F)',
          backgroundColor: 'transparent',
        };
      }
    }
    
    // Default: iOS light gray (overridden on custom map page by mapSettings.colors when set)
    return { 
      background: '#F2F2F7',
      backgroundColor: '#F2F2F7' 
    };
  }, [isOwnedMap, viewAsRole, mapSettings]);

  const isDefaultLightBg = backgroundStyle.backgroundColor === '#F2F2F7';
  const headerText = isDefaultLightBg ? 'text-[#3C3C43]' : 'text-white';
  const headerTextMuted = isDefaultLightBg ? 'text-[#3C3C43]/60' : 'text-white/60';
  const headerIcon = isDefaultLightBg ? 'text-[#3C3C43]' : 'text-white';
  const headerIconMuted = isDefaultLightBg ? 'text-[#3C3C43]/60' : 'text-white/50';
  const headerHover = isDefaultLightBg ? 'hover:bg-black/5' : 'hover:bg-white/10';
  const headerBorder = isDefaultLightBg ? 'border-gray-200' : 'border-white/5';
  const headerBorderStrong = isDefaultLightBg ? 'border-gray-300' : 'border-white/10';
  const headerBgMuted = isDefaultLightBg ? 'bg-black/5' : 'bg-white/10';
  const headerBgMutedBorder = isDefaultLightBg ? 'border-gray-300' : 'border-white/30';
  const headerIconHover = isDefaultLightBg ? 'hover:text-[#3C3C43]' : 'hover:text-white';

  // Apply background color to body element
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    const bgColor = backgroundStyle.background;
    document.body.style.background = bgColor;
    document.documentElement.style.background = bgColor;

    return () => {
      // Reset on unmount or when condition changes
      document.body.style.background = '';
      document.documentElement.style.background = '';
    };
  }, [backgroundStyle]);

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
          ...backgroundStyle
        }}
      >
      {/* Header - Flexible height based on content, background from backgroundStyle (default iOS light gray) */}
      <header 
        className="flex flex-col flex-shrink-0"
        style={backgroundStyle}
      >
        <HeaderThemeProvider value={{ isDefaultLightBg, isSearchActive: false }}>
        {/* Notification window placeholder - 30px height, only on iOS native app */}
        {!isSearchMode && isNativeIOSApp && (
          <div className="w-full" style={{ height: '30px' }} />
        )}
        
        <div className="w-full px-4 sm:px-6 lg:px-[10px]">
          {/* Top Row: Logo, Search, Nav, Account - full width with horizontal padding */}
          {!isSearchMode && (
            <div className="grid grid-cols-12 gap-6 items-center transition-all duration-300 h-14">
            {/* 1st Column: Logo & Map Name & Search (Aligns with left sidebar) - Hide search when type param exists */}
            <div className="hidden lg:flex lg:col-span-3 items-center gap-3 min-w-0">
          <div className="flex-shrink-0">
            {isMapPage ? (
              <button
                onClick={() => router.back()}
                className={`flex items-center justify-center p-1.5 ${headerHover} rounded-md transition-colors`}
                aria-label="Go back"
              >
                <ArrowLeftIcon className={`w-5 h-5 ${headerIconMuted} ${headerIconHover}`} />
              </button>
            ) : isOnboardingPage ? (
              <span className={`text-sm font-semibold ${headerText}`}>Onboarding</span>
            ) : (
              <Image
                src="/logo.png"
                alt="For the Love of Minnesota"
                width={28}
                height={28}
                className={`w-7 h-7 ${isDefaultLightBg ? '' : 'invert'}`}
                priority
                unoptimized
              />
            )}
          </div>
          
          {/* Maps Selector - Show on /map or /maps routes only */}
          {(isMapsPage || isMapPage) && (
            <div className="flex-1 max-w-[200px] sm:max-w-[250px] transition-all duration-300">
              <MapsSelectorDropdown darkText={isDefaultLightBg} />
            </div>
          )}
            </div>
          
            {/* Mobile Header Layout (Logo, Maps Selector/Map Name, Search, Header Content, Account) */}
            <div className="lg:hidden col-span-12 flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0">
                  {isMapPage ? (
                    <button
                      onClick={() => router.back()}
                      className={`flex items-center justify-center p-1.5 ${headerHover} rounded-md transition-colors`}
                      aria-label="Go back"
                    >
                      <ArrowLeftIcon className={`w-5 h-5 ${headerIconMuted} ${headerIconHover}`} />
                    </button>
                  ) : isOnboardingPage ? (
                    <span className={`text-xs font-semibold ${headerText}`}>Onboarding</span>
                  ) : (
                    <Image
                      src="/logo.png"
                      alt="Logo"
                      width={24}
                      height={24}
                      className={`w-6 h-6 ${isDefaultLightBg ? '' : 'invert'}`}
                      priority
                      unoptimized
                    />
                  )}
                </div>
                {/* Maps Selector - shown on /map or /maps routes, next to logo */}
                {(isMapsPage || isMapPage) && (
                  <MapsSelectorDropdown darkText={isDefaultLightBg} />
                )}
              </div>
              <div className="flex-shrink-0 flex items-center gap-1">
                {headerContent}
                {showAccountDropdown && !isOnboardingPage && (
                  <AccountDropdown 
                    variant={isDefaultLightBg ? 'light' : 'dark'}
                    onAccountClick={accountDropdownProps?.onAccountClick}
                    onSignInClick={accountDropdownProps?.onSignInClick}
                  />
                )}
              </div>
            </div>
            
            {/* 2nd Column: Nav Icons or Mention Type Filters (Aligns with center feed, max-width 800px) */}
            {!isOnboardingPage && (
              <div className="hidden lg:flex lg:col-span-6 justify-center px-4">
                <div className="flex items-center justify-around w-full max-w-[800px]">
                  {/* Show nav icons on all pages, including map pages */}
                  {navItems.map((item) => {
                  // Hash-based items (like #people) are active when hash matches
                  // Use currentHash state to avoid hydration mismatch (only set after mount)
                  const isActive = item.href?.startsWith('#')
                    ? (mounted && currentHash === item.href)
                    : (item.href && (pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href))));
                  const Icon = isActive ? item.iconSolid : item.icon;
                  
                  // Handle items with onClick (e.g., hash-based navigation)
                  if ((item as any).onClick) {
                    return (
                      <button
                        key={item.label}
                        onClick={(item as any).onClick}
                        className={`flex items-center justify-center w-full h-10 transition-colors ${headerHover} rounded-md`}
                      >
                        <Icon className={`w-5 h-5 ${isActive ? headerIcon : headerIconMuted}`} />
                      </button>
                    );
                  }
                  
                  return (
                    <Link
                      key={item.label}
                      href={item.href!}
                      className={`flex items-center justify-center w-full h-10 transition-colors ${headerHover} rounded-md`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? headerIcon : headerIconMuted}`} />
                    </Link>
                  );
                })}
              </div>
            </div>
            )}
            
            {/* Mention Type Filters - Show below nav icons on map pages when types are selected */}
            {isMapPage && selectedMentionTypes.length > 0 && (
              <div className="hidden lg:flex lg:col-span-12 justify-center items-center px-4 pt-2">
                <div className="flex flex-wrap items-center gap-2 justify-center">
                  {selectedMentionTypes.map((type) => (
                    <div
                      key={type.id}
                      className={`inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-md text-xs border whitespace-nowrap ${headerBgMuted} ${headerBgMutedBorder} ${headerText}`}
                    >
                      <span className="text-base flex-shrink-0">{type.emoji}</span>
                      <span className="font-medium leading-none">{type.name}</span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveType(type.slug);
                        }}
                        className={`hover:opacity-70 transition-opacity flex items-center justify-center flex-shrink-0 leading-none ml-0.5 ${headerText}`}
                        aria-label={`Remove ${type.name} filter`}
                      >
                        <XCircleIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 3rd Column: Header Content, Account Dropdown (Aligns with right sidebar) */}
            <div className="hidden lg:flex lg:col-span-3 justify-end items-center gap-2">
              {headerContent}
              {showAccountDropdown && !isOnboardingPage && (
                <AccountDropdown 
                  variant={isDefaultLightBg ? 'light' : 'dark'}
                  onAccountClick={accountDropdownProps?.onAccountClick}
                  onSignInClick={accountDropdownProps?.onSignInClick}
                />
              )}
            </div>
            </div>
          )}
        </div>

        {/* Search Mode Header: logo + full-width search; same horizontal inset as main content */}
        {isSearchMode && (
          <div className="w-full px-4 sm:px-6 lg:px-[10px] flex flex-col animate-in fade-in slide-in-from-top-2 duration-300 pt-1">
            {/* Row 1: Logo + full-width search input (+ Cancel on mobile) */}
            <div className="flex items-center gap-2 h-14">
              <div className="flex-shrink-0">
                {isMapPage ? (
                  <button
                    onClick={() => router.back()}
                    className={`flex items-center justify-center p-1.5 ${headerHover} rounded-md transition-colors`}
                    aria-label="Go back"
                  >
                    <ArrowLeftIcon className={`w-5 h-5 ${headerIconMuted} ${headerIconHover}`} />
                  </button>
                ) : isOnboardingPage ? (
                  <span className={`text-sm font-semibold ${headerText}`}>Onboarding</span>
                ) : (
                  <Image
                    src="/logo.png"
                    alt="For the Love of Minnesota"
                    width={28}
                    height={28}
                    className={`w-6 h-6 lg:w-7 lg:h-7 ${isDefaultLightBg ? '' : 'invert'}`}
                    priority
                    unoptimized
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                {searchComponent}
              </div>
              <button
                onClick={() => {
                  const newUrl = pathname + window.location.search;
                  window.history.pushState({}, '', newUrl);
                  window.dispatchEvent(new HashChangeEvent('hashchange'));
                }}
                className={`flex-shrink-0 lg:hidden ${headerTextMuted} text-xs font-medium px-2 py-1`}
              >
                Cancel
              </button>
            </div>
            {/* Row 2: Search tabs (Content Type Filters) - pushes main content down */}
            <div className={`flex-shrink-0 px-2 pt-1 pb-1 flex justify-center border-t ${headerBorder}`}>
              <ContentTypeFilters />
            </div>
          </div>
        )}
        </HeaderThemeProvider>
      </header>

      {/* Main Content Area - Source of truth for horizontal inset on desktop. Sidebars live inside this. */}
      <div className="flex-1 flex flex-col min-h-0 lg:px-[10px]" data-content-inset-desktop={CONTENT_INSET_DESKTOP}>
        <div 
          className="bg-white rounded-t-3xl flex-1 overflow-hidden relative flex flex-col"
          style={{ minHeight: 0 }}
        >
        {/* Scrollable Content Container - Hidden scrollbar, with bottom padding on mobile for fixed nav */}
        {/* Disable scrolling for map pages (except live map) - map container handles its own scrolling */}
        <div 
          className={`flex-1 overflow-x-hidden scrollbar-hide lg:pb-0 ${
            isMapPage ? 'overflow-hidden pb-0' : isOnboardingPage ? 'overflow-y-auto pb-0' : 'overflow-y-auto pb-[calc(2.5rem+env(safe-area-inset-bottom))]'
          }`}
          style={{ minHeight: 0 }}
        >
          {isSearchMode && searchResultsComponent ? searchResultsComponent : children}
        </div>
        </div>
      </div>

      {/* Bottom nav (mobile) - height fits icon row only, no extra space above */}
      {!isSearchMode && !isOnboardingPage && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 lg:hidden flex flex-col items-stretch"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="backdrop-blur-lg rounded-t-2xl shadow-2xl border-t border-white/10 flex-shrink-0 min-h-0 py-0">
            <div className="flex items-center justify-around h-9 min-h-9 max-h-9">
                {navItems.map((item) => {
                  // Hash-based items use currentHash state to avoid hydration mismatch
                  const isActive = item.href?.startsWith('#')
                    ? (mounted && currentHash === item.href)
                    : (item.href && (pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href))));
                  const Icon = isActive ? item.iconSolid : item.icon;
                  
                  // Handle items with onClick (e.g., hash-based navigation)
                  if ((item as any).onClick) {
                    return (
                      <button
                        key={item.label}
                        onClick={(item as any).onClick}
                        className={`flex items-center justify-center flex-1 h-9 transition-colors ${headerHover} rounded-xl`}
                      >
                        <Icon className={`w-5 h-5 ${isActive ? headerIcon : headerIconMuted}`} />
                      </button>
                    );
                  }
                  
                  return (
                    <Link
                      key={item.label}
                      href={item.href!}
                      className={`flex items-center justify-center flex-1 h-9 transition-colors ${headerHover} rounded-xl`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? headerIcon : headerIconMuted}`} />
                    </Link>
                  );
                })}
              </div>
          </div>
        </div>
      )}


    </div>
    </>
  );
}
