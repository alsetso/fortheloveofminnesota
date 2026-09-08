'use client';

/**
 * GameMapBehaviors — mounts zero-UI map behaviors for the game surface.
 *
 * Renders nothing; exists solely to attach hooks that need map access and
 * should always be active during game play (not gated on Find Me or any
 * specific dock state).
 *
 * Currently mounts:
 *   useSnapZoom — no-op (Locked → Explore pinch-escape was removed)
 */

import { useMapContext } from '@/map/MapProvider';
import { useSnapZoom } from '@/map/location/camera/useSnapZoom';

export function GameMapBehaviors() {
  const { map, ready } = useMapContext();
  useSnapZoom(map, ready);
  return null;
}
