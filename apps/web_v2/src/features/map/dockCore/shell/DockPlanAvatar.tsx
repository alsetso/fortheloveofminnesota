'use client';

/**
 * Plan-ringed account avatar for dock chrome — gold (paid) / grey (hobby)
 * with XP level square inset inside the circle at bottom-right.
 */

import { AccountAvatar, type AccountRow } from '@/features/auth';
import {
  getDockAvatarInnerClass,
  getDockAvatarLevelBadgeClass,
  getDockAvatarRingClass,
  type DockAvatarRingSize,
} from '@/lib/billing/planHelpers';

type Props = {
  account: AccountRow | null | undefined;
  email?: string | null;
  plan?: string | null;
  level?: number | null;
  size?: DockAvatarRingSize;
  loading?: boolean;
  /** When set, the level badge is a button (Account card). Otherwise decorative. */
  onLevelClick?: () => void;
  className?: string;
};

export default function DockPlanAvatar({
  account,
  email,
  plan,
  level,
  size = 'lg',
  loading = false,
  onLevelClick,
  className,
}: Props) {
  const resolvedPlan = plan ?? account?.plan;
  const showLevel = level != null && level > 0;
  const badgeClass = getDockAvatarLevelBadgeClass(resolvedPlan, size);

  return (
    <div className={getDockAvatarRingClass(resolvedPlan, size) + (className ? ` ${className}` : '')}>
      <div className={getDockAvatarInnerClass(resolvedPlan)}>
        <AccountAvatar
          account={account}
          email={email}
          size={size === 'lg' ? 'lg' : 'sm'}
          loading={loading}
          className="h-full w-full"
        />
      </div>
      {showLevel ? (
        onLevelClick ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLevelClick();
            }}
            className={`${badgeClass} transition active:scale-95`}
            aria-label={`Level ${level}`}
          >
            {level}
          </button>
        ) : (
          <span className={badgeClass} aria-hidden>
            {level}
          </span>
        )
      ) : null}
    </div>
  );
}
