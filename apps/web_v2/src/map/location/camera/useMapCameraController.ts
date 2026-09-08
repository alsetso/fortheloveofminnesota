'use client';

/**
 * useMapCameraController — single public owner of Live / Scout / pin-yield camera.
 *
 * Phase 2 of the game map logic reset: FindMe (and Game) should depend on this
 * façade, not on useFollowCamera directly. Internally we still compose the
 * mature follow + orbit implementation; new behavior gates through
 * mapCameraAuthority (PositionMode Live/Scout + cameraIntent yield).
 *
 * Postures:
 *   live-follow — GPS/driving frame lock, follow ticks, orbit, compass
 *   scout       — camera unlocked; GPS session may stay for the avatar
 *   yield-pin   — pin/feature framing; follow ticks lose acquireCameraIntent
 */

import { useFollowCamera, type UseFollowCameraParams, type UseFollowCameraReturn } from '@/map/location/camera/useFollowCamera';

export type UseMapCameraControllerParams = UseFollowCameraParams;
export type UseMapCameraControllerReturn = UseFollowCameraReturn;

export function useMapCameraController(
  params: UseMapCameraControllerParams,
): UseMapCameraControllerReturn {
  return useFollowCamera(params);
}
