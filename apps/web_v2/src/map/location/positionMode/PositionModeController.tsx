'use client';

/**
 * @deprecated Prefer PlayerPresenceController for `/game`.
 *
 * PositionModeController was the multi-experience boot (game / story / campaign).
 * Phase 3 split that into:
 *   - PlayerPresenceController — /game Live + Scout only
 *   - CampaignPositionController — Capitol Free + WASD + chase (quarantined)
 *
 * This file re-exports the game owner so older imports keep compiling.
 */

export {
  PlayerPresenceController as PositionModeController,
  PlayerPresenceController,
  usePlayerPresenceSwitch,
  usePositionModeSwitch,
  type PlayerPresenceSwitch,
  type PositionModeSwitch,
} from '@/map/location/positionMode/PlayerPresenceController';

/** @deprecated Story/Campaign experience prop removed from the game owner. */
export type MapExperience = 'game' | 'story' | 'campaign';
