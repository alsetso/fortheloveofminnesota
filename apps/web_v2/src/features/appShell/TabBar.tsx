'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ComponentType } from 'react';
import {
  APP_TABS,
  APP_CONTENT_MAX_WIDTH_PX,
  APP_TAB_BAR_HEIGHT_PX,
  appTabHref,
  appTabIdFromPathname,
  appTabBarHidden,
  type AppTabId,
} from '@/features/appShell/tabs';
import {
  IconTabFeed,
  IconTabMap,
  IconTabProfile,
} from '@/features/appShell/tabIcons';
import { useAuthSafe } from '@/features/auth';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { SAFE_AREA, safePadBottom } from '@/lib/despia/safeArea';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';

const TAB_ICON: Record<
  AppTabId,
  ComponentType<{ className?: string; selected?: boolean }>
> = {
  feed: IconTabFeed,
  map: IconTabMap,
  profile: IconTabProfile,
};

/**
 * Full-bleed bottom nav — bar spans the viewport; icons center in the
 * compact content column so they align with main on large screens.
 * Discover lives on the map TopBar (search), not here.
 */
export default function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { account } = useAuthSafe();
  const { openAccount } = useMapDock();
  const viewerUsername = account?.username ?? null;
  const active = appTabIdFromPathname(pathname, { viewerUsername });

  if (APP_TABS.length === 0 || appTabBarHidden(pathname)) return null;

  return (
    <nav
      aria-label="Main"
      data-app-tab-bar=""
      className={`fixed inset-x-0 bottom-0 border-t border-black/[0.08] bg-[#f7f5f1] transition-[opacity,transform] duration-150 ease-out ${Z_LAYER_CLASS.SHEET}`}
      style={{
        paddingBottom: safePadBottom('0px'),
        paddingLeft: SAFE_AREA.left,
        paddingRight: SAFE_AREA.right,
      }}
    >
      <div
        className="mx-auto grid w-full grid-cols-3 items-center"
        style={{
          maxWidth: APP_CONTENT_MAX_WIDTH_PX,
          height: APP_TAB_BAR_HEIGHT_PX,
        }}
        role="tablist"
      >
        {APP_TABS.map((tab) => {
          const Icon = TAB_ICON[tab.id];
          const isActive = active === tab.id;
          const href = appTabHref(tab, { viewerUsername });
          const className = 'grid h-full place-items-center transition-opacity active:opacity-60';
          const icon = (
            <span
              className={`inline-flex h-10 w-10 items-center justify-center rounded-[12px] transition-colors ${
                isActive
                  ? 'bg-black/[0.035] text-foreground'
                  : 'text-foreground-muted/70'
              }`}
            >
              <Icon className="h-6 w-6" selected={isActive} />
            </span>
          );

          if (!href) {
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-label={tab.label}
                aria-selected={isActive}
                onClick={() => openAccount()}
                className={className}
              >
                {icon}
              </button>
            );
          }

          return (
            <Link
              key={tab.id}
              href={href}
              role="tab"
              aria-label={tab.label}
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              onClick={(e) => {
                // Own profile tab — drop any leftover ?from= so owner gets +.
                if (tab.id === 'profile' && pathname === href) {
                  e.preventDefault();
                  router.replace(href);
                }
              }}
              className={className}
            >
              {icon}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
