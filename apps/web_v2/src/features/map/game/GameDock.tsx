'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import ContactsSheet from '@/features/contacts/ui/ContactsSheet';
import CreatePostSheet from '@/features/community/CreatePostSheet';
import {
  MapDockProvider,
  useMapDock,
} from '@/features/map/dockCore/shell/MapDockContext';
import MapDockShell from '@/features/map/dockCore/shell/MapDockShell';
import MapDockFreeChrome from '@/features/map/dockCore/shell/MapDockFreeChrome';
import MapDockPill from '@/features/map/dockCore/shell/MapDockPill';
import GameMinimapRail from '@/features/map/game/GameMinimapRail';
import GameStatsHud from '@/features/map/game/GameStatsHud';
import { GameStatsHudCompact } from '@/features/map/game/GameStatsHudCompact';
import { GameLevelHud } from '@/features/map/game/GameLevelHud';
import {
  GameMapModeMenu,
  GameMapModeMenuPanel,
  useGameMapModeMenu,
} from '@/features/map/game/GameMapModeMenu';
import { ObjectRadar } from '@/features/map/game/objectRadar';
import DockPaneRouter from '@/features/map/dockCore/panes/DockPaneRouter';
import { AllExperienceZonesLayer } from '@/features/experienceZones/map/AllExperienceZonesLayer';
import { ExperienceZoneBoundaryLayer } from '@/features/experienceZones/map/ExperienceZoneBoundaryLayer';
import { ExperienceZoneApproachLabel } from '@/features/experienceZones/ui/ExperienceZoneApproachLabel';
import { ExploreZoneEnteredModal } from '@/features/experienceZones/ui/ExploreZoneEnteredModal';
import { ExploreZoneLeaveButton } from '@/features/experienceZones/ui/ExploreZoneLeaveButton';
import { LeaveGameButton } from '@/features/map/game/LeaveGameButton';
import { CountyMapInteraction } from '@/features/map/territory';
import { CtuBoundaryLayer } from '@/features/map/territory/CtuBoundaryLayer';
import { SelectedPointMapMarker } from '@/features/map/dockCore/controllers/SelectedPointMapMarker';
import { GameMapRadiusRing } from '@/features/map/game/GameMapRadiusRing';
import { TileGridLayer } from '@/features/map/game/tileGrid';
import { WorldModelsLayer } from '@/features/map/game/world/WorldModelsLayer';
import { AtlasFeatureLabelsLayer, GameAtlasLayer } from '@/features/map/atlas';
import { AvatarPickerGate } from '@/features/avatar/AvatarPickerGate';
import { TopBar } from '@/features/appShell/TopBar';
import { useIsAppShellChrome } from '@/features/appShell/shellChromeContext';
import {
  demoShowsTopChrome,
  useDemoMapChrome,
} from '@/features/setup/DemoMapChromeContext';
import { PendingXpReviewPill } from '@/features/xp/modals/XpOverlay';
import { SavedAddressesProvider } from '@/features/map/savedAddresses/SavedAddressesProvider';
import { SavedAddressesLayer } from '@/features/map/savedAddresses/SavedAddressesLayer';
import {
  DirectoryPagesLayer,
  DirectoryPagesProvider,
} from '@/features/map/directory';
import { GameMapControllers } from '@/features/map/game/GameMapControllers';
import { PendingMapFocusController } from '@/features/map/dockCore/controllers/PendingMapFocusController';
import { usePresence } from '@/map/location/positionMode/usePositionMode';
import { usePlayerPresenceSwitch } from '@/map/location/positionMode/usePlayerPresenceSwitch';
import {
  subscribeFindMeCoords,
  getFindMeCoordsSnapshot,
} from '@/map/location/camera/findMeCoordsStore';
import {
  resolveSpeedTier,
} from '@/map/location/device/locomotion';
import { haptic } from '@/lib/despia/haptics';
import {
  MAP_DOCK_FLOATING_CONTROLS_Z,
  MAP_DOCK_LEFT_INSET,
} from '@/features/map/dockCore/core/mapDockTokens';

