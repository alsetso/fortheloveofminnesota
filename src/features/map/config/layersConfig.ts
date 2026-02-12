/**
 * Layers schema configuration
 * Each layers.* table maps to a display card on Explore and a detail page.
 * Add new entries when adding tables to layers schema.
 */

import {
  GlobeAltIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  RectangleStackIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType } from 'react';

export type LayerId = 'state' | 'counties' | 'cities-and-towns' | 'congressional-districts';

export interface LayerConfig {
  id: LayerId;
  /** layers schema table name */
  table: string;
  /** URL slug for /explore/[table] */
  slug: string;
  /** Display label for card and page header */
  label: string;
  /** Short description for card */
  description: string;
  /** Heroicon component */
  icon: ComponentType<{ className?: string }>;
  /** API endpoint for fetching records */
  apiEndpoint: string;
  /** Field used as display name in list/detail */
  nameField: string;
  /** Count label suffix (e.g. "counties", "districts") */
  countLabel: string;
}

export const LAYERS_CONFIG: LayerConfig[] = [
  {
    id: 'state',
    table: 'state',
    slug: 'state',
    label: 'Minnesota State Boundary',
    description: 'Complete state boundary of Minnesota',
    icon: GlobeAltIcon,
    apiEndpoint: '/api/civic/state-boundary',
    nameField: 'name',
    countLabel: 'boundary',
  },
  {
    id: 'counties',
    table: 'counties',
    slug: 'counties',
    label: 'Counties',
    description: 'Minnesota county boundaries',
    icon: MapPinIcon,
    apiEndpoint: '/api/civic/county-boundaries',
    nameField: 'county_name',
    countLabel: 'counties',
  },
  {
    id: 'cities-and-towns',
    table: 'cities_and_towns',
    slug: 'cities-and-towns',
    label: 'Cities and Towns',
    description: 'Cities, townships, and municipalities',
    icon: BuildingOfficeIcon,
    apiEndpoint: '/api/civic/ctu-boundaries',
    nameField: 'feature_name',
    countLabel: 'total',
  },
  {
    id: 'congressional-districts',
    table: 'districts',
    slug: 'congressional-districts',
    label: 'Congressional Districts',
    description: 'U.S. Congressional district boundaries',
    icon: RectangleStackIcon,
    apiEndpoint: '/api/civic/congressional-districts',
    nameField: 'district_number',
    countLabel: 'districts',
  },
];

export const LAYER_SLUGS = LAYERS_CONFIG.map((c) => c.slug);

export function getLayerConfigBySlug(slug: string): LayerConfig | undefined {
  return LAYERS_CONFIG.find((c) => c.slug === slug);
}

export function getLayerConfigById(id: LayerId): LayerConfig | undefined {
  return LAYERS_CONFIG.find((c) => c.id === id);
}
