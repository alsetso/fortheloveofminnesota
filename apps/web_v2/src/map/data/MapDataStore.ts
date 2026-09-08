import type { FeatureCollection } from 'geojson';

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };

type Listener = (data: FeatureCollection) => void;

/**
 * Named GeoJSON datasets keyed for Mapbox sources.
 * React (or fetchers) write here; GeoJsonLayer subscribes and calls setData.
 * Avoids per-layer fetch caches and prop-drilling FeatureCollections.
 */
export class MapDataStore {
  private datasets = new Map<string, FeatureCollection>();
  private listeners = new Map<string, Set<Listener>>();

  get(id: string): FeatureCollection {
    return this.datasets.get(id) ?? EMPTY_FC;
  }

  set(id: string, data: FeatureCollection): void {
    this.datasets.set(id, data);
    const subs = this.listeners.get(id);
    if (!subs) return;
    for (const fn of subs) fn(data);
  }

  clear(id: string): void {
    this.set(id, EMPTY_FC);
  }

  subscribe(id: string, listener: Listener): () => void {
    let set = this.listeners.get(id);
    if (!set) {
      set = new Set();
      this.listeners.set(id, set);
    }
    set.add(listener);
    listener(this.get(id));
    return () => {
      set!.delete(listener);
      if (set!.size === 0) this.listeners.delete(id);
    };
  }
}

/** Module singleton for the single-page map shell. */
export const mapDataStore = new MapDataStore();

/** Canonical source ids used by the shell. */
export const MAP_SOURCE_IDS = {
  /** White outside-Minnesota cutout (always on). */
  stateMask: 'app-state-mask',
  counties: 'app-counties',
  ctus: 'app-ctus',
  schoolDistricts: 'app-school-districts',
  schools: 'app-schools',
  districts: 'app-districts',
  districtParts: 'app-district-parts',
  senateDistricts: 'app-senate-districts',
  houseDistricts: 'app-house-districts',
  /** Independent single-feature highlight — not tied to Controls layer visibility. */
  selection: 'app-selection',
  /** Multi-boundary overlays for jurisdictions at a selected / Find Me point. */
  pointTerritories: 'app-point-territories',
  /** Find Me → Selected point Directions line. */
  route: 'app-route',
  /** Public community pins (`community.posts` kind=pin). */
  pins: 'app-community-pins',
  /** User-generated directory pages (`page.pages` with coords + logos). */
  pages: 'app-directory-pages',
  /** Ephemeral What's nearby POI overlay (Find Me / dock). */
  nearby: 'app-nearby-places',
  /** User-saved addresses (lightweight map layer). */
  savedAddresses: 'app-saved-addresses',
  /**
   * World object radar — GeoJSON points of visible (uncollected) world placements
   * in unlocked territories. Scoped to the signed-in account's passport.
   * Runtime ownership: WorldObjectRadarLayer.
   */
  worldObjectRadar: 'app-world-object-radar',
  /**
   * Live atlas overlays (parks / water access / …) streamed by viewport bbox.
   * Runtime ownership: GameAtlasLayer — writes via Mapbox setData, not this store.
   */
  atlasFeatures: 'app-atlas-features',
} as const;
