/**
 * Catalog defaults vs placement overrides — same formula as admin resolvePlacementPose.
 *
 * Scale:     catalogCalibration * coalesce(scale_multiplier, 1)
 * Rotation:  coalesce(placement.rotationZ, model.defaultRotationZ)
 * Altitude:  coalesce(placement.altitudeMeters, model.defaultHeightMeters, autoGroundSit)
 *
 * Auto ground-sit: center-origin GLBs bury halfway at translation 0 — when catalog
 * height is 0/unset, lift by half the apparent real-world size.
 */

import { scaleFromMeters } from '@/features/map/game/world/catalog';

export type PoseModel = {
  scale?: [number, number, number];
  /** Catalog default yaw (degrees). Prefer explicit field; falls back to rotation[2]. */
  defaultRotationZ?: number | null;
  rotation?: [number, number, number];
  defaultHeightMeters?: number | null;
  realWorldMeters?: number | null;
  nativeUnitsMax?: number | null;
};

export type PosePlacement = {
  scaleMultiplier?: number | null;
  rotationZ?: number | null;
  altitudeMeters?: number | null;
};

export type ResolvedPose = {
  scale: [number, number, number];
  rotationZ: number;
  altitude: number;
  scaleMultiplier: number;
  overridden: {
    scale: boolean;
    rotation: boolean;
    altitude: boolean;
    any: boolean;
  };
};

function isScaleOverridden(m: number | null | undefined): boolean {
  const n = Number(m);
  if (!Number.isFinite(n)) return false;
  return Math.abs(n - 1) > 0.0001;
}

function isSet(v: number | null | undefined): boolean {
  return v != null && Number.isFinite(Number(v));
}

/** Half apparent height — seats a center-origin GLB on the ground plane. */
export function groundSitAltitudeMeters(
  realWorldMeters: number | null | undefined,
  scaleMultiplier = 1,
): number {
  const m = Number(realWorldMeters);
  const meters = Number.isFinite(m) && m > 0 ? m : 1;
  const mult = Number.isFinite(scaleMultiplier) && scaleMultiplier > 0 ? scaleMultiplier : 1;
  return (meters * mult) / 2;
}

export function resolvePlacementPose(
  model: PoseModel | null | undefined,
  placement: PosePlacement | null | undefined,
): ResolvedPose {
  const multRaw = Number(placement?.scaleMultiplier);
  const scaleMultiplier = Number.isFinite(multRaw) && multRaw > 0 ? multRaw : 1;

  let base: [number, number, number];
  if (model?.scale) {
    base = model.scale;
  } else {
    base = scaleFromMeters(model?.realWorldMeters, model?.nativeUnitsMax);
  }
  const scale: [number, number, number] = [
    base[0] * scaleMultiplier,
    base[1] * scaleMultiplier,
    base[2] * scaleMultiplier,
  ];

  const defaultRot =
    model?.defaultRotationZ != null && Number.isFinite(Number(model.defaultRotationZ))
      ? Number(model.defaultRotationZ)
      : Number(model?.rotation?.[2]) || 0;

  const rotationZ = isSet(placement?.rotationZ)
    ? Number(placement!.rotationZ)
    : defaultRot;

  const catalogAlt = Number(model?.defaultHeightMeters);
  let altitude: number;
  if (isSet(placement?.altitudeMeters)) {
    altitude = Number(placement!.altitudeMeters);
  } else if (Number.isFinite(catalogAlt) && Math.abs(catalogAlt) > 0.0001) {
    altitude = catalogAlt;
  } else {
    altitude = groundSitAltitudeMeters(model?.realWorldMeters, scaleMultiplier);
  }

  const overridden = {
    scale: isScaleOverridden(scaleMultiplier),
    rotation: isSet(placement?.rotationZ),
    altitude: isSet(placement?.altitudeMeters),
    any: false,
  };
  overridden.any = overridden.scale || overridden.rotation || overridden.altitude;

  return { scale, rotationZ, altitude, scaleMultiplier, overridden };
}
