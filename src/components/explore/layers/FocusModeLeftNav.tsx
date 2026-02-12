'use client';

import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { getLayerConfigBySlug } from '@/features/map/config/layersConfig';

interface FocusModeLeftNavProps {
  table: string;
  recordName?: string;
}

/**
 * Minimal left nav when a specific record is selected.
 * Replaces the full list; provides back navigation and context.
 */
export default function FocusModeLeftNav({ table, recordName }: FocusModeLeftNavProps) {
  const config = getLayerConfigBySlug(table);
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
        <nav className="space-y-1">
          <div className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wide px-2">
            Breadcrumb
          </div>
          <Link
            href="/explore"
            className="block px-2 py-1.5 text-xs rounded-md text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
          >
            Explore
          </Link>
          <Link
            href={`/explore/${table}`}
            className="block px-2 py-1.5 text-xs rounded-md text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
          >
            {tableLabel}
          </Link>
          {recordName && (
            <div className="px-2 py-1.5 text-xs font-medium text-foreground truncate">
              {recordName}
            </div>
          )}
        </nav>
      </div>
    </div>
  );
}
