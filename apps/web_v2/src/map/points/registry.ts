import {
  selectedPointFormat,
  userLocationDotFormat,
  userLocationFormat,
} from '@/map/points/formats';
import type {
  MapPointFormat,
  MapPointFormatId,
} from '@/map/points/types';

const FORMATS: Record<MapPointFormatId, MapPointFormat> = {
  selected: selectedPointFormat,
  'user-location': userLocationFormat,
  'user-location-dot': userLocationDotFormat,
};

export function getMapPointFormat(id: MapPointFormatId): MapPointFormat {
  return FORMATS[id];
}

export function listMapPointFormats(): MapPointFormat[] {
  return Object.values(FORMATS);
}

export function ensureMapPointFormatStyles(format: MapPointFormat): void {
  if (typeof document === 'undefined') return;
  if (document.head.querySelector(`#${format.styleId}`)) return;
  const style = document.createElement('style');
  style.id = format.styleId;
  style.textContent = format.styleText;
  document.head.appendChild(style);
}
