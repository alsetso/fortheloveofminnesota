import { GAME_PATH } from '@/lib/routes/routePolicy';

/** The signed-in world map. Campaign / Story routes redirect here. */
export type WorldExperience = 'game';

/**
 * Play hub “Experience Zones” = featured primary `world.experience_zones`.
 * See `docs/foundation/map-experiences-v1.md`.
 */
export function pathForExperience(_experience?: WorldExperience): string {
  return GAME_PATH;
}

export function experienceFromPathname(
  pathname: string | null,
): WorldExperience | null {
  if (!pathname) return null;
  if (pathname === GAME_PATH || pathname.startsWith(`${GAME_PATH}/`)) {
    return 'game';
  }
  return null;
}
