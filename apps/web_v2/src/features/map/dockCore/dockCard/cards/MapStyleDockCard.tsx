'use client';

import BasemapStylePicker from '@/features/map/dockCore/compass/BasemapStylePicker';
import { useBasemap } from '@/features/map/dockCore/compass/useBasemap';
import type { MapBasemapId } from '@/features/map/dockCore/compass/basemap';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';

const BASEMAP_COPY: Record<MapBasemapId, { label: string; blurb: string }> = {
  streets: { label: 'Streets', blurb: 'Roads and labels for everyday browsing.' },
  outdoors: { label: 'Outdoors', blurb: 'Trails, parks, and terrain detail.' },
  satellite: { label: 'Satellite', blurb: 'Aerial imagery with street labels.' },
};

/** Map style dock card — streets / outdoors / satellite basemap picker. */
export default function MapStyleDockCard() {
  const { basemap } = useBasemap();
  const current = BASEMAP_COPY[basemap];

  return (
    <DockCardShell
      titleMode="center"
      eyebrow="Map"
      title="Map style"
      subtitle={`${current.label} — ${current.blurb}`}
    >
      <BasemapStylePicker bare />
    </DockCardShell>
  );
}
