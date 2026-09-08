'use client';

/**
 * MinimapsShell — full-screen sheet opened from the Game MiniMap.
 *
 * Chrome (title + close + floating nav) stays put. The body swaps between
 * Objects (Object Radar), Unlocked (passport map), and Records (unlock list).
 */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from '@/features/map/dockCore/core/icons';
import { ObjectMap } from '@/features/map/game/objectRadar/ui/ObjectMap';
import { MinimapsNav } from '@/features/map/game/minimaps/MinimapsNav';
import { MinimapsRecordsList } from '@/features/map/game/minimaps/MinimapsRecordsList';
import { MinimapsUnlockedMap } from '@/features/map/game/minimaps/MinimapsUnlockedMap';
import { MinimapsDetailSheet } from '@/features/map/game/minimaps/MinimapsDetailSheet';
import {
  objectRadarActions,
  useObjectRadarStore,
} from '@/features/map/game/objectRadar/objectRadarStore';
import { useVenueMode } from '@/features/experienceZones/store/venueModeStore';
import { MINIMAPS_TABS, type MinimapsTabId } from '@/features/map/game/minimaps/minimapsTabs';
import { safePadTop } from '@/lib/despia/safeArea';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';

const TAB_TITLE: Record<MinimapsTabId, string> = {
  objects: 'Objects',
  unlocked: 'Unlocked',
  records: 'Records',
};

export function MinimapsShell() {
  const { sheetOpen, sheetTab, focusedTerritory } = useObjectRadarStore();
  const venue = useVenueMode();
  const inZone = venue.exploring && sheetTab === 'objects';
  const zoneName = inZone ? venue.zoneName : null;

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') objectRadarActions.closeSheet();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  if (!sheetOpen || typeof document === 'undefined') return null;

  const title = zoneName ?? TAB_TITLE[sheetTab];
  const activeTab = MINIMAPS_TABS.find((t) => t.id === sheetTab);

  return createPortal(
    <div
      data-minimaps="shell"
      data-minimaps-tab={sheetTab}
      data-zone-mode={inZone ? 'true' : undefined}
      className={`fixed inset-0 ${Z_LAYER_CLASS.CRITICAL_DIALOG} flex flex-col ${
        inZone ? 'bg-[#12081f]' : 'bg-[#050608]'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={zoneName ? `${zoneName} · Minimaps` : `Minimaps · ${title}`}
    >
      <header
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-3"
        style={{ paddingTop: safePadTop('0.75rem') }}
      >
        <div className="pointer-events-none min-w-0">
          <p
            className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${
              inZone ? 'text-violet-300/80' : 'text-white/45'
            }`}
          >
            Minimaps
          </p>
          <p className="mt-0.5 max-w-[min(100%,18rem)] truncate text-[18px] font-bold leading-tight tracking-tight text-white">
            {title}
          </p>
        </div>
        <button
          type="button"
          onClick={() => objectRadarActions.closeSheet()}
          aria-label="Close minimaps"
          className={`pointer-events-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition active:scale-95 ${
            inZone
              ? 'border border-violet-300/40 bg-violet-600/55 shadow-[0_0_18px_rgba(139,92,246,0.4)] hover:bg-violet-500/70'
              : 'bg-white/15'
          }`}
        >
          <IconX className="h-5 w-5" />
        </button>
      </header>

      {sheetTab === 'objects' ? <ObjectMap /> : null}
      {sheetTab === 'unlocked' ? <MinimapsUnlockedMap /> : null}
      {sheetTab === 'records' ? <MinimapsRecordsList /> : null}

      {/* Territory detail sheet — mounts in peek; drags up to full.
          Keyed by entity id so a new territory resets snap to peek. */}
      {focusedTerritory ? (
        <MinimapsDetailSheet
          key={focusedTerritory.id}
          entity={{
            id:        focusedTerritory.id,
            kind:      focusedTerritory.kind as Parameters<typeof MinimapsDetailSheet>[0]['entity']['kind'],
            title:     focusedTerritory.title,
            subtitle:  focusedTerritory.subtitle,
            kindLabel: focusedTerritory.kindLabel,
          }}
        />
      ) : null}

      <MinimapsNav
        active={activeTab?.id ?? 'objects'}
        onChange={(tab) => objectRadarActions.setSheetTab(tab)}
        zoneAccent={inZone}
      />
    </div>,
    document.body,
  );
}
