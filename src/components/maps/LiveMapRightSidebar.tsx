'use client';

/**
 * Right Sidebar for Live Map page
 * Simplified - recent activity and trending removed
 */
export default function LiveMapRightSidebar() {
  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide bg-surface border-l border-border-muted dark:border-white/10">
      <div className="p-[10px] border-b border-border-muted dark:border-white/10">
        <h2 className="text-sm font-semibold text-foreground">Activity</h2>
      </div>
    </div>
  );
}
