'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Map as MapboxMap,
  MapboxGeoJSONFeature,
  MapLayerMouseEvent,
  PointLike,
} from 'mapbox-gl';
import { useCommunityPinsVisible } from '@/features/map/community';
import { useDirectoryPagesVisible } from '@/features/map/directory';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import {
  buildActiveHitLayers,
  isAtlasSource,
  isDirectoryPageSource,
  isNearbyPlacesSource,
  isPinSource,
  isPointTerritorySource,
  isSavedAddressesSource,
  canDropSelectedPoint,
  resolveMapInteractionPolicy,
  useMapInteractionMode,
  useSyncMapInteractionMode,
} from '@/features/map/interaction';
import { gameAtlasCollectionLabel } from '@/features/map/atlas/gameAtlasCollections';
import { useGameAtlasEnabledSlugs } from '@/features/map/atlas/gameAtlasVisibilityStore';
import {
  AtlasFeaturePopover,
  type AtlasFeaturePopoverState,
} from '@/features/map/atlas/AtlasFeaturePopover';
import { formatCtuClassLabel } from '@/features/map/territory/territoryLayers';
import { useTerritoryLayers } from '@/features/map/territory/TerritoryLayersProvider';
import {
  EXPLORE_UNLOCKED_PROP,
  PASSPORT_FAR_FOG_ID,
} from '@/features/map/territory/passportCtuPublish';
import {
  EXPLORE_TIER,
  EXPLORE_TIER_PROP,
} from '@/features/map/territory/passportTiers';
import { NearbyPlaceCallout } from '@/features/map/dockCore/controllers/NearbyPlaceCallout';
import { ZoneOutOfBoundsModal } from '@/features/experienceZones/ui/ZoneOutOfBoundsModal';
import {
  PointTerritoryOverlapChooser,
  type PointTerritoryChooserState,
} from '@/features/map/territory/PointTerritoryOverlapChooser';
import {
  TerritoryHoverPopover,
  type TerritoryHoverPopoverState,
} from '@/features/map/territory/TerritoryHoverPopover';
import { type SelectionKind } from '@/features/map/territory/territorySelection';
import { useTerritoryFocusCamera } from '@/features/map/territory/useTerritoryFocusCamera';
import { commitMinnesotaMapPoint } from '@/lib/geo/commitMinnesotaMapPoint';
import { crowFliesMiles } from '@/lib/geo/crowFliesDistance';
import { flyToNearbyPlace } from '@/lib/geo/flyToNearbyPlace';
import {
  openContributeSheet,
  openContributeSheetWithError,
} from '@/features/community/contributeSheetStore';
import { getVenueModeSnapshot } from '@/features/experienceZones/store/venueModeStore';
import { getZoneGeometryById } from '@/features/experienceZones/map/AllExperienceZonesLayer';
import { showZoneOutOfBounds } from '@/features/experienceZones/store/zoneOutOfBoundsStore';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { showOutOfRangePin } from '@/map/points/outOfRangePin';
import {
  getCurrentTerritoryStackSnapshot,
} from '@/features/accountTerritories/store/currentTerritoryStackStore';
import {
  getNearbyPlaceById,
  getNearbyPlacesSnapshot,
  selectNearbyPlace,
  useNearbyPlaces,
} from '@/lib/geo/nearby/nearbyPlacesStore';
import { MAP_SOURCE_IDS, setFeatureSelected, useMapContext } from '@/map';
import { shouldIgnoreMapClick } from '@/map/engine/mapClickGate';
import { isMapStyleReady, safeGetLayer, safeGetSource } from '@/map/engine/mapStyleGuard';
import {
  isWorldPlaceModeActive,
  placeWorldModel,
  queryWorldPlacementAtPoint,
} from '@/features/map/game/world';
import {
  getHitTestPaddingPx,
  pointXY,
  rankFeaturesByScreenDistance,
} from '@/features/map/territory/hitTestPadding';
import {
  getPresenceOrigin,
  isPresenceLive,
} from '@/map/location/positionMode/playerPresenceOrigin';
import { easeMapClickZoomIn } from '@/map/location/camera/mapClickZoom';
import { getObjectRadarState } from '@/features/map/game/objectRadar/objectRadarStore';
import { setMapSurface, clearMapSurface } from '@/map/surface/mapSurfaceStore';
import { parseMapSurfaceFeatures } from '@/map/surface/parseMapSurfaceFeatures';
import { pointAtLocationCacheKey } from '@/features/map/dockCore/store/pointAtLocationCache';
import { setMapGeoFeatures } from '@/map/geo/mapGeoFeaturesStore';
import { normalizeMapboxFeatures } from '@/map/geo/appGeoFeature';

type HoverTarget = {
  sourceId: string;
  featureId: string | number;
};

const SOURCE_BY_KIND: Partial<Record<SelectionKind, string>> = {
  county: MAP_SOURCE_IDS.counties,
  ctu: MAP_SOURCE_IDS.ctus,
  school_district: MAP_SOURCE_IDS.schoolDistricts,
  school: MAP_SOURCE_IDS.schools,
  district: MAP_SOURCE_IDS.districts,
  district_part: MAP_SOURCE_IDS.districtParts,
  senate_district: MAP_SOURCE_IDS.senateDistricts,
  house_district: MAP_SOURCE_IDS.houseDistricts,
};

