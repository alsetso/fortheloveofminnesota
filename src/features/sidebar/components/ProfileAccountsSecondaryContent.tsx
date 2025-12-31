'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStateSafe, AccountService, Account } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import ProfilePhoto from '@/components/shared/ProfilePhoto';

export default function ProfileAccountsSecondaryContent() {
  const router = useRouter();
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  
  const {
    account,
    activeAccountId,
    isLoading,
    displayAccount,
    signOut,
    setActiveAccountId,
  } = useAuthStateSafe();

  const { openWelcome, openAccount } = useAppModalContextSafe();

  // Fetch all user accounts when component mounts
  useEffect(() => {
    if (account) {
      const fetchAccounts = async () => {
        setLoadingAccounts(true);
        try {
          const response = await fetch('/api/accounts?limit=50', {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            setAllAccounts(data.accounts || []);
          }
        } catch (error) {
          console.error('Error fetching accounts:', error);
        } finally {
          setLoadingAccounts(false);
        }
      };
      fetchAccounts();
    }
  }, [account, activeAccountId]); // Refresh when active account changes

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Only for authenticated accounts - opens account settings modal
  const handleAccountClick = () => {
    openAccount('settings');
  };

  // Switch to a different account
  const handleSwitchAccount = async (accountId: string) => {
    try {
      // Set localStorage immediately before switching to ensure persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('mnuda_active_account_id', accountId);
      }
      await setActiveAccountId(accountId);
      // Refresh server components to pick up the new active account cookie
      router.refresh();
    } catch (error) {
      console.error('Error switching account:', error);
    }
  };

  // Sign in button - opens welcome modal
  const handleSignIn = () => {
    openWelcome();
  };

  return (
    <div className="space-y-3">
      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        </div>
      )}

      {/* Not Authenticated */}
      {!isLoading && !account && (
        <div className="space-y-3">
          <div className="text-center py-4">
            <p className="text-xs text-gray-600 mb-3">Sign in to view and switch between your accounts.</p>
            <button
              onClick={handleSignIn}
              className="w-full px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      )}

      {/* Authenticated - Accounts List */}
      {!isLoading && account && (
        <div className="space-y-3">
          {/* Accounts Section */}
          <div>
            <div className="px-[10px] py-1.5 text-[10px] font-medium text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
              Accounts
            </div>
            {loadingAccounts ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                {allAccounts.length === 0 ? (
                  <div className="p-[10px] text-center">
                    <p className="text-xs text-gray-600">No accounts found.</p>
                  </div>
                ) : (
                  allAccounts.map((acc) => {
                    const isActive = acc.id === activeAccountId;
                    return (
                      <button
                        key={acc.id}
                        onClick={() => isActive ? handleAccountClick() : handleSwitchAccount(acc.id)}
                        className="w-full flex items-center gap-2 p-[10px] hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-b-0"
                      >
                        <ProfilePhoto account={acc} size="sm" editable={false} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {AccountService.getDisplayName(acc)}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {acc.plan ? acc.plan.charAt(0).toUpperCase() + acc.plan.slice(1) : 'Account'}
                          </p>
                        </div>
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                          title={isActive ? 'Active' : 'Inactive'}
                        />
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Sign Out */}
          <div className="border-t border-gray-200 pt-3">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 p-[10px] hover:bg-gray-50 transition-colors text-xs text-gray-600 rounded-md"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

