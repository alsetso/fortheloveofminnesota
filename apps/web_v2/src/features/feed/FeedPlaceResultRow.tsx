'use client';

import { IconMapPin } from '@/features/map/dockCore/core/icons';
import type { ForwardGeocodeHit } from '@/lib/geo/fetch/fetchForwardGeocode';

function splitLabel(name: string): { title: string; subtitle: string | null } {
  const parts = name.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { title: name, subtitle: null };
  if (parts.length === 1) return { title: parts[0]!, subtitle: null };
  return { title: parts[0]!, subtitle: parts.slice(1).join(', ') };
}

export function FeedPlaceResultRow({
  hit,
  onSelect,
}: {
  hit: ForwardGeocodeHit;
  onSelect: (hit: ForwardGeocodeHit) => void;
}) {
  const { title, subtitle } = splitLabel(hit.name);

  return (
    <button
      type="button"
      onClick={() => onSelect(hit)}
      className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors active:bg-black/[0.03]"
    >
      <span className="grid h-9 w-9 shrink-0 place-content-center rounded-full bg-black/[0.06] text-foreground-muted">
        <IconMapPin className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-foreground">
          {title}
        </span>
        {subtitle ? (
          <span className="mt-0.5 block truncate text-[13px] text-foreground-muted">
            {subtitle}
          </span>
        ) : null}
      </span>
    </button>
  );
}
