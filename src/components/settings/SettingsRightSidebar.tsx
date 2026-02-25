'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import { getDisplayName } from '@/types/profile';

const PLAN_LABELS: Record<string, string> = {
  hobby: 'Public',
  contributor: 'Contributor',
};

/**
 * Right Sidebar for Settings page
 * Shows account info and quick actions
 */
export default function SettingsRightSidebar() {
  const { account, userEmail } = useSettings();
  const displayName = getDisplayName(account);
  const subtitle = account.username ? `@${account.username}` : userEmail || '';
  const planLabel = (account.plan && PLAN_LABELS[account.plan]) || 'Public';
  const hasPaidPlanBorder = account.plan === 'contributor';
  const canUpgrade = !account.plan || account.plan === 'hobby' || account.plan === 'contributor';

  return (
    <div className="h-full flex flex-col p-3 overflow-y-auto">
      <div className="space-y-4">
        {/* Account Info */}
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-4 text-center">
          <div
            className={`w-16 h-16 rounded-full mx-auto mb-3 overflow-hidden ${
              hasPaidPlanBorder ? 'p-[2px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600' : 'bg-surface-accent'
            }`}
          >
            <div className="w-full h-full rounded-full overflow-hidden bg-surface relative">
              {account.image_url ? (
                <Image
                  src={account.image_url}
                  alt={displayName}
                  fill
                  className="object-cover"
                  unoptimized={account.image_url.includes('supabase.co')}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-foreground-muted">
                  <span className="text-2xl font-medium">{displayName.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1 truncate w-full">{displayName}</h3>
          <p className="text-xs text-foreground-muted mb-2 truncate w-full">{subtitle}</p>
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
          {userEmail && (
            <p className="text-xs text-foreground-muted truncate w-full">{userEmail}</p>
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