/**
 * Typical containment order, innermost first — used to pick which overlapping
 * point-territory overlay wins hover. A congressional district blankets every
 * other boundary, so without this the largest polygon always eats the hit.
 */
const POINT_TERRITORY_RANK: Record<string, number> = {
  school: 0,
  ctu: 1,
  district_part: 2,
  school_district: 3,
  house_district: 4,
  senate_district: 5,
  county: 6,
  district: 7,
};

function pointTerritoryRank(feature: MapboxGeoJSONFeature): number {
  const kind = feature.properties?.kind;
  return typeof kind === 'string' ? (POINT_TERRITORY_RANK[kind] ?? 8) : 8;
}

function isSelectionKind(kind: DockEntity['kind'] | string): kind is SelectionKind {
  return kind in SOURCE_BY_KIND;
}

function setHoverState(
  map: MapboxMap,
  sourceId: string,
  featureId: string | number | null,
  prev: HoverTarget | null,
): void {
  if (prev && (prev.sourceId !== sourceId || prev.featureId !== featureId)) {
    if (safeGetSource(map, prev.sourceId)) {
      try {
        map.setFeatureState(
          { source: prev.sourceId, id: prev.featureId },
          { hover: false },
        );
      } catch {
        /* ignore */
      }
    }
  }
  if (featureId != null && safeGetSource(map, sourceId)) {
    try {
      map.setFeatureState({ source: sourceId, id: featureId }, { hover: true });
    } catch {
      /* ignore */
    }
  }
}

function clearHover(map: MapboxMap, prev: HoverTarget | null): void {
  if (!prev || !safeGetSource(map, prev.sourceId)) return;
  try {
    map.setFeatureState({ source: prev.sourceId, id: prev.featureId }, { hover: false });
  } catch {
    /* ignore */
  }
}

function featureName(
  feature: MapboxGeoJSONFeature,
  kind?: DockEntity['kind'],
): string {
  const props = feature.properties ?? {};
  if (kind === 'page') {
    return String(props.name ?? props.title ?? 'Page');
  }
  if (kind === 'pin') {
    const username = props.username;
    if (typeof username === 'string' && username.trim()) {
      return `@${username.trim()}`;
    }
    return String(props.title ?? 'Community pin');
  }
  return String(props.name ?? props.county_name ?? props.feature_name ?? 'Area');
}

function featureSubtitle(
  feature: MapboxGeoJSONFeature,
  kind: DockEntity['kind'],
): string | undefined {
  const props = feature.properties ?? {};
  if (kind === 'page') {
    if (props.address != null && String(props.address).trim()) {
      return String(props.address);
    }
    if (props.page_type_label != null && String(props.page_type_label).trim()) {
      return String(props.page_type_label);
    }
    return undefined;
  }
  if (kind === 'pin') {
    if (props.address != null && String(props.address).trim()) {
      return String(props.address);
    }
    if (props.title != null && String(props.title).trim()) {
      return String(props.title);
    }
    return undefined;
  }
  if (kind === 'ctu' && props.county_name != null) return String(props.county_name);
  if (kind === 'school_district' && props.sd_number != null) return `ISD ${props.sd_number}`;
  if (kind === 'district' && props.district_number != null) {
    return `CD ${props.district_number}`;
  }
  if (kind === 'senate_district' && props.district_code != null) {
    return `SD ${props.district_code}`;
  }
  if (kind === 'house_district' && props.district_code != null) {
    return `HD ${props.district_code}`;
  }
  if (kind === 'district_part') {
    if (props.county != null && props.district_number != null) {
      return `${props.county} · CD ${props.district_number}`;
    }
    if (props.district_number != null) return `CD ${props.district_number}`;
  }
  if (kind === 'school' && props.school_type != null) return String(props.school_type);
  if (props.slug != null) return String(props.slug);
  return undefined;
}

function featureKindLabel(
  feature: MapboxGeoJSONFeature,
  kind: DockEntity['kind'],
): string | undefined {
  const props = feature.properties ?? {};
  if (kind === 'page') {
    if (props.page_type_label != null && String(props.page_type_label).trim()) {
      return String(props.page_type_label);
    }
    return 'Page';
  }
  if (kind === 'pin') {
    if (props.title != null && String(props.title).trim()) return String(props.title);
    return 'Pin';
  }
  if (kind === 'ctu') {
    return (
      formatCtuClassLabel(
        typeof props.ctu_class === 'string' ? props.ctu_class : null,
      ) ?? 'City / town'
    );
  }
  if (kind === 'county') return 'County';
  if (kind === 'school_district') return 'School district';
  if (kind === 'district') return 'Congressional district';
  if (kind === 'senate_district') return 'Senate district';
  if (kind === 'house_district') return 'House district';
  if (kind === 'district_part') return 'Precinct';
  if (kind === 'school') return 'School';
  return undefined;
}

