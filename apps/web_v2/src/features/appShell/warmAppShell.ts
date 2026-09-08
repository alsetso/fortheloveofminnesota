/**
 * Splash-time warm-up: Mapbox GL JS + token, style JSON, and primary routes.
 * Feed payloads are warmed separately via `warmFeedHome` once auth is ready
 * (credentialed). Makes welcome → setup → Feed/Map feel instant after the gate.
 */

import { DISCOVER_PATH, FEED_PATH, GAME_PATH } from '@/lib/routes/routePolicy';
import { MAP_CONFIG } from '@/map/config';
import { loadMapboxGL } from '@/map/engine/mapboxLoader';

type PrefetchRouter = { prefetch: (href: string) => void };

function styleFetchUrl(styleUri: string, token: string): string | null {
  if (!token || !styleUri.startsWith('mapbox://styles/')) return null;
  const path = styleUri.replace('mapbox://styles/', '');
  return `https://api.mapbox.com/styles/v1/${path}?access_token=${encodeURIComponent(token)}`;
}

/** Fire-and-forget warm for Mapbox + App Router. Safe to call multiple times. */
export async function warmAppShell(router?: PrefetchRouter | null): Promise<void> {
  const token = MAP_CONFIG.MAPBOX_TOKEN;

  try {
    const mapbox = await loadMapboxGL();
    if (token) mapbox.accessToken = token;
  } catch {
    /* map still loads on demand */
  }

  if (token) {
    const styleUrl = styleFetchUrl(MAP_CONFIG.STYLE, token);
    if (styleUrl) {
      void fetch(styleUrl, { mode: 'cors', credentials: 'omit' }).catch(() => undefined);
    }
  }

  if (router) {
    try {
      router.prefetch(FEED_PATH);
      router.prefetch(GAME_PATH);
      router.prefetch(DISCOVER_PATH);
    } catch {
      /* ignore */
    }
  }
}
