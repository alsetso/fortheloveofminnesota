import type { MapItem } from './types';

/**
 * Hardcoded community maps
 * These are special maps that don't have database entries
 */
export const COMMUNITY_MAPS: Omit<MapItem, 'view_count'>[] = [
  {
    id: 'mention',
    title: 'Mentions',
    description: 'Community mentions map',
    visibility: 'public',
    map_style: 'street',
    map_type: 'community',
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
    title: 'Fraud',
    description: 'Professional fraud map',
    visibility: 'public',
    map_style: 'street',
    map_type: 'professional',
    href: '/map/fraud',
    requiresPro: true,
  },
  {
    id: 'realestate',
    title: 'Real Estate',
    description: 'Professional real estate map',
    visibility: 'public',
    map_style: 'street',
    map_type: 'professional',
    href: '/map/realestate',
    requiresPro: true,
  },
  {
    id: 'skip-tracing',
    title: 'Skip Tracing',
    description: 'Professional skip tracing map',
    visibility: 'public',
    map_style: 'street',
    map_type: 'professional',
    href: '/map/skip-tracing',
    requiresPro: true,
  },
];

