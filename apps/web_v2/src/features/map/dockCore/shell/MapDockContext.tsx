'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { MAP_DOCK_PILL_PEEK_PX } from '@/features/map/dockCore/core/mapDockTokens';
import { isDemoSelectedPointBlocked } from '@/features/setup/demoSelectedPointGate';
import {
  BROWSE_PANE,
  type DockCtuItem,
  type DockEntity,
  type DockPane,
  type DockPaneId,
} from '@/features/map/dockCore/core/dockPanes';
import { isMapToolPane } from '@/features/map/dockCore/core/mapRailActions';
import {
  clearActiveRoute,
} from '@/features/map/dockCore/store/activeRouteStore';
import {
  resetSelectedPinMode,
} from '@/map/points/selectedPinModeStore';
import { recordRecentDockEntity } from '@/features/map/dockCore/store/recentDockEntitiesStore';
import { setMapSearchQuery } from '@/features/map/dockCore/store/mapSearchStore';
import { resolveDockMode, type DockMode } from '@/features/map/dockCore/core/dockMode';
import { clearRouteGeometry } from '@/lib/geo/nearby/routeLineStore';
import { selectNearbyPlace } from '@/lib/geo/nearby/nearbyPlacesStore';
import { clearSelectedPointCoords } from '@/map/location/camera/selectedPointCoordsStore';
import { clearMapSelectSession } from '@/features/map/reset/mapClearSessions';
import type { DockCardId } from '@/features/map/dockCore/dockCard/dockCardTypes';
import type {
  ContactsSheetOpenOpts,
  ContactsSheetState,
} from '@/features/contacts/state/contactsSheetTypes';
import type { AddressCandidate } from '@/features/contacts/logic/identifyCandidates';
import type { ContactSaveSource } from '@/features/contacts/state/contactConfirmDraft';
import type { KnownSavedAddress } from '@/features/map/savedAddresses/addressCardStore';
import { selectAddressForCard } from '@/features/map/savedAddresses/addressCardStore';

/** Closed → quarter (browse peek) → half (browse/detail) → full. */
export type MapDockSnap = 'collapsed' | 'quarter' | 'half' | 'full';

export type { DockCardId, ContactsSheetOpenOpts, ContactsSheetState };
export type { DockMode };

/** Full-screen Create Post sheet (selected-point compose). */
export type CreatePostSheetState = {
  lat: number;
  lng: number;
  address: string | null;
  /**
   * Dock snap to restore when the sheet closes.
   * Details → `half` / `full` so inspect context returns.
   */
  returnSnap?: MapDockSnap;
  /** Open the in-WebView camera immediately (rail camera shortcut). */
  openCamera?: boolean;
  /**
   * Contribution category slug (e.g. 'report', 'highlight') from ContributeSheet.
   * Matches community.post_types.slug and CATEGORY_UUID key.
   */
  categorySlug?: string;
  /** Contribution subtype slug (e.g. 'roads', 'nature') — child of categorySlug. */
  subtypeSlug?: string;
  /** Placeholder override for the compose textarea. */
  composePlaceholder?: string;
  /** Experience zone the user is actively exploring — stored on the post record. */
  experienceZoneId?: string | null;
  experienceZoneName?: string | null;
  /** When set, opens in full edit mode (same compose UI as create). */
  editPostId?: string;
};

/** Place AI chat chrome morph — back-to-chats + new chat in the search pill. */
export type TerritoryAiChrome = {
  onBackToChats: () => void;
  onNewChat: () => void;
  newChatDisabled?: boolean;
} | null;

