/**
 * Mentions layer IDs (pins + clusters). Kept in draw order: bottom to top.
 * Used so pins and cluster groupings default above all area/boundary layers.
 */
export const MENTIONS_LAYER_IDS = [
  'map-mentions-cluster-circle',
  'map-mentions-cluster-count',
  'map-mentions-point',
  'map-mentions-point-label',
  'map-mentions-highlight',
] as const;

/**
 * Move all mentions layers (pins and cluster circles/counts) to the top of the
 * map layer stack so they render above area/boundary layers by default.
 */
export function moveMentionsLayersToTop(
  map: { getLayer: (id: string) => unknown; moveLayer: (id: string, beforeId?: string) => void }
): void {
  if (typeof map.moveLayer !== 'function') return;
  try {
    for (const layerId of MENTIONS_LAYER_IDS) {
      if (map.getLayer(layerId)) {
        map.moveLayer(layerId, undefined);
      }
    }
  } catch {
    // Ignore; map may be removed or style changing
  }
}
