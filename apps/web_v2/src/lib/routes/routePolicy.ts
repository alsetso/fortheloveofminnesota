import { isReservedUsername } from '@/lib/account/reservedUsernames';

export const WELCOME_PATH = '/welcome';
export const SETUP_PATH = '/setup';
/**
 * Retired map URL. Redirects to Game (Map tab).
 * Kept so leftover /story links still resolve.
 */
export const STORY_PATH = '/story';
/**
 * Retired scout-map URL. Redirects to Game (Map tab).
 * Kept so leftover /campaign links still resolve.
 */
export const CAMPAIGN_PATH = '/campaign';
/** Product Map tab — full game surface (radar, world models, zones, dock). */
export const GAME_PATH = '/game';
export const FLY_PATH = '/fly';
/**
 * Retired Map hub URL. Redirects to Game (Map tab).
 * Kept so leftover /map links still resolve.
 */
export const MAP_PATH = '/map';
/** Statewide community posts + pins (App scroll surface). */
export const FEED_PATH = '/feed';
/** Single community post (`/post/:id`) — pushed from Feed. */
export const POST_PATH = '/post';
/** Places + posts search (Own scroll surface). Legacy path — redirects to Discover. */
export const EXPLORE_PATH = '/explore';
/** Discover browse + search (Own scroll surface). Replaces Explore tab. */
export const DISCOVER_PATH = '/discover';

/** Community event calendar (Own scroll surface). */
export const CALENDAR_PATH = '/calendar';

/**
 * Home service bid-request portal — accounts post what they need at an address.
 * Own scroll surface; create path writes Marketplace · Wanted pins.
 */
export const SERVICES_PATH = '/services';

/** `/discover/:territory-type` — visited + left-to-visit for one passport kind. */
export function discoverKindPath(slug: string): string {
  return `${DISCOVER_PATH}/${encodeURIComponent(slug)}`;
}

/** Cities you follow + notify for alerts. */
export const DISCOVER_PLACES_PATH = `${DISCOVER_PATH}/places`;

/** Topics you follow for alerts (and later map filter). */
export const DISCOVER_INTERESTS_PATH = `${DISCOVER_PATH}/interests`;

/** Statewide K–12 schools directory (your schools + catalog). */
export const DISCOVER_SCHOOLS_PATH = `${DISCOVER_PATH}/schools`;

/** Atlas feature sets (collections) browse. */
export const DISCOVER_ATLAS_PATH = `${DISCOVER_PATH}/atlas`;

/** One atlas feature set (collection slug). */
export function discoverAtlasCollectionPath(slug: string): string {
  return `${DISCOVER_ATLAS_PATH}/${encodeURIComponent(slug)}`;
}

/** Finds / collectibles progress by model. */
export const DISCOVER_COLLECTIBLES_PATH = `${DISCOVER_PATH}/collectibles`;

/** Level, passport, and collectibles — game standing off the Discover home. */
export const DISCOVER_STANDING_PATH = `${DISCOVER_PATH}/standing`;

/** One experience zone detail (`/discover/zone/:id`). */
export function discoverZonePath(id: string): string {
  return `${DISCOVER_PATH}/zone/${encodeURIComponent(id)}`;
}

/** Contact book — people & addresses (Own scroll surface). */
export const CONTACTS_PATH = '/contacts';
/**
 * Account AI Helpdesk — threads + messages (`ai.subject_threads` /
 * `ai.subject_messages`). Opened from the left account menu.
 */
export const HELPDESK_PATH = '/helpdesk';
/** @deprecated Prefer {@link HELPDESK_PATH}. */
export const CHAT_PATH = HELPDESK_PATH;
/** Legacy path kept for redirects into Helpdesk. */
export const LEGACY_CHAT_PATH = '/chat';
/** Account-owned directory pages (Own scroll surface). */
export const PAGES_PATH = '/pages';
/** Create a new directory page (push from Discover or My Pages). */
export const PAGES_NEW_PATH = `${PAGES_PATH}/new`;
/** Sponsored feed — first dedicated feed-style ad placement surface. */
export const ADS_PATH = '/ads';
/**
 * Legacy Ads Manager hub URL. Redirects to {@link pagesAdvertisePath}.
 * Ads ops live on a page (`/page/:slug/advertise`); My Pages is the account hub.
 */
