'use client';

/**
 * WorldMapShell — Campaign map kernel.
 * Mapbox, MN mask, buildings, scout avatar, dock.
 */

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import { MapCanvas } from '@/components/shell/MapCanvas';
import { logWorldSession } from '@/features/appShell/logWorldSession';
import { TerritoryLayersProvider } from '@/features/map/territory';
import { useBasemap } from '@/features/map/dockCore/compass/useBasemap';
import { useBasemapStyleSync } from '@/features/map/dockCore/compass/useBasemapStyleSync';
import { useAvatarMe } from '@/features/avatar/useAvatarMe';
import { DemoMapChromeProvider } from '@/features/setup/DemoMapChromeContext';
import { MapProvider, useMapEngine, useMapContext } from '@/map';
import { useMapBuildings3D } from '@/map/buildings/useMapBuildings3D';
import { useMinnesotaLabelFilter } from '@/map/layers/useMinnesotaLabelFilter';
import { useMinnesotaStateMask } from '@/map/layers/useMinnesotaStateMask';
import { FindMeProvider } from '@/map/location/camera/useFindMe';
import { CampaignPositionController } from '@/map/location/positionMode/CampaignPositionController';
import {
  CAMPAIGN_MAX_ZOOM,
  CAMPAIGN_MIN_ZOOM,
  CAMPAIGN_PITCH,
  CAMPAIGN_ZOOM,
  CAPITOL_SPAWN,
} from '@/map/location/positionMode/positionConstants';

const CampaignLayers = dynamic(
  () =>
    import('@/features/map/experience/CampaignLayers').then(
      (m) => m.CampaignLayers,
    ),
  { ssr: false },
);

const CampaignMapDock = dynamic(
  () =>
    import('@/features/map/experience/CampaignMapDock').then(
      (m) => m.CampaignMapDock,
    ),
  { ssr: false },
);

export function WorldMapShell() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, ready, error } = useMapEngine({
    containerRef,
    center: [CAPITOL_SPAWN.lng, CAPITOL_SPAWN.lat],
    zoom: CAMPAIGN_ZOOM,
    pitch: CAMPAIGN_PITCH,
    minZoom: CAMPAIGN_MIN_ZOOM,
    maxZoom: CAMPAIGN_MAX_ZOOM,
    lockCameraGestures: true,
  });
  const { surface } = useBasemap();

  useEffect(() => {
    logWorldSession('map_mount');
  }, []);

  return (
    <div className="app-root" data-map-surface={surface} data-map-experience="campaign">
      <div className="map-stage">
        <MapProvider map={map} ready={ready}>
          <DemoMapChromeProvider value={null}>
            <BasemapStyleSync />
            <MapBuildings3D />
            <FindMeProvider autoResume={false} allowCompass={false} lockToUser>
              <AvatarBootstrap />
              <CampaignPositionController />
              <CampaignLayers />
              <MapCanvas ref={containerRef} error={error} />
              <MinnesotaStateMaskLayer />
              <TerritoryLayersProvider>
                <CampaignMapDock />
              </TerritoryLayersProvider>
            </FindMeProvider>
          </DemoMapChromeProvider>
        </MapProvider>
      </div>
    </div>
  );
}

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

function MinnesotaStateMaskLayer() {
  const { map, ready } = useMapContext();
  useMinnesotaStateMask(map, ready);
  useMinnesotaLabelFilter(map, ready);
  return null;
}
