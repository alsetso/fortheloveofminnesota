'use client';

import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon, ChartBarIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { 
  UserIcon, 
  ClockIcon, 
  ShareIcon, 
  CloudArrowDownIcon, 
  ShieldCheckIcon, 
  Cog6ToothIcon,
  MapPinIcon,
  BuildingStorefrontIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline';
import { PWAStatusIcon } from '@/components/pwa/PWAStatusIcon';
import { useAuthStateSafe, AccountService, Account } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { useAccountTabs } from '@/features/account/hooks/useAccountTabs';
import { useAccountData } from '@/features/account/hooks/useAccountData';
import type { AccountTabId } from '@/features/account/types';
import AnalyticsClient from '@/features/account/components/AnalyticsClient';
import SettingsClient from '@/features/account/components/SettingsClient';
import ProfilesClient from '@/features/account/components/ProfilesClient';
import OnboardingClient from '@/features/account/components/OnboardingClient';
import { isAccountComplete } from '@/lib/accountCompleteness';
import { checkOnboardingStatus } from '@/lib/onboardingCheck';

const LAST_SELECTED_ACCOUNT_KEY = 'LAST_SELECTED_ACCOUNT';

interface LiveAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: AccountTabId;
}


interface Tab {
  id: AccountTabId;
  label: string;
  icon: typeof ChartBarIcon;
}

