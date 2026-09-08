/**
 * GameRenderService — clean lifecycle orchestrator for world model rendering.
 *
 * Owns the full game rendering lifecycle:
 *   init()    → register catalog models + add source/layers + start RAF
 *   patch()   → diff placements, update GeoJSON source only when data changed
 *   teardown() → stop RAF, remove layers, clean up
 *
 * WorldModelsLayer.tsx becomes a thin mount wrapper that calls this service.
 * All Mapbox plumbing lives in ensurePlacementLayers.ts (unchanged).
 *
 * Pop-in animation: new placements enter at model-scale 0 → full via a brief
 * RAF-driven setPaintProperty tween. Keeps the effect fully native Mapbox.
 */

import type { Map as MapboxMap } from 'mapbox-gl';
import type { FeatureCollection, Point } from 'geojson';
import {
  ensureWorldPlacementLayers,
  removeWorldPlacementLayers,
  startWorldPlacementPulse,
  stopWorldPlacementPulse,
} from '@/features/map/game/world/ensurePlacementLayers';
import { isMapStyleReady } from '@/map/engine/mapStyleGuard';
import type { WorldModelSpec } from '@/features/map/game/world/catalog';
import {
  worldModelLayerId,
  WORLD_LOD_3D_MIN_ZOOM,
} from '@/features/map/game/world/catalog';
import type { WorldPlacementRaw } from '@/features/map/game/world/placementsStore';
import {
  getWorldPlacementsSnapshot,
  rebuildWorldPlacementFeatures,
} from '@/features/map/game/world/placementsStore';

export {
  ensureLodCircleLayer,
} from '@/features/map/game/world/ensurePlacementLayers';
export {
  WORLD_LOD_CIRCLE_LAYER_ID,
} from '@/features/map/game/world/catalog';

// ─── LOD constants ────────────────────────────────────────────────────────────

/**
 * Below this zoom 3D models are replaced with 2D circle indicators.
 * Keeps GPU load flat when the admin or explore map zooms out.
 * Note: the game map is locked at 18.5 so this only fires in explore/admin.
 */
export const LOD_3D_MIN_ZOOM = WORLD_LOD_3D_MIN_ZOOM;

// ─── Pop-in animation ─────────────────────────────────────────────────────────

/** Duration for the scale-up pop-in on new placements (ms). */
const POP_IN_DURATION_MS = 380;
/** Easing — ease-out cubic: fast start, smooth finish. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

interface PopInJob {
  slug: string;
  startMs: number;
  targetScale: [number, number, number];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export interface GameRenderService {
  init(map: MapboxMap, catalog: WorldModelSpec[]): void;
  /** Call whenever placements change — diffs and applies efficiently. */
  patch(placements: WorldPlacementRaw[]): void;
  /** Force layer re-apply after style.load (bypasses snapshot short-circuit). */
  repaint(placements: WorldPlacementRaw[]): void;
  teardown(): void;
}

