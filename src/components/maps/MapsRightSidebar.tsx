'use client';

/**
 * Right Sidebar for Maps page
 * Currently empty - can be populated with real data later
 */
export default function MapsRightSidebar() {
  return (
    <div className="h-full flex flex-col p-3 overflow-y-auto scrollbar-hide">
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-foreground-muted text-center">
          {/* Empty for now - can add real stats/activity later */}
        </p>
      </div>
    </div>
  );
}