export default function LiveAccountModal({ isOpen, onClose, initialTab }: LiveAccountModalProps) {
  const { account, user, isLoading, activeAccountId, setActiveAccountId, refreshAccount } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [isAccountsExpanded, setIsAccountsExpanded] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const [accountComplete, setAccountComplete] = useState(true);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  
  // Tab management - redirect 'profile' to 'settings' since profile tab is removed
  const normalizedInitialTab = initialTab === 'profile' ? 'settings' : initialTab;
  const { activeTab, setActiveTab } = useAccountTabs(normalizedInitialTab, isOpen);
  const { account: accountData, userEmail, loading: accountLoading } = useAccountData(isOpen, activeTab);
  
  // Redirect away from profile tab if somehow activeTab becomes 'profile'
  useEffect(() => {
    if (activeTab === 'profile') {
      setActiveTab('settings');
    }
  }, [activeTab, setActiveTab]);
  
  // Use accountData if available, otherwise fall back to account from auth
  const currentAccount = accountData || account;
  
  // Check onboarding status when modal opens
  useEffect(() => {
    if (isOpen && user && !checkingOnboarding) {
      const checkStatus = async () => {
        setCheckingOnboarding(true);
        try {
          const { account: onboardingAccount } = await checkOnboardingStatus();
          const complete = onboardingAccount ? isAccountComplete(onboardingAccount) : false;
          setAccountComplete(complete);
          // If incomplete, show onboarding tab
          if (!complete) {
            // Don't set tab here - let the UI handle it
          }
        } catch (error) {
          console.error('[LiveAccountModal] Error checking onboarding:', error);
          setAccountComplete(true); // Default to complete on error
        } finally {
          setCheckingOnboarding(false);
        }
      };
      checkStatus();
    }
  }, [isOpen, user, checkingOnboarding]);
  
  // Build tabs array
  const tabs: Tab[] = useMemo(() => {
    // If account incomplete, don't show tabs - show onboarding
    if (!accountComplete) {
      return [];
    }
    
    const baseTabs: Tab[] = [
      { id: 'analytics', label: 'Analytics', icon: ChartBarIcon },
      { id: 'settings', label: 'Settings', icon: UserIcon },
    ];
    
    // Only include profiles tab if user is admin
    if (currentAccount?.role === 'admin') {
      baseTabs.push({ id: 'profiles', label: 'Profiles', icon: UserGroupIcon });
    }
    
    return baseTabs;
  }, [accountComplete, currentAccount?.role]);
  
  // Redirect away from profiles tab if user is not admin
  useEffect(() => {
    if (activeTab === 'profiles' && currentAccount?.role !== 'admin') {
      setActiveTab('settings');
    }
  }, [activeTab, currentAccount?.role, setActiveTab]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Fetch all user accounts when modal opens and account is admin
  useEffect(() => {
    if (isOpen && account && account.role === 'admin') {
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
          console.error('[LiveAccountModal] Error fetching accounts:', error);
        } finally {
          setLoadingAccounts(false);
        }
      };
      fetchAccounts();
    }
  }, [isOpen, account, activeAccountId]);

  // Switch to a different account
  const handleSwitchAccount = async (accountId: string) => {
    if (accountId === activeAccountId) return;
    
    setSwitchingAccountId(accountId);
    
    try {
      // Find the account to switch to
      const accountToSwitch = allAccounts.find(acc => acc.id === accountId);
      if (!accountToSwitch) {
        console.error('[LiveAccountModal] Account not found in list');
        setSwitchingAccountId(null);
        return;
      }
      
      // Use setActiveAccountId which handles localStorage and state updates
      await setActiveAccountId(accountId);
      
      // Verify localStorage was set (we always store account ID now)
      // Add a small delay to ensure setActiveAccountId has completed
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const storedValue = typeof window !== 'undefined' 
        ? localStorage.getItem(LAST_SELECTED_ACCOUNT_KEY) 
        : null;
      
      if (process.env.NODE_ENV === 'development') {
        if (storedValue === accountId) {
          console.log('[LiveAccountModal] Success: Last selected account set to', accountId);
        } else {
          console.warn('[LiveAccountModal] Warning: localStorage value mismatch', { 
            expected: accountId, 
            actual: storedValue
          });
        }
      }
      
      // Close modal after switching
      onClose();
      setSwitchingAccountId(null);
    } catch (error) {
      console.error('[LiveAccountModal] Error switching account:', error);
      setSwitchingAccountId(null);
    }
  };

  if (!isOpen) return null;

  // If not authenticated, show sign in prompt
  if (!account && !isLoading) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-auto">
        <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={onClose} />
        <div className="relative w-full max-w-sm bg-white rounded-lg shadow-lg pointer-events-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Love of Minnesota"
                width={24}
                height={24}
                className="object-contain"
                priority
              />
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 text-center">
            <p className="text-sm text-gray-600 mb-4">Sign in to access your account</p>
            <button
              onClick={() => {
                onClose();
                openWelcome();
              }}
              className="w-full px-4 py-2 text-sm font-medium text-gray-900 bg-white hover:bg-gray-50 border border-gray-300 rounded-md transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-auto">
        <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={onClose} />
        <div className="relative w-full max-w-sm bg-white rounded-lg shadow-lg p-6 pointer-events-auto">
          <div className="flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  const displayName = currentAccount ? AccountService.getDisplayName(currentAccount) : 'User';
  const currentUserEmail = userEmail || user?.email || '';

  // Handle onboarding completion
  const handleOnboardingComplete = async () => {
    try {
      if (refreshAccount) {
        await refreshAccount();
      }
      const { account: updatedAccount } = await checkOnboardingStatus();
      const complete = updatedAccount ? isAccountComplete(updatedAccount) : false;
      setAccountComplete(complete);
      if (complete) {
        setActiveTab('settings');
      }
    } catch (error) {
      console.error('[LiveAccountModal] Error refreshing after onboarding:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center pointer-events-auto">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/40 pointer-events-auto ${!accountComplete ? '' : ''}`}
        onClick={accountComplete ? onClose : undefined}
      />

      {/* Modal - slides up from bottom on mobile, centered on desktop */}
      <div className="relative w-full max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col animate-slide-up pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Love of Minnesota"
              width={24}
              height={24}
              className="object-contain"
              priority
            />
          </div>
          <div className="flex items-center gap-2">
            <PWAStatusIcon 
              variant="light" 
              size="sm"
              showLabel={false}
            />
            <button
              onClick={accountComplete ? onClose : undefined}
              disabled={!accountComplete}
              className={`p-1 transition-colors ${
                accountComplete 
                  ? 'text-gray-500 hover:text-gray-700' 
                  : 'text-gray-300 cursor-not-allowed'
              }`}
              aria-label="Close"
              title={!accountComplete ? 'Please complete your profile to continue' : 'Close'}
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Account Information Section */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-200">
            <div className="flex items-start gap-3 mb-3">
              {/* Profile Picture with Camera Icon */}
              <div className="relative flex-shrink-0">
                <ProfilePhoto account={account} size="lg" editable={false} />
              </div>

              {/* Name and Email */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 truncate mb-1">
                  {displayName}
                </h3>
                {currentUserEmail && (
                  <p className="text-xs text-gray-600 truncate mb-1">
                    {currentUserEmail}
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {currentAccount?.role && (
                    <span className="text-[10px] font-medium text-gray-600 px-1.5 py-0.5 bg-gray-100 rounded">
                      {currentAccount.role === 'admin' ? 'Admin' : 'General'}
                    </span>
                  )}
                  {currentAccount?.plan && (
                    <span className="text-[10px] font-medium text-gray-600 px-1.5 py-0.5 bg-gray-100 rounded">
                      {currentAccount.plan === 'pro' ? 'Pro' : currentAccount.plan === 'plus' ? 'Plus' : 'Hobby'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* View Profile Button */}
            {currentAccount?.username && (
              <Link
                href={`/profile/${currentAccount.username}`}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-transparent border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
                View Profile
              </Link>
            )}

          </div>

          {/* Other Accounts Section - Only show if role is admin and account complete */}
          {accountComplete && currentAccount && currentAccount.role === 'admin' && (
            <div className="px-4 pt-3 pb-3 border-b border-gray-200">
              <button
                onClick={() => setIsAccountsExpanded(!isAccountsExpanded)}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="text-xs font-semibold text-gray-900">Other accounts</span>
                {isAccountsExpanded ? (
                  <ChevronUpIcon className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                )}
              </button>

              {isAccountsExpanded && (
                <div className="mt-2 space-y-1">
                  {loadingAccounts ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                    </div>
                  ) : allAccounts.length > 0 ? (
                    allAccounts
                      .filter((acc) => acc.id !== activeAccountId)
                      .map((acc) => {
                        const displayName = AccountService.getDisplayName(acc);
                        const isActive = acc.id === activeAccountId;
                        const isSwitching = switchingAccountId === acc.id;
                        
                        return (
                          <button
                            key={acc.id}
                            onClick={() => handleSwitchAccount(acc.id)}
                            disabled={isSwitching}
                            className={`w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors text-left ${
                              isActive
                                ? 'bg-gray-100'
                                : isSwitching
                                ? 'bg-gray-50 opacity-75'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <ProfilePhoto account={acc} size="sm" editable={false} />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-900 truncate">
                                {displayName}
                              </div>
                              {acc.email && (
                                <div className="text-[10px] text-gray-500 truncate">
                                  {acc.email}
                                </div>
                              )}
                            </div>
                            {isSwitching ? (
                              <div className="w-3 h-3 border-2 border-gray-400 border-t-gray-600 rounded-full animate-spin flex-shrink-0" />
                            ) : isActive ? (
                              <div className="w-2 h-2 bg-teal-500 rounded-full flex-shrink-0" />
                            ) : null}
                          </button>
                        );
                      })
                  ) : (
                    <p className="text-xs text-gray-500 py-2">No other accounts</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tabs - Only show if account is complete */}
          {accountComplete && tabs.length > 0 && (
            <div className="flex border-b border-gray-200 overflow-x-auto flex-shrink-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
              return (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-1.5 px-[10px] py-2 text-xs font-medium transition-colors whitespace-nowrap border-b-2
                      ${activeTab === tab.id
                        ? 'text-gray-900 border-gray-900'
                        : 'text-gray-500 hover:text-gray-700 border-transparent'
                      }
                    `}
                  >
                    <Icon className="w-3 h-3" />
                    {tab.label}
                </button>
              );
            })}
            </div>
          )}

          {/* Tab Content or Onboarding */}
          <div className="flex-1 overflow-y-auto p-[10px]">
            {!accountComplete ? (
              // Show onboarding if account incomplete
              <OnboardingClient
                initialAccount={currentAccount}
                onComplete={handleOnboardingComplete}
              />
            ) : accountLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {activeTab === 'analytics' && <AnalyticsClient />}
                {activeTab === 'settings' && currentAccount && <SettingsClient initialAccount={currentAccount} userEmail={currentUserEmail} />}
                {activeTab === 'profiles' && <ProfilesClient />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

