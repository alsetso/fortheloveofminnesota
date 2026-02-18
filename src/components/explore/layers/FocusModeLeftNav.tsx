'use client';

import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { getEntityConfig } from '@/features/explore/config/entityRegistry';
import ExploreBreadcrumb from '@/components/explore/ExploreBreadcrumb';

interface FocusModeLeftNavProps {
  table: string;
  recordName?: string;
}

/**
 * Minimal left nav when a specific record is selected.
 * Replaces the full list; provides back navigation and context.
 */
export default function FocusModeLeftNav({ table, recordName }: FocusModeLeftNavProps) {
  const config = getEntityConfig(table);
  const tableLabel = config?.label ?? table;

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      <div className="p-[10px] border-b border-border flex-shrink-0">
        <Link
          href={`/explore/${table}`}
          className="flex items-center gap-2 text-xs text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>Back to {tableLabel}</span>
        </Link>
      </div>
      <div className="p-[10px] flex-1">
        <ExploreBreadcrumb entitySlug={table} recordName={recordName} variant="stacked" />
      </div>
    </div>
  );
}