/**
 * Top-center HUD control — tap to toggle Play ↔ Scout.
 *
 * Live  — blue (GPS-locked)
 * Scout — dim white (free pose / viewport)
 *
 * Speed sub-label when Live + modeKnown && speed > 0.5 mph.
 * Failed Live entry keeps Scout and surfaces `notice` under the pill.
 */
function PresenceModeToggle() {
  const { mode: positionMode, notice } = usePresence();
  const { switchToLive, switchToScout, switching } = usePlayerPresenceSwitch();
  const { coords, modeKnown } = useSyncExternalStore(
    subscribeFindMeCoords,
    getFindMeCoordsSnapshot,
    getFindMeCoordsSnapshot,
  );

  const speedMps = coords?.speed ?? null;
  const speedMph = speedMps != null ? speedMps * 2.237 : null;
  const showSpeed = modeKnown && speedMph != null && speedMph > 0.5;
  const speedTier = resolveSpeedTier(speedMps);
  const isVehicle = speedTier === 'vehicle';
  const isMovingFast = speedTier === 'moving';
  const speedLabel = showSpeed
    ? speedMph! < 20
      ? `${speedMph!.toFixed(1)} mph`
      : `${Math.round(speedMph!)} mph`
    : null;

  const isLive = positionMode === 'live';

  const pillStyle = isLive
    ? 'border-blue-400/30 bg-black/40 text-blue-300 backdrop-blur-md'
    : 'border-white/15 bg-black/30 text-white/60 backdrop-blur-md';

  const dotStyle = isLive ? 'bg-blue-400' : 'bg-white/40';

  const speedStyle = isVehicle
    ? 'text-red-400'
    : isMovingFast
    ? 'text-orange-400'
    : 'text-white/50';

  const label = isLive ? 'Play' : 'Scout';

  const onToggle = useCallback(() => {
    if (switching) return;
    haptic.toggle();
    if (isLive) {
      void switchToScout();
    } else {
      void switchToLive();
    }
  }, [switching, isLive, switchToLive, switchToScout]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onToggle}
        disabled={switching}
        aria-label={isLive ? 'Switch to Scout' : 'Switch to Play'}
        aria-pressed={isLive}
        title={isLive ? 'Tap for Scout' : 'Tap for Play'}
        className={`
          inline-flex flex-col items-center gap-0.5
          rounded-2xl border px-3 py-1.5
          text-[11px] font-semibold tracking-widest uppercase
          transition-all duration-300 select-none
          active:scale-95 disabled:opacity-60
          ${pillStyle}
        `}
      >
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
              switching ? 'animate-pulse' : ''
            } ${dotStyle}`}
          />
          {label}
        </div>
        {speedLabel && isLive ? (
          <div
            className={`text-[10px] font-medium tracking-wide normal-case ${speedStyle} transition-colors duration-500`}
          >
            {speedLabel}
          </div>
        ) : null}
      </button>
      {notice ? (
        <p
          role="status"
          className="max-w-[14rem] rounded-xl border border-white/10 bg-black/55 px-2.5 py-1.5 text-center text-[10px] font-medium leading-snug tracking-normal text-white/75 backdrop-blur-md normal-case"
        >
          {notice}
        </p>
      ) : null}
    </div>
  );
}

/** Keep city/town overlays bound to the last selected county (sticky). */
function ContactsSheetHost() {
  const { contactsSheet, closeContactsSheet } = useMapDock();
  if (!contactsSheet) return null;
  return <ContactsSheet state={contactsSheet} onClose={closeContactsSheet} />;
}

function CreatePostSheetHost() {
  const { createPostSheet, closeCreatePostSheet } = useMapDock();
  if (!createPostSheet) return null;
  return <CreatePostSheet state={createPostSheet} onClose={closeCreatePostSheet} />;
}
function GameShellTopBar() {
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const mode = useGameMapModeMenu(setModeMenuOpen);

  return (
    <TopBar
      leading={<GameLevelHud />}
      title={
        <GameMapModeMenu
          open={modeMenuOpen}
          onOpenChange={setModeMenuOpen}
          listId={mode.listId}
          label={mode.label}
          isLive={mode.isLive}
          notice={mode.notice}
          switching={mode.switching}
          speedLabel={mode.speedLabel}
          speedClass={mode.speedClass}
        />
      }
      trailing={<GameStatsHudCompact />}
      below={
        <GameMapModeMenuPanel
          listId={mode.listId}
          isLive={mode.isLive}
          select={mode.select}
        />
      }
      belowCollapsed={!modeMenuOpen}
      belowOverlay
    />
  );
}

function GameDockInner() {
  const demo = useDemoMapChrome();
  const inShellChrome = useIsAppShellChrome();
  // Full-bleed (setup / no AppShell): floating leave / presence / stats.
  // With AppShell: TopBar owns mode + condensed HUD; map keeps leave-zone + XP.
  const showFloatingTopChrome = demoShowsTopChrome(demo?.stepKey) && !inShellChrome;
  const { pane } = useMapDock();
  const isComposing = pane.id === 'post-compose';

  return (
    <>
      {inShellChrome ? <GameShellTopBar /> : null}
      <AvatarPickerGate />
      {/* Single controllers node — all null-render side-effect hooks */}
      <GameMapControllers />
      <PendingMapFocusController />
      <CountyMapInteraction />
      <SelectedPointMapMarker />
      <GameMapRadiusRing />
      <TileGridLayer />
      <CtuBoundaryLayer />
      {/* Always-on ambient layer — all active zones, location-independent */}
      <AllExperienceZonesLayer />
      {/* Active presence layer — inside / approaching only, sits on top */}
      <ExperienceZoneBoundaryLayer />
      <ExperienceZoneApproachLabel />
      <WorldModelsLayer />
      <GameAtlasLayer />
      <AtlasFeatureLabelsLayer />
      <SavedAddressesLayer />
      <DirectoryPagesLayer />
      <ObjectRadar />
      <ExploreZoneEnteredModal />
      {showFloatingTopChrome ? (
        <div
          className={`pointer-events-none transition-[opacity,transform] duration-300 ${
            isComposing ? 'opacity-0' : 'opacity-100'
          }`}
          aria-hidden={isComposing || undefined}
        >
          <MapDockFreeChrome
            topLeft={
              <div className={`relative flex flex-col items-start gap-2 ${isComposing ? '' : 'pointer-events-auto'}`}>
                <LeaveGameButton />
                <ExploreZoneLeaveButton />
                <PendingXpReviewPill />
              </div>
            }
            topCenter={
              <div className={isComposing ? '' : 'pointer-events-auto'}>
                <PresenceModeToggle />
              </div>
            }
            topRight={<div className={isComposing ? '' : 'pointer-events-auto'}><GameStatsHud /></div>}
          />
        </div>
      ) : null}
      {inShellChrome && !isComposing ? (
        <div
          className={`pointer-events-none absolute left-0 top-0 ${MAP_DOCK_FLOATING_CONTROLS_Z}`}
          style={{ paddingTop: '0.75rem', paddingLeft: MAP_DOCK_LEFT_INSET }}
        >
          <div className="pointer-events-auto relative flex flex-col items-start gap-2">
            <ExploreZoneLeaveButton />
            <PendingXpReviewPill />
          </div>
        </div>
      ) : null}
      <MapDockShell
        pill={<MapDockPill />}
        sideRails={<GameMinimapRail />}
        hideIdleBrowseWhenCollapsed={false}
      >
        <DockPaneRouter />
      </MapDockShell>
      <ContactsSheetHost />
      <CreatePostSheetHost />
    </>
  );
}

/**
 * `/game` dock — Object Radar + Standing/Atlas chrome + search-led dock.
 * Top-left: unclaimed XP pill (or leave-zone while exploring).
 * Top-right: Standing HUD. Left rail: Object MiniMap.
 * Dock header: search (Find Me / recenter inside) + account.
 */
export default function GameDock() {
  return (
    <MapDockProvider>
      <SavedAddressesProvider>
        <DirectoryPagesProvider>
          <GameDockInner />
        </DirectoryPagesProvider>
      </SavedAddressesProvider>
    </MapDockProvider>
  );
}
