'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { MapCanvas } from '@/components/shell/MapCanvas';
import { logWorldSession } from '@/features/appShell/logWorldSession';
import { useBasemap } from '@/features/map/dockCore/compass/useBasemap';
import { useBasemapStyleSync } from '@/features/map/dockCore/compass/useBasemapStyleSync';
import GameDock from '@/features/map/game/GameDock';
import { NearbyPlacesController } from '@/features/map/dockCore/controllers/NearbyPlacesController';
import {
  TerritoriesAroundMeController,
  TerritoryLayersProvider,
  useTerritoryLayers,
} from '@/features/map/territory';
import { GAME_SURFACE_CONFIG } from '@/components/shell/mapSurfaceConfig';
import { useNearbyPlaces } from '@/lib/geo/nearby/nearbyPlacesStore';
import { MAP_CONFIG } from '@/map/config';
import { GeoJsonLayer, MapProvider, useMapEngine, useMapContext, MAP_SOURCE_IDS } from '@/map';
import { useMapBuildings3D } from '@/map/buildings/useMapBuildings3D';
import {
  NEARBY_PLACES_LAYER_SPEC,
  POINT_TERRITORIES_LAYER_SPEC,
  ROUTE_LAYER_SPEC,
  SELECTION_LAYER_SPEC,
  SHELL_LAYER_SPECS,
} from '@/map/layers/layerRegistry';
import { useMinnesotaLabelFilter } from '@/map/layers/useMinnesotaLabelFilter';
import { useMinnesotaStateMask } from '@/map/layers/useMinnesotaStateMask';
import { FindMeProvider } from '@/map/location/camera/useFindMe';
import { useExploreModeZoom } from '@/map/location/camera/useExploreModeZoom';
import { UserMapPositionView } from '@/map/location/position/UserMapPositionView';
import { PlayerPresenceController } from '@/map/location/positionMode/PlayerPresenceController';
import { useAvatarMe } from '@/features/avatar/useAvatarMe';
import { DemoInteractionBridge } from '@/features/setup/DemoInteractionBridge';
import { DemoMapChromeProvider } from '@/features/setup/DemoMapChromeContext';
import type { DemoStepKey } from '@/features/setup/demoSteps';
import { LevelUpSequence } from '@/features/xp/modals/LevelUpSequence';


/** Optional /setup demo coach — listens for real dock interactions. */
export type MapAppShellDemo = {
  stepKey: DemoStepKey;
  onInteraction: () => void;
};

/** Single shell owner — map engine + layer registry + game dock. */
export function MapAppShell({
  demo = null,
  demoPanel = null,
}: {
  /** When set (setup tutorial), bridge real dock gestures → demo step progress. */
  demo?: MapAppShellDemo | null;
  /**
   * Compact coach chip — rendered in GameMinimapRail (zone-banner slot)
   * so it sits between MiniMap and Find Me like the explore Yes/No prompt.
   */
  demoPanel?: ReactNode;
} = {}) {
  const surfaceConfig = GAME_SURFACE_CONFIG;
  const containerRef = useRef<HTMLDivElement>(null);
  // First paint: last-known MN pose when set, else Capitol. Presence boots
  // Scout (free roam); Play (GPS follow) is opt-in via Find Me / mode menu.
  const { map, ready, error } = useMapEngine({
    containerRef,
    zoom: MAP_CONFIG.FIND_ME_ZOOM,
    skipFindMeBoot: false,
  });
  const { surface } = useBasemap();

  useEffect(() => {
    logWorldSession('map_mount');
  }, []);

  const demoChrome =
    demo && demoPanel
      ? { stepKey: demo.stepKey, panel: demoPanel }
      : null;

  return (
    <div
      className="app-root"
      data-map-surface={surface}
      data-map-demo={demo ? 'true' : undefined}
      data-demo-step={demo?.stepKey}
    >
      <div className="map-stage">
        <MapProvider map={map} ready={ready}>
          <BasemapStyleSync />
          <MapBuildings3D />
          <ExploreModeZoom />
          <FindMeProvider
            autoResume={surfaceConfig.findMe.autoResume}
            allowCompass={surfaceConfig.findMe.allowCompass}
            lockToUser={surfaceConfig.findMe.lockToUser}
          >
            {/* Kick /api/avatar/me immediately so avatarStore is hydrated before
                waitForMapStyleReady resolves and compile() picks a model ID. */}
            {surfaceConfig.findMe.lockToUser && <AvatarBootstrap />}
            {/* Presence owner — Scout on load; Play via Find Me / mode menu. */}
            <PlayerPresenceController />
            {/* GL puck — same findMeCoordsStore SSOT as territories / zones. */}
            <UserMapPositionView
              variant={surfaceConfig.findMe.lockToUser ? 'avatar' : 'dot'}
            />
            <TerritoryLayersProvider>
              <DemoMapChromeProvider value={demoChrome}>
                <MapCanvas ref={containerRef} error={error} />
                <ShellLayers map={map} ready={ready} />
                <TerritoriesAroundMeController />
                <NearbyPlacesController />
                <MinnesotaStateMaskLayer map={map} ready={ready} />
                <GameDock />
                  {demo ? (
                    <>
                      <DemoInteractionBridge
                        stepKey={demo.stepKey}
                        onInteraction={demo.onInteraction}
                      />
                      {/*
                        LevelUpSequence is normally in AppShell — which is
                        NOT mounted during /setup. Mount it here (demo-only) so
                        the claim_streak level-up ceremonies play in context
                        rather than queuing silently and firing on /game entry.
                      */}
                      <LevelUpSequence />
                    </>
                  ) : null}
              </DemoMapChromeProvider>
            </TerritoryLayersProvider>
          </FindMeProvider>
        </MapProvider>
      </div>
    </div>
  );
}

