import {
  FEED_PATH,
  isCalendarPath,
  isChatThreadPath,
  isDiscoverPath,
  isFeedPath,
  isMessagePath,
  isMessageThreadPath,
  isMessagesPath,
  isNotificationsPath,
  isPagePath,
  isTerritoryUnitPath,
  isPostPath,
  isServicesPath,
  isSettingsPath,
  isSignedInMapPath,
  isUsernamePath,
  GAME_PATH,
  OUTSIDE_PATH,
  usernamePath,
} from '@/lib/routes/routePolicy';

/** Top-level App surfaces in the bottom tab bar. */
export type AppTabId = 'feed' | 'map' | 'profile';

export type AppTabDef = {
  id: AppTabId;
  /** Static href when known; profile resolves from the signed-in username. */
  href: string | null;
  label: string;
};

/** Feed · Map · Profile. Discover opens from the map TopBar search control. */
export const APP_TABS: readonly AppTabDef[] = [
  { id: 'feed', href: FEED_PATH, label: 'Feed' },
  { id: 'map', href: GAME_PATH, label: 'Map' },
  { id: 'profile', href: null, label: 'Profile' },
] as const;

export {
  APP_CONTENT_MAX_WIDTH_CLASS,
  APP_CONTENT_MAX_WIDTH_PX,
  APP_SHELL_GUTTER_X_CLASS,
} from '@/lib/shell/appContentWidth';

/** Flat bottom nav row height (icons), not including safe-area. */
export const APP_TAB_BAR_HEIGHT_PX = 52;

/**
 * Space content must clear above the bottom nav.
 * Matches TabBar: row height + safe-area-bottom.
 * Used by AppShell’s in-flow spacer, FeedComposeFab, and `.app-root` lift.
 */
export const APP_TAB_BAR_CLEARANCE = `calc(${APP_TAB_BAR_HEIGHT_PX}px + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)))`;

/** @deprecated Prefer APP_TAB_BAR_HEIGHT_PX — kept for older clearance math. */
export const APP_TAB_BAR_CAPSULE_PX = APP_TAB_BAR_HEIGHT_PX;
/** Flat nav — no float gap. */
export const APP_TAB_BAR_FLOAT_GAP_PX = 0;
/** @deprecated Fade removed — solid bordered footer. */
export const APP_TAB_BAR_FADE_PX = 0;

function usernameSegmentFromPath(pathname: string): string | null {
  if (!isUsernamePath(pathname)) return null;
  const parts = pathname.split('/').filter(Boolean);
  let seg = parts[0] ?? '';
  try {
    seg = decodeURIComponent(seg);
  } catch {
    return null;
  }
  return seg.trim().replace(/^@/, '').toLowerCase() || null;
}

export function appTabIdFromPathname(
  pathname: string | null,
  opts?: { viewerUsername?: string | null },
): AppTabId | null {
  if (!pathname) return null;

  const viewer = opts?.viewerUsername?.trim().replace(/^@/, '').toLowerCase() || null;
  const profileSeg = usernameSegmentFromPath(pathname);
  if (profileSeg) {
    if (viewer && profileSeg === viewer) return 'profile';
    // Someone else's profile — no primary tab selected.
    return null;
  }

  if (isSignedInMapPath(pathname)) return 'map';

  // Discover is a map lightbox — keep Map tab selected.
  if (isDiscoverPath(pathname)) return 'map';

  if (
    isFeedPath(pathname) ||
    isPostPath(pathname) ||
    isServicesPath(pathname) ||
    isSettingsPath(pathname) ||
    isNotificationsPath(pathname) ||
    isMessagesPath(pathname) ||
    isMessagePath(pathname)
  ) {
    return 'feed';
  }
  if (isCalendarPath(pathname) || isTerritoryUnitPath(pathname)) {
    return 'map';
  }
  return null;
}

/** Resolve tab href — profile uses `/:username` when available. */
export function appTabHref(
  tab: AppTabDef,
  opts?: { viewerUsername?: string | null },
): string | null {
  if (tab.id === 'profile') {
    const u = opts?.viewerUsername?.trim().replace(/^@/, '').toLowerCase();
    return u ? usernamePath(u) : null;
  }
  return tab.href;
}

/** Hide on Outside MN — full-bleed afar experience.
 * `/game` is full-bleed map (no tab bar); Discover lightbox keeps the footer.
 * Chat thread pushes hide the footer so the composer owns the bottom.
 * Public page profiles keep the footer; /page/:slug/manage hides it like an edit push.
 */
export function appTabBarHidden(pathname: string | null): boolean {
  if (!pathname) return true;
  if (isSignedInMapPath(pathname)) return true;
  if (pathname === OUTSIDE_PATH || pathname.startsWith(`${OUTSIDE_PATH}/`)) {
    return true;
  }
  if (isChatThreadPath(pathname) || isMessageThreadPath(pathname)) {
    return true;
  }
  if (isPagePath(pathname) && pathname.endsWith('/manage')) {
    return true;
  }
  return false;
}