export function createGameRenderService(): GameRenderService {
  let _map: MapboxMap | null = null;
  let _catalog: WorldModelSpec[] = [];
  let _lastSnapshotRef: FeatureCollection<Point> | null = null;
  let _popInRaf: number | null = null;
  const _popInJobs: PopInJob[] = [];
  let _knownIds = new Set<string>();

  // ─── Pop-in RAF ──────────────────────────────────────────────────────────────

  function tickPopIn(now: number): void {
    const map = _map;
    if (!map || !isMapStyleReady(map) || _popInJobs.length === 0) {
      _popInRaf = null;
      return;
    }

    let anyRunning = false;
    for (let i = _popInJobs.length - 1; i >= 0; i--) {
      const job = _popInJobs[i]!;
      const elapsed = now - job.startMs;
      const t = Math.min(1, elapsed / POP_IN_DURATION_MS);
      const eased = easeOutCubic(t);
      const s: [number, number, number] = [
        job.targetScale[0] * eased,
        job.targetScale[1] * eased,
        job.targetScale[2] * eased,
      ];
      try {
        // model-scale via setPaintProperty — only works for layers whose
        // model-scale paint property is set to a fixed value (not an expression).
        map.setPaintProperty(worldModelLayerId(job.slug), 'model-scale', s);
      } catch {
        /* layer not ready yet — skip tick */
      }
      if (t >= 1) {
        _popInJobs.splice(i, 1);
      } else {
        anyRunning = true;
      }
    }

    if (anyRunning) {
      _popInRaf = requestAnimationFrame(tickPopIn);
    } else {
      _popInRaf = null;
    }
  }

  function schedulePopIn(slug: string, targetScale: [number, number, number]): void {
    // Skip if a job for this slug is already running
    if (_popInJobs.some((j) => j.slug === slug)) return;
    _popInJobs.push({ slug, startMs: performance.now(), targetScale });
    if (_popInRaf == null) {
      _popInRaf = requestAnimationFrame(tickPopIn);
    }
  }

  // ─── Patch logic ─────────────────────────────────────────────────────────────

  function patch(placements: WorldPlacementRaw[]): void {
    const map = _map;
    if (!map || !isMapStyleReady(map)) return;

    // Detect newly added placement IDs for pop-in
    const nextIds = new Set(placements.map((p) => p.id));
    const newIds = new Set([...nextIds].filter((id) => !_knownIds.has(id)));
    _knownIds = nextIds;

    // Never rebuild here — rebuild emits a new snapshot and would re-trigger
    // WorldModelsLayer's `data` effect → infinite patch loop / max call stack.
    // Catalog changes rebuild via WorldModelsLayer; raw writes rebuild in the store.
    const snapshot = getWorldPlacementsSnapshot();

    // Diff snapshot reference — avoid redundant setData calls
    if (snapshot === _lastSnapshotRef) return;
    _lastSnapshotRef = snapshot;

    ensureWorldPlacementLayers(map, snapshot);

    // Schedule pop-in for each newly added slug
    if (newIds.size > 0) {
      for (const feature of snapshot.features) {
        const props = feature.properties as {
          id?: string;
          slug?: string;
          modelScale?: [number, number, number];
        } | null;
        if (
          props?.id &&
          newIds.has(props.id) &&
          props.slug &&
          props.modelScale
        ) {
          schedulePopIn(props.slug, props.modelScale);
        }
      }
    }

    if (snapshot.features.length > 0) {
      startWorldPlacementPulse(map);
    }
  }

  // ─── LOD layer visibility ─────────────────────────────────────────────────────

  /**
   * Apply LOD zoom-based visibility expressions to all model layers.
   * Called once after layers are established. Keeps GPU load flat on
   * statewide explore/admin views while preserving full 3D at game zoom.
   */
  function applyLodExpressions(): void {
    const map = _map;
    if (!map || !isMapStyleReady(map)) return;
    for (const spec of _catalog) {
      const layerId = worldModelLayerId(spec.slug);
      try {
        if (!map.getLayer(layerId)) continue;
        map.setLayoutProperty(layerId, 'visibility', 'visible');
        // min-zoom is the cleanest LOD lever — Mapbox hides the layer below it.
        map.setLayerZoomRange(layerId, LOD_3D_MIN_ZOOM, 24);
      } catch {
        /* layer not ready yet */
      }
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  function repaint(placements: WorldPlacementRaw[]): void {
    _lastSnapshotRef = null;
    patch(placements);
  }

  function init(map: MapboxMap, catalog: WorldModelSpec[]): void {
    _map = map;
    _catalog = catalog;
    _knownIds = new Set();
    _lastSnapshotRef = null;

    if (!isMapStyleReady(map)) return;

    rebuildWorldPlacementFeatures();
    const snapshot = getWorldPlacementsSnapshot();
    ensureWorldPlacementLayers(map, snapshot);
    applyLodExpressions();

    if (snapshot.features.length > 0) startWorldPlacementPulse(map);
  }

  function teardown(): void {
    stopWorldPlacementPulse();
    if (_popInRaf != null) {
      cancelAnimationFrame(_popInRaf);
      _popInRaf = null;
    }
    _popInJobs.length = 0;
    if (_map) {
      try {
        removeWorldPlacementLayers(_map);
      } catch {
        /* already removed */
      }
    }
    _map = null;
    _catalog = [];
    _knownIds = new Set();
    _lastSnapshotRef = null;
  }

  return { init, patch, repaint, teardown };
}
