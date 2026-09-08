/**
 * Typed dock body panes — improved vs ios v1's scattered browseSection flags.
 * These are in-dock layout components, not Next.js routes.
 */

export type DockPaneId =
  | 'browse'
  | 'city'
  | 'search'
  | 'map-style'
  | 'tools'
  | 'details'
  | 'account'
  | 'subpage'
  | 'selected-point'
  | 'your-route'
  | 'today'
  | 'post-compose';

/** Map / directory entity shown in dock details and selection. */
export type DockEntity = {
  id: string;
  kind:
    | 'county'
    | 'ctu'
    | 'school_district'
    | 'school'
    | 'district'
    | 'district_part'
    | 'senate_district'
    | 'house_district'
    | 'zipcode'
    | 'pin'
    | 'page'
    /** Live game atlas overlay feature (park, school campus, lake, …). */
    | 'atlas';
  title: string;
  subtitle?: string;
  summary?: string;
  /** Eyebrow label in details (e.g. City / Township). Falls back to `kind`. */
  kindLabel?: string;
  /** Account avatar for community pins. */
  imageUrl?: string | null;
};

/**
 * Minimal CTU record carried in the city ambient pane.
 * Kept local to avoid a circular import with territoryAtPointTypes (which
 * references DockEntity). Compatible with TerritoryAtPointItem at kind='ctu'.
 */
export type DockCtuItem = {
  id: string;
  name: string;
  slug: string | null;
  kindLabel: string;
  subtitle?: string | null;
  ctu_class?: string | null;
};

export type DockPane =
  | { id: 'browse' }
  | { id: 'city'; ctu: DockCtuItem }
  | { id: 'search' }
  | { id: 'map-style' }
  | { id: 'tools' }
  | { id: 'details'; entity: DockEntity }
  | { id: 'account' }
  | { id: 'subpage'; title: string; subtitle?: string; kind: string; slug?: string; query?: string }
  | { id: 'selected-point' }
  | { id: 'your-route' }
  | { id: 'today' }
  | { id: 'post-compose'; lat: number; lng: number; address: string | null };

export const BROWSE_PANE: DockPane = { id: 'browse' };

export type DockPaneIconId =
  | 'layers'
  | 'locate'
  | 'map-style'
  | 'search'
  | 'tools'
  | 'account'
  | 'details'
  | 'ai'
  | 'none';

export function paneTitle(pane: DockPane): string {
  switch (pane.id) {
    case 'browse':
      return 'Explore';
    case 'city':
      return pane.ctu.name;
    case 'search':
      return 'Search';
    case 'map-style':
      return 'Map style';
    case 'tools':
      return 'Tools';
    case 'details':
      return pane.entity.title;
    case 'account':
      return 'Account';
    case 'subpage':
      return pane.title;
    case 'selected-point':
      return 'Selected point';
    case 'your-route':
      return 'Your route';
    case 'today':
      return 'Today';
    case 'post-compose':
      return 'New post';
  }
}

/** Icon key for title chrome — rendered by MapDockPill. */
export function paneIconId(pane: DockPane): DockPaneIconId {
  switch (pane.id) {
    case 'map-style':
      return 'map-style';
    case 'selected-point':
      return 'locate';
    case 'post-compose':
      return 'locate';
    case 'your-route':
      return 'locate';
    case 'tools':
      return 'tools';
    case 'search':
      return 'search';
    case 'account':
      return 'account';
    case 'details':
      return 'details';
    case 'subpage':
      return pane.kind === 'territory-ai' ? 'ai' : 'details';
    default:
      return 'none';
  }
}

/** Title text optically centered between back + trailing chrome (AI chat). */
export function paneCentersTitleChrome(pane: DockPane): boolean {
  return pane.id === 'subpage' && pane.kind === 'territory-ai';
}

/** Human-readable kind for details chrome / eyebrows. */
export function entityKindLabel(entity: DockEntity): string {
  if (entity.kindLabel?.trim()) return entity.kindLabel.trim();
  switch (entity.kind) {
    case 'senate_district':
      return 'Senate district';
    case 'house_district':
      return 'House district';
    case 'district':
      return 'Congressional district';
    case 'school_district':
      return 'School district';
    case 'district_part':
      return 'Precinct';
    case 'pin':
      return 'Pin';
    case 'page':
      return 'Page';
    case 'atlas':
      return 'Atlas';
    default:
      return entity.kind.replace(/_/g, ' ');
  }
}

export function paneSubtitle(pane: DockPane): string | null {
  switch (pane.id) {
    case 'city':
      return pane.ctu.ctu_class
        ? pane.ctu.ctu_class.charAt(0).toUpperCase() + pane.ctu.ctu_class.slice(1).toLowerCase()
        : (pane.ctu.kindLabel ?? 'City / township');
    case 'details':
      return pane.entity.subtitle ?? entityKindLabel(pane.entity);
    case 'account':
      return 'Profile';
    case 'subpage':
      return pane.subtitle ?? null;
    case 'map-style':
      return 'Streets, outdoors, satellite';
    case 'tools':
      return 'People, addresses & credits';
    case 'selected-point':
      return 'Map location';
    case 'post-compose':
      return pane.address ?? 'Map location';
    case 'your-route':
      return 'Directions';
    case 'today':
      return 'Standing';
    default:
      return null;
  }
}

/**
 * Panes that replace the search field with a title chrome row.
 * City pane keeps the search field (contextual search within the city).
 */
export function paneUsesTitleChrome(pane: DockPane): boolean {
  return pane.id !== 'browse' && pane.id !== 'search' && pane.id !== 'city';
}

/**
 * Stable identity for "this is different content, scroll to top" — not just
 * pane id, since e.g. county→county or subpage→subpage swap content in place
 * without the pane id changing. Used to reset the shared dock body scroll
 * position on navigation (see MapDockShell).
 */
export function dockPaneScrollKey(pane: DockPane): string {
  switch (pane.id) {
    case 'city':
      return `city:${pane.ctu.id}`;
    case 'details':
      return `details:${pane.entity.id}`;
    case 'subpage':
      return `subpage:${pane.kind}:${pane.slug ?? ''}:${pane.query ?? ''}`;
    default:
      return pane.id;
  }
}

/**
 * At full snap, body owns identity (hero / record header) — hide redundant title + avatar.
 * Territory `details` always uses centered type + name + more chrome (any snap).
 * Map tools keep chrome so orientation stays clear while the map is covered.
 */
export function paneHidesTitleAtFull(pane: DockPane): boolean {
  if (pane.id === 'account') return true;
  if (pane.id !== 'subpage') return false;
  return (
    pane.kind === 'contact-detail' ||
    pane.kind === 'contact-confirm' ||
    pane.kind === 'contact-enrichment' ||
    pane.kind === 'tool-result'
  );
}
