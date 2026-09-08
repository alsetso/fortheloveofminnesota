'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconTabDiscover } from '@/features/appShell/tabIcons';
import { DISCOVER_PATH, GAME_PATH, isDiscoverPath } from '@/lib/routes/routePolicy';

/**
 * Inline TopBar search icon — sits beside the account avatar.
 * Toggles Discover lightbox; paints active when search is open.
 */
export function DiscoverTopBarSearchButton() {
  const pathname = usePathname();
  const open = isDiscoverPath(pathname);
  const href = open ? GAME_PATH : DISCOVER_PATH;

  return (
    <Link
      href={href}
      aria-label={open ? 'Close search' : 'Search'}
      aria-pressed={open}
      className={`relative z-[1] inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-[color,transform,opacity] active:scale-95 ${
        open ? 'text-lake-blue' : 'text-foreground-muted hover:text-foreground'
      }`}
    >
      <IconTabDiscover className="h-[22px] w-[22px]" selected={open} />
    </Link>
  );
}
