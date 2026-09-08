'use client';

/**
 * GameMapControllers — single component housing all null-render side-effect
 * controllers for the game surface.
 *
 * Consolidating these here halves React's reconciliation work vs. mounting 6
 * separate components, and makes the GameDockInner tree a clear separation of
 * "controllers" (here) vs. "UI renderers" (siblings).
 *
 * Controllers included:
 *   FindMeAvatarTapBridge    — wires avatar tap → openAccount dock action
 *   CtuFocusCountySync       — sticky county focus for city/town overlays
 *   ExperienceZoneVenueSync  — venue zone enter/exit side effects
 *   MapToolDeepLinkHandler   — ?tool= / ?q= / ?layers= deep-link consumption
 *   DockCityAutoOpen         — Live-only: opens/clears "Where you are" city pane
 */

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMapContext } from '@/map/MapProvider';
import { setFindMeAvatarTapHandler } from '@/map/points';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { useTerritoryLayers } from '@/features/map/territory';
import { useCurrentExperienceZone } from '@/features/experienceZones/store/currentExperienceZoneStore';
import { setVenueZone } from '@/features/experienceZones/store/venueModeStore';
import { triggerWorldRefresh } from '@/features/map/game/world/worldRefreshSignal';
import { haptic } from '@/lib/despia/haptics';
import { objectRadarActions } from '@/features/map/game/objectRadar/objectRadarStore';
import { useCurrentTerritoryStack } from '@/features/accountTerritories/store/currentTerritoryStackStore';
import { useCtuZoomFloor } from '@/features/map/territory/useCtuZoomFloor';
import { useDemoMapChrome } from '@/features/setup/DemoMapChromeContext';
import { getContactBookTool, isContactBookToolKind } from '@/features/tools/core/contactBookTools';
import { getTerritoryLayer, type TerritorySlug } from '@/features/map/territory';
import { setMapSearchQuery } from '@/features/map/dockCore/store/mapSearchStore';
import { GAME_PATH } from '@/lib/routes/routePolicy';
import { usePresence } from '@/map/location/positionMode/usePositionMode';

/** Suspense boundary required — inner uses useSearchParams (CSR bailout). */
export function GameMapControllers() {
  return (
    <Suspense fallback={null}>
      <GameMapControllersInner />
    </Suspense>
  );
}

function GameMapControllersInner() {
  // ── Map context ───────────────────────────────────────────────────────────────
  const { map: _map, ready: _ready } = useMapContext();

  // ── CTU zoom floor — locks minZoom to the user's city/town boundary ──────────
  useCtuZoomFloor(_map, _ready);

  // ── Avatar tap → openAccount ─────────────────────────────────────────────────
  const {
    openAccount,
    selectedEntity,
    openCity,
    resetToBrowse,
    stack: dockStack,
    openSubpage,
    openContactsSheet,
    openSearch,
  } = useMapDock();
  useEffect(() => {
    setFindMeAvatarTapHandler(openAccount);
    return () => setFindMeAvatarTapHandler(null);
  }, [openAccount]);

  // ── CTU focus — sticky county for city/town overlays ─────────────────────────
  const { setCtuFocusCounty, ensureActive, setUnlockedOnly } = useTerritoryLayers();
  useEffect(() => {
    if (selectedEntity?.kind === 'county') {
      setCtuFocusCounty(selectedEntity.id);
    }
  }, [selectedEntity, setCtuFocusCounty]);

  // ── Experience zone venue enter/exit ─────────────────────────────────────────
  const { primaryZone, subZone } = useCurrentExperienceZone();
  const lastZoneIdRef = useRef<string | null>(null);
  useEffect(() => {
    const zoneId = primaryZone?.id ?? null;
    const prev = lastZoneIdRef.current;
    setVenueZone({
      zoneId,
      zoneSlug: primaryZone?.slug ?? null,
      zoneName: primaryZone?.name ?? null,
      subZoneId: subZone?.id ?? null,
      subZoneName: subZone?.name ?? null,
    });
    if (zoneId && zoneId !== prev) {
      haptic.findMe.success();
    } else if (!zoneId && prev) {
      objectRadarActions.closeSheet();
      triggerWorldRefresh();
    }
    lastZoneIdRef.current = zoneId;
  }, [
    primaryZone?.id,
    primaryZone?.slug,
    primaryZone?.name,
    subZone?.id,
    subZone?.name,
  ]);

  // ── Deep-link handler (?tool= / ?q= / ?layers=) ───────────────────────────────
  const router = useRouter();
  const searchParams = useSearchParams();
  const consumedRef = useRef<string | null>(null);
  useEffect(() => {
    const tool = searchParams.get('tool');
    const query = searchParams.get('q');
    const layersParam = searchParams.get('layers');
    const unlocked = typeof window !== 'undefined' && window.location.hash === '#unlocked';
    const key = tool
      ? `tool:${tool}`
      : query
        ? `q:${query}`
        : layersParam || unlocked
          ? `layers:${layersParam ?? ''}:${unlocked}`
          : null;
    if (!key || consumedRef.current === key) return;
    consumedRef.current = key;

    if (tool === 'saved') {
      openContactsSheet({ kind: 'people' });
    } else if (tool && isContactBookToolKind(tool)) {
      const def = getContactBookTool(tool);
      if (def) openSubpage({ title: def.title, subtitle: def.subtitle, kind: def.kind });
    } else if (query) {
      setMapSearchQuery(query);
      openSearch();
    }

    if (layersParam || unlocked) {
      setUnlockedOnly(unlocked);
      const slugs = layersParam ? layersParam.split(',') : [];
      for (const raw of slugs) {
        const slug = raw.trim();
        if (slug && getTerritoryLayer(slug)) void ensureActive(slug as TerritorySlug);
      }
    }

    router.replace(GAME_PATH);
  }, [
    searchParams,
    openSubpage,
    openContactsSheet,
    openSearch,
    ensureActive,
    setUnlockedOnly,
    router,
  ]);

  // ── City pane ("Where you are") — Live / GPS only ────────────────────────────
  const demo = useDemoMapChrome();
  const stack = useCurrentTerritoryStack();
  const { mode: presenceMode } = usePresence();
  const isLive = presenceMode === 'live';
  const lastOpenedCtuId = useRef<string | null>(null);

  // Scout (or location off) → drop ambient city pane. Live → re-open when CTU resolves.
  useEffect(() => {
    if (demo !== null) return;

    if (!isLive) {
      lastOpenedCtuId.current = null;
      // Only clear when city is the idle root (don't nuke an active nav stack).
      if (dockStack.length === 1 && dockStack[0]?.id === 'city') {
        resetToBrowse();
      }
      return;
    }

    if (!stack.ready) return;
    const ctu = stack.jurisdictions.find((j) => j.kind === 'ctu');
    if (!ctu) return;
    if (lastOpenedCtuId.current === ctu.id) return;
    const rootPane = dockStack[0];
    const isRootReplaceable =
      rootPane?.id === 'browse' ||
      (rootPane?.id === 'city' && rootPane.ctu.id !== ctu.id);
    if (!isRootReplaceable) return;
    lastOpenedCtuId.current = ctu.id;
    openCity({
      id: ctu.id,
      name: ctu.name,
      slug: ctu.slug,
      kindLabel: ctu.kindLabel,
      subtitle: ctu.subtitle,
      ctu_class: ctu.ctu_class,
    });
  }, [
    isLive,
    stack.ready,
    stack.jurisdictions,
    demo,
    openCity,
    resetToBrowse,
    dockStack,
  ]);

  return null;
}
