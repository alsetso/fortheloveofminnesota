'use client';

import { useMemo } from 'react';
import {
  basemapPreviewLabelIsLight,
  mapboxBasemapPreviewUrl,
  setBasemapId,
  type MapBasemapId,
} from '@/features/map/dockCore/compass/basemap';
import { useBasemap } from '@/features/map/dockCore/compass/useBasemap';
import { DockSection } from '@/features/map/dockCore/panes/DockPaneShell';
import { MAP_CONFIG } from '@/map/config';
import { useMapContext } from '@/map/MapProvider';

const BASEMAPS: {
  id: MapBasemapId;
  label: string;
  hint: string;
  fallbackClass: string;
}[] = [
  {
    id: 'streets',
    label: 'Streets',
    hint: 'Streets map',
    fallbackClass: 'bg-gradient-to-br from-sky-100 via-slate-100 to-slate-200',
  },
  {
    id: 'outdoors',
    label: 'Outdoors',
    hint: 'Trails, parks, and terrain',
    fallbackClass: 'bg-gradient-to-br from-emerald-100 via-lime-100 to-sky-100',
  },
  {
    id: 'satellite',
    label: 'Satellite',
    hint: 'Satellite map',
    fallbackClass: 'bg-gradient-to-br from-emerald-900 via-slate-800 to-neutral-900',
  },
];

type BasemapStylePickerProps = {
  /** Skip DockSection chrome when embedded in a dock card that already has a title. */
  bare?: boolean;
};

/** Map style picker — Map style pane + map-style dock card. */
export default function BasemapStylePicker({ bare = false }: BasemapStylePickerProps) {
  const { ready, map } = useMapContext();
  const { basemap } = useBasemap();
  const disabled = !ready || !map;

  const previews = useMemo(
    () => ({
      streets: mapboxBasemapPreviewUrl('streets', MAP_CONFIG.MAPBOX_TOKEN),
      outdoors: mapboxBasemapPreviewUrl('outdoors', MAP_CONFIG.MAPBOX_TOKEN),
      satellite: mapboxBasemapPreviewUrl('satellite', MAP_CONFIG.MAPBOX_TOKEN),
    }),
    [],
  );

  const grid = (
    <div className="flex gap-2" role="group" aria-label="Basemap style">
      {BASEMAPS.map(({ id, label, hint, fallbackClass }) => {
        const selected = basemap === id;
        const preview = previews[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => setBasemapId(id)}
            disabled={disabled}
            aria-pressed={selected}
            title={hint}
            className={`relative min-w-0 flex-1 overflow-hidden rounded-xl border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-lake-blue/50 ${
              bare ? 'h-20' : 'h-16'
            } ${
              selected
                ? 'border-lake-blue ring-2 ring-lake-blue/40'
                : 'border-map-glass opacity-90 hover:opacity-100'
            } ${disabled ? 'opacity-50' : ''}`}
          >
            <span className={`absolute inset-0 ${fallbackClass}`} aria-hidden />
            {preview ? (
              <img
                src={preview}
                alt=""
                className="absolute inset-0 z-[1] h-full w-full object-cover"
                loading="lazy"
                draggable={false}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : null}
            <span
              className={`absolute bottom-1 left-1.5 z-[2] rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                basemapPreviewLabelIsLight(id)
                  ? 'bg-white/75 text-foreground'
                  : 'bg-black/45 text-white'
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );

  if (bare) return grid;

  return (
    <DockSection title="Map style" subtitle="Base imagery under every layer.">
      {grid}
    </DockSection>
  );
}
