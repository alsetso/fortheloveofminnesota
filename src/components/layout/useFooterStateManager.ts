import { useMemo } from 'react';
import type { FooterState } from './footerConfig';

interface FooterStateManagerOptions {
  /** Whether search is currently active */
  isSearchActive: boolean;
  /** Whether a pin is selected */
  hasPinSelection: boolean;
  /** Whether a location is selected */
  hasLocationSelection: boolean;
  /** Whether a mention type filter is active */
  hasMentionTypeFilter: boolean;
  /** Whether a modal is open (should hide footer) */
  isModalOpen?: boolean;
  /** Current panel height in pixels */
  panelHeight: number;
  /** Explicit target state override */
  targetState?: FooterState | null;
  /** Height constants */
  heights: {
    HIDDEN_HEIGHT: number;
    TINY_HEIGHT: number;
    LOW_HEIGHT: number;
    MAIN_HEIGHT: number;
    TALL_HEIGHT: number;
  };
}

interface FooterStateManagerResult {
  /** Current footer state */
  currentState: FooterState;
  /** Whether close icon should be shown */
  shouldShowCloseIcon: boolean;
  /** Whether mention type cards should be shown */
  shouldShowMentionTypes: boolean;
  /** Whether footer should be open */
  shouldBeOpen: boolean;
  /** Target height for current state */
  targetHeight: number;
}

/**
 * Unified footer state manager - single source of truth for footer state logic
 * Determines footer state from all possible sources and resolves conflicts
 */
export function useFooterStateManager({
  isSearchActive,
  hasPinSelection,
  hasLocationSelection,
  hasMentionTypeFilter,
  isModalOpen = false,
  panelHeight,
  targetState,
  heights,
}: FooterStateManagerOptions): FooterStateManagerResult {
  const { HIDDEN_HEIGHT, TINY_HEIGHT, LOW_HEIGHT, MAIN_HEIGHT, TALL_HEIGHT } = heights;

  // Determine current state with priority:
  // 1. Modal open → hidden (highest priority, overrides everything)
  // 2. Explicit targetState
  // 3. Search active → main
  // 4. Pin selected → tall
  // 5. Panel height indicates tall state
  // 6. Panel height indicates tiny state
  // 7. Location/mention type selected → main
  // 8. Default → low
  const currentState = useMemo((): FooterState => {
    // Modal open always hides footer (highest priority)
    if (isModalOpen) {
      return 'hidden';
    }

    // Explicit target state takes priority (unless modal is open)
    if (targetState) {
      return targetState;
    }

    // Search active triggers main state (shows search results card)
    if (isSearchActive) {
      return 'main';
    }

    // Pin selection triggers tall state
    if (hasPinSelection) {
      return 'tall';
    }

    // Panel height indicates tall state (within threshold)
    if (panelHeight >= TALL_HEIGHT - 10) {
      return 'tall';
    }

    // Panel height indicates tiny state (within threshold)
    if (panelHeight <= TINY_HEIGHT + 10) {
      return 'tiny';
    }

    // Location or mention type selection triggers main state
    if (hasLocationSelection || hasMentionTypeFilter) {
      return 'main';
    }

    // Don't use panel height as fallback - only use explicit selections
    // Panel height is managed by drag/state transitions, not used to determine state

    // Default to low
    return 'low';
  }, [targetState, isSearchActive, hasPinSelection, hasLocationSelection, hasMentionTypeFilter, isModalOpen, panelHeight, TINY_HEIGHT, TALL_HEIGHT]);

  // Determine if close icon should be shown
  const shouldShowCloseIcon = useMemo(() => {
    // Show close icon if:
    // - Search is active
    // - Any selection exists (pin, location, mention type)
    // - Footer is in tall or main state
    return isSearchActive || hasPinSelection || hasLocationSelection || hasMentionTypeFilter || currentState !== 'low';
  }, [isSearchActive, hasPinSelection, hasLocationSelection, hasMentionTypeFilter, currentState]);

  // Determine if mention types should be shown
  const shouldShowMentionTypes = useMemo(() => {
    // Hide mention types when:
    // - Search is active (tall state with search)
    // - Footer is in tall state (pin selected or search)
    // - Footer is in tiny state
    // - Pin is selected (hasPinSelection)
    return !isSearchActive && currentState !== 'tall' && currentState !== 'tiny' && !hasPinSelection;
  }, [isSearchActive, currentState, hasPinSelection]);

  // Determine if footer should be open
  const shouldBeOpen = useMemo(() => {
    return currentState !== 'low' && currentState !== 'tiny' && currentState !== 'hidden';
  }, [currentState]);

  // Determine target height for current state
  const targetHeight = useMemo(() => {
    switch (currentState) {
      case 'hidden':
        return HIDDEN_HEIGHT;
      case 'tiny':
        return TINY_HEIGHT;
      case 'tall':
        return TALL_HEIGHT;
      case 'main':
        return MAIN_HEIGHT;
      case 'low':
      default:
        return LOW_HEIGHT;
    }
  }, [currentState, HIDDEN_HEIGHT, TINY_HEIGHT, LOW_HEIGHT, MAIN_HEIGHT, TALL_HEIGHT]);

  return {
    currentState,
    shouldShowCloseIcon,
    shouldShowMentionTypes,
    shouldBeOpen,
    targetHeight,
  };
}
