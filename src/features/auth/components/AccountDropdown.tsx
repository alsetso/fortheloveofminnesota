'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UserIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { AccountService, Account } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import ProfilePhoto from '@/components/shared/ProfilePhoto';

interface AccountDropdownProps {
  /** Visual variant */
  variant?: 'light' | 'dark';
  /** Callback when user clicks their authenticated account */
  onAccountClick?: () => void;
  /** Callback when Sign In is clicked */
  onSignInClick?: () => void;
}

export default function AccountDropdown({
  variant = 'light',
  onAccountClick,
  onSignInClick,
}: AccountDropdownProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
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

  const { openWelcome, openAccount, openCreateAccount } = useAppModalContextSafe();

  // Fetch all user accounts when dropdown opens
  useEffect(() => {
    if (isOpen && account) {
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
  }, [isOpen, account, activeAccountId]); // Refresh when active account changes

  // Listen for account creation events to refresh the list
  useEffect(() => {
    if (!account) return;

    const handleAccountCreated = async () => {
      if (isOpen) {
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
      }
    };

    window.addEventListener('account-created', handleAccountCreated);
    return () => {
      window.removeEventListener('account-created', handleAccountCreated);
    };
  }, [isOpen, account]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
    return undefined;
  }, [isOpen]);

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsOpen(false);
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Only for authenticated accounts - opens account settings modal
  const handleAccountClick = () => {
    setIsOpen(false);
    if (onAccountClick) {
      onAccountClick();
    } else {
      openAccount('settings');
    }
  };

  // Switch to a different account
  const handleSwitchAccount = async (accountId: string) => {
    try {
      // Set localStorage immediately before switching to ensure persistence
      if (typeof window !== 'undefined') {
        // Account switching is handled by setActiveAccountId which stores username
      }
      await setActiveAccountId(accountId);
      setIsOpen(false);
      // Refresh server components to pick up the new active account cookie
      router.refresh();
    } catch (error) {
      console.error('Error switching account:', error);
    }
  };

  // Sign in button - opens welcome modal with URL param
  const handleSignIn = () => {
    setIsOpen(false);
    if (onSignInClick) {
      onSignInClick();
    } else {
      openWelcome();
    }
  };

  const isDark = variant === 'dark';

  // When not authenticated and not loading, show red sign-in button (no dropdown)
  if (!isLoading && !account) {
    return (
      <button
        onClick={handleSignIn}
        className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 text-xs font-medium rounded-md transition-colors"
        aria-label="Sign in"
      >
        Sign In
      </button>
    );
  }

  // When authenticated or loading, show profile dropdown
  return (
    <div ref={containerRef} className="relative">
        {/* Trigger Button */}
        <button
          onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors ${
          isDark
            ? isOpen
              ? 'bg-white/20 text-white'
              : 'text-white hover:text-white hover:bg-white/10'
            : isOpen
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
        }`}
        aria-label="Account menu"
        aria-expanded={isOpen}
      >
        {displayAccount ? (
          <ProfilePhoto 
            account={displayAccount as Account} 
            size="sm" 
            editable={false}
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
            <UserIcon className="w-3 h-3 text-gray-500" />
          </div>
        )}
        <svg 
          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white z-50 overflow-hidden rounded-md border border-gray-200 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-0">
              {/* All Accounts Section */}
              {account && (
                <div className="border-b border-gray-200">
                  <div className="px-[10px] py-1.5 text-[10px] font-medium text-gray-500 uppercase tracking-wide bg-gray-50">
                    Accounts
                  </div>
                  {loadingAccounts ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      {allAccounts.map((acc) => {
                        const isActive = acc.id === activeAccountId;
                        return (
                          <button
                            key={acc.id}
                            onClick={() => isActive ? handleAccountClick() : handleSwitchAccount(acc.id)}
                            className="w-full flex items-center gap-2 p-[10px] hover:bg-gray-50 transition-colors text-left"
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
                              className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                              title={isActive ? 'Active' : 'Inactive'}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Create New Account Button - Only for admins or pro plan users */}
                  {(account.role === 'admin' || account.plan === 'pro') && (
                    <div className="border-t border-gray-200">
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          openCreateAccount();
                        }}
                        className="w-full flex items-center gap-2 p-[10px] hover:bg-gray-50 transition-colors text-left text-xs text-gray-700 font-medium"
                      >
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create New Account
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Sign In / Sign Out */}
              <div>
                {account ? (
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 p-[10px] hover:bg-gray-50 transition-colors text-left text-xs text-gray-600"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                ) : (
                  <button
                    onClick={handleSignIn}
                    className="w-full flex items-center gap-2 p-[10px] hover:bg-gray-50 transition-colors text-left text-xs text-blue-600 font-medium"
                  >
                    <UserIcon className="w-4 h-4" />
                    Sign In
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

