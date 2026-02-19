'use client';

import { ReactNode, useState, useEffect, useRef, useMemo } from 'react';
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
  BuildingOfficeIcon,
  NewspaperIcon,
  XMarkIcon,
  Bars3Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
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
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { useAuthStateSafe } from '@/features/auth';
import MessagesDropdown from './MessagesDropdown';
import NotificationsDropdown from './NotificationsDropdown';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useTheme } from '@/contexts/ThemeContext';

/** Known top-level app route segments. Anything at the root not in this set is treated as a /:username route. */
const KNOWN_APP_ROUTES = new Set([
  'feed', 'maps', 'map', 'people', 'analytics', 'settings', 'admin',
  'explore', 'gov', 'news', 'docs', 'mention', 'page', 'pages',
  'messages', 'search', 'collections', 'saved', 'memories', 'friends',
  'stories', 'billing', 'plans', 'onboarding', 'signup', 'login',
  'terms', 'post', 'marketplace', 'ad_center', 'contact', 'download',
  'privacy', 'not-found', 'school', 'schools', 'transportation', 'weather',
]);

/** Routes where the right sidebar should be suppressed in the main content area. */
function shouldHideRightSidebar(pathname: string | null): boolean {
  if (!pathname) return false;
  // Exact or prefix match on explicit routes
  if (pathname === '/maps' || pathname.startsWith('/maps/')) return true;
  if (pathname === '/transportation/gtfs') return true;
  // Username routes: single root segment not matching a known app route
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length >= 1 && !KNOWN_APP_ROUTES.has(segments[0])) return true;
  return false;
}

