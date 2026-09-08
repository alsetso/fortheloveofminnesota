'use client';

import { useEffect, useState } from 'react';
import type { AccountRow } from './AuthProvider';
import { getAccountInitials } from './accountDisplay';
import { IconUser } from '@/features/map/dockCore/core/icons';

type AccountAvatarProps = {
  account: AccountRow | null | undefined;
  email?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  loading?: boolean;
};

const SIZE = {
  sm: { box: 'h-11 w-11', icon: 'h-5 w-5', text: 'text-sm' },
  md: { box: 'h-14 w-14', icon: 'h-7 w-7', text: 'text-base' },
  lg: { box: 'h-16 w-16', icon: 'h-8 w-8', text: 'text-lg' },
} as const;

/** Circular account photo — image_url or initials / user icon fallback. */
export default function AccountAvatar({
  account,
  email,
  size = 'sm',
  className = '',
  loading = false,
}: AccountAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const dims = SIZE[size];
  const src = account?.image_url?.trim() || null;

  useEffect(() => {
    setImgFailed(false);
  }, [src]);

  if (loading) {
    return (
      <span
        className={`inline-block h-full w-full shrink-0 animate-pulse rounded-full bg-black/[0.08] ${className || dims.box}`}
        aria-hidden
      />
    );
  }

  if (src && !imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={`block h-full w-full shrink-0 rounded-full object-cover ${className || dims.box}`}
        onError={() => setImgFailed(true)}
        decoding="async"
        referrerPolicy="no-referrer"
      />
    );
  }

  const initials = getAccountInitials(account, email);
  if (account && (account.first_name || account.last_name || account.username || email)) {
    return (
      <span
        className={`inline-flex h-full w-full shrink-0 items-center justify-center rounded-full bg-lake-blue/15 font-semibold text-lake-blue ${dims.text} ${className || dims.box}`}
        aria-hidden
      >
        {initials}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex h-full w-full shrink-0 items-center justify-center text-lake-blue ${className || dims.box}`}
      aria-hidden
    >
      <IconUser className={dims.icon} />
    </span>
  );
}
