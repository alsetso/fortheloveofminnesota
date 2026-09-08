'use client';

/**
 * Shared Explore page section chrome — large title + optional supporting line.
 * Use for passport, collectibles, and future breakdown blocks.
 */

import type { ReactNode } from 'react';

export function ExploreSection({
  title,
  supporting,
  children,
  className,
}: {
  title: string;
  supporting?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="px-5">
        <h2 className="text-[22px] font-bold tracking-tight text-foreground">{title}</h2>
        {supporting ? (
          <p className="mt-2.5 text-[12px] leading-snug text-foreground-muted">{supporting}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function ExploreStat({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | null;
  loading?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      {loading || value == null ? (
        <div className="h-6 w-10 animate-pulse rounded bg-black/[0.06]" />
      ) : (
        <p className="text-[22px] font-bold tabular-nums tracking-tight text-foreground">
          {value.toLocaleString()}
        </p>
      )}
      <p className="mt-0.5 text-[11px] font-medium leading-snug text-foreground-muted">{label}</p>
    </div>
  );
}
