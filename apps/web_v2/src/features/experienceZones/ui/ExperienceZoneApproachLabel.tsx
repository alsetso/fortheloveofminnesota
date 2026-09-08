'use client';

/**
 * Floating map label on the approaching experience-zone edge.
 * "Walking up to" chrome — only while near, not yet inside.
 *
 * Lives in MAP_CHROME (under the dock / cards / rails) and is positioned in
 * map-canvas space — not a viewport-fixed hover layer.
 */

import { useEffect, useState } from 'react';
import { useNearbyExperienceZone } from '@/features/experienceZones/store/nearbyExperienceZoneStore';
import { useVenueMode } from '@/features/experienceZones/store/venueModeStore';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';
import { useMapContext } from '@/map/MapProvider';

function formatApproachDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(1, Math.round(meters))} m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
}

export function ExperienceZoneApproachLabel() {
  const { map, ready } = useMapContext();
  const { nearest } = useNearbyExperienceZone();
  const { active, exploring } = useVenueMode();
  const [screen, setScreen] = useState<{ x: number; y: number } | null>(null);

  const show = Boolean(nearest && !active && !exploring);

  useEffect(() => {
    if (!map || !ready || !show || !nearest) {
      setScreen(null);
      return;
    }

    const project = () => {
      try {
        const p = map.project([nearest.label_lng, nearest.label_lat]);
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
          setScreen(null);
          return;
        }
        setScreen({ x: p.x, y: p.y });
      } catch {
        setScreen(null);
      }
    };

    project();
    map.on('move', project);
    return () => {
      map.off('move', project);
    };
  }, [map, ready, show, nearest]);

  if (!show || !nearest || !screen) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 ${Z_LAYER_CLASS.MAP_CHROME} overflow-hidden`}
    >
      <div
        className="pointer-events-none absolute max-w-[min(240px,70vw)] -translate-x-1/2 -translate-y-[calc(100%+14px)]"
        style={{ left: screen.x, top: screen.y }}
        role="status"
        aria-live="polite"
        aria-label={`${nearest.name}, ${formatApproachDistance(nearest.distance_m)}`}
      >
        <div
          className={`rounded-xl px-3 py-1.5 shadow-md ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
        >
          <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
            {nearest.name}
          </p>
          <p className="mt-0.5 truncate text-[11px] font-medium leading-snug text-foreground-muted">
            Experience zone · {formatApproachDistance(nearest.distance_m)}
          </p>
        </div>
      </div>
    </div>
  );
}
