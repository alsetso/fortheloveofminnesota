/**
 * Position-mode constants — spawn point, Free Mode movement tuning, and
 * per-mode camera behavior.
 */

import type { PresenceMode } from '@/map/location/positionMode/positionModeStore';

/**
 * Minnesota State Capitol lawn — the universal fallback spawn.
 *
 * This is the ONLY place these coordinates may appear. Every consumer
 * (boot camera, resolver fallback, setup cinematic) imports this constant.
 */
export const CAPITOL_SPAWN = { lat: 44.95343, lng: -93.10278 } as const;

/**
 * Campaign chase camera — steep third-person, zoom locked close,
 * always behind the scout looking along travel.
 */
export const CAMPAIGN_PITCH = 78;
export const CAMPAIGN_ZOOM = 21;
export const CAMPAIGN_MIN_ZOOM = 20.6;
export const CAMPAIGN_MAX_ZOOM = 21.4;
/** Ground look-ahead so the frame sits behind the avatar. */
export const CAMPAIGN_LOOK_AHEAD_M = 10;
/**
 * Camera bearing blend α at 60fps — consumers dt-scale via
 * `1 - (1-α)^(dt*60)` so ProMotion and hitchy frames feel identical.
 * Tight to the scout heading so the map turns with the stick, not after.
 */
export const CAMPAIGN_BEARING_LERP = 0.45;
/**
 * Avatar facing blend α at 60fps (same dt-scaling as bearing).
 * Body turns slower than the stick so the view eases ahead of yaw.
 */
export const CAMPAIGN_TURN_LERP = 0.08;
/** Campaign ground speed (m/s). Not zoom-scaled — close cam would crawl. */
export const CAMPAIGN_MOVE_SPEED_MPS = 7;

/**
 * Free Mode movement speed in meters per second, measured at
 * {@link FREE_MOVE_REF_ZOOM}. A brisk jog — quick enough to cross a block
 * in a few seconds without feeling like teleportation.
 */
export const FREE_MOVE_SPEED_MPS = 3.2;

/**
 * Zoom at which FREE_MOVE_SPEED_MPS applies 1:1. At other zooms the ground
 * speed scales by 2^(ref − zoom) — meters-per-pixel doubles per zoom level
 * out, so this keeps *on-screen* speed constant at any altitude.
 * Matches ZOOM_STATE_STREET / FIND_ME_ZOOM historically (18.5). Kept as a
 * fixed speed-scale reference so Scout free-move feel stays stable if Live
 * close zoom changes.
 */
export const FREE_MOVE_REF_ZOOM = 18.5;

/** Safety cap on the zoom-scaled ground speed (m/s). */
export const FREE_MOVE_MAX_MPS = 96;

/**
 * Stick enter threshold — inputs below this start ignored (thumb rest).
 * Exit uses {@link FREE_MOVE_INPUT_RELEASE_DEADZONE} so the edge doesn't
 * chatter start/stop while the thumb wobbles near the deadzone.
 */
export const FREE_MOVE_INPUT_DEADZONE = 0.12;
/** Stick release threshold — lower than enter for hysteresis. */
export const FREE_MOVE_INPUT_RELEASE_DEADZONE = 0.06;
/**
 * Keep the drive loop alive this long after input goes silent so a brief
 * deadzone dip doesn't fire endAvatarDrive → idle → restart hitch.
 */
export const FREE_MOVE_STOP_GRACE_MS = 100;

/** Persist cadence while moving; a final flush fires on input release. */
export const FREE_MOVE_PERSIST_THROTTLE_MS = 500;

/**
 * Zoom-scaled Free Mode ground speed (m/s). Pure — unit tested.
 * Latitude cancels out of the ratio, so only zoom matters.
 */
export function freeMoveSpeedMpsForZoom(zoom: number): number {
  const scaled = FREE_MOVE_SPEED_MPS * Math.pow(2, FREE_MOVE_REF_ZOOM - zoom);
  return Math.min(FREE_MOVE_MAX_MPS, Math.max(FREE_MOVE_SPEED_MPS * 0.25, scaled));
}

/**
 * Camera tilt per PresenceMode (° from nadir).
 * Live is intentional street 3-D; Scout is flatter for freer browse.
 * Campaign keeps its own {@link CAMPAIGN_PITCH}.
 */
export const PRESENCE_PITCH = {
  /** Live / Find Me attach — steep street-level chase. */
  live: 75,
  /** Scout — flatter still; keeps a hint of depth without locking immersion. */
  scout: 24,
} as const satisfies Record<PresenceMode, number>;

export type CameraBehavior =
  | {
      /** Camera hard-locked to the avatar (existing Follow Me pipeline). */
      kind: 'locked-follow';
    }
  | {
      /**
       * Center dead zone: the avatar roams a centered viewport box and only
       * pushes the camera when it reaches the box edge. Fractions are of the
       * full viewport width/height.
       */
      kind: 'dead-zone';
      widthFrac: number;
      heightFrac: number;
    };

/**
 * Camera behavior per presence mode. Driving (LiveKind) stays on live's
 * locked-follow until a Driving pass defines its own framing (wider zoom,
 * stronger look-ahead) via a LiveKind override — not a third PresenceMode.
 */
export const CAMERA_BEHAVIOR: Record<PresenceMode, CameraBehavior> = {
  live: { kind: 'locked-follow' },
  scout: { kind: 'dead-zone', widthFrac: 0.44, heightFrac: 0.34 },
};
