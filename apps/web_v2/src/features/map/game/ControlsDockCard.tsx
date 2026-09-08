'use client';

import { useSyncExternalStore } from 'react';
import {
  getTheme,
  getThemeServer,
  subscribeTheme,
  toggleTheme,
} from '@/features/theme/themeStore';
import {
  formatHomeResetDate,
  useHomeStatus,
} from '@/features/accountTerritories/store/useHomeStatus';
import { useAuthSafe } from '@/features/auth';
import { DockLayerGroupCard, DockLayerToggle } from '@/features/map/dockCore/shell/DockLayerToggle';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { useMapReset } from '@/features/map/reset';
import {
  useTerritoriesAroundMe,
  useTerritoriesAroundMeToggle,
} from '@/features/map/territory';
import { useFindMe } from '@/map/location/camera/useFindMe';
import { useFindMeCoords } from '@/map/location/camera/useFindMeCoords';
import {
  getTileGridState,
  subscribeTileGrid,
  setTileGridSatellite,
  setTileGridLines,
} from '@/features/map/game/tileGrid';
import {
  GAME_ATLAS_COLLECTIONS,
  GAME_ATLAS_COLOR,
  toggleGameAtlasCollection,
  useGameAtlasCollectionOn,
} from '@/features/map/atlas';

function LinkRow({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors active:bg-map-glass-hover"
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-foreground">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block text-[12px] text-foreground-muted">{subtitle}</span>
        ) : null}
      </span>
      <span className="text-[15px] text-foreground-muted" aria-hidden>
        ›
      </span>
    </button>
  );
}

function AtlasCollectionToggle({
  collection,
}: {
  collection: (typeof GAME_ATLAS_COLLECTIONS)[number];
}) {
  const on = useGameAtlasCollectionOn(collection.slug);
  return (
    <DockLayerToggle
      label={collection.label}
      hint={
        on
          ? `${collection.hint} · streamed in view`
          : collection.hint
      }
      on={on}
      onClick={() => toggleGameAtlasCollection(collection.slug)}
      color={collection.color || GAME_ATLAS_COLOR}
    />
  );
}

/**
 * Game's Controls card — location, home, map style, and atlas overlays
 * (viewport-streamed collections from GAME_ATLAS_COLLECTIONS). Broader
 * dataset browsing stays on Discover / Explore surfaces.
 */
export default function ControlsDockCard() {
  const { openDockCard } = useMapDock();
  const { resetMapToFree } = useMapReset();
  const aroundMe = useTerritoriesAroundMe();
  const { toggle: toggleAroundMe } = useTerritoriesAroundMeToggle();
  const tileGrid = useSyncExternalStore(subscribeTileGrid, getTileGridState, getTileGridState);
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getThemeServer);
  const { coords: findMeCoords, lookupCoords } = useFindMeCoords();
  const aroundMeAvailable = Boolean(findMeCoords ?? lookupCoords);
  const {
    phase,
    compassMode,
    setCompassMode,
    allowCompass,
    heading,
  } = useFindMe();
  const sharing = phase === 'active' || phase === 'finding';
  const { account } = useAuthSafe();
  const { status: homeStatus } = useHomeStatus();
  const homeLocked = Boolean(homeStatus?.homeSetAt) && !homeStatus?.canReset;

  const toggleCompass = () => {
    if (!allowCompass) return;
    setCompassMode(!compassMode);
  };

  return (
    <DockCardShell
      titleMode="center"
      eyebrow="Controls"
      title="Map settings"
      subtitle="Map style & layers"
    >
      <section>
        <div className="overflow-hidden rounded-2xl border border-lake-blue/40 bg-lake-blue/10">
          {allowCompass ? (
            <DockLayerToggle
              label="Heading-up map"
              hint={
                compassMode
                  ? heading != null
                    ? `Rotates with you · ${Math.round(heading)}°`
                    : 'Rotates the map as you turn'
                  : 'North stays up'
              }
              on={compassMode}
              disabled={!sharing}
              onClick={toggleCompass}
              withHaptic={false}
            />
          ) : null}
          <DockLayerToggle
            label="Areas around me"
            hint={
              aroundMe.on
                ? `${aroundMe.jurisdictions.length} live areas · follows you`
                : aroundMeAvailable
                  ? 'Only your live layers on the map'
                  : 'Turn on Find Me first'
            }
            on={aroundMe.on}
            disabled={!aroundMe.on && !aroundMeAvailable}
            onClick={toggleAroundMe}
          />
          {aroundMe.on ? (
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-[rgb(var(--map-ink-subtle))] px-3.5 py-3 text-center">
              {!account ? (
                <p className="text-[12px] text-foreground-muted">
                  Sign in to set as home
                </p>
              ) : (
                <>
                  {homeLocked ? (
                    <p className="text-[12px] font-medium text-foreground-muted">
                      Home locked · resets{' '}
                      {formatHomeResetDate(homeStatus?.homeResetAvailableAt)}
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={aroundMe.jurisdictions.length === 0}
                      onClick={() => openDockCard('set-home-confirm')}
                      className="text-[13px] font-semibold text-lake-blue underline underline-offset-2 transition hover:text-lake-blue/80 disabled:opacity-45"
                    >
                      Set as home
                    </button>
                  )}
                  <span aria-hidden className="text-[12px] text-foreground-muted/60">
                    ·
                  </span>
                  <button
                    type="button"
                    onClick={() => openDockCard('my-places')}
                    className="text-[13px] font-semibold text-lake-blue underline underline-offset-2 transition hover:text-lake-blue/80"
                  >
                    My Places
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <DockLayerGroupCard label="Atlas in view">
        {GAME_ATLAS_COLLECTIONS.map((collection) => (
          <AtlasCollectionToggle key={collection.slug} collection={collection} />
        ))}
      </DockLayerGroupCard>

      <DockLayerGroupCard label="Ground plane">
        <DockLayerToggle
          label="Satellite imagery"
          hint={
            tileGrid.showSatellite
              ? 'Real aerial photo as ground · street zoom ≈ 78 m / tile'
              : 'Show Mapbox Satellite under buildings and models'
          }
          on={tileGrid.showSatellite}
          onClick={() => setTileGridSatellite(!tileGrid.showSatellite)}
          color="#2A6F8F"
        />
        <DockLayerToggle
          label="Tile grid lines"
          hint={
            tileGrid.showGridLines
              ? 'XYZ tile boundaries visible on the ground'
              : 'Overlay tile boundaries — useful for placing'
          }
          on={tileGrid.showGridLines}
          onClick={() => setTileGridLines(!tileGrid.showGridLines)}
          color="#2A6F8F"
        />
      </DockLayerGroupCard>

      <DockLayerGroupCard label="Appearance">
        <DockLayerToggle
          label="Dark mode"
          hint={theme === 'dark' ? 'Dark chrome across all map styles' : 'Light chrome · follows map style'}
          on={theme === 'dark'}
          onClick={toggleTheme}
          color="#007AFF"
        />
      </DockLayerGroupCard>

      <DockLayerGroupCard label="More">
        <LinkRow title="Map style" onClick={() => openDockCard('map-style')} />
      </DockLayerGroupCard>

      <button
        type="button"
        onClick={() => resetMapToFree({ snap: 'collapsed' })}
        className="w-full rounded-xl px-3.5 py-3 text-center text-[15px] font-medium text-foreground-muted transition-colors active:bg-map-glass-hover"
      >
        Reset map
      </button>
    </DockCardShell>
  );
}
