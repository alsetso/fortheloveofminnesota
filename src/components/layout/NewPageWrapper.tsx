'use client';

import { ReactNode, useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  HomeIcon, 
  MapIcon, 
  UsersIcon,
  UserCircleIcon,
  ChartBarIcon,
  EllipsisHorizontalIcon,
  BookmarkIcon,
  ClockIcon,
  DocumentTextIcon,
  CameraIcon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline';
import { 
  HomeIcon as HomeIconSolid, 
  MapIcon as MapIconSolid, 
  UsersIcon as UsersIconSolid,
  UserCircleIcon as UserCircleIconSolid,
  ChartBarIcon as ChartBarIconSolid,
} from '@heroicons/react/24/solid';
import { HeartIcon } from '@heroicons/react/24/solid';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { useAuthStateSafe } from '@/features/auth';
import MessagesDropdown from './MessagesDropdown';
import NotificationsDropdown from './NotificationsDropdown';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useTheme } from '@/contexts/ThemeContext';

interface NewPageWrapperProps {
  children: ReactNode;
  leftSidebar?: ReactNode;
  rightSidebar?: ReactNode;
  headerContent?: ReactNode;
  /** When true, main content area does not scroll (e.g. profile map). Root uses h-screen; main uses overflow-hidden and flex so a single full-height child fills the area. */
  mainNoScroll?: boolean;
}

/**
 * New PageWrapper with three-column layout:
 * - Fixed header (pt-14 offset)
 * - Sticky left sidebar (lg: breakpoint, scrollable)
 * - Flexible center feed (scrollable)
 * - Sticky right sidebar (xl: breakpoint, scrollable)
 */