export const ADS_MANAGER_PATH = '/ads/manager';
/** Public / sharable directory page profile (`/page/:slug`). */
export const PAGE_PATH = '/page';
/**
 * My Pages with advertise intent — account-level entry when the page isn’t known yet.
 * Open a page from here, then Advertise on that page.
 */
export function pagesAdvertisePath(): string {
  return `${PAGES_PATH}?intent=advertise`;
}
/** Civic / geo territory unit record (`/directory/territory/:unitId`). */
export const DIRECTORY_TERRITORY_PATH = '/directory/territory';
/** @deprecated Prefer {@link DIRECTORY_TERRITORY_PATH}. Kept for legacy redirects. */
export const PLACE_PATH = '/place';
/** Account settings — details + billing (Own scroll surface). */
export const SETTINGS_PATH = '/settings';
/** In-app alerts inbox (`platform.alerts`) — Own scroll surface. */
export const NOTIFICATIONS_PATH = '/notifications';
/** Direct messages inbox (`platform.threads` / `platform.messages`). */
export const MESSAGES_PATH = '/messages';
/** Single DM thread push (`/message/thread/:id`). */
export const MESSAGE_PATH = '/message';
/** Signed-in home after splash — community feed. */
export const LOGGED_IN_HOME_PATH = FEED_PATH;
/**
 * Outside-Minnesota experience — shown to signed-in users who are outside MN.
 * Full Mapbox data (statewide MN view), streak claim, level bar.
 * GPS watcher redirects back to /game the moment the user enters MN bounds.
 */
export const OUTSIDE_PATH = '/outside';

/** True on the community feed page. */
export function isFeedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === FEED_PATH || pathname.startsWith(`${FEED_PATH}/`);
}

/** `/post/:id` detail push from Feed. */
export function postPath(id: string): string {
  return `${POST_PATH}/${encodeURIComponent(id)}`;
}

/** True on a single post page. */
export function isPostPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === POST_PATH || pathname.startsWith(`${POST_PATH}/`);
}

/** True on Discover (and legacy /explore URLs that redirect into it). */
export function isDiscoverPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === DISCOVER_PATH ||
    pathname.startsWith(`${DISCOVER_PATH}/`) ||
    pathname === EXPLORE_PATH ||
    pathname.startsWith(`${EXPLORE_PATH}/`)
  );
}

/** True on the community calendar page. */
export function isCalendarPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === CALENDAR_PATH || pathname.startsWith(`${CALENDAR_PATH}/`);
}

/** True on the home-services bid-request portal. */
export function isServicesPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === SERVICES_PATH || pathname.startsWith(`${SERVICES_PATH}/`);
}

/** @deprecated Prefer {@link isDiscoverPath}. */
export function isExplorePath(pathname: string | null): boolean {
  return isDiscoverPath(pathname);
}

/** True on the contact book page. */
export function isContactsPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === CONTACTS_PATH || pathname.startsWith(`${CONTACTS_PATH}/`);
}

/** True on the account Helpdesk inbox or a thread push. */
export function isHelpdeskPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === HELPDESK_PATH ||
    pathname.startsWith(`${HELPDESK_PATH}/`) ||
    pathname === LEGACY_CHAT_PATH ||
    pathname.startsWith(`${LEGACY_CHAT_PATH}/`)
  );
}

/** @deprecated Prefer {@link isHelpdeskPath}. */
export function isChatPath(pathname: string | null): boolean {
  return isHelpdeskPath(pathname);
}

