'use client';

import { useEffect, useRef, useState } from 'react';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { IconEllipsis, IconShare } from '@/features/map/dockCore/core/icons';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
  MAP_DOCK_GLASS_HOVER_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import {
  showTerritorySelection,
  type SelectionKind,
} from '@/features/map/territory/territorySelection';
import { absoluteShareUrl, shareOrCopy } from '@/lib/share/shareOrCopy';
import { directoryTerritoryPath } from '@/lib/routes/routePolicy';

const UNIT_AI_KINDS = new Set<DockEntity['kind']>([
  'county',
  'ctu',
  'school_district',
  // district / senate_district / house_district: hidden for first launch
]);

function isSelectionKind(kind: DockEntity['kind']): kind is SelectionKind {
  return (
    kind === 'county' ||
    kind === 'ctu' ||
    kind === 'school_district' ||
    kind === 'school' ||
    kind === 'district' ||
    kind === 'district_part' ||
    kind === 'senate_district' ||
    kind === 'house_district'
  );
}

const MENU_BTN =
  `inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${MAP_DOCK_GLASS_BORDER_CLASS} ${MAP_DOCK_GLASS_FILL_CLASS} text-foreground shadow-sm transition-[background-color,transform] duration-150 ${MAP_DOCK_GLASS_HOVER_CLASS} active:scale-95`;

/** Territory details ⋯ menu — highlight on map + Place AI + Share. */
export default function TerritoryDetailsOpsMenu({ entity }: { entity: DockEntity }) {
  const { openSubpage } = useMapDock();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
    setCopied(false);
  }, [entity.id]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Atlas overlay features have no territory share URL / highlight selection yet.
  if (entity.kind === 'atlas') return null;

  const highlight = () => {
    if (!isSelectionKind(entity.kind)) return;
    void showTerritorySelection(entity.kind, entity.id);
    setOpen(false);
  };

  const openAi = () => {
    openSubpage({
      title: entity.title,
      subtitle: 'AI',
      kind: 'territory-ai',
      slug: entity.id,
    });
    setOpen(false);
  };

  const share = async () => {
    const url = absoluteShareUrl(directoryTerritoryPath(entity.id));
    await shareOrCopy(entity.title, url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setOpen(false);
  };

  const canHighlight = isSelectionKind(entity.kind);
  const canAi = UNIT_AI_KINDS.has(entity.kind);

  return (
    <div ref={rootRef} className="relative shrink-0 flex items-center gap-1.5">
      {/* Inline share shortcut — always visible, no menu needed for the most common action */}
      <button
        type="button"
        aria-label={copied ? 'Link copied' : 'Share this area'}
        title={copied ? 'Link copied!' : 'Share'}
        onClick={() => void share()}
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${MAP_DOCK_GLASS_BORDER_CLASS} ${MAP_DOCK_GLASS_FILL_CLASS} shadow-sm transition-[background-color,transform,color] duration-150 ${MAP_DOCK_GLASS_HOVER_CLASS} active:scale-95 ${copied ? 'text-lake-blue' : 'text-foreground'}`}
      >
        <IconShare className="h-4.5 w-4.5" />
      </button>

      {/* ⋯ menu for less-common actions */}
      {(canHighlight || canAi) ? (
        <button
          type="button"
          aria-label="More"
          title="More"
          aria-expanded={open}
          aria-haspopup="menu"
          className={MENU_BTN}
          onClick={() => setOpen((v) => !v)}
        >
          <IconEllipsis className="h-5 w-5" />
        </button>
      ) : null}

      {open ? (
        <div
          role="menu"
          className={`absolute right-0 top-[calc(100%+0.35rem)] z-40 min-w-[11.5rem] overflow-hidden rounded-2xl shadow-lg ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
        >
          {canHighlight ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3.5 py-3 text-left text-[14px] font-medium text-foreground transition active:bg-black/[0.04]"
              onClick={highlight}
            >
              Highlight on map
            </button>
          ) : null}
          {canAi ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full px-3.5 py-3 text-left text-[14px] font-medium text-foreground transition active:bg-black/[0.04]"
              onClick={openAi}
            >
              Open Place AI
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
