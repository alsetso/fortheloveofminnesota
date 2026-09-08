'use client';

/**
 * ContributeSheet — two-step contribution type picker.
 *
 * Step 1: Pick a category   (Report / Highlight / Event / Story / Idea)
 * Step 2: Pick a subtype    (6 choices per category)
 *
 * Lives as `absolute inset-0 z-30` inside MapDockShell's body frame —
 * same pattern as DockCardPopover. Width, corner radii, scroll, and
 * gesture handling are all inherited from the dock shell.
 *
 * On open: dock snaps to half. User drags to full to scroll subtypes,
 * or swipes down via the dock's own handle to dismiss.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  closeContributeSheet,
  getContributeSheetSnapshot,
  subscribeContributeSheet,
} from '@/features/community/contributeSheetStore';
import {
  CONTRIBUTION_CATEGORIES,
  type ContributionCategory,
  type ContributionSubtype,
} from '@/features/community/contributionTypes';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { DockScrollRegion } from '@/features/map/dockCore/core/dockScroll';
import { MAP_SHEET_BODY_CLASS } from '@/lib/map/mapChrome';
import { getFindMeLastCoords } from '@/map/location/device/findMeLastCoords';
import { getFindMeCoordsSnapshot } from '@/map/location/camera/findMeCoordsStore';
import { haptic } from '@/lib/despia/haptics';
import { useVenueMode } from '@/features/experienceZones/store/venueModeStore';

// ─── Step 1: Category tile ────────────────────────────────────────────────────

function CategoryTile({
  category,
  onSelect,
}: {
  category: ContributionCategory;
  onSelect: (c: ContributionCategory) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(category)}
      className="flex flex-col items-center gap-2 py-2 transition-transform duration-150 active:scale-[0.94]"
    >
      <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-neutral-100 text-[28px]">
        {category.emoji}
      </span>
      <span className="text-[12px] font-semibold leading-tight text-foreground">
        {category.label}
      </span>
    </button>
  );
}

// ─── Step 2: Subtype tile ─────────────────────────────────────────────────────

function SubtypeTile({
  subtype,
  onSelect,
}: {
  subtype: ContributionSubtype;
  onSelect: (s: ContributionSubtype) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(subtype)}
      className="flex flex-col items-center gap-2 py-2 transition-transform duration-150 active:scale-[0.94]"
    >
      <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-neutral-100 text-[26px]">
        {subtype.emoji}
      </span>
      <span className="text-[12px] font-semibold leading-tight text-foreground">
        {subtype.label}
      </span>
    </button>
  );
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

export default function ContributeSheet() {
  const sheetState = useSyncExternalStore(
    subscribeContributeSheet,
    getContributeSheetSnapshot,
    getContributeSheetSnapshot,
  );
  const venue = useVenueMode();

  const { openCreatePostSheet, setSnap } = useMapDock();
  const [entering, setEntering] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ContributionCategory | null>(null);

  // The user is physically inside a zone but hasn't opted in to Explore Zone.
  // Show a soft subtitle suggesting they can contribute to the zone.
  // Only surfaces when contributions are allowed — no misleading prompt otherwise.
  const candidateZoneName =
    venue.active &&
    !venue.exploring &&
    venue.zoneAllowContributions &&
    Boolean(venue.zoneName)
      ? venue.zoneName
      : null;

  // The user IS exploring, but this zone has contributions turned off.
  // Block the picker and show a friendly informational panel instead.
  const noContributions = sheetState.open && venue.exploring && !venue.zoneAllowContributions;

  // Snap dock to half and run enter animation when sheet opens.
  useEffect(() => {
    if (!sheetState.open) return;
    setSnap('half');
    setEntering(true);
    // Honour preselected category (e.g. opened from a specific Report button).
    if (sheetState.preselectedCategoryId) {
      const cat = CONTRIBUTION_CATEGORIES.find(
        (c) => c.id === sheetState.preselectedCategoryId,
      );
      setSelectedCategory(cat ?? null);
    } else {
      setSelectedCategory(null);
    }
  }, [sheetState.open, sheetState.preselectedCategoryId, setSnap]);

  // Reset selection when sheet closes so it's clean on re-open.
  useEffect(() => {
    if (!sheetState.open) setSelectedCategory(null);
  }, [sheetState.open]);

  // Close on Escape.
  useEffect(() => {
    if (!sheetState.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selectedCategory) setSelectedCategory(null);
      else closeContributeSheet();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetState.open, selectedCategory]);

  const handleCategorySelect = useCallback((cat: ContributionCategory) => {
    haptic.toggle();
    setSelectedCategory(cat);
  }, []);

  const handleBack = useCallback(() => {
    haptic.toggle();
    setSelectedCategory(null);
  }, []);

  const handleSubtypeSelect = useCallback(
    (subtype: ContributionSubtype) => {
      if (!selectedCategory) return;
      haptic.toggle();
      closeContributeSheet();

      const snap = getFindMeCoordsSnapshot();
      const coords = snap.coords ?? getFindMeLastCoords();

      openCreatePostSheet({
        lat: coords?.lat ?? 0,
        lng: coords?.lng ?? 0,
        address: sheetState.experienceZoneName ?? sheetState.ctu?.name ?? 'Minnesota',
        categorySlug: selectedCategory.slug,
        subtypeSlug: subtype.slug,
        composePlaceholder: subtype.composePlaceholder,
        returnSnap: 'quarter',
        experienceZoneId:   sheetState.experienceZoneId ?? null,
        experienceZoneName: sheetState.experienceZoneName ?? null,
      });
    },
    [openCreatePostSheet, sheetState.ctu, sheetState.experienceZoneId, sheetState.experienceZoneName, selectedCategory],
  );

  if (!sheetState.open) return null;

  // ── No-contributions state — exploring a zone with contributions disabled ───
  if (noContributions) {
    const zoneName = venue.zoneName ?? 'This zone';
    return (
      <div
        className="pointer-events-auto absolute inset-0 z-30 flex flex-col bg-white contribute-sheet-enter"
        role="dialog"
        aria-modal="true"
        aria-label={`${zoneName} contributions`}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
          <div className="h-8 w-8 shrink-0" aria-hidden />
          <p className="flex-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-violet-500">
            Experience zone
          </p>
          <button
            type="button"
            onClick={() => { haptic.toggle(); closeContributeSheet(); }}
            aria-label="Dismiss"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[15px] transition-transform active:scale-90"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pb-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-50 text-[32px]">
            🔒
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-[17px] font-bold leading-snug text-foreground">
              <span className="text-violet-600">{zoneName}</span>
            </p>
            <p className="text-[15px] font-medium text-foreground/70">
              doesn&apos;t allow contributions at this time.
            </p>
          </div>
          <p className="text-[13px] leading-relaxed text-foreground/40">
            Check back later — this experience zone may open contributions in the future.
          </p>
        </div>

        <style>{`
          @keyframes contributeSheetIn {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .contribute-sheet-enter {
            animation: contributeSheetIn 0.28s cubic-bezier(0.2, 0, 0, 1) both;
          }
        `}</style>
      </div>
    );
  }

  // ── Error state — tapped outside GPS accuracy circle ────────────────────────
  if (sheetState.errorMessage) {
    return (
      <div
        className="pointer-events-auto absolute inset-0 z-30 flex flex-col bg-white contribute-sheet-enter"
        role="dialog"
        aria-modal="true"
        aria-label="Outside your location"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
          <div className="h-8 w-8 shrink-0" aria-hidden />
          <h2 className="flex-1 text-center text-[17px] font-bold leading-snug text-foreground">
            Outside your location
          </h2>
          <button
            type="button"
            onClick={() => { haptic.toggle(); closeContributeSheet(); }}
            aria-label="Dismiss"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[15px] transition-transform active:scale-90"
          >
            ✕
          </button>
        </div>

        {/* Error body */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pb-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-[32px]">
            📍
          </span>
          <p className="text-[15px] font-semibold leading-snug text-foreground">
            {sheetState.errorMessage}
          </p>
          <p className="text-[13px] leading-relaxed text-foreground/50">
            Move closer to where you want to contribute, then tap the map again.
          </p>
        </div>

        <style>{`
          @keyframes contributeSheetIn {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .contribute-sheet-enter {
            animation: contributeSheetIn 0.28s cubic-bezier(0.2, 0, 0, 1) both;
          }
        `}</style>
      </div>
    );
  }

  const locationLabel = sheetState.experienceZoneName ?? sheetState.ctu?.name ?? 'Minnesota';
  const isZoneContribute = Boolean(sheetState.experienceZoneId);
  const isSubtypeStep = selectedCategory !== null;

  return (
    <div
      className={`pointer-events-auto absolute inset-0 z-30 flex flex-col bg-white ${
        entering ? 'contribute-sheet-enter' : ''
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={`Contribute to ${locationLabel}`}
      onAnimationEnd={() => setEntering(false)}
    >
      {/* Header */}
      <div className="shrink-0 px-5 pb-3 pt-5">
        {isSubtypeStep ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Back to categories"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[15px] transition-transform active:scale-90"
            >
              ←
            </button>
            <div className="min-w-0 flex-1">
              {isZoneContribute && (
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-500">
                  Experience zone · {locationLabel}
                </p>
              )}
              <p className={`font-semibold uppercase tracking-widest ${isZoneContribute ? 'text-[10px] text-foreground/40' : 'text-[11px] text-foreground/40'}`}>
                {selectedCategory.emoji} {selectedCategory.label}
              </p>
              <h2 className="truncate text-[17px] font-bold leading-snug text-foreground">
                What kind of {selectedCategory.label.toLowerCase()}?
              </h2>
            </div>
            <button
              type="button"
              onClick={() => { haptic.toggle(); closeContributeSheet(); }}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[15px] transition-transform active:scale-90"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            {/* spacer to mirror close button */}
            <div className="h-8 w-8 shrink-0" aria-hidden />
            <div className="flex-1 text-center">
              {isZoneContribute && (
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-violet-500">
                  Experience zone
                </p>
              )}
              <h2 className="text-[18px] font-bold leading-snug text-foreground">
                What&apos;d you like to contribute to{' '}
                <span className={isZoneContribute ? 'text-violet-600' : 'text-lake-blue'}>
                  {locationLabel}
                </span>?
              </h2>
              {candidateZoneName && !isZoneContribute && (
                <p className="mt-[6px] text-[12px] leading-snug text-foreground/50">
                  Would you like to contribute this to{' '}
                  <span className="font-semibold text-violet-500">{candidateZoneName}</span>?
                  {' '}Start exploring the zone to pin directly to it.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => { haptic.toggle(); closeContributeSheet(); }}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[15px] transition-transform active:scale-90"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Grid */}
      <DockScrollRegion
        scrollKey={`contribute-sheet:${isSubtypeStep ? selectedCategory?.id : 'categories'}`}
        className={MAP_SHEET_BODY_CLASS}
      >
        {isSubtypeStep ? (
          <div className="grid grid-cols-3 gap-x-2 gap-y-1 pb-4">
            {selectedCategory.subtypes.map((st) => (
              <SubtypeTile key={st.slug} subtype={st} onSelect={handleSubtypeSelect} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-x-2 gap-y-1 pb-4">
            {CONTRIBUTION_CATEGORIES.map((cat) => (
              <CategoryTile key={cat.id} category={cat} onSelect={handleCategorySelect} />
            ))}
          </div>
        )}
        <p className="pb-4 text-center text-[11px] text-foreground/30">
          Each pin drops live on the map for{' '}
          {locationLabel}.
        </p>
      </DockScrollRegion>

      <style>{`
        @keyframes contributeSheetIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .contribute-sheet-enter {
          animation: contributeSheetIn 0.28s cubic-bezier(0.2, 0, 0, 1) both;
        }
      `}</style>
    </div>
  );
}
