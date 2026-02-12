/**
 * Analytics card visibility configuration
 * Core cards are always visible to everyone
 * Additional cards are only visible to admins
 * 
 * TODO: Move to database table for admin UI control
 */

export type AnalyticsCardId = 
  | 'liveMentions'
  | 'profileViews'
  | 'totalPinViews'
  | 'totalMentionViews'
  | 'postViews'
  | 'mapViews'
  | 'likes'
  | 'collections'
  | 'uniqueVisitors'
  | 'avgViewsPerPin'
  | 'mostViewedPin'
  | 'referrerSources'
  | 'engagementRate'
  | 'viewsByDay'
  | 'topReferrers'
  | 'deviceType';

/**
 * Core analytics cards visible to everyone
 */
export const CORE_CARDS: AnalyticsCardId[] = [
  'liveMentions',
  'profileViews',
  'totalPinViews',
  'totalMentionViews',
  'postViews',
  'mapViews',
];

/**
 * Additional cards that are only visible to admins (future use)
 */
export const ADMIN_ONLY_CARDS: AnalyticsCardId[] = [
  'likes',
  'collections',
  'uniqueVisitors',
  'avgViewsPerPin',
  'mostViewedPin',
  'referrerSources',
  'engagementRate',
  'viewsByDay',
  'topReferrers',
  'deviceType',
];

/**
 * Check if a card should be visible for a user
 * @param cardId - The card identifier
 * @param isAdmin - Whether the user is an admin
 * @returns true if card should be visible
 */
export function isCardVisible(cardId: AnalyticsCardId, isAdmin: boolean = false): boolean {
  // Core cards are visible to everyone
  if (CORE_CARDS.includes(cardId)) {
    return true;
  }
  
  // Additional cards are only visible to admins
  if (ADMIN_ONLY_CARDS.includes(cardId)) {
    return isAdmin;
  }
  
  // Default: hide unknown cards
  return false;
}

/**
 * Get all visible cards for a user
 * @param isAdmin - Whether the user is an admin
 * @returns Array of visible card IDs
 */
export function getVisibleCards(isAdmin: boolean = false): AnalyticsCardId[] {
  const allCards = [...CORE_CARDS, ...ADMIN_ONLY_CARDS];
  return allCards.filter((cardId) => isCardVisible(cardId, isAdmin));
}
