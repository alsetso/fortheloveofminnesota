'use client';

/**
 * MinimapsDetailSheet — territory detail rendered natively inside the Minimaps shell.
 *
 * Uses the same snap-sheet physics as the main map dock:
 *   peek  (~46 vh) — initial open; map still visible behind
 *   full  (~92 vh) — scroll unlocked, full content accessible
 *
 * Drag-to-resize is captured on the handle pill + header track only.
 * Scroll body is overflow-hidden until snap reaches `full`.
 * Spring settle animation mirrors MAP_DOCK_SHEET_SPRING_CLASS.
 *
 * Objects section is first for CTUs (most game-relevant data at a glance).
 * data-map-surface="dark" flips all semantic tokens without per-component overrides.
 */

import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import { objectRadarActions } from '@/features/map/game/objectRadar/objectRadarStore';
import { TerritoryHeroHeader } from '@/features/map/dockCore/panes/TerritoryHeroHeader';
import { DockUnitProfileSection } from '@/features/map/dockCore/panes/DockUnitProfileSection';
import { DockWorldObjectsHereSection } from '@/features/map/dockCore/panes/DockWorldObjectsHereSection';
import { DockOfficeholdersSection } from '@/features/map/dockCore/panes/DockOfficeholdersSection';
import { TerritoryBulletinSection } from '@/features/map/dockCore/panes/TerritoryBulletinSection';
import { DockPassportLockedSections } from '@/features/map/dockCore/panes/DockPassportLockedSections';
import { useTerritoryPassportUnlock } from '@/features/map/dockCore/panes/useTerritoryPassportUnlock';
import { IconArrowLeft, IconChevronDown } from '@/features/map/dockCore/core/icons';
import { MAP_DOCK_SHEET_SPRING_CLASS } from '@/features/map/dockCore/core/mapDockTokens';
import { safePadBottom, safePadTop } from '@/lib/despia/safeArea';
import { useMinimapSnapSheet } from './useMinimapSnapSheet';

const BULLETIN_KINDS = new Set(['county', 'ctu', 'school_district']);
const CTU_KINDS = new Set(['ctu']);

export function MinimapsDetailSheet({ entity }: { entity: DockEntity }) {
  const { snap, setSnap, sheetH, dragging, scrollable, scrollBodyRef, handleProps } =
    useMinimapSnapSheet('peek');

  const { loading, unlocked, locked, unlockable, xpEarned } =
    useTerritoryPassportUnlock(entity);

  const isCtu = CTU_KINDS.has(entity.kind);
  const hasBulletin = BULLETIN_KINDS.has(entity.kind);
  const isExpanded = snap === 'full';

  // Back: full → peek, peek → close sheet entirely
  const onBack = isExpanded
    ? () => setSnap('peek')
    : () => objectRadarActions.clearFocusedTerritory();

  // Spring class only applies when settled; during drag use inline height directly
  const springClass = dragging ? '' : MAP_DOCK_SHEET_SPRING_CLASS;

  return (
    <div
      data-map-surface="dark"
      className={`absolute inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden bg-[#050608] ${springClass} ${
        isExpanded ? 'rounded-none' : 'rounded-t-[28px]'
      }`}
      style={{ height: sheetH }}
    >
      {/* ── Drag handle ─────────────────────────────────────────────────
          Full-width grab target. Pointer events captured here drive
          the sheet resize. Buttons in the header use stopPropagation
          so clicks never accidentally initiate a drag. */}
      <div
        {...handleProps}
        className="flex shrink-0 justify-center pb-1 pt-2.5 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="pointer-events-none h-1 w-10 rounded-full bg-white/20" />
      </div>

      {/* ── Header ──────────────────────────────────────────────────────
          Title track also participates in drag (onPointerDown propagates
          from handle above). Buttons stop propagation to avoid conflicts. */}
      <div
        {...handleProps}
        className="flex shrink-0 items-center gap-2 border-b border-white/8 px-3 pb-3 select-none"
        style={{ paddingTop: isExpanded ? safePadTop('0.75rem') : '0.5rem' }}
      >
        {/* Back — stops pointer propagation so it doesn't start a drag */}
        <button
          type="button"
          onClick={onBack}
          aria-label={isExpanded ? 'Collapse to peek' : 'Close detail'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground/70 transition active:scale-90"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <IconArrowLeft className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-foreground-muted opacity-60">
            {entity.kindLabel ?? entity.kind}
          </p>
          <p className="truncate text-[16px] font-bold leading-tight text-foreground">
            {entity.title}
          </p>
        </div>

        {/* Expand — peek only; tapping snaps directly to full */}
        {!isExpanded && (
          <button
            type="button"
            onClick={() => setSnap('full')}
            aria-label="Expand to full details"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground/70 transition active:scale-90"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <IconChevronDown className="h-5 w-5 rotate-180" />
          </button>
        )}
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────
          Scroll is only enabled at full snap (when scrollable=true).
          At peek, overflow-hidden prevents scroll and touch-none lets
          vertical pan fall through to the handle above. */}
      <div
        ref={scrollBodyRef}
        className={`min-h-0 flex-1 overscroll-y-contain ${
          scrollable
            ? 'overflow-y-auto touch-pan-y'
            : 'overflow-hidden touch-none'
        }`}
        style={{ paddingBottom: safePadBottom('1.5rem') }}
      >
        <div className="space-y-5 px-4 py-5">

          {/* Objects first — most game-relevant data for CTUs */}
          {isCtu && <DockWorldObjectsHereSection entity={entity} />}

          {/* Passport stamp hero */}
          <TerritoryHeroHeader
            entity={entity}
            unlockable={unlockable}
            loading={loading}
            unlocked={unlocked}
            locked={locked}
            xpEarned={xpEarned}
          />

          <DockUnitProfileSection entity={entity} />

          {locked ? <DockPassportLockedSections entity={entity} /> : null}

          {unlocked ? (
            <>
              <DockOfficeholdersSection entity={entity} />
              {hasBulletin ? <TerritoryBulletinSection entity={entity} /> : null}
            </>
          ) : null}

        </div>
      </div>
    </div>
  );
}
