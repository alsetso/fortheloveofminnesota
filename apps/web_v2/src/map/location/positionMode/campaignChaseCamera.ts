/**
 * Campaign chase camera — shared bearing + one-shot boot reframe.
 *
 * While the stick is held, Free Mode owns jumpTo directly
 * (`freeMoveController.chaseJumpTo`). Release is a withdrawal of ownership —
 * do not call sync from the stop path. Boot may call sync once on enter.
 */

import type { Map as MapboxMap } from 'mapbox-gl';
import { thirdPersonCameraCenter } from '@/map/location/camera/flyToFindMe';
import {
  getAvatarPresentationCoords,
  getLastWalkBearing,
} from '@/map/location/player/avatarWalkController';
import {
  CAMPAIGN_LOOK_AHEAD_M,
  CAMPAIGN_PITCH,
  CAMPAIGN_ZOOM,
} from '@/map/location/positionMode/positionConstants';

let chaseBearing: number | null = null;

function headingOf(pose: { course?: number | null }): number {
  if (typeof pose.course === 'number' && Number.isFinite(pose.course)) {
    return pose.course;
  }
  return getLastWalkBearing() ?? chaseBearing ?? 0;
}

export type SyncCampaignChaseOpts = {
  pose?: { lat: number; lng: number; course?: number | null };
  headingDeg?: number | null;
};

export function resetCampaignChaseBearing(): void {
  chaseBearing = null;
}

/** Free Mode writes the live chase bearing so boot/idle stay continuous. */
export function noteCampaignChaseBearing(deg: number): void {
  chaseBearing = ((deg % 360) + 360) % 360;
}

/**
 * Boot / explicit reframe only — center on the scout with latched bearing.
 * Never call from Free Mode stopLoop (release must not jumpTo again).
 */
export function syncCampaignChaseCamera(
  map: MapboxMap,
  opts?: SyncCampaignChaseOpts,
): void {
  const pose = opts?.pose ?? getAvatarPresentationCoords();
  if (!pose) return;

  const heading =
    typeof opts?.headingDeg === 'number' && Number.isFinite(opts.headingDeg)
      ? opts.headingDeg
      : headingOf(pose);

  if (chaseBearing == null) {
    chaseBearing = heading;
  }

  const lookAt = thirdPersonCameraCenter(
    pose.lng,
    pose.lat,
    chaseBearing,
    CAMPAIGN_LOOK_AHEAD_M,
  );

  try {
    map.stop();
  } catch {
    /* no in-flight ease */
  }

  map.jumpTo({
    center: [lookAt.lng, lookAt.lat],
    bearing: chaseBearing,
    pitch: CAMPAIGN_PITCH,
    zoom: CAMPAIGN_ZOOM,
  });
}
