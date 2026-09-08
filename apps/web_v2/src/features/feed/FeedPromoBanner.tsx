'use client';

import Link from 'next/link';
import { GAME_PATH } from '@/lib/routes/routePolicy';

/**
 * Promo strip under feed tabs — clean bordered banner.
 */
export function FeedPromoBanner({
  onDismiss,
}: {
  onDismiss?: () => void;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3 overflow-hidden rounded-xl border border-black/[0.08] bg-white px-3 py-2.5">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black/[0.08] bg-[#f7f5f1] text-[15px] font-bold text-foreground"
          aria-hidden
        >
          MN
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold leading-snug text-foreground">
            The map is live
          </p>
          <p className="truncate text-[12px] text-foreground-muted">
            Drop a pin · walk Minnesota
          </p>
        </div>
        <Link
          href={GAME_PATH}
          className="shrink-0 rounded-lg border border-black/[0.08] bg-[#f7f5f1] px-3 py-1.5 text-[12px] font-semibold text-foreground transition active:opacity-80"
        >
          Open
        </Link>
        {onDismiss ? (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-black/[0.08] text-foreground-muted transition active:bg-black/[0.04]"
          >
            <span aria-hidden className="text-[16px] leading-none">
              ×
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
