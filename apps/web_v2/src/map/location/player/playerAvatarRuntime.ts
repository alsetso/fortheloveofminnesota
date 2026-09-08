/**
 * Compile-once 3D player runtime (Campaign + Game).
 *
 * Story never mounts this — it paints a GPS puck via GpsPuckView.
 *
 * Goals:
 * - Register GLB + model layer once per map/style (prefetch + addModel).
 * - Never remove the compiled model on GPS refresh — only move the feature.
 * - Drive paint from an imperative 30fps loop (not React re-renders).
 * - Keep presentation pose sticky across Find Me finding/active flaps.
 */

import type { FeatureCollection, Point } from 'geojson';
import type {
  GeoJSONSource,
  Map as MapboxMap,
  MapMouseEvent,
} from 'mapbox-gl';
import { mapUsesMapboxStandard } from '@/map/buildings/applyMapBuildings3D';
import {
  isMapStyleReady,
  safeGetLayer,
  safeGetSource,
} from '@/map/engine/mapStyleGuard';
import type { UserCoords } from '@/map/location/device/geolocation';
import type { LocomotionMode } from '@/map/location/device/locomotion';
import {
  clearAvatarWalk,
  getAvatarWalkSnapshot,
  getLastDrivenYaw,
  getLastWalkBearing,
  setAvatarWalkTarget,
  subscribeAvatarWalk,
} from '@/map/location/player/avatarWalkController';
import {
  isChaseOwned,
  isFreeMoving,
} from '@/map/location/positionMode/freeMoveController';
import { getFindMeAvatarTapHandler } from '@/map/points/avatarTapHandler';
import {
  getLastKnownAvatarPosition,
  persistAvatarPositionThrottled,
} from '@/map/location/positionMode/positionPersistence';
import { getAvatarStore, subscribeAvatarStore } from '@/features/avatar/avatarStore';
import {
  getAvatarBlobUrlSync,
  primeAvatarGlbCache,
} from '@/features/avatar/avatarLocalCache';

/** Fallback when account avatar hasn't loaded yet. */
const FALLBACK_MODEL_ID = 'male-base-model';
const FALLBACK_MODEL_URL = '/models/props/male-base-model.glb';

/** Resolved from avatarStore, falls back to male-base while loading. */
export function getPlayerAvatarModelId(): string {
  return getAvatarStore()?.modelId ?? FALLBACK_MODEL_ID;
}

/**
 * Returns the effective model URL for Mapbox addModel().
 *
 * Prefers the in-session blob URL (from avatarLocalCache Layer 2) when the
 * GLB has been primed into the Cache API — zero network round-trip.
 * Falls back to the original network URL transparently.
 */
export function getPlayerAvatarModelUrl(): string {
  const networkUrl = getAvatarStore()?.modelUrl ?? FALLBACK_MODEL_URL;
  return getAvatarBlobUrlSync(networkUrl);
}

export const PLAYER_AVATAR_SOURCE = 'ftlomn-player-avatar';
export const PLAYER_AVATAR_LAYER = 'ftlomn-player-avatar';

export const USER_AVATAR_MODEL_ID = FALLBACK_MODEL_ID;
export const USER_AVATAR_MODEL_URL = FALLBACK_MODEL_URL;

const MODEL_SCALE: [number, number, number] = [3, 3, 3];
/** Face along bearing / path — back to pitched camera.
 * The model's default orientation points TOWARD the viewer (south-facing in
 * Mapbox's coordinate system), so +180° is required to make the avatar face
 * away from the camera and into the direction of travel. */
export const PLAYER_AVATAR_YAW_OFFSET_DEG = 180;

const PAINT_MIN_MS = 33; // ~30fps
/** Skip redundant model setData when pose/yaw unchanged (release / idle). */
const PAINT_COORD_EPS = 1e-7;
const PAINT_YAW_EPS_DEG = 0.5;

const EMPTY: FeatureCollection<Point> = {
  type: 'FeatureCollection',
  features: [],
};

/** Tracks which model ID is currently registered on the live layer. */
let compiledModelId: string | null = null;
/** Last successfully painted pose — epsilon no-op for identical frames. */
let lastPainted: { lat: number; lng: number; yaw: number } | null = null;

