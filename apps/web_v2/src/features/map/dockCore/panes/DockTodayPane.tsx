'use client';

/**
 * Dock body pane for the Today / Standing hub.
 * Renders InsightsTodayDockCard in embedded mode — content sits directly inside
 * the dock body below the pill (search + avatar header). No card shell overlay.
 */

import InsightsTodayDockCard from '@/features/map/game/InsightsTodayDockCard';

export default function DockTodayPane() {
  return (
    <div className="px-4 pb-6 pt-2">
      <InsightsTodayDockCard embedded />
    </div>
  );
}
