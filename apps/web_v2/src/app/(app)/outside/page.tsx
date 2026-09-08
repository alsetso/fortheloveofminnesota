import { Suspense } from 'react';
import { MapAppShell } from '@/components/shell/MapAppShell';
import { OutsideOverlay } from '@/features/outside/OutsideOverlay';

/**
 * /outside — the Minnesota-from-afar experience.
 *
 * Mounted when OutsideMNGate (in /game) detects the user's GPS fix is outside
 * MN bounds. Shows the full Mapbox dataset at a statewide MN view so the app
 * feels alive, then overlays a minimal card with: level badge, XP progress
 * bar, streak claim button, and an "Enter Game" banner the moment GPS
 * confirms the user has crossed into Minnesota.
 *
 * Surface config: `variant="explore"` boots to EXPLORE_MAP_CONFIG defaults —
 * a flat statewide frame, no Find Me auto-lock, no gyroscope. The user can
 * still pan/zoom freely over all of Minnesota.
 *
 * Suspense wraps MapAppShell because GameMapControllers uses useSearchParams.
 */
export default function OutsidePage() {
  return (
    <Suspense fallback={null}>
      <MapAppShell />
      <OutsideOverlay />
    </Suspense>
  );
}
