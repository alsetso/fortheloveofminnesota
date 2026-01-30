'use client';

import { ReactNode } from 'react';

/**
 * Full-viewport app wrapper that provides the map background container (100vw × 100vh).
 * Used on /live to render map content without the PageWrapper header/nav layout.
 */
interface AppContainerProps {
  children: ReactNode;
}

export default function AppContainer({ children }: AppContainerProps) {
  return (
    <div
      className="fixed inset-0 w-[100vw] h-[100vh] relative"
      style={{ width: '100vw', height: '100vh' }}
      data-container="map-background"
      aria-label="Map background"
    >
      {children}
    </div>
  );
}
