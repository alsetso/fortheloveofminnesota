'use client';

import { useSyncExternalStore } from 'react';
import {
  dismissRecentDockEntity,
  getRecentDockEntitiesSnapshot,
  recentDockEntityTabId,
  subscribeRecentDockEntities,
} from '@/features/map/dockCore/store/recentDockEntitiesStore';
import { MAP_SHEET_SHELL_X } from '@/lib/map/mapChrome';
import { IconX } from '@/features/map/dockCore/core/icons';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';

type MapDockBoundaryTabsProps = {
  onSelectEntity?: (entity: DockEntity) => void;
};

/** Stable empty — React 19 requires getServerSnapshot to be referentially equal. */
const EMPTY_RECENT_TABS = { tabs: [] as DockEntity[] };

/**
 * Horizontal chip scroll — recently opened dock records (session MRU).
 */
export default function MapDockBoundaryTabs({ onSelectEntity }: MapDockBoundaryTabsProps) {
  const { selectedEntity, pane } = useMapDock();
  const { tabs } = useSyncExternalStore(
    subscribeRecentDockEntities,
    getRecentDockEntitiesSnapshot,
    () => EMPTY_RECENT_TABS,
  );

  const activeTabId =
    pane.id === 'details'
      ? recentDockEntityTabId(pane.entity)
      : selectedEntity
        ? recentDockEntityTabId(selectedEntity)
        : '';

  if (tabs.length === 0) return null;

  return (
    <div className={`${MAP_SHEET_SHELL_X} py-1.5`}>
      <div
        className="flex min-w-0 items-center gap-1.5 overflow-x-auto overflow-y-visible scrollbar-hide py-0.5"
        role="tablist"
        aria-label="Recently opened places"
      >
        {tabs.map((entity) => {
          const tabId = recentDockEntityTabId(entity);
          const active = tabId === activeTabId;
          return (
            <div
              key={tabId}
              role="presentation"
              className={`inline-flex shrink-0 items-center rounded-full shadow-sm ring-1 ring-black/[0.04] transition-colors ${
                active
                  ? 'border border-lake-blue/35 bg-lake-blue/10 text-lake-blue'
                  : `${MAP_DOCK_GLASS_BORDER_CLASS} ${MAP_DOCK_GLASS_FILL_CLASS} text-foreground-muted hover:bg-map-ink-subtle hover:text-foreground`
              }`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectEntity?.(entity)}
                className="max-w-[11rem] truncate py-1.5 pl-3 pr-1 text-left text-[13px] font-semibold"
                title={entity.subtitle ? `${entity.title} · ${entity.subtitle}` : entity.title}
              >
                {entity.title}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissRecentDockEntity(tabId);
                }}
                className={`mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                  active
                    ? 'text-lake-blue/80 hover:bg-lake-blue/15 hover:text-lake-blue'
                    : 'text-foreground-muted hover:bg-black/5 hover:text-foreground'
                }`}
                aria-label={`Remove ${entity.title} from recent`}
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
