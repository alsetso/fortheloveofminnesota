'use client';

import Link from 'next/link';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';

/** Plan slugs that can access Real Estate (contributor or higher). */
export const REALESTATE_REQUIRED_PLANS = ['contributor', 'gov'] as const;

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing'];

export function useRealEstateAccess(): { hasAccess: boolean; isLoading: boolean } {
  const { account, isAccountLoading } = useAuthStateSafe();

  const hasAccess =
    !!account &&
    REALESTATE_REQUIRED_PLANS.includes(account.plan as (typeof REALESTATE_REQUIRED_PLANS)[number]) &&
    ACTIVE_SUBSCRIPTION_STATUSES.includes(account.subscription_status || '');

  return { hasAccess, isLoading: isAccountLoading };
}

export default function RealEstateMapGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuthStateSafe();
  const { hasAccess, isLoading: accountLoading } = useRealEstateAccess();
  const { openWelcome } = useAppModalContextSafe();

  const isLoading = authLoading || accountLoading;
  const isLoggedIn = !!user;
  const showLoginOverlay = isLoggedIn === false && !authLoading;
  const showPlanOverlay = isLoggedIn && !hasAccess;

  const loginOverlay = showLoginOverlay && (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-md bg-black/40 dark:bg-black/50 p-4 text-center">
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface p-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-900 dark:text-foreground">
          Must be logged in to view
        </p>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <button
            type="button"
            className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-surface-muted transition-colors"
            onClick={openWelcome}
          >
            Sign in
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-surface-muted transition-colors"
            onClick={openWelcome}
          >
            Sign up
          </button>
        </div>
      </div>
    </div>
  );

  const planOverlay = showPlanOverlay && (
    <div
      role="button"
      tabIndex={0}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-md bg-black/40 dark:bg-black/50 p-4 text-center focus:outline-none focus:ring-2 focus:ring-gray-300 cursor-pointer"
      onClick={() => window.location.assign('/pricing')}
      onKeyDown={(e) => e.key === 'Enter' && window.location.assign('/pricing')}
    >
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface p-4 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-gray-900 dark:text-foreground">
          Real Estate requires a Contributor or higher plan
        </p>
        <p className="text-xs text-gray-600 dark:text-foreground-muted max-w-[240px]">
          Upgrade to access the map and property tools.
        </p>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-surface-muted transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            View plans
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-surface-muted transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Talk to sales
          </Link>
        </div>
      </div>
    </div>
  );

  const overlay = loginOverlay || planOverlay;

  const loadingOverlay = isLoading && (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-gray-100/80 dark:bg-surface-muted/80">
      <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <>
      {children}
      {loadingOverlay}
      {overlay}
    </>
  );
}
