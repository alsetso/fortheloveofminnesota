import { ChartBarIcon, ClockIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';

function SkeletonText({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded bg-surface-accent dark:bg-white/10 animate-pulse ${className}`}
      aria-hidden
    />
  );
}

function ListSpinner() {
  return (
    <div className="flex items-center justify-center py-12" aria-label="Loading">
      <svg
        className="w-8 h-8 text-foreground-muted animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}

export default function AnalyticsLoading() {
  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      rightSidebar={<RightSidebar />}
    >
      <div className="w-full py-6">
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          {/* Header — skeleton for title + time selector */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ChartBarIcon className="w-4 h-4 text-foreground-muted" />
              <h1 className="text-sm font-semibold text-foreground">Analytics</h1>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border-muted dark:border-white/10">
              <ClockIcon className="w-3 h-3 text-foreground-muted" />
              <SkeletonText className="h-3.5 w-16" />
            </div>
          </div>

          {/* Stat cards — skeleton text */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="border rounded-md p-[10px] border-border-muted dark:border-white/10 bg-surface"
              >
                <SkeletonText className="h-3 w-16 mb-1.5" />
                <SkeletonText className="h-4 w-10 mt-0.5" />
                <SkeletonText className="h-3 w-full mt-1.5" />
              </div>
            ))}
          </div>

          {/* Section 1 — Profile Views: header + list spinner */}
          <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md overflow-hidden">
            <div className="p-[10px] border-b border-border-muted dark:border-white/10">
              <h2 className="text-sm font-semibold text-foreground">Profile Views</h2>
              <SkeletonText className="h-3 w-48 mt-1.5" />
            </div>
            <ListSpinner />
          </div>

          {/* Section 2 — Pin Views: header + list spinner */}
          <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md overflow-hidden">
            <div className="p-[10px] border-b border-border-muted dark:border-white/10">
              <h2 className="text-sm font-semibold text-foreground">Pin Views</h2>
              <SkeletonText className="h-3 w-40 mt-1.5" />
            </div>
            <ListSpinner />
          </div>

          {/* Section 3 — Your Visit History: accordion collapsed, skeleton subtitle */}
          <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md overflow-hidden">
            <div className="flex items-center gap-2 p-[10px]">
              <ChevronDownIcon className="w-4 h-4 text-foreground-muted flex-shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">Your Visit History</h2>
                <SkeletonText className="h-3 w-56 mt-1.5" />
              </div>
            </div>
          </div>

          {/* Map Views section — header + list spinner */}
          <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md overflow-hidden">
            <div className="p-[10px] border-b border-border-muted dark:border-white/10">
              <h2 className="text-sm font-semibold text-foreground">Map views</h2>
              <SkeletonText className="h-3 w-44 mt-1.5" />
            </div>
            <ListSpinner />
          </div>
        </div>
      </div>
    </NewPageWrapper>
  );
}
