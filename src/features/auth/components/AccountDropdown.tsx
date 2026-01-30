'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UserIcon, Cog6ToothIcon, CreditCardIcon, ChartBarIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { AccountService, Account } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import BottomButtonsPopup from '@/components/layout/BottomButtonsPopup';

interface AccountDropdownProps {
  /** Visual variant */
  variant?: 'light' | 'dark';
  /** Callback when user clicks their authenticated account */
  onAccountClick?: () => void;
  /** Callback when Sign In is clicked */
  onSignInClick?: () => void;
  /** When set, trigger button calls this instead of toggling the dropdown (e.g. open AppMenu on /live) */
  onTriggerClick?: () => void;
}

export default function AccountDropdown({
  variant = 'light',
  onAccountClick,
  onSignInClick,
  onTriggerClick,
}: AccountDropdownProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  
  const {
    user,
    account,
    activeAccountId,
    isLoading,
    displayAccount,
    signOut,
    setActiveAccountId,
  } = useAuthStateSafe();
  
  // Plan & Limits: only via Settings → Billing/Analytics. Settings/Billing/Analytics in dropdown: Admin only.
  const isAdmin = account?.role === 'admin';

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
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const data = await response.json();
              setAllAccounts(data.accounts || []);
            } else {
              console.error('Expected JSON response but got:', contentType);
            }
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

  // Detect mobile screen size (lg breakpoint is 1024px)
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // When not authenticated and not loading, show blue hyperlink text (no dropdown)
  if (!isLoading && !account) {
    return (
      <button
        onClick={handleSignIn}
        className={`text-sm font-medium transition-colors ${
          isDark
            ? 'text-blue-400 hover:text-blue-300'
            : 'text-blue-600 hover:text-blue-700'
        }`}
        aria-label="Sign in"
      >
        Sign In
      </button>
    );
  }

  // Rich content (email, plan labels, Settings/Billing/Analytics) only for admins; others get minimal switcher + Sign Out.
  const renderDropdownContent = () => (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-0">
          {/* User email: admins only */}
          {isAdmin && user?.email && (
            <div className="border-b border-gray-200">
              <div className="px-[10px] py-2">
                <p className="text-xs text-gray-600 truncate" title={user.email}>
                  {user.email}
                </p>
              </div>
            </div>
          )}

          {/* Accounts: list for everyone; label + plan per account only for admins */}
          {account && (
            <div className="border-b border-gray-200">
              {isAdmin && (
                <div className="px-[10px] py-1.5 text-[10px] font-medium text-gray-500 uppercase tracking-wide bg-gray-50">
                  Accounts
                </div>
              )}
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
                        onClick={() => {
                          if (isActive) {
                            handleAccountClick();
                          } else {
                            handleSwitchAccount(acc.id);
                          }
                        }}
                        className="w-full flex items-center gap-2 p-[10px] hover:bg-gray-50 transition-colors text-left"
                      >
                        <ProfilePhoto account={acc} size="sm" editable={false} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {AccountService.getDisplayName(acc)}
                          </p>
                          {isAdmin && (
                            <p className="text-[10px] text-gray-500">
                              {acc.plan ? acc.plan.charAt(0).toUpperCase() + acc.plan.slice(1) : 'Account'}
                            </p>
                          )}
                        </div>
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                          title={isActive ? 'Active' : 'Inactive'}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
              {(account.role === 'admin' || account.plan === 'contributor') && (
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

          {/* Actions: Settings/Billing/Analytics admins only; Sign Out everyone */}
          <div className="border-t border-gray-200">
            {account ? (
              <>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        router.push('/settings');
                      }}
                      className="w-full flex items-center gap-2 p-[10px] hover:bg-gray-50 transition-colors text-left text-xs text-gray-700"
                    >
                      <Cog6ToothIcon className="w-4 h-4 text-gray-500" />
                      Settings
                    </button>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        router.push('/billing');
                      }}
                      className="w-full flex items-center gap-2 p-[10px] hover:bg-gray-50 transition-colors text-left text-xs text-gray-700"
                    >
                      <CreditCardIcon className="w-4 h-4 text-gray-500" />
                      Billing
                    </button>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        router.push('/analytics');
                      }}
                      className="w-full flex items-center gap-2 p-[10px] hover:bg-gray-50 transition-colors text-left text-xs text-gray-700"
                    >
                      <ChartBarIcon className="w-4 h-4 text-gray-500" />
                      Analytics
                    </button>
                  </>
                )}
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 p-[10px] hover:bg-gray-50 transition-colors text-left text-xs text-red-600 border-t border-gray-100"
                >
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </>
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
    </>
  );

  // When authenticated or loading, show profile dropdown or popup
  return (
    <>
      <div ref={containerRef} className="relative">
        {/* Trigger Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onTriggerClick) {
              onTriggerClick();
              return;
            }
            setIsOpen(!isOpen);
          }}
          className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 backdrop-blur-sm ${
            isDark
              ? 'bg-white/10 hover:bg-white/20 text-white/90 hover:text-white'
              : 'bg-black/5 hover:bg-black/10 text-[#3C3C43]'
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
              <UserIcon className={`w-3 h-3 ${isDark ? 'text-gray-500' : 'text-[#3C3C43]'}`} />
            </div>
          )}
        </button>

        {/* Desktop Dropdown */}
        {!isMobile && isOpen && (
          <div 
            className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white z-50 overflow-hidden rounded-md border border-gray-200 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {renderDropdownContent()}
          </div>
        )}
      </div>

      {/* Mobile Popup */}
      {isMobile && (
        <BottomButtonsPopup
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          type="account"
          height="full"
          darkMode={false}
          containerRelative={false}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-[10px] py-[10px] border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-3xl">
            <h2 className="text-sm font-semibold text-gray-900">Account</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center w-8 h-8 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          
          {/* Content */}
          {renderDropdownContent()}
        </BottomButtonsPopup>
      )}
    </>
  );
}

