import type { Map as MapboxMap, PaddingOptions } from 'mapbox-gl';
import { MAP_CONFIG } from '@/map/config';
import {
  MAP_DOCK_QUARTER_HEIGHT_VH,
  mapDockVhPx,
} from '@/features/map/dockCore/core/mapDockTokens';

/**
 * Camera padding so a selected point sits in the visible map above the
 * quarter (~25%) dual-entry dock — not under the sheet.
 */
export function selectedPointFocusPadding(map: MapboxMap): PaddingOptions {
  const bleed = MAP_CONFIG.BLEED_BOTTOM_PX;
  const hFull = map.getContainer().clientHeight || window.innerHeight;
  const h = Math.max(1, hFull - bleed);
  const w = map.getContainer().clientWidth || window.innerWidth;
  const dockBottom = mapDockVhPx(MAP_DOCK_QUARTER_HEIGHT_VH, h);
  return {
    top: Math.max(48, Math.round(h * 0.08)),
    left: Math.max(28, Math.round(w * 0.06)),
    right: Math.max(28, Math.round(w * 0.06)),
    bottom: Math.max(dockBottom + 24, Math.round(h * 0.28)) + bleed,
  };
}
