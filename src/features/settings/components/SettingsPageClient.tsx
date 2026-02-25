'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCardIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import AccountSettingsForm from './AccountSettingsForm';
import { useAuth } from '@/features/auth';
import type { ProfileAccount } from '@/types/profile';

interface SettingsPageClientProps {
  account: ProfileAccount;
  userEmail: string;
}

export default function SettingsPageClient({ account: initialAccount, userEmail }: SettingsPageClientProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [account, setAccount] = useState<ProfileAccount>({
    ...initialAccount,
    search_visibility: initialAccount.search_visibility ?? false,
    account_taggable: initialAccount.account_taggable ?? false,
  });
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  useEffect(() => {
    setAccount({
      ...initialAccount,
      search_visibility: initialAccount.search_visibility ?? false,
      account_taggable: initialAccount.account_taggable ?? false,
    });
  }, [initialAccount]);

  const handleSignOutClick = () => {
    setShowSignOutConfirm(true);
  };

  const handleSignOutConfirm = async () => {
    setIsSigningOut(true);
    setSignOutError('');
    setShowSignOutConfirm(false);
    
    try {
      await signOut();
      localStorage.removeItem('freemap_sessions');
      localStorage.removeItem('freemap_current_session');
      router.replace('/');
    } catch (error) {
      console.error('Sign out error:', error);
      setSignOutError('Failed to sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleSignOutCancel = () => {
    setShowSignOutConfirm(false);
  };

  const handleManageBilling = () => {
    router.push('/settings/billing');
  };

  // Determine billing status
  const isProUser = account.plan === 'contributor';
  const isActive = account.subscription_status === 'active' || account.subscription_status === 'trialing';
  const isTrial = account.billing_mode === 'trial' || account.subscription_status === 'trialing';
  const planDisplayName = account.plan === 'contributor' ? 'Contributor' : 'Hobby';
  const planPrice = account.plan === 'contributor' ? '$20/month' : 'Free';

  // Get subscription status display
  const getStatusDisplay = () => {
    if (!account.subscription_status) return null;
    if (account.subscription_status === 'active') return { text: 'Active', color: 'bg-green-900/20 text-green-400' };
    if (account.subscription_status === 'trialing') return { text: 'Trial', color: 'bg-blue-900/20 text-blue-400' };
    if (account.subscription_status === 'past_due') return { text: 'Past Due', color: 'bg-yellow-900/20 text-yellow-400' };
    if (account.subscription_status === 'canceled') return { text: 'Canceled', color: 'bg-surface-accent text-foreground/80' };
    return { text: account.subscription_status, color: 'bg-surface-accent text-foreground/80' };
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-3">
          <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px] flex flex-col gap-1.5">
            <p className="text-xs text-foreground/70">Signed in as {userEmail || '—'}</p>
            {account.username && (
              <Link
                href={`/${encodeURIComponent(account.username)}`}
                className="text-xs font-medium text-foreground hover:underline"
              >
                View profile →
              </Link>
            )}
          </div>
          <AccountSettingsForm
            initialAccount={account}
            userEmail={userEmail}
            showAccountSwitcher
            onAccountUpdate={setAccount}
          />

          {/* Manage Billing Section */}
          <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
          <h3 className="text-sm font-semibold text-foreground mb-3">Manage Billing</h3>
          <div className="flex items-center justify-between p-[10px] border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent dark:hover:bg-white/10 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h4 className="text-xs font-semibold text-foreground">{planDisplayName}</h4>
                {isTrial && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/20 text-blue-400">
                    Trial
                  </span>
                )}
                {statusDisplay && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusDisplay.color}`}>
                    {statusDisplay.text}
                  </span>
                )}
              </div>
              <p className="text-xs text-foreground/70">
                {isProUser 
                  ? isActive 
                    ? `${planPrice} • Active subscription`
                    : account.subscription_status === 'canceled'
                    ? 'Subscription canceled'
                    : account.subscription_status === 'past_due'
                    ? 'Payment required'
                    : 'Subscription inactive'
                  : 'Upgrade to unlock Contributor features'
                }
              </p>
            </div>
            <button
              onClick={handleManageBilling}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-foreground bg-surface border border-border-muted dark:border-white/20 hover:bg-surface-accent dark:hover:bg-white/10 rounded-md transition-colors flex-shrink-0"
            >
              <CreditCardIcon className="w-3 h-3" />
              <span>{isProUser ? 'Manage' : 'Upgrade'}</span>
            </button>
          </div>
        </div>

          {/* Account Actions */}
          <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
          <h3 className="text-sm font-semibold text-foreground mb-3">Account Actions</h3>
          
          {signOutError && (
            <div className="mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-400 px-[10px] py-[10px] rounded-md text-xs flex items-start gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{signOutError}</span>
            </div>
          )}
          
          <div className="flex items-center justify-between p-[10px] border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent dark:hover:bg-white/10 transition-colors">
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-0.5">Sign Out</h4>
              <p className="text-xs text-foreground/70">Sign out of your account on this device</p>
            </div>
            <button
              onClick={handleSignOutClick}
              disabled={isSigningOut}
              className="flex items-center gap-1.5 px-[10px] py-[10px] text-xs font-medium text-foreground bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSigningOut ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Signing out...
                </>
              ) : (
                'Sign Out'
              )}
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signout-title"
          onKeyDown={(e) => e.key === 'Escape' && handleSignOutCancel()}
        >
          <div className="bg-surface rounded-md border border-border-muted dark:border-white/10 w-full max-w-md mx-4">
            <div className="p-[10px]">
              <div className="flex items-center mb-3">
                <div className="flex-shrink-0 w-8 h-8 mx-auto bg-red-900/20 rounded-md flex items-center justify-center">
                  <ArrowRightOnRectangleIcon className="w-4 h-4 text-red-400" aria-hidden />
                </div>
              </div>
              <div className="text-center">
                <h3 id="signout-title" className="text-sm font-semibold text-foreground mb-1.5">
                  Sign out of your account?
                </h3>
                <p className="text-xs text-foreground/70 mb-3">
                  You&apos;ll need to sign in again to access your account.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleSignOutCancel}
                    className="flex-1 px-[10px] py-[10px] text-xs font-medium text-foreground bg-surface-accent border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent/80 focus:outline-none focus:ring-2 focus:ring-white/30 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSignOutConfirm}
                    disabled={isSigningOut}
                    className="flex-1 px-[10px] py-[10px] text-xs font-medium text-foreground bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSigningOut ? 'Signing out...' : 'Sign out'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
