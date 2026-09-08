'use client';

/**
 * `/game` — full Mapbox play surface inside AppShell chrome (TopBar + TabBar).
 * Header chrome (map mode + condensed HUD) mounts from GameDock so it shares
 * the map MapDock / FindMe providers.
 */

import { MapAppShell } from '@/components/shell/MapAppShell';
import { OutsideMNGate } from '@/features/outside/OutsideMNGate';

export default function GamePage() {
  return (
    <>
      <MapAppShell />
      <OutsideMNGate />
    </>
  );
}
