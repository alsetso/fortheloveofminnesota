'use client';

/**
 * Persistent Game map for AppShell map surfaces (`/game` + `/discover/*`).
 * Stays mounted when switching Discover ↔ Map so Mapbox does not cold-boot.
 */

import { Suspense } from 'react';
import { MapAppShell } from '@/components/shell/MapAppShell';
import { OutsideMNGate } from '@/features/outside/OutsideMNGate';

function GameMapSurface() {
  return (
    <>
      <MapAppShell />
      <OutsideMNGate />
    </>
  );
}

export function PersistentGameMap() {
  return (
    <Suspense fallback={null}>
      <GameMapSurface />
    </Suspense>
  );
}
