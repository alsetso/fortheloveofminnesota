'use client';

import { createContext, useContext, type ReactNode } from 'react';

const DiscoverLightboxContext = createContext(false);

/** True when Discover is rendering inside the map lightbox (under shell TopBar). */
export function useDiscoverLightbox(): boolean {
  return useContext(DiscoverLightboxContext);
}

export function DiscoverLightboxProvider({ children }: { children: ReactNode }) {
  return (
    <DiscoverLightboxContext.Provider value={true}>
      {children}
    </DiscoverLightboxContext.Provider>
  );
}
