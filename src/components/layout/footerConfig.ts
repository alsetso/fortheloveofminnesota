/**
 * Footer panel configuration constants
 */

export const HEADER_HEIGHT = 120; // Drag handle + AppHeader + MentionTypeCards

export const getViewportHeight = (): number => {
  return typeof window !== 'undefined' ? window.innerHeight : 800;
};

export const getFooterHeights = () => {
  const viewportHeight = getViewportHeight();
  return {
    HIDDEN_HEIGHT: 0, // Completely hidden (slides down out of view)
    LOW_HEIGHT: 140, // Just header (handle + account/search/mention types)
    MAIN_HEIGHT: viewportHeight * 0.4, // 40vh - main action container + pins
    TALL_HEIGHT: viewportHeight * 0.9, // 90vh - tall state (search overlay or live pin card)
  };
};

export type FooterState = 'hidden' | 'low' | 'main' | 'tall';