/** Thread conversation push (`/helpdesk/:threadId`) — not the inbox root. */
export function isHelpdeskThreadPath(pathname: string | null): boolean {
  if (!pathname || !isHelpdeskPath(pathname)) return false;
  if (pathname === HELPDESK_PATH || pathname === LEGACY_CHAT_PATH) return false;
  const base =
    pathname.startsWith(`${LEGACY_CHAT_PATH}/`) ? LEGACY_CHAT_PATH : HELPDESK_PATH;
  const rest = pathname.slice(base.length + 1);
  if (!rest || rest.includes('/')) return false;
  return true;
}

/** @deprecated Prefer {@link isHelpdeskThreadPath}. */
export function isChatThreadPath(pathname: string | null): boolean {
  return isHelpdeskThreadPath(pathname);
}

/** True on the account pages list. */
export function isPagesPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === PAGES_PATH || pathname.startsWith(`${PAGES_PATH}/`);
}

/** True on the sponsored feed (includes legacy `/ads/manager` redirect path). */
export function isAdsPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === ADS_PATH || pathname.startsWith(`${ADS_PATH}/`);
}

/** @deprecated Legacy hub — redirects to My Pages. Prefer {@link isPagesPath}. */
export function isAdsManagerPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === ADS_MANAGER_PATH || pathname.startsWith(`${ADS_MANAGER_PATH}/`);
}

/** True on a public page profile (`/page/:slug`). */
export function isPagePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === PAGE_PATH || pathname.startsWith(`${PAGE_PATH}/`);
}

/** `/directory/territory/:unitId` — sharable territory unit record. */
export function directoryTerritoryPath(unitId: string): string {
  return `${DIRECTORY_TERRITORY_PATH}/${encodeURIComponent(unitId)}`;
}

/** @deprecated Prefer {@link directoryTerritoryPath}. */
export function placePath(id: string): string {
  return directoryTerritoryPath(id);
}

/** True on a territory unit record (`/directory/territory/:unitId`). */
export function isDirectoryTerritoryPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === DIRECTORY_TERRITORY_PATH ||
    pathname.startsWith(`${DIRECTORY_TERRITORY_PATH}/`)
  );
}

/** True on a place record (`/place/:id` legacy alias). */
export function isPlacePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === PLACE_PATH || pathname.startsWith(`${PLACE_PATH}/`);
}

/** True on any territory unit record surface (new + legacy paths). */
export function isTerritoryUnitPath(pathname: string | null): boolean {
  return isDirectoryTerritoryPath(pathname) || isPlacePath(pathname);
}

/** Account settings hub + nested account / billing pushes. */
export function settingsAccountPath(): string {
  return `${SETTINGS_PATH}/account`;
}

export function settingsBillingPath(): string {
  return `${SETTINGS_PATH}/billing`;
}

/** True on Settings (`/settings` and nested). */
export function isSettingsPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === SETTINGS_PATH || pathname.startsWith(`${SETTINGS_PATH}/`);
}

/** True on Notifications (`/notifications`). */
export function isNotificationsPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === NOTIFICATIONS_PATH ||
    pathname.startsWith(`${NOTIFICATIONS_PATH}/`)
  );
}

/** DM thread push (`/message/thread/:id`). */
export function messageThreadPath(threadId: string): string {
  return `${MESSAGE_PATH}/thread/${encodeURIComponent(threadId)}`;
}

/** True on Messages inbox (`/messages`). */
export function isMessagesPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === MESSAGES_PATH || pathname.startsWith(`${MESSAGES_PATH}/`);
}

/** True on a DM thread (`/message/thread/:id`). */
export function isMessageThreadPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (!pathname.startsWith(`${MESSAGE_PATH}/thread/`)) return false;
  const rest = pathname.slice(`${MESSAGE_PATH}/thread/`.length);
  return Boolean(rest) && !rest.includes('/');
}

/** True on any `/message` surface (thread pushes). */
export function isMessagePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === MESSAGE_PATH || pathname.startsWith(`${MESSAGE_PATH}/`);
}