/**
 * Fires /api/avatar/me as early as the map shell mounts — before
 * waitForMapStyleReady resolves — so the avatarStore is hydrated before
 * compile() picks a model ID. Prevents compile() from baking the male-base
 * fallback into the Mapbox layer when the style loads faster than the fetch.
 *
 * AvatarPickerGate in GameDock also calls useAvatarMe for picker logic;
 * the hook is idempotent and the second call hits browser cache.
 */
function AvatarBootstrap() {
  useAvatarMe();
  return null;
}

function BasemapStyleSync() {
  useBasemapStyleSync();
  return null;
}

function MapBuildings3D() {
  useMapBuildings3D(true);
  return null;
}

function ExploreModeZoom() {
  const { map, ready } = useMapContext();
  useExploreModeZoom(map, ready);
  return null;
}

function MinnesotaStateMaskLayer({
  map,
  ready,
}: {
  map: ReturnType<typeof useMapEngine>['map'];
  ready: boolean;
}) {
  useMinnesotaStateMask(map, ready);
  useMinnesotaLabelFilter(map, ready);
  return null;
}

function ShellLayers({
  map,
  ready,
}: {
  map: ReturnType<typeof useMapEngine>['map'];
  ready: boolean;
}) {
  const { isActive, countyOverlays, districtSchools, schoolsLayer, districtParts } =
    useTerritoryLayers();
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
  const nearby = useNearbyPlaces();

  return (
    <>
      {SHELL_LAYER_SPECS.map((spec) => {
        let visible = false;
        if (spec.sourceId === MAP_SOURCE_IDS.counties) visible = countiesOn;
        else if (spec.sourceId === MAP_SOURCE_IDS.ctus) visible = citiesOn;
        else if (spec.sourceId === MAP_SOURCE_IDS.schoolDistricts) {
          visible = schoolDistrictsOn;
        } else if (spec.sourceId === MAP_SOURCE_IDS.schools) {
          visible = schoolsOn;
        } else if (spec.sourceId === MAP_SOURCE_IDS.districts) {
          visible = districtsOn;
        } else if (spec.sourceId === MAP_SOURCE_IDS.senateDistricts) {
          visible = senateDistrictsOn;
        } else if (spec.sourceId === MAP_SOURCE_IDS.houseDistricts) {
          visible = houseDistrictsOn;
        } else if (spec.sourceId === MAP_SOURCE_IDS.districtParts) {
          visible = districtPartsOn;
        }
        return (
          <GeoJsonLayer
            key={spec.sourceId}
            map={map}
            ready={ready}
            spec={spec}
            visible={visible}
          />
        );
      })}
      <GeoJsonLayer
        map={map}
        ready={ready}
        spec={POINT_TERRITORIES_LAYER_SPEC}
        visible
      />
      <GeoJsonLayer
        map={map}
        ready={ready}
        spec={SELECTION_LAYER_SPEC}
        visible
      />
      <GeoJsonLayer map={map} ready={ready} spec={ROUTE_LAYER_SPEC} visible />
      <GeoJsonLayer
        map={map}
        ready={ready}
        spec={NEARBY_PLACES_LAYER_SPEC}
        visible={nearby.on}
      />
    </>
  );
}
