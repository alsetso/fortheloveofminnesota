'use client';

import { useRouter } from 'next/navigation';
import {
  AccountAvatar,
  formatAccountPlan,
  getAccountDisplayName,
  getAccountHandle,
  useAuthSafe,
} from '@/features/auth';
import {
  SettingsChrome,
  SettingsGroup,
  SettingsRow,
} from '@/features/settings/SettingsChrome';
import { StreakCalendarCard } from '@/features/streaks/StreakCalendarCard';
import { useAccountStreak } from '@/features/streaks/useAccountStreak';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  formatWalletBalance,
  useWalletSummary,
} from '@/features/tools/wallet/useWalletSummary';
import { isPaidPlan } from '@/lib/billing/planHelpers';
import {
  FEED_PATH,
  settingsAccountPath,
  settingsBillingPath,
  WELCOME_PATH,
} from '@/lib/routes/routePolicy';

/**
 * /settings — hub for account details + billing.
 */
export default function SettingsPage() {
  const router = useRouter();
  const { openDockCard } = useMapDock();
  const { account, user, isLoading, signOut } = useAuthSafe();
  const { summary, loading: walletLoading } = useWalletSummary();
  const { streak, loading: streakLoading } = useAccountStreak(account?.id ?? null);

  const displayName = getAccountDisplayName(account, user?.email);
  const handle = getAccountHandle(account);
  const planLabel =
    summary?.planLabel?.trim() || formatAccountPlan(account?.plan);
  const credits = walletLoading ? '…' : formatWalletBalance(summary);
  const paid = isPaidPlan(account?.plan);

  const onBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(FEED_PATH);
  };

  const onSignOut = async () => {
    await signOut();
    router.replace(WELCOME_PATH);
    router.refresh();
  };

  return (
    <SettingsChrome title="Settings" backLabel="Back" onBack={onBack}>
      <div className="space-y-6 px-4 pb-12 pt-4">
        <h2 className="px-1 text-[28px] font-extrabold tracking-tight text-foreground">
          Settings
        </h2>

        {/* Identity strip */}
        <div className="flex items-center gap-3 rounded-[14px] border border-black/[0.08] bg-white px-4 py-3.5 shadow-sm">
          <span className="inline-flex h-14 w-14 shrink-0 overflow-hidden rounded-full bg-[#f7f5f1] ring-1 ring-black/[0.06]">
            <AccountAvatar
              account={account}
              email={user?.email}
              size="md"
              loading={isLoading && !account}
              className="h-14 w-14"
            />
          </span>
          <div className="min-w-0 flex-1">
            {isLoading && !account ? (
              <div className="space-y-2" aria-hidden>
                <div className="h-4 w-28 animate-pulse rounded bg-black/[0.06]" />
                <div className="h-3 w-20 animate-pulse rounded bg-black/[0.05]" />
              </div>
            ) : (
              <>
                <p className="truncate text-[17px] font-bold tracking-tight text-foreground">
                  {displayName}
                </p>
                {handle ? (
                  <p className="mt-0.5 truncate text-[13px] text-foreground-muted">
                    {handle}
                  </p>
                ) : null}
                {user?.email ? (
                  <p className="mt-0.5 truncate text-[12px] text-foreground-muted">
                    {user.email}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>

        {account ? (
          <div className="-mx-4">
            <StreakCalendarCard streak={streak} loading={streakLoading} />
          </div>
        ) : null}

        <SettingsGroup label="Account">
          <SettingsRow
            title="Account details"
            subtitle="Name, username, contact, privacy"
            disabled={!account}
            onClick={() => router.push(settingsAccountPath())}
          />
          <SettingsRow
            title="Delete account"
            subtitle="Permanently remove this account"
            destructive
            disabled={!account}
            onClick={() => openDockCard('delete-account')}
          />
        </SettingsGroup>

        <SettingsGroup label="Billing">
          <SettingsRow
            title="Plan & credits"
            subtitle={
              paid
                ? `${planLabel} · ${credits} credits`
                : `${planLabel} · earn credits on the map`
            }
            trailing={
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  paid
                    ? 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 text-white'
                    : 'bg-lake-blue/10 text-lake-blue'
                }`}
              >
                {planLabel}
              </span>
            }
            disabled={!account}
            onClick={() => router.push(settingsBillingPath())}
          />
        </SettingsGroup>

        <SettingsGroup label="Session">
          <SettingsRow title="Sign out" destructive onClick={() => void onSignOut()} />
        </SettingsGroup>
      </div>
    </SettingsChrome>
  );
}
