/**
 * Map click / hover hit policy.
 *
 * Hit priority (first match wins when querying rendered features):
 *   page → pin → saved_address → nearby → atlas → point_territory → school → district_part →
 *   ctu → school_district → house/senate → district → county
 *
 * Atlas hits open dock details (kind=atlas) and frame the camera; hover still
 * uses the floating name/type/blurb card.
 *
 * Miss action comes from the active MapInteractionMode (itself derived from
 * DockMode + ownership in resolveMapInteractionMode):
 *   browse / compose / locate → drop-point
 *   explore / mentions / route → ignore
 *
 * Drop-point range gate (object-radar rangeM, max 500m) is Live/Play only —
 * Scout free-roam allows empty-map clicks anywhere. See useCountyMapInteraction.
 *
 * Do not reorder ALL_LAYER_SPECS casually — layer stacking and UX both depend
 * on this order.
 */

import type { MapInteractionMode } from '@/features/map/interaction/mapInteractionMode';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import {
  GAME_ATLAS_POINT_LAYER_IDS,
  GAME_ATLAS_POLYGON_LAYER_IDS,
} from '@/features/map/atlas/gameAtlasCollections';
import { MAP_SOURCE_IDS } from '@/map/data/MapDataStore';

/** Hit-test category — ordered by priority inside the policy. */
export type MapHitCategory =
  | 'page'
  | 'pin'
  | 'saved_address'
  | 'nearby'
  | 'atlas'
  | 'point_territory'
  | 'school'
  | 'district_part'
  | 'ctu'
  | 'school_district'
  | 'house_district'
  | 'senate_district'
  | 'district'
  | 'county';

/**
 * Point layers get zoom-scaled bbox hit padding; polygon fills stay exact-pixel
 * so neighboring counties/CTUs aren't pulled in by a padded query.
 */
export type MapHitGeometryKind = 'point' | 'polygon';

export type MapHitLayerSpec = {
  category: MapHitCategory;
  layerIds: string[];
  sourceId: string;
  /** Default dock kind when feature props don’t override. */
  kind: DockEntity['kind'];
  geometryKind: MapHitGeometryKind;
};

export type MapMissAction = 'drop-point' | 'ignore';

export type MapInteractionPolicy = {
  mode: MapInteractionMode;
  /** Categories allowed in this mode (order = hit priority). */
  categories: MapHitCategory[];
  miss: MapMissAction;
  /** Accept community pin hits. */
  allowPins: boolean;
  /** Accept Controls / overlay territory hits. */
  allowTerritories: boolean;
};

