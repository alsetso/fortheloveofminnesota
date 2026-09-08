'use client';

import { useEffect } from 'react';
import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from 'geojson';
import type {
  ExpressionSpecification,
  FilterSpecification,
  Map as MapboxMap,
} from 'mapbox-gl';
import {
  isMapStyleReady,
} from '@/map/engine/mapStyleGuard';
import { loadStateBoundaryMinnesota } from '@/map/layers/useMinnesotaStateMask';

type SymbolLayerLike = {
  id: string;
  type?: string;
  layout?: Record<string, unknown>;
};

function isFeatureCollection(value: unknown): value is FeatureCollection {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as FeatureCollection).type === 'FeatureCollection' &&
    Array.isArray((value as FeatureCollection).features)
  );
}

function minnesotaPolygonGeometry(
  minnesota: FeatureCollection,
): Polygon | MultiPolygon | null {
  const feature = minnesota.features[0] as Feature | undefined;
  if (!feature?.geometry) return null;
  if (
    feature.geometry.type === 'Polygon' ||
    feature.geometry.type === 'MultiPolygon'
  ) {
    return feature.geometry;
  }
  return null;
}

function filterAlreadyScoped(filter: unknown): boolean {
  if (!Array.isArray(filter)) return false;
  if (filter[0] === 'within') return true;
  if (filter[0] === 'all') {
    return filter.some((part) => Array.isArray(part) && part[0] === 'within');
  }
  return false;
}

/**
 * Combine existing layer filter with ['within', mnPolygon].
 * Preserves prior predicates via `all`.
 */
export function combineWithMinnesotaWithin(
  existing: FilterSpecification | ExpressionSpecification | null | undefined,
  minnesotaPolygon: Polygon | MultiPolygon,
): FilterSpecification {
  const withinExpr = ['within', minnesotaPolygon] as FilterSpecification;

  if (existing == null) return withinExpr;
  if (filterAlreadyScoped(existing)) {
    if (Array.isArray(existing) && existing[0] === 'within') return withinExpr;
    if (Array.isArray(existing) && existing[0] === 'all') {
      const rest = existing
        .slice(1)
        .filter((part) => !(Array.isArray(part) && part[0] === 'within'));
      return ['all', withinExpr, ...rest] as FilterSpecification;
    }
  }

  return ['all', withinExpr, existing] as FilterSpecification;
}

/** Skip line-based road shields — full-containment `within` drops cross-border roads. */
function isPointOrientedSymbolLayer(
  map: MapboxMap,
  layer: SymbolLayerLike,
): boolean {
  const layout = layer.layout ?? {};
  if (layout['text-field'] == null && layout['icon-image'] == null) return false;

  const id = layer.id.toLowerCase();
  if (
    id.includes('road') &&
    (id.includes('shield') || id.includes('number') || id.includes('exit'))
  ) {
    return false;
  }
  if (id.includes('motorway-junction') || id.includes('highway-shield')) {
    return false;
  }

  try {
    const filter = map.getFilter(layer.id);
    const asText = JSON.stringify(filter ?? null);
    if (
      (asText.includes('LineString') || asText.includes('line')) &&
      (id.includes('shield') || id.includes('road-label'))
    ) {
      return false;
    }
  } catch {
    /* ignore */
  }

  return true;
}

function applyWithinFilters(
  map: MapboxMap,
  minnesotaPolygon: Polygon | MultiPolygon,
): number {
  let applied = 0;
  let layers: SymbolLayerLike[] = [];
  try {
    layers = (map.getStyle()?.layers ?? []).filter(
      (layer) => layer?.type === 'symbol' && typeof layer.id === 'string',
    ) as SymbolLayerLike[];
  } catch {
    return 0;
  }

  for (const layer of layers) {
    if (layer.id.startsWith('app-')) continue;
    if (!isPointOrientedSymbolLayer(map, layer)) continue;

    try {
      const existing = map.getFilter(layer.id) as
        | FilterSpecification
        | ExpressionSpecification
        | null;
      map.setFilter(
        layer.id,
        combineWithMinnesotaWithin(existing, minnesotaPolygon),
      );
      applied += 1;
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[MinnesotaLabelFilter] setFilter failed', layer.id, err);
      }
    }
  }
  return applied;
}

/**
 * Classic-style label filter via `within`.
 * Mapbox Standard basemap symbols are handled by the clip layer in
 * useMinnesotaStateMask (Standard layers aren't enumerable for setFilter).
 *
 * Reuses the shared state-boundary payload loaded by useMinnesotaStateMask —
 * no duplicate network request. Both hooks mount on the same component, so
 * the promise resolves once and both consumers share the result.
 */
export function useMinnesotaLabelFilter(
  map: MapboxMap | null,
  ready: boolean,
): void {
  useEffect(() => {
    if (!map || !ready) return;
    let cancelled = false;
    let minnesota: FeatureCollection | null = null;

    const apply = () => {
      if (cancelled || !isMapStyleReady(map) || !minnesota) return;
      const poly = minnesotaPolygonGeometry(minnesota);
      if (!poly) return;
      const applied = applyWithinFilters(map, poly);
      if (process.env.NODE_ENV === 'development') {
        console.info('[MinnesotaLabelFilter] within layers', applied);
      }
    };

    const onStyle = () => {
      apply();
      requestAnimationFrame(apply);
    };

    // Reuse the shared boundary promise — never fires a second fetch.
    void loadStateBoundaryMinnesota()
      .then((data) => {
        if (cancelled || !data) return;
        minnesota = data;
        apply();
      })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[MinnesotaLabelFilter]', err);
        }
      });

    map.on('style.load', onStyle);
    return () => {
      cancelled = true;
      map.off('style.load', onStyle);
    };
  }, [map, ready]);
}
