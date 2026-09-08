'use client';

/**
 * DockCityController — ambient city pane lifecycle manager.
 *
 * Live (location on) only. Watches currentTerritoryStackStore for a resolved
 * CTU and calls openCity() when:
 *   1. A CTU first resolves (dock root is browse → replace with city).
 *   2. The user moves to a new CTU (city pane at root → refresh).
 *
 * Scout (or location off) → clears idle city root back to browse.
 *
 * Never overrides an active navigation stack (e.g. user has opened
 * details, search, selected-point on top of city — we leave it).
 * Only replaces the root pane when the stack root is 'browse' or
 * an outdated 'city' entry.
 *
 * Renders nothing — pure side-effect controller.
 */

import { useEffect, useRef } from 'react';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  useCurrentTerritoryStack,
} from '@/features/accountTerritories/store/currentTerritoryStackStore';
import { useDemoMapChrome } from '@/features/setup/DemoMapChromeContext';
import { usePresence } from '@/map/location/positionMode/usePositionMode';

export function DockCityController() {
  const demo = useDemoMapChrome();
  const stack = useCurrentTerritoryStack();
  const { openCity, resetToBrowse, stack: dockStack } = useMapDock();
  const { mode: presenceMode } = usePresence();
  const isLive = presenceMode === 'live';

  // Track the last CTU id we've opened so we don't thrash on re-renders.
  const lastOpenedCtuId = useRef<string | null>(null);

  useEffect(() => {
    // Never interfere with the onboarding demo.
    if (demo !== null) return;

    if (!isLive) {
      lastOpenedCtuId.current = null;
      if (dockStack.length === 1 && dockStack[0]?.id === 'city') {
        resetToBrowse();
      }
      return;
    }

    if (!stack.ready) return;

    const ctu = stack.jurisdictions.find((j) => j.kind === 'ctu');
    if (!ctu) return;

    // Don't re-open if already open for this CTU.
    if (lastOpenedCtuId.current === ctu.id) return;

    // Only replace the stack root when it's browse or a stale city pane.
    // If the user has navigated elsewhere on top of the root, leave them alone.
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
  }, [isLive, stack.ready, stack.jurisdictions, demo, openCity, resetToBrowse, dockStack]);

  return null;
}
