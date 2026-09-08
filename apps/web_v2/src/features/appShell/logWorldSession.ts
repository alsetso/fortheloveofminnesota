/**
 * Fire-and-forget "world load" ping — at most once per page lifetime.
 * Boot and map_mount both try to ping; cold start used to fire both and
 * double the session traffic. Server still grants daily-streak XP idempotently;
 * when a new day is granted we refresh the pending-XP rollup so Review /
 * claim surfaces appear without a manual refetch.
 */

import { refreshPendingXp } from '@/features/xp/store/pendingXpStore';

export type WorldSessionTrigger = 'boot' | 'map_mount';

/** One ping per JS realm — boot + map_mount race on cold entry. */
let sessionPingInFlight: Promise<void> | null = null;
let sessionPingDone = false;

export function logWorldSession(trigger: WorldSessionTrigger): void {
  if (sessionPingDone || sessionPingInFlight) return;

  try {
    sessionPingInFlight = fetch('/api/world/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ trigger }),
      keepalive: true,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { streakGranted?: boolean } | null) => {
        sessionPingDone = true;
        if (body?.streakGranted) {
          void refreshPendingXp();
        }
      })
      .catch(() => undefined)
      .finally(() => {
        sessionPingInFlight = null;
      });
  } catch {
    sessionPingInFlight = null;
  }
}
