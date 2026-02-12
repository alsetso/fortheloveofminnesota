'use client';

import { ReactNode } from 'react';

/**
 * Full-viewport app wrapper (100% × 100dvh). Legacy component, no longer used.
 * 100dvh = dynamic viewport height (mobile address bar show/hide); 100% width avoids scrollbar overflow.
 */
interface AppContainerProps {
  children: ReactNode;
}

export default function AppContainer({ children }: AppContainerProps) {
  return (
    <div
      className="fixed inset-0 w-full relative"
      style={{ width: '100%', height: '100dvh' }}
      data-container="map-background"
      aria-label="Map background"
    >
      {children}
    </div>
  );
}