type RuntimeState = {
  map: MapboxMap;
  compiled: boolean;
  visible: boolean;
  lastPaintMs: number;
  paintQueued: boolean;
  unsubWalk: (() => void) | null;
  unsubAvatar: (() => void) | null;
  onRotate: (() => void) | null;
  onStyle: (() => void) | null;
  onClick: ((e: MapMouseEvent) => void) | null;
};

let runtime: RuntimeState | null = null;
let prefetchStarted = false;

// ─── Avatar render-error state ────────────────────────────────────────────────
// Set when the model layer fails to compile. Subscribers (AvatarPositionView)
// can fall back to the native blue dot so the user is never left with nothing.
let avatarRenderError = false;
const errorListeners = new Set<() => void>();

function setAvatarRenderError(err: boolean): void {
  if (avatarRenderError === err) return;
  avatarRenderError = err;
  for (const l of errorListeners) l();
}

export function getAvatarRenderError(): boolean {
  return avatarRenderError;
}

export function subscribeAvatarRenderError(cb: () => void): () => void {
  errorListeners.add(cb);
  return () => errorListeners.delete(cb);
}

function normalizeYaw(deg: number): number {
  const n = deg % 360;
  return n < 0 ? n + 360 : n;
}

/**
 * Sticky pose = the single persisted `lastKnownAvatarPosition` key (replaces
 * the old per-tab sessionStorage cache, so the restore also works across
 * sessions). Writes are throttled inside the persistence module — the ~30fps
 * paint loop never hits storage per frame.
 */
function readSessionPose(): UserCoords | null {
  const pos = getLastKnownAvatarPosition();
  if (!pos) return null;
  return { lat: pos.lat, lng: pos.lng, accuracy: null, speed: null, course: null };
}

function writeSessionPose(pose: UserCoords | null): void {
  if (!pose) return;
  persistAvatarPositionThrottled({ lat: pose.lat, lng: pose.lng });
}

/**
 * Warm the avatar GLB into both HTTP cache and the Cache API so the first
 * Mapbox addModel() is instant and the asset is available offline.
 *
 * Uses avatarLocalCache.primeAvatarGlbCache which:
 *   1. Checks the Cache API — skips the fetch if already stored.
 *   2. Fetches with force-cache to warm the HTTP cache.
 *   3. Stores the response in the Cache API for offline resilience.
 *   4. Registers a blob URL so getPlayerAvatarModelUrl() serves it locally.
 */
export function prefetchPlayerAvatar(): void {
  if (prefetchStarted || typeof fetch === 'undefined') return;
  prefetchStarted = true;
  // Use the network URL (not the blob URL) as the cache key.
  const networkUrl = getAvatarStore()?.modelUrl ?? FALLBACK_MODEL_URL;
  void primeAvatarGlbCache(networkUrl).catch(() => {
    prefetchStarted = false;
  });
}

/**
 * Register every catalog GLB on the live map so Mapbox starts GPU compile
 * before the user flips through Pick Your Avatar. HTTP-prefetches as well.
 * Idempotent — skips models already in the map registry.
 */
export function registerAvatarModels(
  map: MapboxMap,
  models: Array<{ modelId: string; modelUrl: string }>,
): void {
  const canAdd = isMapStyleReady(map) && typeof map.addModel === 'function';
  for (const m of models) {
    if (!m.modelId || !m.modelUrl) continue;
    if (typeof fetch !== 'undefined') {
      void fetch(m.modelUrl, { method: 'GET', cache: 'force-cache' }).catch(() => {});
    }
    if (!canAdd) continue;
    if (map.hasModel?.(m.modelId)) continue;
    try {
      map.addModel(m.modelId, m.modelUrl);
    } catch {
      /* style race — next attach retries */
    }
  }
}

function featureFor(
  coords: UserCoords,
  yawDeg: number,
): FeatureCollection<Point> {
  const yaw = normalizeYaw(yawDeg);
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'player-avatar',
        properties: {
          modelId: getPlayerAvatarModelId(),
          modelScale: MODEL_SCALE,
          modelRotation: [0, 0, yaw],
          modelTranslation: [0, 0, 0],
          baseRotationZ: yaw,
        },
        geometry: {
          type: 'Point',
          coordinates: [coords.lng, coords.lat],
        },
      },
    ],
  };
}

