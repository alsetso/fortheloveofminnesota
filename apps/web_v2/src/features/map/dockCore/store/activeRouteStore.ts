/**
 * Active "Your route" session — Directions result painted on the map.
 * Cleared on back from Your route pane or Find Me stop.
 */

import type { DirectionsProfile } from '@/lib/geo/fetch/fetchDirections';
import type { UserCoords } from '@/map/location/device/geolocation';

export type ActiveRouteSession = {
  routeId: string | null;
  profile: DirectionsProfile;
  from: UserCoords;
  to: UserCoords;
  toLabel: string;
  distanceMeters: number;
  durationSeconds: number;
  meta?: Record<string, unknown>;
};

type Snapshot = { route: ActiveRouteSession | null };
type Listener = () => void;

let route: ActiveRouteSession | null = null;
let snapshot: Snapshot = { route: null };
const listeners = new Set<Listener>();

function emit() {
  snapshot = { route };
  for (const listener of listeners) listener();
}

export function getActiveRouteSnapshot(): Snapshot {
  return snapshot;
}

export function subscribeActiveRoute(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setActiveRoute(next: ActiveRouteSession): void {
  route = next;
  emit();
}

export function clearActiveRoute(): void {
  if (route == null) return;
  route = null;
  emit();
}
