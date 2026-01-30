'use client';

import { MapIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';

export interface MapInfoLocation {
  lat: number;
  lng: number;
  address: string | null;
  mapMeta?: Record<string, any> | null;
}

const ZOOM_FOR_PINS = 12;

/** Safe numeric coords for display; avoids TypeError when lat/lng are strings or undefined. */
function safeLatLng(lat: unknown, lng: unknown): { lat: number; lng: number } {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  return {
    lat: Number.isFinite(latNum) ? latNum : 0,
    lng: Number.isFinite(lngNum) ? lngNum : 0,
  };
}

export interface MapInfoMentionType {
  id: string;
  emoji: string;
  name: string;
}

interface MapInfoProps {
  /** Location selected on map (null when none) */
  location: MapInfoLocation | null;
  /** Optional placeholder when no location selected */
  emptyLabel?: string;
  /** Current map zoom; when &lt; ZOOM_FOR_PINS and no emptyLabel, shows zoom hint for dropping pins */
  zoom?: number;
  /** When set and zoom >= 12, show "Add to map" button; called with current location and optional mention type id */
  onAddToMap?: (location: MapInfoLocation, mentionTypeId?: string) => void;
  /** When set with location, show mention type card in location area and "Add [Type] to map" button */
  mentionType?: MapInfoMentionType | null;
  /** When set, show close icon on the card; called when user closes (clears selection and URL on live). */
  onClose?: () => void;
}

function getMapMetaCardInfo(mapMeta: Record<string, any> | null | undefined): { emoji: string; name: string } | null {
  if (!mapMeta) return null;
  // Boundary click (state / county / CTU)
  const boundaryLayer = mapMeta.boundaryLayer as string | undefined;
  const boundaryName = mapMeta.boundaryName as string | undefined;
  if (boundaryLayer && boundaryName) {
    const layerLabel =
      boundaryLayer === 'state'
        ? 'State boundary'
        : boundaryLayer === 'district'
          ? 'Congressional district'
          : boundaryLayer === 'county'
            ? 'County'
            : boundaryLayer === 'ctu'
              ? 'CTU'
              : 'Boundary';
    return { emoji: '🗺️', name: `${layerLabel}: ${boundaryName}` };
  }
  // Pin / location feature
  const f = mapMeta.feature;
  if (!f) return null;
  const name = (f.name ?? f.label ?? '') || null;
  if (!name && !f.icon) return null;
  const emoji = typeof f.icon === 'string' ? f.icon : '📍';
  return { emoji, name: name || 'Location' };
}

/** Entity details from boundary click: pick display-safe fields per layer. */
function getBoundaryDetailRows(
  boundaryLayer: string | undefined,
  details: Record<string, any> | null | undefined
): { label: string; value: string }[] {
  if (!details || typeof details !== 'object') return [];
  const rows: { label: string; value: string }[] = [];
  if (boundaryLayer === 'state') {
    if (details.id != null) rows.push({ label: 'ID', value: String(details.id) });
    if (details.description != null) rows.push({ label: 'Description', value: String(details.description) });
    if (details.publisher != null) rows.push({ label: 'Publisher', value: String(details.publisher) });
    if (details.source_date != null) rows.push({ label: 'Source date', value: String(details.source_date) });
  } else if (boundaryLayer === 'district') {
    if (details.id != null) rows.push({ label: 'ID', value: String(details.id) });
    if (details.district_number != null) rows.push({ label: 'District', value: String(details.district_number) });
  } else if (boundaryLayer === 'county') {
    if (details.id != null) rows.push({ label: 'ID', value: String(details.id) });
    if (details.county_code != null) rows.push({ label: 'Code', value: String(details.county_code) });
    if (details.county_gnis_feature_id != null) rows.push({ label: 'GNIS ID', value: String(details.county_gnis_feature_id) });
  } else if (boundaryLayer === 'ctu') {
    if (details.id != null) rows.push({ label: 'ID', value: String(details.id) });
    if (details.ctu_class != null) rows.push({ label: 'Class', value: String(details.ctu_class) });
    if (details.county_name != null) rows.push({ label: 'County', value: String(details.county_name) });
    if (details.population != null) rows.push({ label: 'Population', value: String(details.population) });
    if (details.acres != null) rows.push({ label: 'Acres', value: String(details.acres) });
  }
  return rows;
}

/**
 * Container for dynamic map info (e.g. location selected on click).
 * Shows map meta card (emoji + name) when available, then location selected.
 */
function getEmptyLabel(zoom: number | undefined, explicitEmptyLabel: string | undefined): string {
  if (explicitEmptyLabel !== undefined) return explicitEmptyLabel;
  if (zoom !== undefined && zoom < ZOOM_FOR_PINS) return 'Zoom to 12 or more to drop pins.';
  return 'Tap the map to select a location';
}

export function MapInfoSkeleton({ onClose }: { onClose?: () => void }) {
  return (
    <div className="p-3 space-y-3" data-container="map-info-skeleton" aria-label="Loading map info">
      <div className="flex items-center justify-between gap-2">
        <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" aria-hidden />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 flex items-center justify-center p-1 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="space-y-1">
        <div className="h-2.5 w-20 rounded bg-gray-200 animate-pulse" aria-hidden />
        <div className="h-3.5 w-full max-w-[200px] rounded bg-gray-100 animate-pulse" aria-hidden />
        <div className="h-2.5 w-24 rounded bg-gray-100 animate-pulse" aria-hidden />
      </div>
    </div>
  );
}

export default function MapInfo({ location, emptyLabel, zoom, onAddToMap, mentionType, onClose }: MapInfoProps) {
  const { account, activeAccountId } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const isAuthenticated = Boolean(account || activeAccountId);

  if (!location) {
    const label = getEmptyLabel(zoom, emptyLabel);
    return (
      <div
        className="p-3 text-xs text-gray-500"
        data-container="map-info"
        aria-label="Map info"
      >
        {label}
      </div>
    );
  }

  const { lat, lng } = safeLatLng(location.lat, location.lng);
  const mapMetaCard = getMapMetaCardInfo(location.mapMeta);
  const display = location.address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const boundaryLayer = location.mapMeta?.boundaryLayer as string | undefined;
  const boundaryDetails = location.mapMeta?.boundaryDetails as Record<string, any> | null | undefined;
  const detailRows = getBoundaryDetailRows(boundaryLayer, boundaryDetails);

  return (
    <div
      className="p-3 space-y-3"
      data-container="map-info"
      aria-label="Map info"
    >
      <div className="flex items-center justify-between gap-2">
        {mapMetaCard ? (
          <div
            className="flex items-center gap-2 min-w-0 flex-1"
            data-container="map-meta-card"
            aria-label="Map meta card"
          >
            <span className="text-base flex-shrink-0" aria-hidden>
              {mapMetaCard.emoji}
            </span>
            <span className="text-xs font-medium text-gray-900 truncate">{mapMetaCard.name}</span>
          </div>
        ) : (
          <span className="text-xs font-medium text-gray-900 truncate flex-1">Location selected</span>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 flex items-center justify-center p-1 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>
      {detailRows.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Entity details</div>
          <ul className="space-y-0.5 list-none p-0 m-0 text-xs text-gray-600">
            {detailRows.map(({ label, value }) => (
              <li key={label} className="flex gap-2">
                <span className="text-gray-500 flex-shrink-0">{label}:</span>
                <span className="text-gray-900 break-words">{value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-1">
        <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Location selected</div>
        <div className="text-xs text-gray-900 break-words">{display}</div>
        <div className="text-[10px] text-gray-500">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </div>
        {mentionType && (
          <div className="flex items-center gap-2 pt-1" data-container="map-info-mention-type-card">
            <span className="text-base flex-shrink-0" aria-hidden>
              {mentionType.emoji}
            </span>
            <span className="text-xs font-medium text-gray-900 truncate">{mentionType.name}</span>
          </div>
        )}
        {zoom !== undefined && zoom >= ZOOM_FOR_PINS && (
          isAuthenticated && onAddToMap ? (
            <button
              type="button"
              onClick={() => onAddToMap({ ...location, lat, lng }, mentionType?.id)}
              className="mt-2 flex items-center justify-center gap-1.5 w-full py-1.5 px-2 text-xs font-medium text-gray-900 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              aria-label={mentionType ? `Add ${mentionType.name} to map` : 'Add to map'}
            >
              <MapIcon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
              {mentionType ? `Add ${mentionType.name} to map` : 'Add to map'}
            </button>
          ) : !isAuthenticated ? (
            <button
              type="button"
              onClick={openWelcome}
              className="mt-2 flex items-center justify-center gap-1.5 w-full py-1.5 px-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
              aria-label="Sign in to add to map"
            >
              <MapIcon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
              Sign in to add to map
            </button>
          ) : null
        )}
      </div>
    </div>
  );
}