function compile(map: MapboxMap): boolean {
  if (!isMapStyleReady(map) || typeof map.addModel !== 'function') return false;

  const modelId = getPlayerAvatarModelId();
  const modelUrl = getPlayerAvatarModelUrl();

  try {
    if (!map.hasModel?.(modelId)) {
      map.addModel(modelId, modelUrl);
    }
  } catch {
    /* race */
  }

  if (!map.getSource(PLAYER_AVATAR_SOURCE)) {
    try {
      map.addSource(PLAYER_AVATAR_SOURCE, { type: 'geojson', data: EMPTY });
    } catch {
      return false;
    }
  }

  if (!map.getLayer(PLAYER_AVATAR_LAYER)) {
    const layer = {
      id: PLAYER_AVATAR_LAYER,
      type: 'model' as const,
      source: PLAYER_AVATAR_SOURCE,
      minzoom: 13,
      // No filter — there is always exactly one player feature; filtering by
      // modelId causes the avatar to vanish after a model switch until the
      // filter expression is also updated.
      layout: {
        'model-id': modelId,
        visibility: 'visible' as const,
      },
      paint: {
        'model-type': 'common-3d' as const,
        'model-scale': ['get', 'modelScale'] as unknown as [
          number,
          number,
          number,
        ],
        'model-rotation': ['get', 'modelRotation'] as unknown as [
          number,
          number,
          number,
        ],
        'model-translation': ['get', 'modelTranslation'] as unknown as [
          number,
          number,
          number,
        ],
        'model-elevation-reference': 'ground' as const,
      },
      ...(mapUsesMapboxStandard(map) ? { slot: 'middle' as const } : {}),
    };
    try {
      map.addLayer(layer);
    } catch {
      try {
        const { slot: _s, ...rest } = layer as typeof layer & { slot?: string };
        void _s;
        map.addLayer(rest);
      } catch {
        return false;
      }
    }
    compiledModelId = modelId;
  } else if (compiledModelId !== modelId) {
    // Avatar switched — swap the model-id on the existing layer in-place so
    // there is no flash or remove/add round-trip.
    try {
      map.setLayoutProperty(PLAYER_AVATAR_LAYER, 'model-id', modelId);
      compiledModelId = modelId;
    } catch {
      /* layer may not be ready yet — next paint will retry */
    }
  }

  const ok = Boolean(map.getLayer(PLAYER_AVATAR_LAYER));
  setAvatarRenderError(!ok);
  return ok;
}

function setLayerVisible(map: MapboxMap, visible: boolean): void {
  if (!safeGetLayer(map, PLAYER_AVATAR_LAYER)) return;
  try {
    map.setLayoutProperty(
      PLAYER_AVATAR_LAYER,
      'visibility',
      visible ? 'visible' : 'none',
    );
  } catch {
    /* ignore */
  }
}

function applyYaw(map: MapboxMap, yawDeg: number): void {
  try {
    map.setPaintProperty(PLAYER_AVATAR_LAYER, 'model-rotation', [
      0,
      0,
      normalizeYaw(yawDeg),
    ]);
  } catch {
    /* ignore */
  }
}

function resolveYaw(map: MapboxMap): number {
  const walk = getAvatarWalkSnapshot();

  // 1. Active path / direct-drive bearing.
  if (walk.pathBearingDeg != null) {
    return walk.pathBearingDeg + PLAYER_AVATAR_YAW_OFFSET_DEG;
  }

  // 2. Sticky Free Mode yaw — survives silent endAvatarDrive so release
  //    consumers recompute the same facing as the last painted frame.
  const driven = getLastDrivenYaw();
  if (driven != null) {
    return driven + PLAYER_AVATAR_YAW_OFFSET_DEG;
  }

  // 3. Live GPS course only when actually moving (avoids fighting sticky yaw).
  const gpsCourse = walk.pose?.course ?? walk.target?.course;
  const gpsSpeed = walk.pose?.speed ?? walk.target?.speed;
  if (
    gpsCourse != null &&
    Number.isFinite(gpsCourse) &&
    gpsSpeed != null &&
    Number.isFinite(gpsSpeed) &&
    gpsSpeed > 0.5
  ) {
    return gpsCourse + PLAYER_AVATAR_YAW_OFFSET_DEG;
  }

  // 4. Last walk bearing (GPS walk segments).
  const lastBearing = getLastWalkBearing();
  if (lastBearing != null) {
    return lastBearing + PLAYER_AVATAR_YAW_OFFSET_DEG;
  }

  // 5. Cold open — face into the scene.
  return map.getBearing() + PLAYER_AVATAR_YAW_OFFSET_DEG;
}

