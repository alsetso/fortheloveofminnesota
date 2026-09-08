/**
 * Venue / Explore Zone mode.
 *
 * `active`     — Find Me is physically inside an experience zone.
 * `exploring`  — user opted into Explore Zone (Yes on the prompt).
 * `exploreDeclined` — user said No; prompt stays hidden for this presence.
 *
 * Zone hierarchy:
 *   `zoneId` / `zoneName`         — primary (parent) zone; drives placement
 *                                   stream, camera lock, and banner headline.
 *   `subZoneId` / `subZoneName`   — specific sub-zone the user is currently
 *                                   standing in (positional badge + inner ring
 *                                   on Object Map). Null when not nested.
 */

import { useSyncExternalStore } from 'react';

export type VenueModeSnapshot = {
  active: boolean;
  /** User opted into Explore Zone for the current venue. */
  exploring: boolean;
  /**
   * User said No to the explore prompt for this presence.
   * Cleared when leaving / switching zones so a re-enter can ask again.
   */
  exploreDeclined: boolean;
  zoneId: string | null;
  zoneSlug: string | null;
  zoneName: string | null;
  /** Sub-zone id when the user is inside a nested area of the primary zone. */
  subZoneId: string | null;
  /** Sub-zone display name — shown as a positional badge ("In Gate A"). */
  subZoneName: string | null;
  /** Bumps once per zone enter — banner can pulse welcome. */
  welcomeToken: number;
  /**
   * Whether the active zone accepts community contributions.
   * When false and the user is exploring, the contribute sheet is blocked.
   */
  zoneAllowContributions: boolean;
  /**
   * Who can see the active zone (public / invite / private).
   * Null when no zone is active.
   */
  zoneVisibility: 'public' | 'invite' | 'private' | null;
};

const INITIAL: VenueModeSnapshot = {
  active: false,
  exploring: false,
  exploreDeclined: false,
  zoneId: null,
  zoneSlug: null,
  zoneName: null,
  subZoneId: null,
  subZoneName: null,
  welcomeToken: 0,
  zoneAllowContributions: true,
  zoneVisibility: null,
};

let snapshot: VenueModeSnapshot = INITIAL;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function getVenueModeSnapshot(): VenueModeSnapshot {
  return snapshot;
}

export function subscribeVenueMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useVenueMode(): VenueModeSnapshot {
  return useSyncExternalStore(
    subscribeVenueMode,
    getVenueModeSnapshot,
    getVenueModeSnapshot,
  );
}

/** Presence update from the experience-zone controller (GPS in / out). */
export function setVenueZone(next: {
  zoneId: string | null;
  zoneSlug: string | null;
  zoneName: string | null;
  subZoneId?: string | null;
  subZoneName?: string | null;
  /** Passed through from the zone record; defaults true when absent. */
  allowContributions?: boolean;
  /** Passed through from the zone record; null when leaving a zone. */
  visibility?: 'public' | 'invite' | 'private' | null;
}): void {
  const active = Boolean(next.zoneId);
  const subZoneId = next.subZoneId ?? null;
  const subZoneName = next.subZoneName ?? null;
  const zoneAllowContributions = active ? (next.allowContributions ?? true) : true;
  const zoneVisibility = active ? (next.visibility ?? 'public') : null;
  const entered =
    active && next.zoneId != null && next.zoneId !== snapshot.zoneId;
  const leftOrSwitched = snapshot.zoneId !== next.zoneId;

  // New primary venue or leaving → drop Explore Zone until user opts in again.
  const exploring = active && !leftOrSwitched ? snapshot.exploring : false;
  const exploreDeclined =
    active && !leftOrSwitched ? snapshot.exploreDeclined : false;

  if (
    snapshot.zoneId === next.zoneId &&
    snapshot.zoneSlug === next.zoneSlug &&
    snapshot.zoneName === next.zoneName &&
    snapshot.subZoneId === subZoneId &&
    snapshot.subZoneName === subZoneName &&
    snapshot.active === active &&
    snapshot.exploring === exploring &&
    snapshot.exploreDeclined === exploreDeclined &&
    snapshot.zoneAllowContributions === zoneAllowContributions &&
    snapshot.zoneVisibility === zoneVisibility
  ) {
    return;
  }

  snapshot = {
    active,
    exploring,
    exploreDeclined,
    zoneId: next.zoneId,
    zoneSlug: next.zoneSlug,
    zoneName: next.zoneName,
    subZoneId,
    subZoneName,
    welcomeToken: entered ? snapshot.welcomeToken + 1 : snapshot.welcomeToken,
    zoneAllowContributions,
    zoneVisibility,
  };
  notify();
}

/** User agrees to Explore Zone for the current venue. */
export function startExploreZone(): boolean {
  if (!snapshot.active || !snapshot.zoneId) return false;
  if (snapshot.exploring) return true;
  snapshot = { ...snapshot, exploring: true, exploreDeclined: false };
  notify();
  return true;
}

/** User says No to the explore prompt (stays in venue, no Explore Zone). */
export function declineExploreZone(): void {
  if (!snapshot.active || snapshot.exploring) return;
  if (snapshot.exploreDeclined) return;
  snapshot = { ...snapshot, exploreDeclined: true };
  notify();
}

/** Bring the yes/no prompt back after a No (still physically in the venue). */
export function reofferExploreZone(): void {
  if (!snapshot.active || snapshot.exploring) return;
  if (!snapshot.exploreDeclined) return;
  snapshot = { ...snapshot, exploreDeclined: false };
  notify();
}

/** User stops Explore Zone (stays physically in the venue). Prompt can return. */
export function stopExploreZone(): void {
  if (!snapshot.exploring) return;
  snapshot = { ...snapshot, exploring: false, exploreDeclined: false };
  notify();
}

export function toggleExploreZone(): boolean {
  if (snapshot.exploring) {
    stopExploreZone();
    return false;
  }
  return startExploreZone();
}

/**
 * Stream scope for PlacementStreamService — only while Explore Zone is on.
 * Scoped to the primary (parent) zone, never the sub-zone.
 */
export function getPlacementStreamZoneId(): string | null {
  return snapshot.exploring ? snapshot.zoneId : null;
}

export function isExploringZone(): boolean {
  return snapshot.exploring;
}
