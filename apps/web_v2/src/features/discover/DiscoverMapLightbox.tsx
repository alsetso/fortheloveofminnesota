'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AppShellChromeProvider } from '@/features/appShell/shellChromeContext';
import { APP_CONTENT_MAX_WIDTH_PX } from '@/features/appShell/tabs';
import { DiscoverLightboxProvider } from '@/features/discover/discoverLightboxContext';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';

/**
 * Discover lightbox — fills the map canvas under the shell TopBar.
 * Map stays mounted underneath; dismiss via TopBar search toggle or Map tab.
 */
export function DiscoverMapLightbox({ children }: { children: ReactNode }) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={`pointer-events-auto absolute inset-0 flex flex-col overflow-hidden bg-[#f7f5f1] ${Z_LAYER_CLASS.SETUP} transition-opacity duration-200 ${
        entered ? 'opacity-100' : 'opacity-0'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Discover"
      data-discover-map-lightbox=""
    >
      <DiscoverLightboxProvider>
        {/*
          Nested shell chrome for child Discover pages (places, atlas, …).
          Home Discover skips its TopBar and uses the shell header instead.
        */}
        <AppShellChromeProvider>
          {(headerSlotRef) => (
            <>
              <div
                ref={headerSlotRef}
                className="relative z-20 w-full shrink-0 self-stretch"
                data-discover-lightbox-header=""
              />
              <div className="flex min-h-0 flex-1 justify-center overflow-hidden">
                <div
                  className="flex h-full w-full min-h-0 flex-col overflow-hidden"
                  style={{ maxWidth: APP_CONTENT_MAX_WIDTH_PX }}
                  data-discover-lightbox-content=""
                >
                  {children}
                </div>
              </div>
            </>
          )}
        </AppShellChromeProvider>
      </DiscoverLightboxProvider>
    </div>
  );
}
