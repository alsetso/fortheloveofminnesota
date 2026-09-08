'use client';

import type { MouseEvent, ReactNode } from 'react';
import Link from 'next/link';
import { directoryTerritoryPath } from '@/lib/routes/routePolicy';

/** City · ZIP — city links to CTU place, zip to zipcode place when ids exist. */
export function PostPlaceLine({
  cityName,
  zipCode,
  unitId,
  zipcodeId,
  trailing,
  className = '',
  linkClassName = 'transition active:opacity-70 hover:text-foreground',
  onLinkClick,
}: {
  cityName: string | null;
  zipCode: string | null;
  unitId: string | null;
  zipcodeId: string | null;
  trailing?: ReactNode;
  className?: string;
  linkClassName?: string;
  onLinkClick?: (e: MouseEvent) => void;
}) {
  if (!cityName && !zipCode && !trailing) return null;

  const cityEl =
    cityName && unitId ? (
      <Link
        href={directoryTerritoryPath(unitId)}
        onClick={onLinkClick}
        className={linkClassName}
      >
        {cityName}
      </Link>
    ) : cityName ? (
      <span>{cityName}</span>
    ) : null;

  const zipEl =
    zipCode && zipcodeId ? (
      <Link
        href={directoryTerritoryPath(zipcodeId)}
        onClick={onLinkClick}
        className={linkClassName}
      >
        {zipCode}
      </Link>
    ) : zipCode ? (
      <span>{zipCode}</span>
    ) : null;

  return (
    <p
      className={`mt-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px] text-foreground-muted ${className}`.trim()}
    >
      {(cityEl || zipEl) && (
        <span className="min-w-0 truncate">
          {cityEl}
          {cityEl && zipEl ? ' · ' : null}
          {zipEl}
        </span>
      )}
      {trailing}
    </p>
  );
}