export default function NewPageWrapper({
  children,
  leftSidebar,
  rightSidebar,
  headerContent,
  mainNoScroll = false,
}: NewPageWrapperProps) {
  const pathname = usePathname();
  const { account } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const { theme, toggleTheme } = useTheme();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(1024);

  // Layout constants - extracted for maintainability
  const LAYOUT_CONSTANTS = {
    LEFT_SIDEBAR_WIDTH: 256,
    RIGHT_SIDEBAR_WIDTH: 320,
    MIN_CENTER_WIDTH: 400,
    RESIZE_THROTTLE_MS: 150,
  } as const;

  // Throttled resize handler for better performance
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastUpdateTime = 0;

    const updateViewportWidth = () => {
      const now = Date.now();
      if (now - lastUpdateTime >= LAYOUT_CONSTANTS.RESIZE_THROTTLE_MS) {
        setViewportWidth(window.innerWidth);
        lastUpdateTime = now;
      } else {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setViewportWidth(window.innerWidth);
          lastUpdateTime = Date.now();
        }, LAYOUT_CONSTANTS.RESIZE_THROTTLE_MS - (now - lastUpdateTime));
      }
    };

    // Initial set
    updateViewportWidth();
    
    window.addEventListener('resize', updateViewportWidth, { passive: true });
    return () => {
      window.removeEventListener('resize', updateViewportWidth);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [LAYOUT_CONSTANTS.RESIZE_THROTTLE_MS]);

  // Calculate which sidebars can fit
  const minWidthForLeftOnly = LAYOUT_CONSTANTS.MIN_CENTER_WIDTH + LAYOUT_CONSTANTS.LEFT_SIDEBAR_WIDTH; // 656px
  const minWidthForBoth = LAYOUT_CONSTANTS.MIN_CENTER_WIDTH + LAYOUT_CONSTANTS.LEFT_SIDEBAR_WIDTH + LAYOUT_CONSTANTS.RIGHT_SIDEBAR_WIDTH; // 976px

  // Determine what can fit
  const effectiveCanShowLeftSidebar = leftSidebar && viewportWidth >= minWidthForLeftOnly;
  const effectiveCanShowRightSidebar = rightSidebar && viewportWidth >= minWidthForBoth;

  // Use constants for consistency
  const { LEFT_SIDEBAR_WIDTH, RIGHT_SIDEBAR_WIDTH, MIN_CENTER_WIDTH } = LAYOUT_CONSTANTS;

  // Navigation items
  const navItems: Array<{
    label: string;
    href?: string;
    icon: typeof HomeIcon;
    iconSolid: typeof HomeIconSolid;
    onClick?: () => void;
  }> = [
    { label: 'Home', href: '/', icon: HomeIcon, iconSolid: HomeIconSolid },
    { label: 'Maps', href: '/maps', icon: MapIcon, iconSolid: MapIconSolid },
    { label: 'People', href: '/people', icon: UsersIcon, iconSolid: UsersIconSolid },
  ];

  // Add Analytics for admins
  if (account?.role === 'admin') {
    navItems.push({
      label: 'Analytics',
      href: '/analytics',
      icon: ChartBarIcon,
      iconSolid: ChartBarIconSolid,
    });
  }

  // Add Profile if username exists
  if (account?.username) {
    navItems.push({
      label: 'Profile',
      href: `/${encodeURIComponent(account.username)}`,
      icon: UserCircleIcon,
      iconSolid: UserCircleIconSolid,
    });
  }

  // Additional navigation items for "More" menu (from LeftSidebar)
  const moreNavItems: Array<{ label: string; icon: typeof BookmarkIcon; href?: string; onClick?: () => void }> = [
    { label: 'Friends', icon: UsersIcon, href: '/friends' },
    { label: 'Saved', icon: BookmarkIcon, href: '/saved' },
    { label: 'Memories', icon: ClockIcon, href: '/memories' },
    { label: 'Pages', icon: DocumentTextIcon, href: '/pages' },
    { label: 'Stories', icon: CameraIcon, href: '/stories' },
  ];

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };

    if (isMoreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMoreMenuOpen]);

  return (
    <div className={mainNoScroll ? 'h-screen flex flex-col bg-surface-muted overflow-hidden' : 'min-h-screen flex flex-col bg-surface-muted'}>
      {/* Fixed Header - z-50, pt-14 offset for content */}
      {/* Three-column layout matching sidebars: w-64 (lg:), flex-1 (center), w-80 (xl:) */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-header border-b border-border-muted dark:border-white/10">
        <div className="h-full flex items-center">
          {/* Left Column - w-64, aligns with left sidebar, shows when space allows */}
          {effectiveCanShowLeftSidebar && (
            <div className="flex items-center w-64 flex-shrink-0 px-4 border-r border-border-muted dark:border-white/10">
            <div className="flex items-center gap-3 min-w-0 w-full">
              <Link href="/feed" className="flex-shrink-0 hover:opacity-80 transition-opacity flex items-center justify-center">
                <HeartIcon className="w-8 h-8 text-red-500 dark:hidden" aria-hidden />
                <Image
                  src="/white-logo.png"
                  alt="Love of Minnesota"
                  width={32}
                  height={32}
                  className="w-8 h-8 hidden dark:block"
                  priority
                />
              </Link>
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search Minnesota"
                    className="w-full h-9 px-3 pl-9 bg-surface-accent rounded-lg text-sm text-foreground placeholder:text-foreground-muted border-none focus:outline-none"
                  />
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Mobile: Logo + Search (when left sidebar hidden) */}
          {!effectiveCanShowLeftSidebar && (
            <div className="flex items-center gap-3 px-4 flex-1 min-w-0">
            <Link href="/feed" className="flex-shrink-0 hover:opacity-80 transition-opacity flex items-center justify-center">
              <HeartIcon className="w-8 h-8 text-red-500 dark:hidden" aria-hidden />
              <Image
                src="/white-logo.png"
                alt="Love of Minnesota"
                width={32}
                height={32}
                className="w-8 h-8 hidden dark:block"
                priority
              />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search"
                  className="w-full h-9 px-3 pl-9 bg-surface-accent rounded-lg text-sm text-foreground placeholder:text-foreground-muted border-none focus:outline-none"
                />
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
          )}

          {/* Center Column - flex-1, aligns with main content - Hidden on mobile */}
          {effectiveCanShowLeftSidebar && (
            <nav className="flex flex-1 min-w-0 items-center px-4">
            <div className="flex items-center justify-between w-full max-w-[600px] mx-auto">
              {navItems.map((item) => {
                const isActive = item.href
                  ? (pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href)))
                  : false;
                const Icon = isActive ? item.iconSolid : item.icon;
                
                if (item.onClick) {
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.onClick}
                      className="flex items-center justify-center flex-1 h-10 rounded-md hover:bg-surface-accent dark:hover:bg-white/10 transition-colors relative"
                      aria-label={item.label}
                    >
                      <Icon className="w-5 h-5 text-foreground-muted hover:text-foreground" />
                    </button>
                  );
                }
                
                return (
                  <Link
                    key={item.label}
                    href={item.href!}
                    className="flex items-center justify-center flex-1 h-10 rounded-md hover:bg-surface-accent dark:hover:bg-white/10 transition-colors relative"
                    aria-label={item.label}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-foreground' : 'text-foreground-muted'}`} />
                    {isActive && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-lake-blue rounded-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>
          )}

          {/* Right Column - w-80, aligns with right sidebar, shows when space allows */}
          {effectiveCanShowRightSidebar && (
            <div className="flex items-center justify-end w-80 flex-shrink-0 px-4 border-l border-border-muted dark:border-white/10">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-accent dark:bg-white/10 hover:bg-surface-accent/80 dark:hover:bg-white/20 transition-colors text-foreground-muted hover:text-foreground"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? (
                  <SunIcon className="w-5 h-5" />
                ) : (
                  <MoonIcon className="w-5 h-5" />
                )}
              </button>
              {account ? (
                <>
                  {/* Messages Dropdown */}
                  <MessagesDropdown />
                  
                  {/* Notifications Dropdown */}
                  <NotificationsDropdown />
                  
                  {headerContent}
                  <Link
                    href="/settings"
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-accent dark:bg-white/10 hover:bg-surface-accent/80 dark:hover:bg-white/20 transition-colors"
                    aria-label="Account settings"
                  >
                    <ProfilePhoto account={account} size="sm" editable={false} />
                  </Link>
                </>
              ) : (
                <>
                  {headerContent}
                  <button
                    onClick={openWelcome}
                    className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors text-white bg-lake-blue hover:bg-lake-blue/90"
                    aria-label="Sign in"
                  >
                    Sign In
                  </button>
                </>
              )}
            </div>
          </div>
          )}

          {/* Mobile/Tablet Right: Messages + Notifications + Account (when right sidebar hidden) */}
          {!effectiveCanShowRightSidebar && (
            <div className="flex items-center gap-2 px-4">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-accent dark:bg-white/10 hover:bg-surface-accent/80 dark:hover:bg-white/20 transition-colors text-foreground-muted hover:text-foreground"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <SunIcon className="w-5 h-5" />
              ) : (
                <MoonIcon className="w-5 h-5" />
              )}
            </button>
            {account ? (
              <>
                <MessagesDropdown />
                <NotificationsDropdown />
                {headerContent}
                <Link
                  href="/settings"
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-accent dark:bg-white/10 hover:bg-surface-accent/80 dark:hover:bg-white/20 transition-colors"
                  aria-label="Account settings"
                >
                  <ProfilePhoto account={account} size="sm" editable={false} />
                </Link>
              </>
            ) : (
              <>
                {headerContent}
                <button
                  onClick={openWelcome}
                  className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors text-white bg-lake-blue hover:bg-lake-blue/90"
                  aria-label="Sign in"
                >
                  Sign In
                </button>
              </>
            )}
          </div>
          )}
        </div>
      </header>

      {/* Main Content Area - pt-14 offset for fixed header */}
      <div className="flex-1 flex pt-14 min-h-0">
        {/* Left Sidebar - Sticky, scrollable, shows when space allows */}
        {leftSidebar && (
          <aside 
            className={`sticky top-14 flex-shrink-0 h-[calc(100vh-3.5rem)] overflow-y-auto scrollbar-hide transition-all duration-200 ease-out ${
              effectiveCanShowLeftSidebar 
                ? 'w-64 opacity-100' 
                : 'w-0 opacity-0 pointer-events-none overflow-hidden'
            }`}
            aria-hidden={!effectiveCanShowLeftSidebar}
            aria-label="Left sidebar navigation"
            role="complementary"
          >
            {effectiveCanShowLeftSidebar && leftSidebar}
          </aside>
        )}

        {/* Center: scrollable feed (default) or no-scroll fill (mainNoScroll) */}
        <main 
          className={`flex-1 min-w-0 min-h-0 transition-all duration-200 ease-out ${mainNoScroll ? 'overflow-hidden flex flex-col bg-surface-muted' : 'overflow-y-auto bg-surface-muted scrollbar-hide'}`}
          style={{ minWidth: `${MIN_CENTER_WIDTH}px` }}
          role="main"
        >
          {children}
        </main>

        {/* Right Sidebar - Sticky, scrollable, shows when space allows */}
        {rightSidebar && (
          <aside 
            className={`sticky top-14 flex-shrink-0 h-[calc(100vh-3.5rem)] overflow-y-auto transition-all duration-200 ease-out ${
              effectiveCanShowRightSidebar 
                ? 'w-80 opacity-100' 
                : 'w-0 opacity-0 pointer-events-none overflow-hidden'
            }`}
            aria-hidden={!effectiveCanShowRightSidebar}
            aria-label="Right sidebar"
            role="complementary"
          >
            {effectiveCanShowRightSidebar && rightSidebar}
          </aside>
        )}
      </div>

      {/* Mobile Bottom Nav - Fixed at bottom, shows when left sidebar is hidden */}
      {!effectiveCanShowLeftSidebar && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-header border-t border-border-muted dark:border-white/10">
        <div className="flex items-center justify-around py-2" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
          {navItems.map((item) => {
            const isActive = item.href
              ? (pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href)))
              : false;
            const Icon = isActive ? item.iconSolid : item.icon;
            
            if (item.onClick) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className="flex items-center justify-center flex-1 py-1 transition-colors"
                  aria-label={item.label}
                >
                  <Icon className="w-5 h-5 text-foreground-muted" />
                </button>
              );
            }
            
            return (
              <Link
                key={item.label}
                href={item.href!}
                className="flex items-center justify-center flex-1 py-1 transition-colors"
                aria-label={item.label}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-foreground' : 'text-foreground-muted'}`} />
              </Link>
            );
          })}
          
          {/* More Menu Button */}
          <div className="relative flex-1" ref={moreMenuRef}>
            <button
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              className="flex items-center justify-center w-full py-1 transition-colors"
              aria-label="More"
            >
              <EllipsisHorizontalIcon className={`w-5 h-5 ${isMoreMenuOpen ? 'text-foreground' : 'text-foreground-muted'}`} />
            </button>

            {/* More Menu Popup */}
            {isMoreMenuOpen && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 max-w-[calc(100vw-2rem)] bg-surface border border-border-muted dark:border-white/10 rounded-lg shadow-xl overflow-hidden z-[60]">
                <div className="max-h-[60vh] overflow-y-auto scrollbar-hide">
                  {/* Header */}
                  <div className="flex items-center justify-between p-3 border-b border-border-muted dark:border-white/10">
                    <h3 className="text-sm font-semibold text-foreground">More</h3>
                    <button
                      onClick={() => setIsMoreMenuOpen(false)}
                      className="w-6 h-6 rounded-full hover:bg-surface-accent flex items-center justify-center transition-colors"
                      aria-label="Close"
                    >
                      <XMarkIcon className="w-4 h-4 text-foreground-muted" />
                    </button>
                  </div>

                  {/* Navigation Items */}
                  <div className="py-2">
                    {moreNavItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = item.href && (pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href)));
                      
                      if (item.onClick) {
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              item.onClick?.();
                              setIsMoreMenuOpen(false);
                            }}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors w-full text-left"
                          >
                            <Icon className="w-5 h-5" />
                            <span>{item.label}</span>
                          </button>
                        );
                      }
                      
                      return (
                        <Link
                          key={item.label}
                          href={item.href!}
                          onClick={() => setIsMoreMenuOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                            isActive
                              ? 'bg-surface-accent text-foreground'
                              : 'text-foreground-muted hover:bg-surface-accent hover:text-foreground'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
      )}
    </div>
  );
}