const ALL_LAYER_SPECS: MapHitLayerSpec[] = [
  {
    category: 'page',
    layerIds: ['app-directory-pages-hit'],
    sourceId: MAP_SOURCE_IDS.pages,
    kind: 'page',
    geometryKind: 'point',
  },
  {
    category: 'pin',
    layerIds: ['app-community-pins-hit', 'app-community-pins-avatar'],
    sourceId: MAP_SOURCE_IDS.pins,
    kind: 'pin',
    geometryKind: 'point',
  },
  {
    // Handled before DockEntity resolution (see isSavedAddressesSource) — `kind`
    // is unused, kept only to satisfy MapHitLayerSpec's shape.
    category: 'saved_address',
    layerIds: ['app-saved-addresses-hit', 'app-saved-addresses-dot'],
    sourceId: MAP_SOURCE_IDS.savedAddresses,
    kind: 'pin',
    geometryKind: 'point',
  },
  {
    // Handled before DockEntity resolution (see isNearbyPlacesSource) — `kind`
    // is unused, kept only to satisfy MapHitLayerSpec's shape.
    category: 'nearby',
    layerIds: ['app-nearby-places-hit', 'app-nearby-places-dot'],
    sourceId: MAP_SOURCE_IDS.nearby,
    kind: 'pin',
    geometryKind: 'point',
  },
  {
    // Atlas overlays — hover popover + dock details on click (see isAtlasSource).
    category: 'atlas',
    layerIds: [...GAME_ATLAS_POINT_LAYER_IDS],
    sourceId: MAP_SOURCE_IDS.atlasFeatures,
    kind: 'atlas',
    geometryKind: 'point',
  },
  {
    category: 'atlas',
    layerIds: [...GAME_ATLAS_POLYGON_LAYER_IDS],
    sourceId: MAP_SOURCE_IDS.atlasFeatures,
    kind: 'atlas',
    geometryKind: 'polygon',
  },
  {
    category: 'point_territory',
    layerIds: ['app-point-territories-fill', 'app-point-territories-circle'],
    sourceId: MAP_SOURCE_IDS.pointTerritories,
    kind: 'county',
    // Fill overlays — exact pixel so padding doesn't pull neighboring fills.
    geometryKind: 'polygon',
  },
  {
    category: 'school',
    layerIds: ['app-schools-label', 'app-schools-fill', 'app-schools-point'],
    sourceId: MAP_SOURCE_IDS.schools,
    kind: 'school',
    geometryKind: 'point',
  },
  {
    category: 'district_part',
    layerIds: ['app-district-parts-fill'],
    sourceId: MAP_SOURCE_IDS.districtParts,
    kind: 'district_part',
    geometryKind: 'polygon',
  },
  {
    category: 'ctu',
    layerIds: ['app-ctus-fill'],
    sourceId: MAP_SOURCE_IDS.ctus,
    kind: 'ctu',
    geometryKind: 'polygon',
  },
  {
    category: 'school_district',
    layerIds: ['app-school-districts-fill'],
    sourceId: MAP_SOURCE_IDS.schoolDistricts,
    kind: 'school_district',
    geometryKind: 'polygon',
  },
  {
    category: 'house_district',
    layerIds: ['app-house-districts-fill', 'app-house-districts-label'],
    sourceId: MAP_SOURCE_IDS.houseDistricts,
    kind: 'house_district',
    geometryKind: 'polygon',
  },
  {
    category: 'senate_district',
    layerIds: ['app-senate-districts-fill', 'app-senate-districts-label'],
    sourceId: MAP_SOURCE_IDS.senateDistricts,
    kind: 'senate_district',
    geometryKind: 'polygon',
  },
  {
    category: 'district',
    layerIds: ['app-districts-fill'],
    sourceId: MAP_SOURCE_IDS.districts,
    kind: 'district',
    geometryKind: 'polygon',
  },
  {
    category: 'county',
    layerIds: ['app-counties-fill'],
    sourceId: MAP_SOURCE_IDS.counties,
    kind: 'county',
    geometryKind: 'polygon',
  },
];

const BROWSE_CATEGORIES: MapHitCategory[] = ALL_LAYER_SPECS.map((s) => s.category);

const EXPLORE_CATEGORIES: MapHitCategory[] = BROWSE_CATEGORIES;

const MENTIONS_CATEGORIES: MapHitCategory[] = ['page', 'pin', 'saved_address'];

const ROUTE_CATEGORIES: MapHitCategory[] = BROWSE_CATEGORIES;

const COMPOSE_CATEGORIES: MapHitCategory[] = [
  'page',
  'pin',
  'saved_address',
  'point_territory',
  // Still allow territory inspect while placing, but miss drops a point.
  'school',
  'district_part',
  'ctu',
  'school_district',
  'house_district',
  'senate_district',
  'district',
  'county',
];

/** Resolve click / hover policy for the active mode. */
export function resolveMapInteractionPolicy(
  mode: MapInteractionMode,
): MapInteractionPolicy {
  switch (mode) {
    case 'explore':
      return {
        mode,
        categories: EXPLORE_CATEGORIES,
        miss: 'ignore',
        allowPins: true,
        allowTerritories: true,
      };
    case 'mentions':
      return {
        mode,
        categories: MENTIONS_CATEGORIES,
        miss: 'ignore',
        allowPins: true,
        allowTerritories: false,
      };
    case 'locate':
      return {
        mode,
        categories: ROUTE_CATEGORIES,
        miss: 'drop-point',
        allowPins: true,
        allowTerritories: true,
      };
    case 'route':
      return {
        mode,
        categories: ROUTE_CATEGORIES,
        miss: 'ignore',
        allowPins: true,
        allowTerritories: true,
      };
    case 'compose':
      return {
        mode,
        categories: COMPOSE_CATEGORIES,
        miss: 'drop-point',
        allowPins: true,
        allowTerritories: true,
      };
    case 'browse':
    default:
      return {
        mode: 'browse',
        categories: BROWSE_CATEGORIES,
        miss: 'drop-point',
        allowPins: true,
        allowTerritories: true,
      };
  }
}

