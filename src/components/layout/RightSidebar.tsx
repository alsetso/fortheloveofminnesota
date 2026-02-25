'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useAuthStateSafe } from '@/features/auth';
import { AccountService } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import ProfilePhoto from '@/components/shared/ProfilePhoto';

interface RightSidebarProps {
  children?: ReactNode;
}

const PLAN_LABELS: Record<string, string> = {
  hobby: 'Public',
  contributor: 'Contributor',
};

/**
 * Default right sidebar content: account card + Get in Touch (matches /settings right sidebar style).
 */
function DefaultRightSidebarContent() {
  const { account } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();

  const displayName = AccountService.getDisplayName(account ?? null) || 'Profile';
  const subtitle = account?.username ? `@${account.username}` : account?.email || '';
  const planLabel = (account?.plan && PLAN_LABELS[account.plan]) || 'Public';
  const hasPaidPlanBorder = account?.plan === 'contributor';
  const canUpgrade = !account?.plan || account?.plan === 'hobby' || account?.plan === 'contributor';

  return (
    <div className="h-full flex flex-col p-3 overflow-y-auto">
      <div className="space-y-4">
        {/* Account Info */}
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-4 text-center">
          <div
            className={`w-16 h-16 rounded-full mx-auto mb-3 overflow-hidden flex-shrink-0 ${
              hasPaidPlanBorder ? 'p-[2px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600' : 'bg-surface-accent dark:bg-white/10'
            }`}
          >
            <div className="w-full h-full rounded-full overflow-hidden bg-surface dark:bg-header relative flex items-center justify-center">
              {account ? (
                <ProfilePhoto account={account} size="lg" editable={false} />
              ) : (
                <span className="text-2xl font-medium text-foreground-muted">
                  W
                </span>
              )}
            </div>
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1 truncate w-full">
            {account ? displayName : 'Welcome'}
          </h3>
          <p className="text-xs text-foreground-muted mb-2 truncate w-full">
            {account ? subtitle : 'Sign in to personalize your experience'}
          </p>
          {account ? (
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-xs text-foreground-muted">{planLabel}</span>
              {canUpgrade && (
                <Link
                  href="/pricing"
                  className="text-xs text-lake-blue hover:text-lake-blue/80 underline"
                >
                  Upgrade
                </Link>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={openWelcome}
              className="text-xs font-medium text-lake-blue hover:text-lake-blue/80 underline"
            >
              Sign in
            </button>
          )}
          {account?.email && (
            <p className="text-xs text-foreground-muted truncate w-full">{account.email}</p>
          )}
          {account && (
            <Link
              href="/settings"
              className="inline-block mt-2 text-xs text-foreground-muted hover:text-foreground underline"
            >
              Account settings
            </Link>
          )}
        </div>

        {/* Get in Touch */}
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-3">
          <h3 className="text-sm font-semibold text-foreground mb-2">Get in Touch</h3>
          <p className="text-xs text-foreground-muted mb-2">
            Have an inquiry about Love of Minnesota?
          </p>
          <a
            href="mailto:loveofminnesota@gmail.com"
            className="text-xs text-lake-blue hover:text-lake-blue/80 hover:underline"
          >
            loveofminnesota@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Right Sidebar - Sticky, scrollable.
 * When no children are passed, shows user-specific content: account card and Get in Touch (same style as /settings right sidebar).
 */
export default function RightSidebar({ children }: RightSidebarProps) {
  if (children !== undefined && children !== null) {
    return (
      <div className="h-full flex flex-col overflow-y-auto scrollbar-hide bg-white dark:bg-header border-l border-border-muted dark:border-white/10">
        <div className="p-3">{children}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide bg-white dark:bg-header border-l border-border-muted dark:border-white/10">
      <DefaultRightSidebarContent />
    </div>
  );
}