function featureSummary(
  feature: MapboxGeoJSONFeature,
  kind: DockEntity['kind'],
): string | undefined {
  if (kind === 'page') {
    const description = feature.properties?.description;
    if (typeof description === 'string' && description.trim()) return description.trim();
    return undefined;
  }
  if (kind !== 'pin') return undefined;
  const body = feature.properties?.body;
  if (typeof body === 'string' && body.trim()) return body.trim();
  return undefined;
}

function featureImageUrl(
  feature: MapboxGeoJSONFeature,
  kind: DockEntity['kind'],
): string | null | undefined {
  if (kind === 'page') {
    const url = feature.properties?.logo_url;
    return typeof url === 'string' && url.trim() ? url.trim() : null;
  }
  if (kind !== 'pin') return undefined;
  const url = feature.properties?.account_image_url;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}

/** Passport-unlockable atlas kinds (matches territory.units / presence). */
const UNLOCKABLE_KINDS = new Set<DockEntity['kind']>([
  'county',
  'ctu',
  'school_district',
  // district / senate_district / house_district: hidden for first launch
]);

function featureIsLocked(
  feature: MapboxGeoJSONFeature,
  kind: DockEntity['kind'],
  isUnlocked: (entityKind: string, unitId: string) => boolean | null,
): boolean {
  if (!UNLOCKABLE_KINDS.has(kind)) return false;
  const stamped = feature.properties?.[EXPLORE_UNLOCKED_PROP];
  if (stamped === 0 || stamped === '0') return true;
  if (stamped === 1 || stamped === '1') return false;
  const id = String(feature.properties?.id ?? feature.id ?? '');
  if (!id) return false;
  return isUnlocked(kind, id) === false;
}

/** Passport far fog — opaque grey mask / far tier, never hittable. */
function featureIsFarFog(feature: MapboxGeoJSONFeature): boolean {
  const id = String(feature.properties?.id ?? feature.id ?? '');
  if (id === PASSPORT_FAR_FOG_ID) return true;
  const tier = feature.properties?.[EXPLORE_TIER_PROP];
  return tier === EXPLORE_TIER.far || tier === '0';
}

/**
 * Hover + click — driven by `mapInteractionMode` policy.
 * Hit order and miss action come from `resolveMapInteractionPolicy`.
 */