interface NewPageWrapperProps {
  children: ReactNode;
  leftSidebar?: ReactNode;
  rightSidebar?: ReactNode;
  headerContent?: ReactNode;
  /** When true, main content area does not scroll (e.g. profile map). Root uses h-screen; main uses overflow-hidden and flex so a single full-height child fills the area. */
  mainNoScroll?: boolean;
  /** Route-specific sub-sidebar content rendered between the left sidebar and main content. */
  subSidebar?: ReactNode;
  /** Label for the sub-sidebar tab in the mobile overlay (e.g. "Explore", "Government"). */
  subSidebarLabel?: string;
  /** Controls whether the sub-sidebar is expanded (inline or overlay depending on viewport). */
  subSidebarOpen?: boolean;
  onSubSidebarOpenChange?: (open: boolean) => void;
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
  subSidebar,
  subSidebarLabel,
  subSidebarOpen,
  onSubSidebarOpenChange,
}: NewPageWrapperProps) {
  const pathname = usePathname();
  const hideRightSidebar = useMemo(() => shouldHideRightSidebar(pathname), [pathname]);
  const { account } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const { theme, toggleTheme } = useTheme();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(1024);

  // Consolidated mobile overlay state: only one panel open at a time
  type MobilePanel = 'left' | 'right' | null;
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanel>(null);
  const [leftPanelTab, setLeftPanelTab] = useState<'menu' | 'sub'>('menu');

  const closeMobilePanel = () => {
    setActiveMobilePanel(null);
    setLeftPanelTab('menu');
  };

  // Layout constants - extracted for maintainability
  const LAYOUT_CONSTANTS = {
    LEFT_SIDEBAR_WIDTH: 256,
    RIGHT_SIDEBAR_WIDTH: 320,
    SUB_SIDEBAR_WIDTH: 240,
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
  const minWidthForLeftSubCenter = LAYOUT_CONSTANTS.LEFT_SIDEBAR_WIDTH + LAYOUT_CONSTANTS.SUB_SIDEBAR_WIDTH + LAYOUT_CONSTANTS.MIN_CENTER_WIDTH; // 896px
  const minWidthForAllFour = minWidthForLeftSubCenter + LAYOUT_CONSTANTS.RIGHT_SIDEBAR_WIDTH; // 1216px

  // Determine what can fit (header: viewport-only; main content: viewport + !hideRightSidebar)
  const effectiveCanShowLeftSidebar = leftSidebar && viewportWidth >= minWidthForLeftOnly;
  const headerCanShowRightSidebar = rightSidebar && viewportWidth >= minWidthForBoth;

  // Sub-sidebar: shows inline when open, left sidebar visible, and viewport wide enough
  const subSidebarIsActive = !!(subSidebar && subSidebarOpen);
  const canShowSubSidebarInline = subSidebarIsActive && !!effectiveCanShowLeftSidebar && viewportWidth >= minWidthForLeftSubCenter;
  const rightSidebarSuppressedBySub = canShowSubSidebarInline && viewportWidth < minWidthForAllFour;

  const effectiveCanShowRightSidebar = headerCanShowRightSidebar && !hideRightSidebar && !rightSidebarSuppressedBySub;

  // Use constants for consistency
  const { LEFT_SIDEBAR_WIDTH, RIGHT_SIDEBAR_WIDTH, SUB_SIDEBAR_WIDTH, MIN_CENTER_WIDTH } = LAYOUT_CONSTANTS;

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

  // Additional navigation items for "More" menu (matches LeftSidebar)
  const moreNavItems: Array<{ label: string; icon: typeof UserCircleIcon; href?: string; onClick?: () => void }> = [
    { label: 'Documentation', icon: UserCircleIcon, href: '/docs' },
    { label: 'Home', icon: HomeIcon, href: '/' },
    { label: 'Explore', icon: MapIcon, href: '/explore' },
    { label: 'Government', icon: BuildingOfficeIcon, href: '/gov' },
    { label: 'News', icon: NewspaperIcon, href: '/news' },
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

  // Close mobile overlay on route navigation
  useEffect(() => {
    setActiveMobilePanel(null);
    setLeftPanelTab('menu');
  }, [pathname]);

  // Auto-close mobile overlay when viewport grows past mobile breakpoint
  useEffect(() => {
    if (effectiveCanShowLeftSidebar) {
      setActiveMobilePanel(null);
      setLeftPanelTab('menu');
    }
  }, [effectiveCanShowLeftSidebar]);

  return (
    <div
      className={
        mainNoScroll
          ? 'h-screen flex flex-col bg-surface-muted overflow-hidden'
          : 'h-screen flex flex-col bg-surface-muted overflow-hidden min-h-0'
      }
    >
      {/* Fixed Header - z-50, pt-14 offset for content */}
      {/* Three-column layout matching sidebars: w-64 (lg:), flex-1 (center), w-80 (xl:) */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-header border-b border-border-muted dark:border-white/10">
        <div className="h-full flex items-center">
          {/* Left Column - w-64, aligns with left sidebar, shows when space allows */}
          {effectiveCanShowLeftSidebar && (
            <div className="flex items-center w-64 flex-shrink-0 px-4 border-r border-border-muted dark:border-white/10">
            <div className="flex items-center gap-3 min-w-0 w-full">
              <Link href="/feed" className="flex-shrink-0 hover:opacity-80 transition-opacity flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="Love of Minnesota"
                  width={32}
                  height={32}
                  className="w-8 h-8 dark:hidden"
                  priority
                />
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
              <Image
                src="/logo.png"
                alt="Love of Minnesota"
                width={32}
                height={32}
                className="w-8 h-8 dark:hidden"
                priority
              />
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

          {/* Right Column - w-80, aligns with right sidebar, shows when space allows (viewport only) */}
          {headerCanShowRightSidebar && (
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

          {/* Mobile/Tablet Right: Messages + Notifications + Account (when right header section hidden by viewport) */}
          {!headerCanShowRightSidebar && (
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
            className={`sticky top-14 flex-shrink-0 h-[calc(100vh-3.5rem)] overflow-y-auto scrollbar-hide transition-all duration-200 ease-out border-r border-border-muted dark:border-white/10 ${
              effectiveCanShowLeftSidebar 
                ? 'w-64 opacity-100' 
                : 'w-0 opacity-0 pointer-events-none overflow-hidden border-r-0'
            }`}
            aria-hidden={!effectiveCanShowLeftSidebar}
            aria-label="Left sidebar navigation"
            role="complementary"
          >
            {effectiveCanShowLeftSidebar && leftSidebar}
          </aside>
        )}

        {/* Sub-Sidebar - Inline between left sidebar and main when viewport is wide enough */}
        {canShowSubSidebarInline && subSidebar && (
          <aside
            className="sticky top-14 flex-shrink-0 w-60 h-[calc(100vh-3.5rem)] overflow-y-auto scrollbar-hide border-r border-border-muted dark:border-white/10 flex flex-col"
            aria-label="Sub navigation"
            role="complementary"
          >
            <div className="flex-shrink-0 flex items-center justify-end px-2 pt-2 bg-white dark:bg-surface">
              <button
                type="button"
                onClick={() => onSubSidebarOpenChange?.(false)}
                className="w-6 h-6 rounded-md hover:bg-surface-accent flex items-center justify-center transition-colors text-foreground-muted hover:text-foreground"
                aria-label="Collapse sub navigation"
              >
                <ChevronLeftIcon className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
              {subSidebar}
            </div>
          </aside>
        )}

        {/* Sub-Sidebar collapsed: inline expand button when desktop has room but user closed it */}
        {subSidebar && !subSidebarOpen && onSubSidebarOpenChange && !!effectiveCanShowLeftSidebar && viewportWidth >= minWidthForLeftSubCenter && (
          <div className="sticky top-14 flex-shrink-0 h-[calc(100vh-3.5rem)] border-r border-border-muted dark:border-white/10 flex items-start">
            <button
              type="button"
              onClick={() => onSubSidebarOpenChange(true)}
              className="mt-2 mx-1 w-6 h-6 rounded-md hover:bg-surface-accent flex items-center justify-center transition-colors text-foreground-muted hover:text-foreground"
              aria-label="Expand sub navigation"
            >
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Center: single scroll container when !mainNoScroll. Content should flow naturally (no nested overflow-y-auto). */}
        <main 
          className={`flex-1 min-w-0 min-h-0 transition-all duration-200 ease-out ${mainNoScroll ? 'overflow-hidden flex flex-col bg-surface-muted' : 'overflow-y-auto bg-surface-muted scrollbar-hide'}`}
          style={{
            minWidth: `${MIN_CENTER_WIDTH}px`,
            ...(mainNoScroll ? {} : { scrollbarWidth: 'none', msOverflowStyle: 'none' }),
          }}
          role="main"
        >
          {/* Mobile top strip: sidebar toggle icons, only on mobile when sidebars exist */}
          {!effectiveCanShowLeftSidebar && (leftSidebar || (rightSidebar && !hideRightSidebar)) && (
            <div className="sticky top-0 z-10 flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-border-muted dark:border-white/10 bg-surface">
              <div>
                {leftSidebar && (
                  <button
                    type="button"
                    onClick={() => setActiveMobilePanel('left')}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-accent transition-colors"
                    aria-label="Open menu"
                  >
                    <Bars3Icon className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div>
                {rightSidebar && !hideRightSidebar && (
                  <button
                    type="button"
                    onClick={() => setActiveMobilePanel('right')}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-accent transition-colors"
                    aria-label="Open details"
                  >
                    <ChevronRightIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          )}
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

      {/* Unified mobile overlay: one panel at a time, controlled by activeMobilePanel */}
      {activeMobilePanel && !effectiveCanShowLeftSidebar && (
        <div
          className={`fixed inset-0 z-[60] flex ${activeMobilePanel === 'right' ? 'justify-end' : ''}`}
          role="dialog"
          aria-label={activeMobilePanel === 'right' ? 'Details' : 'Menu'}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={closeMobilePanel}
            aria-label="Close"
          />
          <div
            className={`relative h-full bg-surface flex flex-col overflow-hidden w-80 max-w-[85vw] ${
              activeMobilePanel === 'right'
                ? 'border-l border-border-muted dark:border-white/10'
                : 'border-r border-border-muted dark:border-white/10'
            }`}
          >
            <div className="flex-shrink-0 flex items-center justify-between p-2 border-b border-border-muted dark:border-white/10">
              {activeMobilePanel === 'left' && subSidebar ? (
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setLeftPanelTab('menu')}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                      leftPanelTab === 'menu'
                        ? 'bg-surface-accent text-foreground font-medium'
                        : 'text-foreground-muted hover:text-foreground'
                    }`}
                  >
                    Menu
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeftPanelTab('sub')}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                      leftPanelTab === 'sub'
                        ? 'bg-surface-accent text-foreground font-medium'
                        : 'text-foreground-muted hover:text-foreground'
                    }`}
                  >
                    {subSidebarLabel || 'Navigation'}
                  </button>
                </div>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={closeMobilePanel}
                className="w-8 h-8 rounded-md hover:bg-gray-50 dark:hover:bg-white/10 flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="w-4 h-4 text-foreground-muted" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
              {activeMobilePanel === 'left' && (
                leftPanelTab === 'sub' && subSidebar ? subSidebar : leftSidebar
              )}
              {activeMobilePanel === 'right' && rightSidebar}
            </div>
          </div>
        </div>
      )}

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
