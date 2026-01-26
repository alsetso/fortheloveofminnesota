import type { MapItem } from './types';

/**
 * Hardcoded community maps
 * These are special maps that don't have database entries
 */
export const COMMUNITY_MAPS: Omit<MapItem, 'view_count'>[] = [
  {
    id: 'mention',
    name: 'Mentions',
    title: 'Mentions',
    description: 'Community mentions map',
    slug: 'mention',
    visibility: 'public',
    settings: {
      appearance: {
        map_style: 'street',
      },
    },
    map_type: 'community',
    member_count: 0,
    href: '/map/mention',
  },
];

/**
 * Hardcoded professional maps
 * These require Contributor plan access
 */
export const PROFESSIONAL_MAPS: Omit<MapItem, 'view_count'>[] = [
  {
    id: 'fraud',
    name: 'Fraud',
    title: 'Fraud',
    description: 'Professional fraud map',
    slug: 'fraud',
    visibility: 'public',
    settings: {
      appearance: {
        map_style: 'street',
      },
    },
    map_type: 'professional',
    member_count: 0,
    href: '/map/fraud',
    requiresPro: true,
  },
  {
    id: 'realestate',
    name: 'Real Estate',
    title: 'Real Estate',
    description: 'Professional real estate map',
    slug: 'realestate',
    visibility: 'public',
    settings: {
      appearance: {
        map_style: 'street',
      },
    },
    map_type: 'professional',
    member_count: 0,
    href: '/map/realestate',
    requiresPro: true,
  },
  {
    id: 'skip-tracing',
    name: 'Skip Tracing',
    title: 'Skip Tracing',
    description: 'Professional skip tracing map',
    slug: 'skip-tracing',
    visibility: 'public',
    settings: {
      appearance: {
        map_style: 'street',
      },
    },
    map_type: 'professional',
    member_count: 0,
    href: '/map/skip-tracing',
    requiresPro: true,
  },
];

