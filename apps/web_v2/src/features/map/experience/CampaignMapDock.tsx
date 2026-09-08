'use client';

/**
 * Campaign chrome — search dock + standing HUD.
 */

import { MapDockProvider } from '@/features/map/dockCore/shell/MapDockContext';
import MapDockShell from '@/features/map/dockCore/shell/MapDockShell';
import MapDockFreeChrome from '@/features/map/dockCore/shell/MapDockFreeChrome';
import MapDockPill from '@/features/map/dockCore/shell/MapDockPill';
import DockPaneRouter from '@/features/map/dockCore/panes/DockPaneRouter';
import GameStatsHud from '@/features/map/game/GameStatsHud';
import { DirectoryPagesProvider } from '@/features/map/directory';
import { SavedAddressesProvider } from '@/features/map/savedAddresses/SavedAddressesProvider';
import { DemoMapChromeProvider } from '@/features/setup/DemoMapChromeContext';
import { usePositionMode } from '@/map/location/positionMode/usePositionMode';

function CampaignMapDockInner() {
  const { notice } = usePositionMode();

  return (
    <>
      <MapDockFreeChrome
        topCenter={
          notice ? (
            <div
              role="status"
              className="max-w-[16rem] rounded-2xl bg-black/70 px-3.5 py-2 text-[12px] font-medium leading-snug text-white/85 backdrop-blur-md"
            >
              {notice}
            </div>
          ) : null
        }
        topRight={<GameStatsHud interactive />}
      />
      <MapDockShell pill={<MapDockPill />} hideIdleBrowseWhenCollapsed={false}>
        <DockPaneRouter />
      </MapDockShell>
    </>
  );
}

export function CampaignMapDock() {
  return (
    <DemoMapChromeProvider value={null}>
      <SavedAddressesProvider>
        <DirectoryPagesProvider>
          <MapDockProvider initialSnap="collapsed">
            <CampaignMapDockInner />
          </MapDockProvider>
        </DirectoryPagesProvider>
      </SavedAddressesProvider>
    </DemoMapChromeProvider>
  );
}
