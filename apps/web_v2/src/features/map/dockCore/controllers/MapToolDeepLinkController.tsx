'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { setMapSearchQuery } from '@/features/map/dockCore/store/mapSearchStore';
import { getContactBookTool, isContactBookToolKind } from '@/features/tools/core/contactBookTools';
import { getTerritoryLayer, useTerritoryLayers, type TerritorySlug } from '@/features/map/territory';
import { GAME_PATH } from '@/lib/routes/routePolicy';

/**
 * Bridges Tools tab links into the map dock's real subpages —
 * `/game?tool=people` opens the same People pane the dock uses.
 * Consumes game params once, then strips them so back/refresh doesn't replay.
 */
export function MapToolDeepLinkController() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openSubpage, openContactsSheet, openSearch } = useMapDock();
  const { ensureActive, setUnlockedOnly } = useTerritoryLayers();
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
      if (def) {
        openSubpage({ title: def.title, subtitle: def.subtitle, kind: def.kind });
      }
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

  return null;
}
