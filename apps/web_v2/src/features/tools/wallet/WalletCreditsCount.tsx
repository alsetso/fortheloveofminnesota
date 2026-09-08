'use client';

import { useAuthSafe } from '@/features/auth';
import { IconWallet } from '@/features/map/dockCore/core/icons';
import { formatWalletBalance, useWalletSummary } from '@/features/tools/wallet/useWalletSummary';

/**
 * Compact credits chip — icon + balance for the dock title pill (far right).
 * Tapping opens Credits when `onOpenCredits` is provided.
 */
export default function WalletCreditsCount({
  onOpenCredits,
  className = '',
}: {
  onOpenCredits?: () => void;
  className?: string;
}) {
  const { account } = useAuthSafe();
  const { summary, loading } = useWalletSummary();

  if (!account) return null;

  const label = loading
    ? 'Loading credits'
    : `Credits: ${formatWalletBalance(summary)}`;

  const body = (
    <>
      <IconWallet className="h-3.5 w-3.5 text-lake-blue" />
      {loading || !summary ? (
        <span className="h-3 w-5 animate-pulse rounded bg-black/[0.08]" aria-hidden />
      ) : (
        <span className="tabular-nums text-[13px] font-semibold text-foreground">
          {formatWalletBalance(summary)}
        </span>
      )}
    </>
  );

  const chipClass = `inline-flex shrink-0 items-center gap-1 rounded-full bg-lake-blue/10 px-2 py-1 ${className}`.trim();

  if (onOpenCredits) {
    return (
      <button type="button" onClick={onOpenCredits} aria-label={label} className={chipClass}>
        {body}
      </button>
    );
  }

  return (
    <span aria-label={label} className={chipClass}>
      {body}
    </span>
  );
}
