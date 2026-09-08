'use client';

/**
 * In-zone explore prompt — game-style yes/no beside the minimap.
 *
 * Present, not exploring:
 *   "Do you want to explore {zoneName}?" → Yes / No
 * Declined:
 *   Quiet "Explore?" chip so they can change their mind without leaving
 * Exploring:
 *   Compact "Exploring" status (+ sub-zone badge when nested)
 */

import { useEffect, useState } from 'react';
import {
  declineExploreZone,
  reofferExploreZone,
  startExploreZone,
  useVenueMode,
} from '@/features/experienceZones/store/venueModeStore';
import { openExploreZoneEntered } from '@/features/experienceZones/ui/ExploreZoneEnteredModal';
import { triggerWorldRefresh } from '@/features/map/game/world/worldRefreshSignal';
import { setTerritoriesAroundMeOn } from '@/features/map/territory/territoriesAroundMeStore';
import { haptic } from '@/lib/despia/haptics';

async function fetchZoneObjectCount(zoneId: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/experience-zones/${zoneId}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      zone?: { placementCount?: number | null };
    };
    const n = json.zone?.placementCount;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function ExperienceZoneBanner() {
  const {
    active,
    exploring,
    exploreDeclined,
    zoneId,
    zoneName,
    subZoneName,
    welcomeToken,
  } = useVenueMode();
  const [pulse, setPulse] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!active || welcomeToken === 0) return;
    setPulse(true);
    const t = window.setTimeout(() => setPulse(false), 900);
    return () => window.clearTimeout(t);
  }, [active, welcomeToken]);

  if (!active || !zoneName || !zoneId) return null;

  if (exploring) {
    const ariaLabel = subZoneName
      ? `Exploring ${zoneName}, in ${subZoneName}`
      : `Exploring ${zoneName}`;

    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={ariaLabel}
        className="pointer-events-none min-w-0 w-full"
      >
        <div
          className={`rounded-2xl border border-black/10 bg-white/95 px-3 py-2 shadow-[0_8px_28px_rgba(15,26,23,0.14)] backdrop-blur-xl transition-transform duration-500 ease-out ${
            pulse ? 'scale-[1.03]' : 'scale-100'
          }`}
        >
          <p className="text-[10px] font-semibold tracking-[0.04em] text-[#5C6670]">
            Exploring
          </p>
          <p className="mt-0.5 truncate text-[15px] font-bold leading-tight tracking-tight text-[#1C1C1E]">
            {zoneName}
          </p>
          {subZoneName ? (
            <p className="mt-0.5 truncate text-[11px] font-medium leading-snug text-[#5C6670]">
              In {subZoneName}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  // No for now — keep a quiet re-entry so they can still opt in later.
  if (exploreDeclined) {
    return (
      <button
        type="button"
        onClick={() => {
          haptic.toggle();
          reofferExploreZone();
        }}
        aria-label={`Explore ${zoneName}`}
        className="pointer-events-auto rounded-full border border-black/10 bg-white/95 px-3.5 py-1.5 text-[12px] font-semibold text-[#1C1C1E] shadow-[0_6px_18px_rgba(15,26,23,0.12)] backdrop-blur-xl transition active:scale-95"
      >
        Explore?
      </button>
    );
  }

  const onYes = async () => {
    if (starting) return;
    setStarting(true);
    haptic.findMe.success();
    if (!startExploreZone()) {
      setStarting(false);
      return;
    }
    setTerritoriesAroundMeOn(false);
    triggerWorldRefresh();
    const objectCount = await fetchZoneObjectCount(zoneId);
    openExploreZoneEntered({ zoneId, zoneName, objectCount });
    setStarting(false);
  };

  const onNo = () => {
    haptic.toggle();
    declineExploreZone();
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={`Do you want to explore ${zoneName}?`}
      className="pointer-events-auto min-w-0 w-full"
    >
      <div
        className={`rounded-2xl border border-black/10 bg-white/95 px-3 py-2.5 shadow-[0_8px_28px_rgba(15,26,23,0.14)] backdrop-blur-xl transition-transform duration-500 ease-out ${
          pulse ? 'scale-[1.03]' : 'scale-100'
        }`}
      >
        <p className="text-[11px] font-semibold leading-snug text-[#1C1C1E]">
          Do you want to explore{' '}
          <span className="font-bold">{zoneName}</span>?
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={onNo}
            disabled={starting}
            aria-label={`No — do not explore ${zoneName}`}
            className="min-w-[3.25rem] flex-1 rounded-full border border-red-700/20 bg-red-600 px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(220,38,38,0.35)] transition active:scale-95 hover:bg-red-500 disabled:opacity-60"
          >
            No
          </button>
          <button
            type="button"
            onClick={() => void onYes()}
            disabled={starting}
            aria-label={`Yes — explore ${zoneName}`}
            className="min-w-[3.25rem] flex-1 rounded-full border border-green-700/20 bg-green-600 px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(22,163,74,0.35)] transition active:scale-95 hover:bg-green-500 disabled:opacity-60"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}