export function useTerritoryMapInteraction(
  setHoverPopover: (next: TerritoryHoverPopoverState) => void,
  setOverlapChooser?: (next: PointTerritoryChooserState) => void,
  setAtlasPopover?: (next: AtlasFeaturePopoverState) => void,
): { dismissAtlasPopover: () => void } {
  const { map, ready } = useMapContext();
  const {
    isActive,
    countyOverlays,
    districtSchools,
    schoolsLayer,
    districtParts,
    loadDistrictParts,
    isUnlocked,
  } = useTerritoryLayers();
  const {
    openDetails,
    openPinCard,
    openSelectedPoint,
    openNearbyPlaceCard,
    selectedEntity,
    pinCardEntity,
    pageCardEntity,
    dockCard,
    clearMapSelection,
  } = useMapDock();
  const pinsOn = useCommunityPinsVisible();
  const pagesOn = useDirectoryPagesVisible();
  const nearbyOn = useNearbyPlaces().on;
  const atlasOn = useGameAtlasEnabledSlugs().length > 0;
  const interactionMode = useMapInteractionMode();

  const countiesOn = isActive('counties');
  const citiesOn =
    ((countyOverlays.citiesOn || countyOverlays.townsOn) &&
      countyOverlays.countyId != null) ||
    isActive('cities-and-towns');
  const schoolDistrictsOn =
    isActive('school-districts') || countyOverlays.schoolDistrictsOn;
  const schoolsOn = districtSchools.schoolsOn || schoolsLayer.on;
  const districtsOn = isActive('districts');
  const senateDistrictsOn = isActive('senate-districts');
  const houseDistrictsOn = isActive('house-districts');
  const districtPartsOn = districtParts.partsOn;

  const hoverRef = useRef<HoverTarget | null>(null);
  const selectedRef = useRef<{ sourceId: string; id: string } | null>(null);
  const openDetailsRef = useRef(openDetails);
  openDetailsRef.current = openDetails;
  const openPinCardRef = useRef(openPinCard);
  openPinCardRef.current = openPinCard;
  const openSelectedPointRef = useRef(openSelectedPoint);
  openSelectedPointRef.current = openSelectedPoint;
  const openNearbyPlaceCardRef = useRef(openNearbyPlaceCard);
  openNearbyPlaceCardRef.current = openNearbyPlaceCard;
  const clearMapSelectionRef = useRef(clearMapSelection);
  clearMapSelectionRef.current = clearMapSelection;
  const selectedEntityRef = useRef(selectedEntity);
  selectedEntityRef.current = selectedEntity;
  const pinCardEntityRef = useRef(pinCardEntity);
  pinCardEntityRef.current = pinCardEntity;
  const pageCardEntityRef = useRef(pageCardEntity);
  pageCardEntityRef.current = pageCardEntity;
  const dockCardRef = useRef(dockCard);
  dockCardRef.current = dockCard;
  const loadDistrictPartsRef = useRef(loadDistrictParts);
  loadDistrictPartsRef.current = loadDistrictParts;
  const setHoverPopoverRef = useRef(setHoverPopover);
  setHoverPopoverRef.current = setHoverPopover;
  const setOverlapChooserRef = useRef(setOverlapChooser);
  setOverlapChooserRef.current = setOverlapChooser;
  const setAtlasPopoverRef = useRef(setAtlasPopover);
  setAtlasPopoverRef.current = setAtlasPopover;
  const isUnlockedRef = useRef(isUnlocked);
  isUnlockedRef.current = isUnlocked;
  const clickBusyRef = useRef(false);
  const atlasPinnedIdRef = useRef<string | null>(null);

  const dismissAtlasPopover = useCallback(() => {
    atlasPinnedIdRef.current = null;
    setAtlasPopoverRef.current?.(null);
  }, []);

  useEffect(() => {
    if (!map || !ready) return;
    const sel = selectedRef.current;
    if (!sel || sel.sourceId !== MAP_SOURCE_IDS.ctus) return;
    setFeatureSelected(map, sel.sourceId, null, sel.id);
    selectedRef.current = null;
  }, [map, ready, citiesOn, countyOverlays.countyId]);

  useEffect(() => {
    if (!map || !ready) return;
    if (!selectedEntity || !isSelectionKind(selectedEntity.kind)) {
      const prev = selectedRef.current;
      if (prev) {
        setFeatureSelected(map, prev.sourceId, null, prev.id);
        selectedRef.current = null;
      }
      return;
    }
    const sourceId = SOURCE_BY_KIND[selectedEntity.kind];
    if (!sourceId) return;
    const prev = selectedRef.current;
    if (prev?.sourceId === sourceId && prev.id === selectedEntity.id) return;
    if (prev) {
      setFeatureSelected(map, prev.sourceId, null, prev.id);
    }
    setFeatureSelected(map, sourceId, selectedEntity.id, null);
    selectedRef.current = { sourceId, id: selectedEntity.id };
  }, [map, ready, selectedEntity]);

  useEffect(() => {
    if (!map || !ready) {
      setHoverPopoverRef.current(null);
      return;
    }

    const policy = resolveMapInteractionPolicy(interactionMode);
    const hitLayers = buildActiveHitLayers(policy, {
      pagesOn,
      pinsOn,
      nearbyOn,
      atlasOn,
      pointTerritoriesOn: policy.allowTerritories,
      schoolsOn,
      districtPartsOn,
      citiesOn,
      schoolDistrictsOn,
      houseDistrictsOn,
      senateDistrictsOn,
      districtsOn,
      countiesOn,
    });

    const hitTest = (point: PointLike) => {
      if (!isMapStyleReady(map)) return null;
      const { x, y } = pointXY(point);
      const padding = getHitTestPaddingPx(map.getZoom());
      const bbox: [PointLike, PointLike] = [
        [x - padding, y - padding],
        [x + padding, y + padding],
      ];
      for (const layer of hitLayers) {
        const queryLayers = layer.layerIds.filter((id) => Boolean(safeGetLayer(map, id)));
        if (queryLayers.length === 0) continue;
        let features: MapboxGeoJSONFeature[] = [];
        try {
          // Point POIs get a zoom-scaled bbox; polygon fills stay exact-pixel
          // so padding doesn't pull in neighboring counties/CTUs.
          features =
            layer.geometryKind === 'polygon'
              ? map.queryRenderedFeatures(point, { layers: queryLayers })
              : map.queryRenderedFeatures(bbox, { layers: queryLayers });
        } catch {
          return null;
        }
        // Passport far fog — skip opaque non-interactive CTUs.
        features = features.filter((f) => !featureIsFarFog(f));
        if (features.length > 1 && layer.geometryKind === 'point') {
          features = rankFeaturesByScreenDistance(map, features, point);
        }
        if (isPointTerritorySource(layer.sourceId)) {
          // Stacked overlays: dedupe (tile seams repeat features) and sort
          // innermost-first so the smallest boundary wins hover, and all of
          // them stay reachable through the overlap chooser on click.
          const seen = new Set<string>();
          const candidates = features.filter((f) => {
            const fid = f.id ?? f.properties?.id;
            if (fid == null) return false;
            const key = `${String(f.properties?.kind ?? '')}:${String(fid)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          candidates.sort((a, b) => pointTerritoryRank(a) - pointTerritoryRank(b));
          const feature = candidates[0];
          if (!feature) continue;
          const id = feature.id ?? feature.properties?.id ?? null;
          if (id == null) continue;
          return { layer, feature, featureId: id as string | number, candidates };
        }
        const feature = features[0];
        if (!feature) continue;
        const id = feature.id ?? feature.properties?.id ?? null;
        if (id == null) continue;
        return {
          layer,
          feature,
          featureId: id as string | number,
          candidates: undefined as MapboxGeoJSONFeature[] | undefined,
        };
      }
      return null;
    };

    const resolveKind = (
      layer: (typeof hitLayers)[number],
      feature: MapboxGeoJSONFeature,
    ): DockEntity['kind'] => {
      if (isPointTerritorySource(layer.sourceId)) {
        const raw = feature.properties?.kind;
        if (typeof raw === 'string' && isSelectionKind(raw)) {
          return raw;
        }
      }
      return layer.kind;
    };

    const clearAllHover = () => {
      clearHover(map, hoverRef.current);
      hoverRef.current = null;
      map.getCanvas().style.cursor = '';
      setHoverPopoverRef.current(null);
      // Keep a click-pinned atlas card; only clear floating hover.
      if (!atlasPinnedIdRef.current) {
        setAtlasPopoverRef.current?.(null);
      }
    };

    const atlasPopoverFromFeature = (
      feature: MapboxGeoJSONFeature,
      x: number,
      y: number,
      pinned: boolean,
    ): AtlasFeaturePopoverState => {
      const props = feature.properties ?? {};
      const id = String(props.id ?? feature.id ?? '');
      const name = String(props.name ?? 'Untitled').trim() || 'Untitled';
      const slug =
        typeof props.collectionSlug === 'string' ? props.collectionSlug : null;
      const blurbRaw = props.blurb;
      const description =
        typeof blurbRaw === 'string' && blurbRaw.trim()
          ? blurbRaw.trim()
          : null;
      return {
        id,
        name,
        type: gameAtlasCollectionLabel(slug),
        description,
        x,
        y,
        pinned,
      };
    };

    const onMove = (e: MapLayerMouseEvent) => {
      const hit = hitTest(e.point);
      if (!hit) {
        clearAllHover();
        return;
      }

      map.getCanvas().style.cursor = 'pointer';

      const x = e.originalEvent?.clientX ?? e.point.x;
      const y = e.originalEvent?.clientY ?? e.point.y;

      // Atlas overlays — dedicated name / type / description popover.
      if (isAtlasSource(hit.layer.sourceId)) {
        clearHover(map, hoverRef.current);
        hoverRef.current = null;
        setHoverPopoverRef.current(null);
        // Don't fight a pinned card with hover updates.
        if (atlasPinnedIdRef.current) return;
        setAtlasPopoverRef.current?.(
          atlasPopoverFromFeature(hit.feature, x, y, false),
        );
        return;
      }

      // Nearby places / saved addresses show their own cards — skip the
      // territory hover popover for these sources.
      if (
        isNearbyPlacesSource(hit.layer.sourceId) ||
        isSavedAddressesSource(hit.layer.sourceId)
      ) {
        clearHover(map, hoverRef.current);
        hoverRef.current = null;
        setHoverPopoverRef.current(null);
        if (!atlasPinnedIdRef.current) setAtlasPopoverRef.current?.(null);
        return;
      }

      if (!atlasPinnedIdRef.current) setAtlasPopoverRef.current?.(null);

      const next: HoverTarget = {
        sourceId: hit.layer.sourceId,
        featureId: hit.featureId,
      };
      if (
        !hoverRef.current ||
        hoverRef.current.sourceId !== next.sourceId ||
        hoverRef.current.featureId !== next.featureId
      ) {
        setHoverState(map, next.sourceId, next.featureId, hoverRef.current);
        hoverRef.current = next;
      }

      const kind = resolveKind(hit.layer, hit.feature);
      const overlapCount = hit.candidates?.length ?? 1;
      const locked = featureIsLocked(hit.feature, kind, isUnlockedRef.current);
      const baseSubtitle =
        featureSubtitle(hit.feature, kind) ?? featureKindLabel(hit.feature, kind);
      setHoverPopoverRef.current({
        name: featureName(hit.feature, kind),
        subtitle:
          overlapCount > 1
            ? `${baseSubtitle ? `${baseSubtitle} · ` : ''}+${overlapCount - 1} more here`
            : baseSubtitle,
        locked,
        x,
        y,
      });
    };

    const clearSelect = () => {
      const prev = selectedRef.current;
      if (prev) {
        setFeatureSelected(map, prev.sourceId, null, prev.id);
        selectedRef.current = null;
      }
      setHoverPopoverRef.current(null);
      atlasPinnedIdRef.current = null;
      setAtlasPopoverRef.current?.(null);
      setOverlapChooserRef.current?.(null);
      clearMapSelectionRef.current();
    };

    /** True when this hit is already the active map selection (reselect → clear). */
    const isCurrentSelection = (opts: {
      id: string;
      kind?: DockEntity['kind'];
      sourceId?: string;
    }): boolean => {
      const { id, kind, sourceId } = opts;
      const sel = selectedRef.current;
      if (sourceId && sel?.sourceId === sourceId && String(sel.id) === id) {
        return true;
      }
      const entity = selectedEntityRef.current;
      if (entity && entity.id === id && (!kind || entity.kind === kind)) {
        return true;
      }
      if (kind === 'pin' && pinCardEntityRef.current?.id === id && dockCardRef.current === 'pin') {
        return true;
      }
      if (kind === 'page' && pageCardEntityRef.current?.id === id && dockCardRef.current === 'page') {
        return true;
      }
      return false;
    };

    const onClick = (e: MapLayerMouseEvent) => {
      // Ignore synthetic clicks after orbit / intentional finger drag.
      if (shouldIgnoreMapClick()) return;

      // Capture ALL Mapbox basemap features at this screen pixel synchronously.
      // Done at the very top so the geo-features debug store is always populated
      // on every map click, regardless of what the hit-test finds.
      try {
        const { lng, lat } = e.lngLat;
        const geoKey = pointAtLocationCacheKey(lat, lng);
        const rendered = map.queryRenderedFeatures(e.point);
        setMapGeoFeatures(geoKey, normalizeMapboxFeatures(rendered));
      } catch {
        // Never let diagnostics block the primary interaction.
      }

      const hit = hitTest(e.point);

      // ── PATH A — feature hit ──────────────────────────────────────────────
      if (hit) {
        // Step zoom in toward max on every feature click (focus camera may reframe territories).
        easeMapClickZoomIn(map, e.lngLat);

        // Atlas feature — open dock details; camera frames via useTerritoryFocusCamera.
        if (isAtlasSource(hit.layer.sourceId)) {
          e.originalEvent?.stopPropagation?.();
          const props = hit.feature.properties ?? {};
          const id = String(props.id ?? hit.featureId ?? '');
          if (!id) return;

          if (isCurrentSelection({ id, kind: 'atlas' })) {
            clearSelect();
            return;
          }

          clearSelect();

          const name = String(props.name ?? 'Untitled').trim() || 'Untitled';
          const slug =
            typeof props.collectionSlug === 'string' ? props.collectionSlug : null;
          const collectionLabel = gameAtlasCollectionLabel(slug);
          const blurbRaw = props.blurb;
          const summary =
            typeof blurbRaw === 'string' && blurbRaw.trim()
              ? blurbRaw.trim()
              : undefined;

          openDetailsRef.current({
            id,
            kind: 'atlas',
            title: name,
            subtitle: collectionLabel,
            kindLabel: collectionLabel,
            summary,
          });
          return;
        }

        // What's nearby — Airbnb-style listing flow (fly + select + open card),
        // never Selected Point / territory details.
        if (isNearbyPlacesSource(hit.layer.sourceId)) {
          e.originalEvent?.stopPropagation?.();
          const placeId = String(hit.feature.properties?.id ?? hit.featureId);
          if (
            getNearbyPlacesSnapshot().selectedPlaceId === placeId &&
            dockCardRef.current === 'nearby-place'
          ) {
            clearSelect();
            return;
          }
          clearSelect();
          const place = getNearbyPlaceById(placeId);
          if (place) {
            selectNearbyPlace(place);
            flyToNearbyPlace(map, place);
            openNearbyPlaceCardRef.current();
          }
          return;
        }

        // Saved address pins — drop a selected point at those coords so the
        // dock pane detects the existing save and shows the saved state inline.
        if (isSavedAddressesSource(hit.layer.sourceId)) {
          e.originalEvent?.stopPropagation?.();
          const props = hit.feature.properties ?? {};
          const geom = hit.feature.geometry;
          const fromGeom =
            geom && geom.type === 'Point' && Array.isArray(geom.coordinates)
              ? { lng: Number(geom.coordinates[0]), lat: Number(geom.coordinates[1]) }
              : null;
          const lat = Number(props.lat ?? fromGeom?.lat);
          const lng = Number(props.lng ?? fromGeom?.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          clearSelect();
          clearMapSurface();
          void (async () => {
            const result = await commitMinnesotaMapPoint(
              { lat, lng },
              { source: 'mapClick', map, fly: true, label: 'Saved address' },
            );
            if (result.ok) openSelectedPointRef.current();
          })();
          return;
        }

        const id = String(hit.feature.properties?.id ?? hit.featureId);
        if (!id) return;

        e.originalEvent?.stopPropagation?.();

        // Stacked point-territory overlays: open the centered chooser so
        // every boundary at this spot stays individually clickable.
        if (hit.candidates && hit.candidates.length > 1 && setOverlapChooserRef.current) {
          clearSelect();
          setOverlapChooserRef.current({
            entries: hit.candidates.flatMap((f) => {
              const fid = f.id ?? f.properties?.id;
              if (fid == null) return [];
              const fKind = resolveKind(hit.layer, f);
              const overlayColor = f.properties?.overlayColor;
              return [
                {
                  entity: {
                    id: String(fid),
                    kind: fKind,
                    title: featureName(f, fKind),
                    subtitle: featureSubtitle(f, fKind),
                    kindLabel: featureKindLabel(f, fKind),
                  },
                  color: typeof overlayColor === 'string' ? overlayColor : undefined,
                  locked: featureIsLocked(f, fKind, isUnlockedRef.current),
                },
              ];
            }),
          });
          return;
        }

        const kind = resolveKind(hit.layer, hit.feature);

        if (
          isCurrentSelection({
            id,
            kind,
            sourceId:
              !isPointTerritorySource(hit.layer.sourceId) &&
              !isPinSource(hit.layer.sourceId) &&
              !isDirectoryPageSource(hit.layer.sourceId)
                ? hit.layer.sourceId
                : undefined,
          })
        ) {
          clearSelect();
          return;
        }

        clearSelect();

        if (
          !isPointTerritorySource(hit.layer.sourceId) &&
          !isPinSource(hit.layer.sourceId) &&
          !isDirectoryPageSource(hit.layer.sourceId)
        ) {
          setFeatureSelected(map, hit.layer.sourceId, id, null);
          selectedRef.current = { sourceId: hit.layer.sourceId, id };
        } else {
          selectedRef.current = null;
        }

        if (kind === 'pin') {
          openPinCardRef.current({
            id,
            kind: 'pin',
            title: featureName(hit.feature, 'pin'),
            subtitle: featureSubtitle(hit.feature, 'pin'),
            kindLabel: featureKindLabel(hit.feature, 'pin'),
            summary: featureSummary(hit.feature, 'pin'),
            imageUrl: featureImageUrl(hit.feature, 'pin'),
          });
          return;
        }

        if (kind === 'district') {
          loadDistrictPartsRef.current(id);
        }

        openDetailsRef.current({
          id,
          kind,
          title: featureName(hit.feature, kind),
          subtitle: featureSubtitle(hit.feature, kind),
          kindLabel: featureKindLabel(hit.feature, kind),
          summary: featureSummary(hit.feature, kind),
          imageUrl: featureImageUrl(hit.feature, kind),
        });
        return;
      }

      // ── PATH B — empty miss ───────────────────────────────────────────────
      clearSelect();

      const canDrop = policy.miss === 'drop-point' && canDropSelectedPoint(interactionMode);
      if (!canDrop) {
        easeMapClickZoomIn(map, e.lngLat);
        return;
      }

      if (clickBusyRef.current) return;

      const { lng, lat } = e.lngLat;

      // Live Play only — blue radar rangeM (≤ 500m) is the contribution boundary.
      // Scout free-roam allows drops anywhere (ring is already Live-only visually).
      if (isPresenceLive()) {
        const origin = getPresenceOrigin();
        if (origin.hasFix) {
          const rangeM = getObjectRadarState().rangeM;
          const distanceM =
            crowFliesMiles(
              { lat: origin.lat, lng: origin.lng },
              { lat, lng },
            ) * 1609.344;
          if (distanceM > rangeM) {
            easeMapClickZoomIn(map, { lng, lat });
            void showOutOfRangePin(map, lng, lat);
            openContributeSheetWithError(
              `You're ${Math.round(distanceM)} m away. Move within the blue zone to contribute here.`,
            );
            return;
          }
        }
      }

      // Zone boundary gate — while Explore Zone is active, only allow pins
      // inside the zone polygon. Outside taps open the "Outside your zone"
      // modal instead of committing a point.
      const venueSnap = getVenueModeSnapshot();
      if (venueSnap.exploring && venueSnap.zoneId) {
        const zoneGeom = getZoneGeometryById(venueSnap.zoneId);
        if (zoneGeom) {
          const turfPoint = { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [lng, lat] }, properties: {} };
          const inside = booleanPointInPolygon(turfPoint, { type: 'Feature' as const, geometry: zoneGeom, properties: {} });
          if (!inside) {
            // Capture the pending pin commit as a closure so "Leave Zone" can
            // proceed with the exact same location after the user confirms.
            const pendingLat = lat;
            const pendingLng = lng;
            const pendingSurfaceKey = pointAtLocationCacheKey(lat, lng);
            let pendingSurfaceChips: ReturnType<typeof parseMapSurfaceFeatures> = [];
            let pendingGeoFeatures: ReturnType<typeof normalizeMapboxFeatures> = [];
            try {
              const rendered = map.queryRenderedFeatures(e.point);
              pendingSurfaceChips = parseMapSurfaceFeatures(rendered);
              pendingGeoFeatures = normalizeMapboxFeatures(rendered);
            } catch { /* ignore */ }

            easeMapClickZoomIn(map, { lng, lat });
            showZoneOutOfBounds(venueSnap.zoneName ?? '', () => {
              // Retry the commit after the user leaves the zone.
              void (async () => {
                const result = await commitMinnesotaMapPoint(
                  { lat: pendingLat, lng: pendingLng },
                  { source: 'mapClick', map, fly: true, label: 'Map point' },
                );
                if (result.ok) {
                  setMapGeoFeatures(pendingSurfaceKey, pendingGeoFeatures);
                  if (pendingSurfaceChips.length > 0) setMapSurface(pendingSurfaceKey, pendingSurfaceChips);
                  const stackSnap = getCurrentTerritoryStackSnapshot();
                  const ctu = stackSnap.jurisdictions.find((j) => j.kind === 'ctu');
                  // Zone context cleared — open normal CTU-scoped sheet.
                  openContributeSheet({
                    ctu: ctu ? { id: ctu.id, name: ctu.name, kindLabel: ctu.kindLabel } : null,
                    experienceZoneId: null,
                    experienceZoneName: null,
                  });
                }
              })();
            });
            return;
          }
        }
      }

      // Placement hit disk — don't place a new model or selected-point pin on it.
      if (queryWorldPlacementAtPoint(map, e.point)) {
        easeMapClickZoomIn(map, { lng, lat });
        return;
      }
      if (isWorldPlaceModeActive()) {
        easeMapClickZoomIn(map, { lng, lat });
        clickBusyRef.current = true;
        void placeWorldModel({ lat, lng }).finally(() => {
          clickBusyRef.current = false;
        });
        return;
      }

      // Parse surface chips for the pill (condensed, miss-only).
      // Geo features were already captured at the top of onClick — hold a
      // reference here so we can re-write them AFTER commitMinnesotaMapPoint,
      // which calls clearMapGeoFeatures() internally.
      const surfaceKey = pointAtLocationCacheKey(lat, lng);
      let surfaceChips: ReturnType<typeof parseMapSurfaceFeatures> = [];
      let capturedGeoFeatures: ReturnType<typeof normalizeMapboxFeatures> = [];
      try {
        const rendered = map.queryRenderedFeatures(e.point);
        surfaceChips = parseMapSurfaceFeatures(rendered);
        capturedGeoFeatures = normalizeMapboxFeatures(rendered);
      } catch {
        // Never let surface parsing block the primary commit flow.
      }

      clickBusyRef.current = true;
      void (async () => {
        try {
          const result = await commitMinnesotaMapPoint(
            { lat, lng },
            { source: 'mapClick', map, fly: true, label: 'Map point' },
          );
          if (result.ok) {
            // Re-write captured features after commit clears them.
            setMapGeoFeatures(surfaceKey, capturedGeoFeatures);
            if (surfaceChips.length > 0) setMapSurface(surfaceKey, surfaceChips);
            // Open the contribution type picker — resolve the active CTU for context.
            const stackSnap = getCurrentTerritoryStackSnapshot();
            const ctu = stackSnap.jurisdictions.find((j) => j.kind === 'ctu');
            const venue = getVenueModeSnapshot();
            openContributeSheet({
              ctu: ctu
                ? { id: ctu.id, name: ctu.name, kindLabel: ctu.kindLabel }
                : null,
              // If user is actively exploring a zone, scope the contribution to it.
              experienceZoneId:   venue.exploring ? (venue.zoneId ?? null)   : null,
              experienceZoneName: venue.exploring ? (venue.zoneName ?? null) : null,
            });
          }
        } finally {
          clickBusyRef.current = false;
        }
      })();
    };

    map.on('mousemove', onMove);
    map.on('mouseout', clearAllHover);
    map.on('click', onClick);

    return () => {
      map.off('mousemove', onMove);
      map.off('mouseout', clearAllHover);
      map.off('click', onClick);
      try {
        map.getCanvas().style.cursor = '';
      } catch {
        /* ignore */
      }
      clearHover(map, hoverRef.current);
      hoverRef.current = null;
      setHoverPopoverRef.current(null);
      setAtlasPopoverRef.current?.(null);
      atlasPinnedIdRef.current = null;
      setOverlapChooserRef.current?.(null);
    };
  }, [
    map,
    ready,
    interactionMode,
    pagesOn,
    pinsOn,
    nearbyOn,
    atlasOn,
    countiesOn,
    citiesOn,
    schoolDistrictsOn,
    schoolsOn,
    districtsOn,
    senateDistrictsOn,
    houseDistrictsOn,
    districtPartsOn,
    isUnlocked,
  ]);

  return { dismissAtlasPopover };
}

/** Map interaction + mode sync + territory hover + overlap chooser + fly-to lock. */
export function CountyMapInteraction() {
  const [hover, setHover] = useState<TerritoryHoverPopoverState>(null);
  const [chooser, setChooser] = useState<PointTerritoryChooserState>(null);
  const [atlas, setAtlas] = useState<AtlasFeaturePopoverState>(null);
  const { openDetails } = useMapDock();
  const { loadDistrictParts } = useTerritoryLayers();
  useSyncMapInteractionMode();
  const { dismissAtlasPopover } = useTerritoryMapInteraction(
    setHover,
    setChooser,
    setAtlas,
  );
  useTerritoryFocusCamera();

  const onPick = (entity: DockEntity) => {
    setChooser(null);
    if (entity.kind === 'district') loadDistrictParts(entity.id);
    openDetails(entity);
  };

  return (
    <>
      <TerritoryHoverPopover hover={hover} />
      <AtlasFeaturePopover state={atlas} onDismiss={dismissAtlasPopover} />
      <NearbyPlaceCallout />
      <PointTerritoryOverlapChooser
        state={chooser}
        onPick={onPick}
        onClose={() => setChooser(null)}
      />
      <ZoneOutOfBoundsModal />
    </>
  );
}