/**
 * Public account profile link — `/:username` (no `/u` prefix).
 * Static App routes win over the dynamic segment; reserved names never count.
 */
export function usernamePath(username: string): string {
  const u = username.trim().replace(/^@/, '').toLowerCase();
  return `/${encodeURIComponent(u)}`;
}

/** True on a sharable account profile (`/:username`). */
export function isUsernamePath(pathname: string | null): boolean {
  if (!pathname) return false;
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== 1) return false;
  let seg = parts[0] ?? '';
  try {
    seg = decodeURIComponent(seg);
  } catch {
    return false;
  }
  const u = seg.trim().replace(/^@/, '').toLowerCase();
  if (!u || isReservedUsername(u)) return false;
  return true;
}

/**
 * Retired world-map aliases that redirect into Game.
 * Prefer {@link isSignedInMapPath} for product checks.
 */
export function isWorldMapPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === STORY_PATH ||
    pathname.startsWith(`${STORY_PATH}/`) ||
    pathname === CAMPAIGN_PATH ||
    pathname.startsWith(`${CAMPAIGN_PATH}/`) ||
    pathname === MAP_PATH ||
    pathname.startsWith(`${MAP_PATH}/`)
  );
}

/** Full-bleed signed-in Map tab (/game) plus retired aliases mid-redirect. */
export function isSignedInMapPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === GAME_PATH ||
    pathname === FLY_PATH ||
    pathname.startsWith(`${GAME_PATH}/`) ||
    isWorldMapPath(pathname)
  );
}

/**
 * @deprecated Prefer {@link isSignedInMapPath}. Map hub redirected to Game.
 */
export function isMapHubPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === MAP_PATH || pathname.startsWith(`${MAP_PATH}/`);
}


const ANON_PREFIXES = [
  WELCOME_PATH,
  PAGE_PATH,
  DIRECTORY_TERRITORY_PATH,
  PLACE_PATH,
  '/privacy',
  '/tos',
  '/auth',
  '/login',
  '/signup',
  /** Public map pin payloads (directory logos + community pins). */
  '/api/directory',
  '/api/maps',
  /** Public place records (territory units). */
  '/api/place',
  /** Public account profiles + profile posts / view log. */
  '/api/community/profile',
  /** Public / profile timelines (account_id filter is public-safe). */
  '/api/community/feed',
  /** Presign returns JSON 401 — do not HTML-redirect fetch() callers. */
  '/api/uploads',
  /** World map reads — must return JSON for fetch() (Discover zone hero, game stream). */
  '/api/world/placements',
  '/api/world/models',
  '/api/world/element-types',
  /** Fly radar — public atlas centerlines; must stay JSON (not an HTML welcome bounce). */
  '/api/fly',
  /** Discover zone detail + list — inline map preview fetches client-side. */
  '/api/experience-zones',
  /** Welcome email probe — must stay JSON for signed-out fetch(). */
  '/api/auth/email-status',
  /** Naming a held point on the open map; already gated to Minnesota server-side. */
  '/api/geo/reverse',
  /** Searching the open map; results are already bounded to Minnesota server-side. */
  '/api/geo/forward',
  /** Point-to-point routing on the open map; self-gated (localhost/admin + MN) and returns JSON 403. */
  '/api/geo/directions',
  /** Home-service category catalog — public read for the Services portal. */
  '/api/services/catalog',
];

export function isAnonymousAllowedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === '/') return true;
  if (ANON_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  /** Sharable account profiles — same public posture as `/page/:slug`. */
  return isUsernamePath(pathname);
}

export function welcomePathWithNext(pathname?: string | null): string {
  if (
    !pathname ||
    pathname === '/' ||
    pathname === LOGGED_IN_HOME_PATH ||
    pathname === WELCOME_PATH ||
    pathname === SETUP_PATH
  ) {
    return WELCOME_PATH;
  }
  return `${WELCOME_PATH}?next=${encodeURIComponent(pathname)}`;
}