type MapDockContextValue = {
  snap: MapDockSnap;
  /**
   * Derived shell mode — hidden | peek | browse | card | overlay. Read-only;
   * always computed from snap + dockCard + overlay sheets (see dockMode.ts).
   */
  mode: DockMode;
  visiblePx: number;
  setVisiblePx: (px: number) => void;
  /**
   * Intrinsic height of selected-point entry body (below chrome).
   * When set, quarter snap wraps to header + this instead of a fixed vh.
   */
  quarterContentPx: number | null;
  setQuarterContentPx: (px: number | null) => void;
  /**
   * Desired visible height for the half detent while a dock card is open
   * (e.g. short text-only pin). Null → default half vh. Capped at default half.
   */
  halfContentPx: number | null;
  setHalfContentPx: (px: number | null) => void;
  dragging: boolean;
  setDragging: (next: boolean) => void;
  settleSnap: (next: MapDockSnap) => void;
  setSnap: (next: MapDockSnap) => void;
  collapse: () => void;
  openBrowse: () => void;
  /** Stack → browse only (no snap change). */
  resetToBrowse: () => void;
  /**
   * Set the city ambient pane as the root of the stack. Called by
   * DockCityController when GPS CTU resolves. Replaces browse at the root;
   * snaps to quarter so the city panel peeks.
   */
  openCity: (ctu: DockCtuItem) => void;

  /** Pane stack — root is always browse; push for sub-layouts. */
  stack: DockPane[];
  pane: DockPane;
  selectedEntity: DockEntity | null;

  /**
   * Push pane onto the stack. Pass `snap` to jump to that detent; omit to
   * preserve current snap (bump to at least half so the body is visible).
   */
  pushPane: (pane: DockPane, snap?: MapDockSnap) => void;
  replacePane: (pane: DockPane, snap?: MapDockSnap) => void;
  popPane: () => void;
  openSearch: () => void;
  cancelSearch: () => void;
  openControls: () => void;
  openMapStyle: () => void;
  openTools: () => void;
  openSelectedPoint: () => void;
  openYourRoute: () => void;
  /** Open the inline half-dock post composer at the selected point. */
  openPostCompose: (opts: { lat: number; lng: number; address: string | null }) => void;
  /** Opens the Today / Standing hub as a dock body pane at full height. */
  openToday: (opts?: { returnToCard?: DockCardId }) => void;
  /** When set, pressing back from the Today pane restores this dock card. */
  todayReturnToCard: DockCardId | null;
  /** Active in-dock card popover (`null` when closed). */
  dockCard: DockCardId | null;
  /** True while any dock card popover is open. */
  dockCardOpen: boolean;
  openDockCard: (id: DockCardId) => void;
  closeDockCard: () => void;
  /** Opens the account dock card. */
  openAccount: () => void;
  /** Community pin / post — wallet-style card (not dock details). */
  pinCardEntity: DockEntity | null;
  /**
   * When set, pin card shows “Back to activity” and returns to Your activity
   * (preserving {@link activityTab}).
   */
  pinReturnToActivity: boolean;
  /** When set, pin card back returns to this profile's Posts list. */
  pinReturnToProfileId: string | null;
  /** Last Your activity tab — survives pin open/close. */
  activityTab: 'pins' | 'likes' | 'comments' | 'archived';
  setActivityTab: (tab: 'pins' | 'likes' | 'comments' | 'archived') => void;
  openPinCard: (
    entity: DockEntity,
    opts?: {
      fromActivity?: boolean;
      fromProfileAccountId?: string;
      /** Force full dock when opening (e.g. profile posts list). */
      expandToFull?: boolean;
    },
  ) => void;
  /** Report the open pin — keeps pin entity so back returns to the post. */
  openReportCard: () => void;
  /** Directory page — contact-book style card (not dock details). */
  pageCardEntity: DockEntity | null;
  /**
   * When set, page card shows back chrome and returns to that dock card
   * (Page Manager / Directory pages list).
   */
  pageReturnToCard: Extract<DockCardId, 'page-manager' | 'directory-pages'> | null;
  openPageCard: (
    entity: DockEntity,
    opts?: { fromCard?: Extract<DockCardId, 'page-manager' | 'directory-pages'> },
  ) => void;
  /** Public profile card target — the account id whose profile is showing. */
  profileCardTarget: string | null;
  /** When true, open the profile card already in edit mode (self only). */
  profileCardStartInEdit: boolean;
  /** Initial profile sub-view after open (e.g. resume Followers after navigation). */
  profileCardStartView: 'profile' | 'followers' | 'following';
  openProfileCard: (
    accountId: string,
    opts?: {
      edit?: boolean;
      view?: 'profile' | 'followers' | 'following';
    },
  ) => void;
  /** What's nearby listing — place data lives in `nearbyPlacesStore` selection. */
  openNearbyPlaceCard: () => void;
  /** Address lookup result — opens the address dock card and seeds the store. */
  openAddressCard: (
    candidate: AddressCandidate,
    source: ContactSaveSource,
    knownSaved?: KnownSavedAddress | null,
  ) => void;
  openDetails: (entity: DockEntity) => void;
  openSubpage: (opts: {
    title: string;
    subtitle?: string;
    kind: string;
    slug?: string;
    query?: string;
  }) => void;
  selectEntity: (entity: DockEntity | null) => void;
  /**
   * Clear map-driven selection (details / pin / page / nearby card + territory paint).
   * Does not clear selected-point coords or tool panes — used by map click Path A/B.
   */
  clearMapSelection: () => void;
  back: () => void;
  canGoBack: boolean;

  territoryAiChrome: TerritoryAiChrome;
  setTerritoryAiChrome: (next: TerritoryAiChrome) => void;

  /** Full-viewport Contacts sheet (people / addresses). */
  contactsSheet: ContactsSheetState | null;
  openContactsSheet: (opts?: ContactsSheetOpenOpts) => void;
  closeContactsSheet: (opts?: { reopenLists?: boolean }) => void;

  /** Full-viewport Create Post sheet (post → pin at selected point). */
  createPostSheet: CreatePostSheetState | null;
  openCreatePostSheet: (opts: CreatePostSheetState) => void;
  closeCreatePostSheet: () => void;
};

