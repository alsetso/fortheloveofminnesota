'use client';

/**
 * Compact profile count cell — Posts / Followers / Following + About game stats.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { IconEye } from '@/features/map/dockCore/core/icons';

export function ProfileStatCell({
  count,
  label,
  privateOnlyMe,
  sublabel,
  disabled,
  onClick,
  href,
}: {
  count: number | string;
  label: string;
  privateOnlyMe?: boolean;
  sublabel?: string | null;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const className = `flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-1 py-1 transition ${
    (onClick || href) && !disabled ? 'active:opacity-70' : ''
  } ${disabled ? 'opacity-50' : ''} ${privateOnlyMe ? 'opacity-70' : ''}`;

  const body = (
    <>
      <span
        className={`text-[1.05rem] font-semibold tabular-nums leading-none ${
          privateOnlyMe ? 'text-foreground-muted' : 'text-foreground'
        }`}
      >
        {count}
      </span>
      {privateOnlyMe ? (
        <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-medium leading-none text-foreground-muted">
          <IconEye className="h-3 w-3" />
          Only me
        </span>
      ) : (
        <span className="mt-1 text-[10px] font-medium leading-none text-foreground-muted">
          {label}
        </span>
      )}
      {sublabel ? (
        <span className="mt-0.5 inline-flex items-center gap-0.5 text-[9px] font-medium leading-none text-foreground-muted">
          <IconEye className="h-2.5 w-2.5" />
          {sublabel}
        </span>
      ) : null}
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" disabled={disabled} onClick={onClick} className={className}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}

export function ProfileStatRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 w-full flex-1 items-center gap-1">{children}</div>
  );
}