function scheduleCompileRetry(rt: RuntimeState, attempt = 1): void {
  if (attempt > 5) return;
  window.setTimeout(
    () => {
      if (!runtime || runtime !== rt || rt.compiled) return;
      rt.compiled = compile(rt.map);
      if (rt.compiled) {
        queuePaint(rt);
      } else {
        scheduleCompileRetry(rt, attempt + 1);
      }
    },
    Math.min(250 * attempt, 1500),
  );
}

function paintNow(
  rt: RuntimeState,
  opts?: { skipRepaint?: boolean },
): void {
  if (!isMapStyleReady(rt.map)) return;
  if (!rt.compiled) {
    rt.compiled = compile(rt.map);
    if (!rt.compiled) {
      // Style race or WebGL not yet ready — retry with backoff rather than
      // silently dropping the frame and waiting for the next GPS tick.
      scheduleCompileRetry(rt);
      return;
    }
  }

  let walk = getAvatarWalkSnapshot();
  let pose = walk.pose ?? walk.target;

  // Sticky: never blank the mesh on a missing tick — restore session pose
  // first. Only {@link hidePlayerAvatar} / dispose clears the feature.
  if (!pose) {
    const cached = readSessionPose();
    if (cached) {
      setAvatarWalkTarget(cached, { snap: true });
      walk = getAvatarWalkSnapshot();
      pose = walk.pose ?? walk.target;
    }
  }
  if (!pose) {
    return;
  }

  const yaw = resolveYaw(rt.map);

  // Identical frame — skip model-layer re-upload (release / idle no-op).
  if (
    lastPainted &&
    Math.abs(pose.lat - lastPainted.lat) < PAINT_COORD_EPS &&
    Math.abs(pose.lng - lastPainted.lng) < PAINT_COORD_EPS &&
    Math.abs(normalizeYaw(yaw) - normalizeYaw(lastPainted.yaw)) < PAINT_YAW_EPS_DEG
  ) {
    return;
  }

  const source = safeGetSource(rt.map, PLAYER_AVATAR_SOURCE) as
    | GeoJSONSource
    | undefined;
  if (!source) {
    rt.compiled = false;
    return;
  }

  // Constant paint props — Mapbox ignores array updates via setData alone.
  try {
    source.setData(featureFor(pose, yaw));
  } catch {
    rt.compiled = false;
    return;
  }
  try {
    rt.map.setPaintProperty(PLAYER_AVATAR_LAYER, 'model-scale', MODEL_SCALE);
  } catch {
    /* ignore */
  }
  applyYaw(rt.map, yaw);
  setLayerVisible(rt.map, true);
  rt.visible = true;
  writeSessionPose(pose);
  lastPainted = { lat: pose.lat, lng: pose.lng, yaw: normalizeYaw(yaw) };

  if (!opts?.skipRepaint) {
    rt.map.triggerRepaint?.();
  }
}

/**
 * Imperative paint for Free Mode's owned rAF — pose must already be written.
 * Pass `skipRepaint` when the caller will jumpTo + triggerRepaint once after.
 */
export function paintPlayerAvatarNow(opts?: { skipRepaint?: boolean }): void {
  if (!runtime) return;
  runtime.lastPaintMs = performance.now();
  paintNow(runtime, opts);
}

function queuePaint(rt: RuntimeState): void {
  // Free Mode owns paint while chase-owned (drive + post-release grace).
  if (isChaseOwned() || isFreeMoving()) return;
  if (rt.paintQueued) return;
  rt.paintQueued = true;
  const delay = Math.max(0, PAINT_MIN_MS - (performance.now() - rt.lastPaintMs));
  window.setTimeout(() => {
    rt.paintQueued = false;
    if (!runtime || runtime !== rt) return;
    if (isChaseOwned() || isFreeMoving()) return;
    rt.lastPaintMs = performance.now();
    paintNow(rt);
  }, delay);
}

function bindClick(rt: RuntimeState): void {
  if (rt.onClick) return;
  rt.onClick = (e) => {
    e.originalEvent?.stopPropagation?.();
    getFindMeAvatarTapHandler()?.();
  };
  rt.map.on('click', PLAYER_AVATAR_LAYER, rt.onClick);
}