const MapDockContext = createContext<MapDockContextValue | null>(null);

/**
 * Dock chrome state — snap physics + typed pane stack + card/sheet
 * navigation. No map/auth/network services; panes are layout frameworks
 * only.
 *
 * Product flags that don't need to live in this bus have their own homes:
 * search query → `mapSearchStore`; boundary/dataset state → `useTerritoryLayers`;
 * location/compass → `useFindMe`; around-me → `territoriesAroundMeStore`.
 * What's left here — snap, pane stack, dock cards, pin/page/profile cards,
 * contacts/create-post sheets — is genuinely one navigation state machine
 * (each action clears/adjusts the others), so it stays one context rather
 * than being split into pieces that would just have to re-sync with each
 * other.
 */
export function MapDockProvider({
  children,
  initialSnap = 'collapsed',
}: {
  children: ReactNode;
  /**
   * Starting detent. Game stays collapsed until city auto-open / map tap.
   * World surfaces (`/story`, `/campaign`) start at quarter so the pill is visible.
   */
  initialSnap?: MapDockSnap;
}) {
  const [snap, setSnapState] = useState<MapDockSnap>(initialSnap);
  const [visiblePx, setVisiblePx] = useState(MAP_DOCK_PILL_PEEK_PX);
  const [quarterContentPx, setQuarterContentPx] = useState<number | null>(null);
  const [halfContentPx, setHalfContentPx] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [stack, setStack] = useState<DockPane[]>([BROWSE_PANE]);
  const [selectedEntity, setSelectedEntity] = useState<DockEntity | null>(null);
  const [territoryAiChrome, setTerritoryAiChrome] = useState<TerritoryAiChrome>(null);
  const [dockCard, setDockCard] = useState<DockCardId | null>(null);
  const dockCardOpen = dockCard != null;
  const [pinCardEntity, setPinCardEntity] = useState<DockEntity | null>(null);
  const [pinReturnToActivity, setPinReturnToActivity] = useState(false);
  const [pinReturnToProfileId, setPinReturnToProfileId] = useState<string | null>(null);
  const [activityTab, setActivityTab] = useState<
    'pins' | 'likes' | 'comments' | 'archived'
  >('pins');
  const [pageCardEntity, setPageCardEntity] = useState<DockEntity | null>(null);
  const [pageReturnToCard, setPageReturnToCard] = useState<
    Extract<DockCardId, 'page-manager' | 'directory-pages'> | null
  >(null);
  const [profileCardTarget, setProfileCardTarget] = useState<string | null>(null);
  const [profileCardStartInEdit, setProfileCardStartInEdit] = useState(false);
  const [profileCardStartView, setProfileCardStartView] = useState<
    'profile' | 'followers' | 'following'
  >('profile');
  const [todayReturnToCard, setTodayReturnToCard] = useState<DockCardId | null>(null);
  const [contactsSheet, setContactsSheet] = useState<ContactsSheetState | null>(null);
  const [createPostSheet, setCreatePostSheet] = useState<CreatePostSheetState | null>(null);

  const pane = stack[stack.length - 1] ?? BROWSE_PANE;
  const canGoBack = stack.length > 1 || pane.id === 'search';
  const mode = resolveDockMode({
    snap,
    dockCardOpen,
    contactsSheetOpen: contactsSheet != null,
    createPostSheetOpen: createPostSheet != null,
  });

  const setSnap = useCallback((next: MapDockSnap) => setSnapState(next), []);

  const resetToBrowse = useCallback(() => {
    setStack([BROWSE_PANE]);
    setMapSearchQuery('');
    setSelectedEntity(null);
  }, []);

  /** Default open snap for idle browse — game always peeks at quarter. */
  const browseOpenSnap = useCallback((): MapDockSnap => 'quarter', []);

  const settleSnap = useCallback(
    (next: MapDockSnap) => {
      // Leaving search (drag/wheel settle below full) → idle browse.
      if (next !== 'full' && pane.id === 'search') {
        resetToBrowse();
        setSnapState(next === 'collapsed' ? 'collapsed' : browseOpenSnap());
        return;
      }
      // Idle browse: game caps at quarter (never half, never full).
      if (pane.id === 'browse' && !dockCardOpen) {
        if (next === 'full' || next === 'half') {
          setSnapState(browseOpenSnap());
          return;
        }
      }
      setSnapState(next);
    },
    [dockCardOpen, pane.id, resetToBrowse, browseOpenSnap],
  );

  const collapse = useCallback(() => setSnapState('collapsed'), []);

  const openBrowse = useCallback(() => {
    resetToBrowse();
    setSnapState(browseOpenSnap());
  }, [resetToBrowse, browseOpenSnap]);

  const openCity = useCallback((ctu: DockCtuItem) => {
    setStack((prev) => {
      const root = prev[0];
      // Already city for this CTU — keep rest of the stack, just refresh root.
      if (root?.id === 'city' && root.ctu.id === ctu.id) return prev;
      // Replace root (browse or stale city) with new city pane, preserve sub-panes.
      const rest = prev.slice(1);
      return [{ id: 'city', ctu }, ...rest];
    });
    setSnapState('quarter');
  }, []);

  const pushPane = useCallback((next: DockPane, nextSnap?: MapDockSnap) => {
    setStack((prev) => [...prev, next]);
    if (nextSnap !== undefined) {
      setSnapState(nextSnap);
    } else {
      // No explicit snap: preserve current height, bump to at least half so the body is visible.
      setSnapState((prev) => (prev === 'collapsed' || prev === 'quarter' ? 'half' : prev));
    }
  }, []);

  const replacePane = useCallback((next: DockPane, nextSnap?: MapDockSnap) => {
    setStack((prev) => {
      if (prev.length <= 1) return [BROWSE_PANE, next];
      return [...prev.slice(0, -1), next];
    });
    if (nextSnap) setSnapState(nextSnap);
  }, []);

  const popPane = useCallback(() => {
    setStack((prev) => {
      if (prev.length <= 1) return [BROWSE_PANE];
      const next = prev.slice(0, -1);
      return next.length ? next : [BROWSE_PANE];
    });
  }, []);

  const openSearch = useCallback(() => {
    setStack([BROWSE_PANE, { id: 'search' }]);
    setSnapState('full');
  }, []);

  const cancelSearch = useCallback(() => {
    resetToBrowse();
    setSnapState('quarter');
  }, [resetToBrowse]);

  const openDockCard = useCallback((rawId: DockCardId) => {
    const id = rawId;

    // Report is a child of pin — keep pin entity + return flags so back restores the post.
    if (id !== 'pin' && id !== 'report') {
      setPinCardEntity(null);
      setPinReturnToActivity(false);
      setPinReturnToProfileId(null);
      setHalfContentPx(null);
    }
    if (id !== 'page') {
      setPageCardEntity(null);
      setPageReturnToCard(null);
    }
    if (id !== 'profile') {
      setProfileCardTarget(null);
      setProfileCardStartInEdit(false);
      setProfileCardStartView('profile');
    }
    if (id !== 'nearby-place') selectNearbyPlace(null);
    setDockCard(id);
    // Every dock card popover opens to at least half — swipe below half closes it
    // (no tap-to-close chrome; see MapDockShell + DockCardPopover).
    setSnapState((prev) => (prev === 'collapsed' || prev === 'quarter' ? 'half' : prev));
  }, []);

  const closeDockCard = useCallback(() => {
    setDockCard(null);
    setHalfContentPx(null);
    setPinCardEntity(null);
    setPinReturnToActivity(false);
    setPinReturnToProfileId(null);
    setPageCardEntity(null);
    setPageReturnToCard(null);
    setProfileCardTarget(null);
    setProfileCardStartInEdit(false);
    setProfileCardStartView('profile');
    setTodayReturnToCard(null);
    selectNearbyPlace(null);
  }, []);

  const openNearbyPlaceCard = useCallback(() => {
    openDockCard('nearby-place');
  }, [openDockCard]);

  const openAddressCard = useCallback(
    (
      candidate: AddressCandidate,
      source: ContactSaveSource,
      knownSaved?: KnownSavedAddress | null,
    ) => {
      // Set selection after open so openDockCard’s non-address clear can’t wipe it.
      openDockCard('address');
      selectAddressForCard(candidate, source, knownSaved);
    },
    [openDockCard],
  );

  const openProfileCard = useCallback(
    (
      accountId: string,
      opts?: {
        edit?: boolean;
        view?: 'profile' | 'followers' | 'following';
      },
    ) => {
      setProfileCardTarget(accountId);
      setProfileCardStartInEdit(Boolean(opts?.edit));
      setProfileCardStartView(opts?.view ?? 'profile');
      setPinReturnToProfileId(null);
      setDockCard('profile');
      setSnapState((prev) => (prev === 'collapsed' || prev === 'quarter' ? 'half' : prev));
    },
    [],
  );

  const openPinCard = useCallback(
    (
      entity: DockEntity,
      opts?: {
        fromActivity?: boolean;
        fromProfileAccountId?: string;
        expandToFull?: boolean;
      },
    ) => {
      clearSelectedPointCoords();
      setPageCardEntity(null);
      setPageReturnToCard(null);
      setProfileCardTarget(null);
      setProfileCardStartInEdit(false);
      setProfileCardStartView('profile');
      setPinCardEntity(entity);
      setPinReturnToActivity(Boolean(opts?.fromActivity));
      setPinReturnToProfileId(opts?.fromProfileAccountId?.trim() || null);
      setSelectedEntity(entity);
      setStack((prev) => prev.filter((p) => p.id !== 'selected-point'));
      setDockCard('pin');
      if (opts?.expandToFull) {
        setSnapState('full');
      } else {
        // Pin card opens to at least half — swipe below half is required to close it.
        setSnapState((prev) => (prev === 'collapsed' || prev === 'quarter' ? 'half' : prev));
      }
    },
    [],
  );

  const openReportCard = useCallback(() => {
    if (!pinCardEntity) return;
    setHalfContentPx(null);
    setDockCard('report');
    setSnapState((prev) => (prev === 'collapsed' || prev === 'quarter' ? 'half' : prev));
  }, [pinCardEntity]);

  const openPageCard = useCallback(
    (
      entity: DockEntity,
      opts?: { fromCard?: Extract<DockCardId, 'page-manager' | 'directory-pages'> },
    ) => {
      clearSelectedPointCoords();
      setPinCardEntity(null);
      setPinReturnToActivity(false);
      setPinReturnToProfileId(null);
      setProfileCardTarget(null);
      setProfileCardStartInEdit(false);
      setProfileCardStartView('profile');
      setPageCardEntity(entity);
      setPageReturnToCard(opts?.fromCard ?? null);
      setSelectedEntity(entity);
      setStack((prev) => prev.filter((p) => p.id !== 'selected-point' && p.id !== 'details'));
      setDockCard('page');
      setSnapState((prev) => (prev === 'collapsed' || prev === 'quarter' ? 'half' : prev));
    },
    [],
  );

  const openControls = useCallback(() => {
    openDockCard('controls');
  }, [openDockCard]);

  const openMapStyle = useCallback(() => {
    openDockCard('map-style');
  }, [openDockCard]);

  const openTools = useCallback(() => {
    setStack((prev) => {
      const top = prev[prev.length - 1];
      const next: DockPane = { id: 'tools' };
      if (top && isMapToolPane(top.id)) {
        return [...prev.slice(0, -1), next];
      }
      return [...prev, next];
    });
    setSnapState('half');
  }, []);

  const openSelectedPoint = useCallback(() => {
    // During the /setup demo, block map taps from opening the dock until the
    // select_point step activates. DemoInteractionBridge manages this gate.
    if (isDemoSelectedPointBlocked()) return;
    setDockCard(null);
    setPinCardEntity(null);
    setPinReturnToActivity(false);
    setPinReturnToProfileId(null);
    setPageCardEntity(null);
    setPageReturnToCard(null);
    setProfileCardTarget(null);
    setProfileCardStartInEdit(false);
    setProfileCardStartView('profile');
    setStack((prev) => {
      const top = prev[prev.length - 1];
      const next: DockPane = { id: 'selected-point' };
      if (top?.id === 'selected-point') return prev;
      if (top && isMapToolPane(top.id)) {
        return [...prev.slice(0, -1), next];
      }
      // Replace search with selected point so place pick doesn't stack under search.
      if (top?.id === 'search') {
        return [...prev.slice(0, -1), next];
      }
      return [...prev, next];
    });
    setSnapState('quarter');
  }, []);

  const openYourRoute = useCallback(() => {
    setStack((prev) => {
      const top = prev[prev.length - 1];
      const next: DockPane = { id: 'your-route' };
      if (top?.id === 'your-route') return prev;
      if (top && isMapToolPane(top.id)) {
        return [...prev.slice(0, -1), next];
      }
      return [...prev, next];
    });
    setSnapState('half');
  }, []);

  const openToday = useCallback((opts?: { returnToCard?: DockCardId }) => {
    setStack([BROWSE_PANE, { id: 'today' }]);
    setTodayReturnToCard(opts?.returnToCard ?? null);
    setSnapState('full');
  }, []);

  const openPostCompose = useCallback(
    (opts: { lat: number; lng: number; address: string | null }) => {
      setDockCard(null);
      setStack((prev) => {
        const top = prev[prev.length - 1];
        const next = { id: 'post-compose' as const, ...opts };
        // Replace selected-point so back from compose returns cleanly.
        if (top?.id === 'selected-point') {
          return [...prev.slice(0, -1), next];
        }
        return [...prev, next];
      });
      setSnapState('half');
    },
    [],
  );

  const openAccount = useCallback(() => {
    setDockCard(null);
    setStack([BROWSE_PANE, { id: 'account' }]);
    setSnapState('full');
  }, []);

  const openDetails = useCallback(
    (entity: DockEntity) => {
      // Community posts open as cards for everyone.
      if (entity.kind === 'pin') {
        openPinCard(entity);
        return;
      }
      if (entity.kind === 'page') {
        openPageCard(entity);
        return;
      }
      recordRecentDockEntity(entity);
      setSelectedEntity(entity);
      setStack((prev) => {
        const top = prev[prev.length - 1];
        // Replace in-place when already on details so county→county doesn't stack / flash.
        if (top?.id === 'details') {
          return [...prev.slice(0, -1), { id: 'details', entity }];
        }
        return [...prev, { id: 'details', entity }];
      });
      setSnapState('half');
    },
    [openPinCard, openPageCard],
  );

  const openSubpage = useCallback(
    (opts: {
      title: string;
      subtitle?: string;
      kind: string;
      slug?: string;
      query?: string;
    }) => {
      // No explicit snap — pushPane preserves current height (bumps to half if collapsed/quarter).
      pushPane({ id: 'subpage', ...opts });
    },
    [pushPane],
  );

  const openContactsSheet = useCallback((opts?: ContactsSheetOpenOpts) => {
    setDockCard(null);
    setContactsSheet({
      kind: opts?.kind ?? 'people',
      query: opts?.query?.trim() ?? '',
      tag: opts?.tag?.trim() || null,
    });
    setSnapState('collapsed');
  }, []);

  const closeContactsSheet = useCallback((opts?: { reopenLists?: boolean }) => {
    setContactsSheet(null);
    if (opts?.reopenLists) {
      setDockCard('contacts');
      setSnapState((prev) => (prev === 'collapsed' ? 'half' : prev));
    }
  }, []);

  const openCreatePostSheet = useCallback((opts: CreatePostSheetState) => {
    setDockCard(null);
    setCreatePostSheet({
      lat: opts.lat,
      lng: opts.lng,
      address: opts.address?.trim() || null,
      returnSnap: opts.returnSnap ?? 'half',
      openCamera: opts.openCamera === true,
    });
    setSnapState('collapsed');
  }, []);

  const closeCreatePostSheet = useCallback(() => {
    setCreatePostSheet((prev) => {
      const nextSnap = prev?.returnSnap ?? 'half';
      // Restore after clearing so the sheet unmounts first, then dock rises.
      queueMicrotask(() => setSnapState(nextSnap));
      return null;
    });
  }, []);

  const selectEntity = useCallback((entity: DockEntity | null) => {
    setSelectedEntity(entity);
  }, []);

  /**
   * Map click clear-select — drops details/pin/page/nearby selection + territory paint.
   * Leaves selected-point coords and non-map cards alone.
   */
  const clearMapSelection = useCallback(() => {
    setSelectedEntity(null);
    setStack((prev) => {
      const next = prev.filter((p) => p.id !== 'details');
      return next.length > 0 ? next : [BROWSE_PANE];
    });
    setDockCard((prev) => {
      if (
        prev === 'pin' ||
        prev === 'page' ||
        prev === 'nearby-place' ||
        prev === 'report'
      ) {
        return null;
      }
      return prev;
    });
    setPinCardEntity(null);
    setPinReturnToActivity(false);
    setPinReturnToProfileId(null);
    setPageCardEntity(null);
    setPageReturnToCard(null);
    setHalfContentPx(null);
    selectNearbyPlace(null);
    clearMapSelectSession();
  }, []);

  const back = useCallback(() => {
    if (pane.id === 'search') {
      cancelSearch();
      return;
    }
    if (pane.id === 'your-route') {
      clearRouteGeometry();
      clearActiveRoute();
    }
    // Post compose: back = cancel → restore red pin, return to selected-point.
    if (pane.id === 'post-compose') {
      resetSelectedPinMode();
      openSelectedPoint();
      return;
    }
    // Selected point: full → half (details) → leave + clear marker.
    // Must run before map-tool shortcut (selected-point is also a tool pane id).
    if (pane.id === 'selected-point') {
      if (snap === 'full') {
        setSnapState('half');
        return;
      }
      if (snap === 'half' || snap === 'quarter') {
        clearSelectedPointCoords();
        if (stack.length > 1) {
          popPane();
          setSnapState('collapsed');
        } else {
          resetToBrowse();
          setSnapState('collapsed');
        }
        return;
      }
    }
    // Today pane: back returns to the originating dock card when set.
    if (pane.id === 'today' && todayReturnToCard) {
      const returnCard = todayReturnToCard;
      setTodayReturnToCard(null);
      resetToBrowse();
      setDockCard(returnCard);
      setSnapState((prev) => (prev === 'collapsed' || prev === 'quarter' ? 'half' : prev));
      return;
    }
    // Map tools return straight to Explore — keeps rail ↔ dock mental model clean.
    if (isMapToolPane(pane.id)) {
      resetToBrowse();
      setSnapState('quarter');
      return;
    }
    if (pane.id === 'details') {
      setSelectedEntity(null);
    }
    if (stack.length > 1) {
      const nextPane = stack[stack.length - 2] ?? BROWSE_PANE;
      popPane();
      setSnapState(nextPane.id === 'browse' || nextPane.id === 'city' ? 'quarter' : 'half');
      return;
    }
    if (snap === 'full') {
      setSnapState(pane.id === 'browse' ? 'quarter' : 'half');
      return;
    }
    if (snap === 'half' || snap === 'quarter') {
      setSnapState('collapsed');
    }
  }, [cancelSearch, openSelectedPoint, pane.id, popPane, resetToBrowse, snap, stack, todayReturnToCard]);

  const value = useMemo<MapDockContextValue>(
    () => ({
      snap,
      mode,
      visiblePx,
      setVisiblePx,
      quarterContentPx,
      setQuarterContentPx,
      halfContentPx,
      setHalfContentPx,
      dragging,
      setDragging,
      settleSnap,
      setSnap,
      collapse,
      openBrowse,
      resetToBrowse,
      openCity,
      stack,
      pane,
      selectedEntity,
      pushPane,
      replacePane,
      popPane,
      openSearch,
      cancelSearch,
      openControls,
      openMapStyle,
      openTools,
      openSelectedPoint,
      openYourRoute,
      openToday,
      openPostCompose,
      dockCard,
      dockCardOpen,
      openDockCard,
      closeDockCard,
      openAccount,
      pinCardEntity,
      pinReturnToActivity,
      pinReturnToProfileId,
      activityTab,
      setActivityTab,
      openPinCard,
      openReportCard,
      pageCardEntity,
      pageReturnToCard,
      openPageCard,
      profileCardTarget,
      profileCardStartInEdit,
      profileCardStartView,
      openProfileCard,
      openNearbyPlaceCard,
      openAddressCard,
      openDetails,
      openSubpage,
      selectEntity,
      clearMapSelection,
      back,
      canGoBack,
      todayReturnToCard,
      territoryAiChrome,
      setTerritoryAiChrome,
      contactsSheet,
      openContactsSheet,
      closeContactsSheet,
      createPostSheet,
      openCreatePostSheet,
      closeCreatePostSheet,
    }),
    [
      snap,
      mode,
      visiblePx,
      quarterContentPx,
      halfContentPx,
      dragging,
      settleSnap,
      setSnap,
      collapse,
      openBrowse,
      resetToBrowse,
      openCity,
      stack,
      pane,
      selectedEntity,
      pushPane,
      replacePane,
      popPane,
      openSearch,
      cancelSearch,
      openControls,
      openMapStyle,
      openTools,
      openSelectedPoint,
      openYourRoute,
      openToday,
      openPostCompose,
      dockCard,
      dockCardOpen,
      openDockCard,
      closeDockCard,
      openAccount,
      pinCardEntity,
      pinReturnToActivity,
      pinReturnToProfileId,
      activityTab,
      setActivityTab,
      openPinCard,
      openReportCard,
      pageCardEntity,
      pageReturnToCard,
      openPageCard,
      profileCardTarget,
      profileCardStartInEdit,
      profileCardStartView,
      openProfileCard,
      openNearbyPlaceCard,
      openAddressCard,
      openDetails,
      openSubpage,
      selectEntity,
      clearMapSelection,
      back,
      canGoBack,
      todayReturnToCard,
      territoryAiChrome,
      contactsSheet,
      openContactsSheet,
      closeContactsSheet,
      createPostSheet,
      openCreatePostSheet,
      closeCreatePostSheet,
    ],
  );

  return (
    <MapDockContext.Provider value={value}>{children}</MapDockContext.Provider>
  );
}

export function useMapDock(): MapDockContextValue {
  const ctx = useContext(MapDockContext);
  if (!ctx) throw new Error('useMapDock must be used within MapDockProvider');
  return ctx;
}

export function useDockPaneId(): DockPaneId {
  return useMapDock().pane.id;
}
