'use client';

import { useState } from 'react';
import {
  MapIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const MAP_STYLES = [
  { value: 'street', label: 'Street' },
  { value: 'satellite', label: 'Satellite' },
  { value: 'light', label: 'Light' },
] as const;

const ACTIVITY_TYPES = [
  { value: '', label: 'All' },
  { value: 'job', label: 'Job' },
  { value: 'training', label: 'Training' },
  { value: 'apprenticeship', label: 'Apprenticeship' },
  { value: 'internship', label: 'Internship' },
];

const SKELETON_CARD_COUNT = 4;

function OpportunityCardSkeleton() {
  return (
    <article className="rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface overflow-hidden">
      <div className="p-[10px] space-y-1">
        <div className="flex items-start justify-between gap-1">
          <div className="h-3.5 w-3/4 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
          <div className="h-4 w-4 rounded bg-gray-200 dark:bg-white/10 animate-pulse shrink-0" />
        </div>
        <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
        <div className="h-3 w-2/5 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
        <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
          <div className="h-4 w-12 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
          <div className="h-3 w-14 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
        </div>
        <div className="h-3 w-16 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
        <div className="mt-1 h-3.5 w-3.5 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
      </div>
    </article>
  );
}

export default function WorkRightSidebar() {
  const [mapStyle, setMapStyle] = useState<string>('street');
  const [activityType, setActivityType] = useState<string>('');
  const [locationQuery, setLocationQuery] = useState('');
  const [employmentType, setEmploymentType] = useState<string>('');
  const [page, setPage] = useState(1);
  const totalPages = 3;

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      {/* Map settings */}
      <section className="flex-shrink-0 p-3 border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <MapIcon className="w-3.5 h-3.5 text-gray-500" />
          <h3 className="text-xs font-semibold text-gray-900 dark:text-foreground">Map</h3>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-medium text-gray-500 dark:text-foreground-muted uppercase tracking-wider block">
            Style
          </label>
          <select
            value={mapStyle}
            onChange={(e) => setMapStyle(e.target.value)}
            className="w-full px-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface text-gray-700 dark:text-foreground focus:outline-none focus:ring-1 focus:ring-gray-300"
          >
            {MAP_STYLES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Filters */}
      <section className="flex-shrink-0 p-3 border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <FunnelIcon className="w-3.5 h-3.5 text-gray-500" />
          <h3 className="text-xs font-semibold text-gray-900 dark:text-foreground">Filters</h3>
        </div>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-0.5">Activity</label>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              className="w-full px-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface text-gray-700 dark:text-foreground"
            >
              {ACTIVITY_TYPES.map((a) => (
                <option key={a.value || 'all'} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-0.5">Location</label>
            <input
              type="text"
              placeholder="City or zip"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              className="w-full px-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-0.5">Employment</label>
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              className="w-full px-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface text-gray-700 dark:text-foreground"
            >
              <option value="">All</option>
              <option value="full">Full-time</option>
              <option value="part">Part-time</option>
              <option value="contract">Contract</option>
            </select>
          </div>
        </div>
      </section>

      {/* Opportunities list */}
      <section className="flex-1 min-h-0 flex flex-col p-3">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-foreground mb-2">Opportunities</h3>
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide space-y-2">
          {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
            <OpportunityCardSkeleton key={i} />
          ))}
        </div>

        <div className="flex-shrink-0 flex items-center justify-between gap-2 pt-3 mt-2 border-t border-gray-200 dark:border-white/10">
          <span className="text-[10px] text-gray-500 dark:text-foreground-muted">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="p-1.5 rounded-md border border-gray-200 dark:border-white/10 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-surface-muted transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="p-1.5 rounded-md border border-gray-200 dark:border-white/10 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-surface-muted transition-colors"
              aria-label="Next page"
            >
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
