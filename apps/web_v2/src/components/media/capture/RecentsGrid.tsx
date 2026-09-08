'use client';

import { useEffect } from 'react';
import PostLocationPanel, {
  type PostLocationValue,
} from '@/components/media/capture/PostLocationPanel';
import RecentMediaTileVisual from '@/components/media/picker/RecentMediaTileVisual';
import { IconCamera, IconCheck, IconChevronDown, IconPhoto } from '@/features/map/dockCore/core/icons';
import { useRecents } from '@/components/media/useRecents';
import type { RecentMediaEntry } from '@/lib/despia/media';
import { isDespia } from '@/lib/despia/despia';
import { haptic } from '@/lib/despia/haptics';
import { openAppSettings } from '@/lib/despia/openAppSettings';

export type RecentsGridProps = {
  cellSize: number;
  gap: number;
  padX: number;
  /** Limited-library notice — only when the runtime reports limited Photos access. */
  showLimitedLibraryNotice?: boolean;
  selectMode: boolean;
  selectedIds: ReadonlySet<string>;
  onToggleSelectMode: () => void;
  onToggleSelected: (id: string) => void;
  onSelectRecent: (entry: RecentMediaEntry) => void;
  onBrowseLibrary: () => void;
  /** Scroll back to the fixed camera viewport. */
  onOpenCamera: () => void;
  /** Confirm multi-select (Select mode) → attach to compose. */
  onConfirmSelection?: (entries: RecentMediaEntry[]) => void;
  /** Delete selected Recents (Select mode). */
  onDeleteSelection?: (entries: RecentMediaEntry[]) => void;
  /** Where the Create Post pin drops — replaces the old quick-action strip. */
  location: PostLocationValue;
  onLocationChange: (next: PostLocationValue) => void;
};

/**
 * State 2 library surface. Camera stays full-size above and only pushes up —
 * cell 0 is a Camera affordance (not a live morphing preview).
 */
export default function RecentsGrid({
  cellSize,
  gap,
  padX,
  showLimitedLibraryNotice = false,
  selectMode,
  selectedIds,
  onToggleSelectMode,
  onToggleSelected,
  onSelectRecent,
  onBrowseLibrary,
  onOpenCamera,
  onConfirmSelection,
  onDeleteSelection,
  location,
  onLocationChange,
}: RecentsGridProps) {
  const { recents, refreshFromLocalCdn } = useRecents();

  useEffect(() => {
    void refreshFromLocalCdn();
  }, [refreshFromLocalCdn]);

  const selectedCount = selectedIds.size;

  return (
    <div style={{ paddingLeft: padX, paddingRight: padX }}>
      <PostLocationPanel value={location} onChange={onLocationChange} />

      <div className="mb-2 flex items-center justify-between gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[15px] font-semibold text-white"
          aria-label="Recents album"
        >
          Recents
          <IconChevronDown className="h-4 w-4 text-white/70" />
        </button>
        <button
          type="button"
          onClick={onToggleSelectMode}
          aria-pressed={selectMode}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[14px] font-semibold text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="4" y="4" width="10" height="10" rx="1.5" />
            <rect x="10" y="10" width="10" height="10" rx="1.5" />
          </svg>
          Select
        </button>
      </div>

      {showLimitedLibraryNotice ? (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-xl bg-white/[0.06] px-3 py-2.5">
          <p className="text-[12px] leading-snug text-white/55">
            You&apos;ve given access to a select number of photos and videos.
          </p>
          <button
            type="button"
            onClick={() => {
              haptic.toggle();
              if (isDespia()) void openAppSettings();
            }}
            className="shrink-0 text-[12px] font-semibold text-white"
          >
            Manage
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-3" style={{ gap }}>
        <button
          type="button"
          onClick={() => {
            haptic.toggle();
            onOpenCamera();
          }}
          aria-label="Open camera"
          className="relative flex flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[10px] bg-white/[0.08]"
          style={{ width: cellSize, height: cellSize }}
        >
          <IconCamera className="h-7 w-7 text-white" />
          <span className="px-1 text-center text-[10px] font-semibold leading-tight text-white/70">
            Camera
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            haptic.toggle();
            onBrowseLibrary();
          }}
          aria-label="Browse photo library"
          className="relative flex flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[10px] bg-white/[0.08]"
          style={{ width: cellSize, height: cellSize }}
        >
          <IconPhoto className="h-7 w-7 text-white" />
          <span className="px-1 text-center text-[10px] font-semibold leading-tight text-white/70">
            Browse Library
          </span>
        </button>

        {recents.map((entry) => {
          const selected = selectedIds.has(entry.id);
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                if (selectMode) {
                  haptic.toggle();
                  onToggleSelected(entry.id);
                  return;
                }
                // Select off → open in camera preview (parent handles haptics).
                onSelectRecent(entry);
              }}
              aria-label={
                entry.kind === 'video'
                  ? 'Preview recent video'
                  : 'Preview recent photo'
              }
              className="relative overflow-hidden rounded-[10px] bg-white/[0.06]"
              style={{ width: cellSize, height: cellSize }}
            >
              <RecentMediaTileVisual entry={entry} />

              {selectMode ? (
                <span
                  className={`pointer-events-none absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                    selected
                      ? 'border-lake-blue bg-lake-blue text-white'
                      : 'border-white/80 bg-black/35'
                  }`}
                >
                  {selected ? <IconCheck className="h-3 w-3" /> : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {selectMode &&
      selectedCount > 0 &&
      (onConfirmSelection || onDeleteSelection) ? (
        <div className="sticky bottom-0 mt-4 flex gap-2 pb-2 pt-2">
          {onDeleteSelection ? (
            <button
              type="button"
              onClick={() => {
                const picked = recents.filter((r) => selectedIds.has(r.id));
                haptic.findMe.stop();
                onDeleteSelection(picked);
              }}
              className="flex-1 rounded-full bg-red-500 py-3 text-[15px] font-semibold text-white transition active:scale-[0.99]"
            >
              Delete ({selectedCount})
            </button>
          ) : null}
          {onConfirmSelection ? (
            <button
              type="button"
              onClick={() => {
                const picked = recents.filter((r) => selectedIds.has(r.id));
                haptic.toggle();
                onConfirmSelection(picked);
              }}
              className="flex-1 rounded-full bg-white py-3 text-[15px] font-semibold text-black transition active:scale-[0.99]"
            >
              Add ({selectedCount})
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
