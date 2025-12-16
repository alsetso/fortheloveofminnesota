import { Pin } from '@/features/pins/services/pinService';

export interface VisibilityFilterOptions {
  public: boolean;
  private: boolean;
}

export interface VisibilityFilterContext {
  userProfileIds: string[];
  isAuthenticated: boolean;
}

/**
 * Unified visibility filter function
 * Applies visibility filtering based on user preferences and pin ownership
 * 
 * Logic:
 * - If both filters are selected: show all visible pins
 * - Public filter: show public pins, accounts_only pins (if authenticated), and own pins
 * - Private filter: show only user's own pins
 */
export function filterPinsByVisibility(
  pins: Pin[],
  filter: VisibilityFilterOptions,
  context: VisibilityFilterContext
): Pin[] {
  const { public: showPublic, private: showPrivate } = filter;
  const { userProfileIds, isAuthenticated } = context;
  
  // If both filters are selected, show all visible pins (no filtering needed)
  if (showPublic && showPrivate) {
    return pins;
  }
  
  return pins.filter((pin) => {
    const isOwnPin = userProfileIds.includes(pin.profile_id || '');
    
    // Public filter: show public pins, accounts_only pins (if authenticated), and own pins
    if (showPublic) {
      if (pin.visibility === 'public') return true;
      if (isAuthenticated && pin.visibility === 'accounts_only') return true;
      if (isOwnPin) return true; // Own pins are always visible
      return false;
    }
    
    // Private filter: show only user's own pins
    if (showPrivate) {
      return isOwnPin;
    }
    
    // Neither filter selected (shouldn't happen, but handle gracefully)
    return false;
  });
}

/**
 * Get visibility filter context from current user state
 */
export function getVisibilityFilterContext(
  userProfileIds: string[],
  isAuthenticated: boolean
): VisibilityFilterContext {
  return {
    userProfileIds,
    isAuthenticated,
  };
}






