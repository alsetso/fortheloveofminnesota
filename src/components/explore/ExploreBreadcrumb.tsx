'use client';

import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import {
  getEntityConfig,
  getEntityConfigById,
  entityUrl,
  type EntityTypeConfig,
} from '@/features/explore/config/entityRegistry';

interface ExploreBreadcrumbProps {
  /** Current entity slug (e.g. "counties", "school-buildings") */
  entitySlug: string;
  /** If provided, renders the record name as the final non-link segment */
  recordName?: string;
  /** Layout variant */
  variant?: 'inline' | 'stacked';
}

/**
 * Shared breadcrumb for all explore pages.
 * Walks the parentType chain from entityRegistry to build:
 *   Explore > {ancestors…} > {current entity} > {record name}
 */
export default function ExploreBreadcrumb({
  entitySlug,
  recordName,
  variant = 'inline',
}: ExploreBreadcrumbProps) {
  const config = getEntityConfig(entitySlug);
  if (!config) return null;

  // Walk parentType chain upward
  const chain: EntityTypeConfig[] = [];
  let cur = config.parentType ? getEntityConfigById(config.parentType) : null;
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentType ? getEntityConfigById(cur.parentType) : null;
  }

  if (variant === 'stacked') {
    return (
      <nav className="space-y-0.5">
        <Link
          href="/explore"
          className="block px-2 py-1.5 text-xs rounded-md text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
        >
          Explore
        </Link>
        {chain.map((bc) => (
          <Link
            key={bc.id}
            href={entityUrl(bc)}
            className="block px-2 py-1.5 text-xs rounded-md text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
          >
            {bc.label}
          </Link>
        ))}
        <Link
          href={entityUrl(config)}
          className="block px-2 py-1.5 text-xs rounded-md text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors"
        >
          {config.label}
        </Link>
        {recordName && (
          <div className="px-2 py-1.5 text-xs font-medium text-foreground truncate">
            {recordName}
          </div>
        )}
      </nav>
    );
  }

  // Default: inline
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-foreground-muted">
      <Link href="/explore" className="hover:text-foreground transition-colors">
        Explore
      </Link>
      {chain.map((bc) => (
        <span key={bc.id} className="flex items-center gap-1.5">
          <ChevronRightIcon className="w-2.5 h-2.5" />
          <Link href={entityUrl(bc)} className="hover:text-foreground transition-colors">
            {bc.label}
          </Link>
        </span>
      ))}
      <ChevronRightIcon className="w-2.5 h-2.5" />
      {recordName ? (
        <>
          <Link
            href={entityUrl(config)}
            className="hover:text-foreground transition-colors"
          >
            {config.label}
          </Link>
          <ChevronRightIcon className="w-2.5 h-2.5" />
          <span className="text-foreground font-medium truncate">{recordName}</span>
        </>
      ) : (
        <span className="text-foreground font-medium">{config.label}</span>
      )}
    </div>
  );
}
