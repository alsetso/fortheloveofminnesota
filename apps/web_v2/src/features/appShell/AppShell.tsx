'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, type FC } from 'react';
import { usePathname } from 'next/navigation';
import { CurrentTerritoryStackController } from '@/features/accountTerritories/ui/CurrentTerritoryStackController';
import { TerritoryUnlockModal } from '@/features/accountTerritories/ui/TerritoryUnlockModal';
import { CurrentExperienceZoneController } from '@/features/experienceZones/ui/CurrentExperienceZoneController';
import AccountChrome from '@/features/appShell/AccountChrome';
import { AppShellChromeProvider } from '@/features/appShell/shellChromeContext';
import { PersistentGameMap } from '@/features/appShell/PersistentGameMap';
import TabBar from '@/features/appShell/TabBar';
import WebFrame from '@/features/appShell/WebFrame';
import {
  APP_CONTENT_MAX_WIDTH_PX,
  APP_TAB_BAR_CLEARANCE,
  appTabIdFromPathname,
  appTabBarHidden,
} from '@/features/appShell/tabs';
import { DiscoverMapLightbox } from '@/features/discover/DiscoverMapLightbox';
import { isDiscoverPath, isSignedInMapPath } from '@/lib/routes/routePolicy';
import { useAuthSafe } from '@/features/auth';
import { HealthStepsSessionController } from '@/features/health/HealthStepsSessionController';
import { subscribeStandingInvalidation } from '@/lib/standing/invalidateStanding';
import { LevelUpSequence } from '@/features/xp/modals/LevelUpSequence';
import { refreshPendingXp } from '@/features/xp/store/pendingXpStore';
import { XpOverlay } from '@/features/xp/modals/XpOverlay';

/** Keeps the global unclaimed-XP rollup fresh whenever anything grants or
 * claims XP, regardless of which tab triggered it. */
const PendingXpWatcher: FC = () => {
  useEffect(() => subscribeStandingInvalidation(() => void refreshPendingXp()), []);
  return null;
};

/**
 * Signed-in App host — fixed to the layout viewport (Despia-safe).
 *
 * Large screens: shell header + tab bar are full-bleed; main content centers
 * in a compact max-width column. Maps stay full-bleed.
 *
 * Discover shares the map surface: the Game map stays mounted and Discover
 * opens as a lightbox over it (no Mapbox remount when flipping tabs).
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { account } = useAuthSafe();
  const tab = appTabIdFromPathname(pathname, {
    viewerUsername: account?.username ?? null,
  });
  const onMapRoute = isSignedInMapPath(pathname);
  const onDiscoverRoute = isDiscoverPath(pathname);
  /** Map host stays alive for both Map tab and Discover lightbox. */
  const mapSurface = onMapRoute || onDiscoverRoute;
  const tabBarHidden = appTabBarHidden(pathname);

  return (
    <div
      data-app-tab-host=""
      data-app-tab={tab ?? undefined}
      data-app-map-surface={mapSurface ? '' : undefined}
      data-app-discover-lightbox={onDiscoverRoute ? '' : undefined}
      className="fixed inset-0 z-0 overflow-hidden bg-[#f7f5f1] text-foreground"
      style={
        {
          '--app-tab-bar-clearance': tabBarHidden ? '0px' : APP_TAB_BAR_CLEARANCE,
          '--app-content-max-width': `${APP_CONTENT_MAX_WIDTH_PX}px`,
          '--foreground': '20 32 28',
          '--foreground-muted': '20 32 28 / 0.55',
          '--lake-blue': '42 111 143',
        } as CSSProperties
      }
    >
      <WebFrame>
      {mapSurface ? (
        <AccountChrome>
          <AppShellChromeProvider>
            {(headerSlotRef) => (
              <div
                className="absolute inset-0 flex flex-col overflow-hidden"
                data-app-shell-stage=""
                data-app-shell-map=""
              >
                <div className="relative min-h-0 flex-1 overflow-hidden">
                  {/*
                    Map surface: shell TopBar stays visible; Discover lightbox
                    fills only the map canvas beneath it.
                  */}
                  <div className="absolute inset-0 flex flex-col overflow-hidden">
                    <div
                      ref={headerSlotRef}
                      className="relative z-20 w-full shrink-0 self-stretch"
                      data-app-shell-header=""
                    />
                    <div className="relative min-h-0 flex-1 overflow-hidden">
                      <div
                        className={`absolute inset-0 ${
                          onDiscoverRoute ? 'pointer-events-none' : ''
                        }`}
                        aria-hidden={onDiscoverRoute || undefined}
                      >
                        {pathname === '/fly' ? children : <PersistentGameMap />}
                      </div>
                      {onDiscoverRoute ? (
                        <DiscoverMapLightbox>{children}</DiscoverMapLightbox>
                      ) : null}
                    </div>
                  </div>
                </div>
                {!tabBarHidden ? <TabBar /> : null}
              </div>
            )}
          </AppShellChromeProvider>
        </AccountChrome>
      ) : (
        <AccountChrome>
          <AppShellChromeProvider>
            {(headerSlotRef) => (
              <div
                className="absolute inset-0 flex flex-col overflow-hidden"
                data-app-shell-stage=""
              >
                <div
                  ref={headerSlotRef}
                  className="relative z-10 w-full shrink-0 self-stretch"
                  data-app-shell-header=""
                />
                <div className="flex min-h-0 flex-1 justify-center overflow-hidden">
                  <div
                    className="flex h-full w-full min-h-0 flex-col overflow-hidden"
                    style={{ maxWidth: APP_CONTENT_MAX_WIDTH_PX }}
                    data-app-content-column=""
                  >
                    {children}
                  </div>
                </div>
                {!tabBarHidden ? (
                  <div
                    className="w-full shrink-0"
                    style={{ height: APP_TAB_BAR_CLEARANCE }}
                    aria-hidden
                    data-app-tab-bar-spacer=""
                  />
                ) : null}
                {!tabBarHidden ? <TabBar /> : null}
              </div>
            )}
          </AppShellChromeProvider>
        </AccountChrome>
      )}
      </WebFrame>
      <CurrentTerritoryStackController />
      <CurrentExperienceZoneController />
      <HealthStepsSessionController />
      <PendingXpWatcher />
      <XpOverlay
        accountId={account?.id ?? null}
        hidePill={mapSurface}
      />
      <TerritoryUnlockModal />
      <LevelUpSequence />
    </div>
  );
}