/**
 * Attach the compiled player to a map. Idempotent for the same map instance.
 * React effect cleanups must NOT tear this down on Strict Mode / ready flaps —
 * only call {@link detachPlayerAvatarRuntime} when leaving Game or destroying
 * the map.
 */
export function attachPlayerAvatarRuntime(map: MapboxMap): void {
  prefetchPlayerAvatar();

  if (runtime?.map === map) {
    if (!runtime.compiled) runtime.compiled = compile(map);
    // Re-bind if a soft detach left listeners null (shouldn't), then paint.
    if (!runtime.unsubWalk) {
      runtime.unsubWalk = subscribeAvatarWalk(() => queuePaint(runtime!));
    }
    queuePaint(runtime);
    return;
  }

  if (runtime) {
    // Map instance replaced — soft handoff, keep pose, leave old feature alone.
    detachPlayerAvatarRuntime({ disposeModel: false, clearPose: false });
  }

  const rt: RuntimeState = {
    map,
    compiled: false,
    visible: false,
    lastPaintMs: 0,
    paintQueued: false,
    unsubWalk: null,
    unsubAvatar: null,
    onRotate: null,
    onStyle: null,
    onClick: null,
  };
  runtime = rt;

  // Restore sticky pose from this session before first GPS tick.
  const cached = readSessionPose();
  if (cached && !getAvatarWalkSnapshot().pose) {
    setAvatarWalkTarget(cached, { snap: true });
  }

  rt.compiled = compile(map);
  if (!rt.compiled) {
    // First-attach style race — kick the retry chain immediately.
    scheduleCompileRetry(rt);
  }
  bindClick(rt);

  rt.unsubWalk = subscribeAvatarWalk(() => queuePaint(rt));

  // Catch the race where avatarStore was already hydrated before this runtime
  // attached (e.g. /api/avatar/me resolved before waitForMapStyleReady).
  // The subscription above will not fire for past events, so we check now.
  {
    const storeModelId = getPlayerAvatarModelId();
    if (compiledModelId && compiledModelId !== storeModelId) {
      // The layer was compiled with the fallback — recompile with the real model.
      rt.compiled = false;
      queuePaint(rt);
    }
  }

  // When the account's avatar changes (picker modal selection):
  // 1. Prefetch + pre-register the new GLB so Mapbox begins GPU compilation.
  //    Also prime into Cache API so it's available locally on next session.
  // 2. Defer the layer model-id swap by 2 animation frames so the old model
  //    stays visible while the new one compiles — prevents the 1-2 frame blank.
  rt.unsubAvatar = subscribeAvatarStore(() => {
    if (!runtime || runtime !== rt) return;
    const newId = getPlayerAvatarModelId();
    // Use the network URL (not blob URL) for addModel — the new GLB hasn't been
    // primed into Cache API yet so getAvatarBlobUrlSync returns the network URL
    // here anyway, but being explicit prevents ordering surprises.
    const networkUrl = getAvatarStore()?.modelUrl ?? FALLBACK_MODEL_URL;
    const newUrl = getPlayerAvatarModelUrl(); // blob URL if already primed, else network

    // Store in Cache API + HTTP cache in the background.
    void primeAvatarGlbCache(networkUrl);

    // Register the model now (starts GPU compile) without touching the layer.
    if (isMapStyleReady(rt.map) && !rt.map.hasModel?.(newId)) {
      try { rt.map.addModel(newId, newUrl); } catch { /* race */ }
    }

    // Swap model-id after the GPU has had 2 frames to begin compilation.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!runtime || runtime !== rt) return;
        rt.compiled = false;
        paintNow(rt);
      });
    });
  });

  rt.onRotate = () => {
    if (!rt.visible) return;
    if (getAvatarWalkSnapshot().phase === 'walking') return;
    // If the avatar has walked somewhere, hold that bearing regardless of how
    // the user orbits the camera. resolveYaw() case 3 handles this; we must
    // not override it here or the avatar spins on every orbit gesture.
    if (getLastWalkBearing() != null) return;
    // Cold open only — no walk history yet; face along current camera bearing.
    applyYaw(rt.map, rt.map.getBearing() + PLAYER_AVATAR_YAW_OFFSET_DEG);
    rt.map.triggerRepaint?.();
  };
  map.on('rotate', rt.onRotate);

  rt.onStyle = () => {
    rt.compiled = false;
    compiledModelId = null;
    window.setTimeout(() => {
      if (!runtime || runtime !== rt) return;
      rt.compiled = compile(rt.map);
      queuePaint(rt);
    }, 0);
  };
  map.on('style.load', rt.onStyle);

  queuePaint(rt);
}

