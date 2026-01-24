'use client';

import { ReactNode, useState, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AccountDropdown from '@/features/auth/components/AccountDropdown';
import HamburgerMenu from './HamburgerMenu';
import { 
  HomeIcon, 
  MapIcon, 
  NewspaperIcon, 
  BuildingLibraryIcon, 
  UserGroupIcon,
  SparklesIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { 
  HomeIcon as HomeIconSolid, 
  MapIcon as MapIconSolid, 
  NewspaperIcon as NewspaperIconSolid, 
  BuildingLibraryIcon as BuildingLibraryIconSolid, 
  UserGroupIcon as UserGroupIconSolid,
  SparklesIcon as SparklesIconSolid,
  ChartBarIcon as ChartBarIconSolid
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
}

/**
 * Global page wrapper with 10vh header and 90vh content area
 * - Header: 10vh, black background (or 20vh when #search is active)
 * - Content: 90vh, white background, rounded top corners, scrollable (or 80vh when #search is active)
 * - When #search is active: Header expands to 20vh with full-width search and mention type filters
 */
export default function PageWrapper({ children, headerContent, searchComponent, showAccountDropdown = true, accountDropdownProps, searchResultsComponent, className = '' }: PageWrapperProps) {
  const pathname = usePathname();
  // Initialize as false to avoid hydration mismatch - will be set correctly on client mount
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { label: 'Home', href: '/', icon: HomeIcon, iconSolid: HomeIconSolid },
    { label: 'Live', href: '/live', icon: MapIcon, iconSolid: MapIconSolid },
    { label: 'Maps', href: '/maps', icon: MapIcon, iconSolid: MapIconSolid },
    { label: 'Feed', href: '/feed', icon: NewspaperIcon, iconSolid: NewspaperIconSolid },
    { label: 'Gov', href: '/gov', icon: BuildingLibraryIcon, iconSolid: BuildingLibraryIconSolid },
    { label: 'Groups', href: '/groups', icon: UserGroupIcon, iconSolid: UserGroupIconSolid },
    { label: 'Analytics', href: '/analytics', icon: ChartBarIcon, iconSolid: ChartBarIconSolid },
  ];

  // Set mounted flag on client side only
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check for #search hash parameter - works with both hashchange events and router navigation
  useEffect(() => {
    if (!mounted) return;

    const checkHash = () => {
      setIsSearchMode(window.location.hash === '#search');
    };

    // Check immediately on mount
    checkHash();

    // Listen for hashchange events (browser navigation and manual dispatches)
    window.addEventListener('hashchange', checkHash);
    
    // Also listen for popstate (browser back/forward)
    window.addEventListener('popstate', checkHash);

    return () => {
      window.removeEventListener('hashchange', checkHash);
      window.removeEventListener('popstate', checkHash);
    };
  }, [mounted]);

  // Also check hash when pathname changes (Next.js router might update pathname)
  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      setIsSearchMode(window.location.hash === '#search');
    }
  }, [pathname, mounted]);

  return (
    <div 
      className={`relative w-full h-screen overflow-hidden bg-black flex flex-col ${className}`} 
      style={{ maxWidth: '100vw' }}
    >
      {/* Header - Flexible height based on content, black background */}
      <header 
        className="flex flex-col flex-shrink-0 bg-black border-b border-white/5"
      >
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          {/* Top Row: Logo, Search, Nav, Account */}
          <div className={`grid grid-cols-12 gap-6 items-center transition-all duration-300 h-14 ${isSearchMode ? 'opacity-0 h-0 overflow-hidden pointer-events-none' : 'opacity-100'}`}>
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
          
            {/* Mobile Header Layout (Logo, Search, Account) */}
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
              <div className="flex-shrink-0">
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
                  const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
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
            
            {/* 3rd Column: Account Dropdown (Aligns with right sidebar) */}
          {showAccountDropdown && (
              <div className="hidden lg:flex lg:col-span-3 justify-end">
              <AccountDropdown 
                variant="dark"
                onAccountClick={accountDropdownProps?.onAccountClick}
                onSignInClick={accountDropdownProps?.onSignInClick}
              />
            </div>
          )}
          </div>
        </div>

        {/* Search Mode Header (Transitions in when isSearchMode is true) */}
        {isSearchMode && (
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex flex-col gap-2 py-1 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2">
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
      >
        {/* Content - Direct children, fills 100% of content area */}
        <div className="flex-1 bg-white overflow-hidden">
          {isSearchMode && searchResultsComponent ? searchResultsComponent : children}
        </div>
      </div>

      {/* Floating Mobile Nav (Visible only on mobile) */}
      {!isSearchMode && (
        <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[400px]">
          <div className="bg-black/80 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl px-2 py-2 flex items-center justify-around">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
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
  );
}

// Content Type Filters Component
function ContentTypeFilters() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const contentTypes = [
    { id: 'posts', label: 'Posts' },
    { id: 'mentions', label: 'Mentions' },
    { id: 'groups', label: 'Groups' },
    { id: 'users', label: 'Users' },
  ];

  // Initialize selected type from URL
  useEffect(() => {
    const contentTypeParam = searchParams.get('content_type');
    
    if (contentTypeParam && contentTypes.some(ct => ct.id === contentTypeParam)) {
      setSelectedType(contentTypeParam);
    } else {
      setSelectedType(null);
    }
  }, [searchParams]);

  const handleTypeSelect = (typeId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Single select: if clicking the same type, deselect it
    if (selectedType === typeId) {
      params.delete('content_type');
      setSelectedType(null);
    } else {
      params.set('content_type', typeId);
      setSelectedType(typeId);
    }
    
    // Always delete content_types param (legacy support)
    params.delete('content_types');

    router.push(`${pathname}?${params.toString()}#search`);
  };

  return (
    <div className="flex flex-wrap gap-4 items-center">
      {contentTypes.map((type) => {
        const isSelected = selectedType === type.id;
        return (
          <button
            key={type.id}
            onClick={() => handleTypeSelect(type.id)}
            className={`text-sm font-medium transition-opacity whitespace-nowrap ${
              isSelected
                ? 'text-white opacity-100'
                : 'text-white opacity-50 hover:opacity-75'
            }`}
          >
            {type.label}
          </button>
        );
      })}
    </div>
  );
}
