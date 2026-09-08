'use client';

import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import MapDockBoundaryTabs from '@/features/map/dockCore/shell/MapDockBoundaryTabs';

/** Idle browse — territory tabs only. Tools open from the pill / HUD, not here. */
export default function DockBrowsePane() {
  const { openDetails } = useMapDock();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MapDockBoundaryTabs onSelectEntity={(entity) => openDetails(entity)} />
    </div>
  );
}
