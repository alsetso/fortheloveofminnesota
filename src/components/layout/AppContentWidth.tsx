'use client';

import { ReactNode } from 'react';
import { useHeaderTheme } from '@/contexts/HeaderThemeContext';
import AppHeader from './AppHeader';
import AppFooter from './AppFooter';
import LiveSearch from './LiveSearch';
import HeaderMentionTypeCards from './HeaderMentionTypeCards';

interface AppContentWidthProps {
  /** Dynamic content for the app footer popup (above the footer header) */
  footerContent?: ReactNode;
  /** Label for the footer header bar (always at bottom) */
  footerHeaderLabel?: string;
  /** Controlled footer open state (optional) */
  footerOpen?: boolean;
  /** Called when footer open state changes (optional) */
  onFooterOpenChange?: (open: boolean) => void;
  /** Transparent section above the white footer (e.g. map loading states) */
  footerStatusContent?: ReactNode;
  /** When set, account image in header opens this (e.g. AppMenu) instead of account dropdown */
  onAccountImageClick?: () => void;
}

/**
 * Overlay container (max-width 500px, 100dvh) over the map.
 * Holds: appHeader (account + search), map interaction area (pass-through), app footer (header at bottom + dynamic popup).
 * When #search, LiveSearch overlay covers everything below the header.
 */
export default function AppContentWidth({
  footerContent,
  footerHeaderLabel = 'Footer',
  footerOpen,
  onFooterOpenChange,
  footerStatusContent,
  onAccountImageClick,
}: AppContentWidthProps) {
  const { isSearchActive } = useHeaderTheme();

  return (
    <div
      className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-full max-w-[500px] flex flex-col pointer-events-none z-10"
      style={{ maxWidth: '500px', height: '100dvh' }}
      data-container="app-content-width"
      aria-label="App content width"
    >
      <div className="pointer-events-auto flex-shrink-0 flex flex-col">
        <AppHeader onAccountImageClick={onAccountImageClick} />
        {!isSearchActive && <HeaderMentionTypeCards />}
      </div>
      <div className="flex-1 min-h-0 relative flex flex-col">
        <div
          className="flex-1 min-h-0 pointer-events-none"
          data-container="map-interaction-area"
          aria-hidden
        />
        <div className="pointer-events-auto flex-shrink-0 flex flex-col">
          {footerStatusContent != null && (
            <div
              className="flex-shrink-0 min-h-0 mx-[10px] bg-gray-100 rounded-t-md"
              data-container="app-footer-status"
              aria-live="polite"
            >
              {footerStatusContent}
            </div>
          )}
          <AppFooter
            headerLabel={footerHeaderLabel}
            isOpen={footerOpen}
            onOpenChange={onFooterOpenChange}
          >
            {footerContent}
          </AppFooter>
        </div>
        {isSearchActive && <LiveSearch />}
      </div>
    </div>
  );
}