export type LayerGateFlags = {
  pagesOn: boolean;
  pinsOn: boolean;
  nearbyOn: boolean;
  atlasOn: boolean;
  pointTerritoriesOn: boolean;
  schoolsOn: boolean;
  districtPartsOn: boolean;
  citiesOn: boolean;
  schoolDistrictsOn: boolean;
  houseDistrictsOn: boolean;
  senateDistrictsOn: boolean;
  districtsOn: boolean;
  countiesOn: boolean;
};

function categoryEnabled(category: MapHitCategory, gates: LayerGateFlags): boolean {
  switch (category) {
    case 'page':
      return gates.pagesOn;
    case 'pin':
      return gates.pinsOn;
    case 'saved_address':
      // Always-on when signed in (empty GeoJSON = nothing to hit).
      return true;
    case 'nearby':
      return gates.nearbyOn;
    case 'atlas':
      return gates.atlasOn;
    case 'point_territory':
      return gates.pointTerritoriesOn;
    case 'school':
      return gates.schoolsOn;
    case 'district_part':
      return gates.districtPartsOn;
    case 'ctu':
      return gates.citiesOn;
    case 'school_district':
      return gates.schoolDistrictsOn;
    case 'house_district':
      return gates.houseDistrictsOn;
    case 'senate_district':
      return gates.senateDistrictsOn;
    case 'district':
      return gates.districtsOn;
    case 'county':
      return gates.countiesOn;
  }
}

/**
 * Hit-test layer list for the active policy ∩ visibility gates.
 * Order is policy category order (pins first when allowed).
 */
export function buildActiveHitLayers(
  policy: MapInteractionPolicy,
  gates: LayerGateFlags,
): MapHitLayerSpec[] {
  const allowed = new Set(policy.categories);
  return ALL_LAYER_SPECS.filter((spec) => {
    if (!allowed.has(spec.category)) return false;
    if (
      (spec.category === 'pin' || spec.category === 'page') &&
      !policy.allowPins
    ) {
      return false;
    }
    if (
      spec.category !== 'pin' &&
      spec.category !== 'page' &&
      spec.category !== 'point_territory' &&
      spec.category !== 'nearby' &&
      spec.category !== 'saved_address' &&
      spec.category !== 'atlas' &&
      !policy.allowTerritories
    ) {
      return false;
    }
    // Point territories stay queryable whenever policy allows territories
    // (data emptiness handles “nothing to hit”).
    if (spec.category === 'point_territory') {
      return policy.allowTerritories && gates.pointTerritoriesOn;
    }
    // Nearby places are independent of territory ownership — gated only by
    // the What's nearby session (`nearby.on`), not Controls/territory policy.
    if (spec.category === 'nearby') {
      return gates.nearbyOn;
    }
    // Atlas overlays — gated by Controls collection toggles.
    if (spec.category === 'atlas') {
      return gates.atlasOn;
    }
    // Saved addresses are always on for signed-in users.
    if (spec.category === 'saved_address') {
      return true;
    }
    return categoryEnabled(spec.category, gates);
  });
}

export function isPinSource(sourceId: string): boolean {
  return sourceId === MAP_SOURCE_IDS.pins;
}

export function isDirectoryPageSource(sourceId: string): boolean {
  return sourceId === MAP_SOURCE_IDS.pages;
}

export function isPointTerritorySource(sourceId: string): boolean {
  return sourceId === MAP_SOURCE_IDS.pointTerritories;
}

export function isNearbyPlacesSource(sourceId: string): boolean {
  return sourceId === MAP_SOURCE_IDS.nearby;
}

export function isSavedAddressesSource(sourceId: string): boolean {
  return sourceId === MAP_SOURCE_IDS.savedAddresses;
}

export function isAtlasSource(sourceId: string): boolean {
  return sourceId === MAP_SOURCE_IDS.atlasFeatures;
}