export type PushPlayerAvatarTargetOpts = {
  mode?: LocomotionMode;
  /** Cold open / app reopen — land once, then walk. */
  snap?: boolean;
};

/**
 * Passive GPS target. Never clears the mesh — only retargets the walk.
 * Pass null only when Find Me fully stops.
 */
export function pushPlayerAvatarTarget(
  coords: UserCoords | null,
  opts?: PushPlayerAvatarTargetOpts,
): void {
  if (coords == null) {
    // Soft: keep last pose on screen; caller should detach to hide.
    return;
  }
  const walk = getAvatarWalkSnapshot();
  setAvatarWalkTarget(coords, {
    mode: opts?.mode,
    snap: opts?.snap === true || walk.pose == null,
  });
  if (runtime) queuePaint(runtime);
}

/** Explicit hide (Find Me fully stopped). The only soft path that blanks. */
export function hidePlayerAvatar(): void {
  if (!runtime) return;
  const source = safeGetSource(runtime.map, PLAYER_AVATAR_SOURCE) as
    | GeoJSONSource
    | undefined;
  try {
    source?.setData(EMPTY);
    setLayerVisible(runtime.map, false);
  } catch {
    /* ignore */
  }
  runtime.visible = false;
  lastPainted = null;
}

/**
 * Detach runtime listeners.
 *
 * Soft (default): keep the painted feature + compiled model + walk pose so
 * React Strict Mode / ready flaps cannot flash the player off.
 * Hard: blank + optionally dispose model / clear pose (leave Game).
 */
export function detachPlayerAvatarRuntime(opts?: {
  disposeModel?: boolean;
  clearPose?: boolean;
  /** Blank the GeoJSON feature. Default false — sticky on-screen. */
  blankFeature?: boolean;
}): void {
  const rt = runtime;
  if (!rt) return;
  runtime = null;
  lastPainted = null;

  rt.unsubWalk?.();
  rt.unsubWalk = null;
  rt.unsubAvatar?.();
  rt.unsubAvatar = null;
  if (rt.onRotate) rt.map.off('rotate', rt.onRotate);
  if (rt.onStyle) rt.map.off('style.load', rt.onStyle);
  if (rt.onClick) rt.map.off('click', PLAYER_AVATAR_LAYER, rt.onClick);
  rt.onRotate = null;
  rt.onStyle = null;
  rt.onClick = null;

  if (opts?.clearPose) {
    clearAvatarWalk();
    writeSessionPose(null);
  }

  if (!isMapStyleReady(rt.map)) return;

  const blank = opts?.blankFeature === true || opts?.disposeModel === true;
  if (blank) {
    try {
      const source = rt.map.getSource(PLAYER_AVATAR_SOURCE) as
        | GeoJSONSource
        | undefined;
      source?.setData(EMPTY);
      setLayerVisible(rt.map, false);
    } catch {
      /* ignore */
    }
  }

  if (!opts?.disposeModel) return;

  // Capture before clearing so we remove the model that is actually compiled,
  // not the static fallback constant (which may differ if the user picked a
  // custom avatar).
  const modelToRemove = compiledModelId;
  compiledModelId = null;
  setAvatarRenderError(false);
  try {
    if (rt.map.getLayer(PLAYER_AVATAR_LAYER)) {
      rt.map.removeLayer(PLAYER_AVATAR_LAYER);
    }
    if (rt.map.getSource(PLAYER_AVATAR_SOURCE)) {
      rt.map.removeSource(PLAYER_AVATAR_SOURCE);
    }
    if (
      modelToRemove &&
      typeof rt.map.removeModel === 'function' &&
      rt.map.hasModel?.(modelToRemove)
    ) {
      rt.map.removeModel(modelToRemove);
    }
  } catch {
    /* ignore */
  }
}

export function isPlayerAvatarRuntimeAttached(): boolean {
  return runtime != null;
}
