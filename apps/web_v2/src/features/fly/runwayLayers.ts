import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl';
import { landingGeoJson, runwayGeoJson, type Runway } from './runways';

export function paintRunways(map: MapboxMap, runways: Runway[], selectedId: string | null) {
  // Called after style load; terrain tiles may still be loading at this point.
  if (!map.getStyle()) return;
  const data = runwayGeoJson(runways);
  const source = map.getSource('fly-runways') as GeoJSONSource | undefined;
  if (source) source.setData(data);
  else map.addSource('fly-runways', { type: 'geojson', data });
  if (!map.getLayer('fly-runway-halo')) {
    map.addLayer({ id: 'fly-runway-halo', type: 'line', source: 'fly-runways',
      paint: { 'line-color': '#183f35', 'line-width': 14, 'line-opacity': 0.6 } });
    map.addLayer({ id: 'fly-runway-center', type: 'line', source: 'fly-runways',
      paint: { 'line-color': '#69efc1', 'line-width': 5 } });
    map.addLayer({ id: 'fly-runway-selected', type: 'line', source: 'fly-runways',
      paint: { 'line-color': '#ffd36e', 'line-width': 8 } });
    map.addLayer({ id: 'fly-runway-label', type: 'symbol', source: 'fly-runways',
      layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'name'], 'text-size': 12, 'text-offset': [0, -1.4] },
      paint: { 'text-color': '#19382e', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
  }
  map.setFilter('fly-runway-selected', ['==', ['get', 'id'], selectedId ?? '']);
}

/** Update only when the eligible runway/direction changes, not each frame. */
export function paintLandingCorridor(map: MapboxMap, runway: Runway | undefined, reverse = false) {
  if (!map.getStyle()) return;
  const data = landingGeoJson(runway, reverse);
  const source = map.getSource('fly-landing') as GeoJSONSource | undefined;
  if (source) source.setData(data);
  else map.addSource('fly-landing', { type: 'geojson', data });
  if (!map.getLayer('fly-landing-fill')) {
    map.addLayer({ id: 'fly-landing-fill', type: 'fill', source: 'fly-landing',
      paint: { 'fill-color': '#45ffc1', 'fill-opacity': 0.28 } }, 'fly-runway-halo');
    map.addLayer({ id: 'fly-landing-outline', type: 'line', source: 'fly-landing',
      paint: { 'line-color': '#45ffc1', 'line-width': 3 } }, 'fly-runway-halo');
  }
}
