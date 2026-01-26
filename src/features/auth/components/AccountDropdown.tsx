'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { UserIcon, Cog6ToothIcon, CreditCardIcon, ChartBarIcon, MapIcon, XMarkIcon, DocumentTextIcon, FolderIcon, UserGroupIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { AccountService, Account } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useBillingEntitlementsSafe } from '@/contexts/BillingEntitlementsContext';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import BottomButtonsPopup from '@/components/layout/BottomButtonsPopup';

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
  const { features, isLoading: featuresLoading, getFeature } = useBillingEntitlementsSafe();
  
  // Group and prioritize features for display
  const displayFeatures = useMemo(() => {
    // Key features to show (prioritize count-based limits)
    // Use exact matching to avoid matching sub-features (e.g., 'map_analytics')
    const keyFeatureSlugs = ['custom_maps', 'map', 'posts', 'collections', 'groups'];
    const keyFeatures = features.filter(f => 
      keyFeatureSlugs.includes(f.slug) && // Exact match, not includes()
      (f.limit_type === 'count' || f.is_unlimited)
    );
    
    // Show key features first, then other count-based features
    return [
      ...keyFeatures,
      ...features.filter(f => !keyFeatures.includes(f) && f.limit_type === 'count')
    ].slice(0, 6); // Limit to 6 most important features
  }, [features]);
  
  const booleanFeatures = useMemo(() => {
    return features.filter(f => 
      f.limit_type === 'boolean' || 
      (f.limit_type === null && !f.is_unlimited && f.limit_value === null)
    ).slice(0, 4); // Show up to 4 boolean features
  }, [features]);
  
  // Fetch current usage for all key features
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [loadingUsage, setLoadingUsage] = useState(false);
  
  useEffect(() => {
    if (!isOpen || !activeAccountId) return;
    
    const fetchUsage = async () => {
      setLoadingUsage(true);
      try {
        const usageResponse = await fetch('/api/billing/usage', { credentials: 'include' });
        if (usageResponse.ok) {
          const usageData = await usageResponse.json();
          setUsage(usageData.usage || {});
        }
      } catch (err) {
        console.error('Error fetching usage:', err);
      } finally {
        setLoadingUsage(false);
      }
    };
    
    fetchUsage();
  }, [isOpen, activeAccountId]);

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

  // Render dropdown content (shared between dropdown and popup)
  const renderDropdownContent = () => (
    <>
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

          {/* Plan & Limits Section - The Brain of the System */}
          {account && (
            <div className="border-t border-gray-200">
              <div className="px-[10px] py-1.5 text-[10px] font-medium text-gray-500 uppercase tracking-wide bg-gray-50">
                Plan & Limits
              </div>
              <div className="p-[10px] space-y-2">
                {/* Plan Status */}
                <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-600">Plan</span>
                    {account.subscription_status === 'active' && (
                      <CheckCircleIcon className="w-3 h-3 text-green-500" title="Active subscription" />
                    )}
                    {account.subscription_status === 'trialing' && (
                      <span className="text-[9px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">Trial</span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-gray-900">
                    {account.plan ? account.plan.charAt(0).toUpperCase() + account.plan.slice(1) : 'None'}
                  </span>
                </div>
                
                {/* Key Features with Limits - Compact Display */}
                {!featuresLoading && displayFeatures.length > 0 && (
                  <div className="space-y-1.5">
                    {displayFeatures.map((feature) => {
                      // Use actual feature name from database, but remove "Custom" prefix if present
                      let label = feature.name;
                      if (label.startsWith('Custom ')) {
                        label = label.replace(/^Custom /, '');
                      }
                      
                      // Determine icon based on feature slug (exact matching)
                      let Icon = MapIcon;
                      
                      // Use exact matching or category-based logic
                      if (feature.slug === 'custom_maps' || feature.slug === 'map' || feature.slug === 'unlimited_maps') {
                        Icon = MapIcon;
                      } else if (feature.slug === 'posts' || feature.slug === 'post') {
                        Icon = DocumentTextIcon;
                      } else if (feature.slug === 'collections' || feature.slug === 'collection') {
                        Icon = FolderIcon;
                      } else if (feature.slug === 'groups' || feature.slug === 'group') {
                        Icon = UserGroupIcon;
                      } else if (feature.category === 'maps' || (feature.slug && feature.slug.startsWith('map_'))) {
                        Icon = MapIcon;
                      } else if (feature.category === 'content' || (feature.slug && feature.slug.startsWith('content_'))) {
                        Icon = DocumentTextIcon;
                      }
                      
                      // Get usage by feature slug (API returns usage keyed by slug)
                      const currentUsage = usage[feature.slug] ?? 0;
                      const displayCount = loadingUsage ? '...' : currentUsage;
                      
                      const limitDisplay = feature.is_unlimited 
                        ? '∞' 
                        : feature.limit_value !== null 
                          ? feature.limit_value 
                          : '∞';
                      
                      const isAtLimit = !feature.is_unlimited && 
                                       feature.limit_value !== null && 
                                       currentUsage >= feature.limit_value;
                      
                      return (
                        <div key={feature.slug} className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <Icon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                            <span className="text-xs text-gray-600 truncate" title={feature.slug}>
                              {label}
                            </span>
                          </div>
                          <span className={`text-xs font-medium flex-shrink-0 ml-2 ${
                            isAtLimit ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            {feature.is_unlimited 
                              ? `${displayCount} (∞)`
                              : `${displayCount} / ${limitDisplay}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Boolean Features (Yes/No access) */}
                {!featuresLoading && booleanFeatures.length > 0 && (
                  <div className="pt-1.5 border-t border-gray-100 space-y-1">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Features</div>
                    <div className="flex flex-wrap gap-1">
                      {booleanFeatures.map((feature) => (
                        <span 
                          key={feature.slug}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700"
                          title={feature.name}
                        >
                          <CheckCircleIcon className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[60px]">{feature.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Actions */}
                <div className="pt-1.5 border-t border-gray-100 space-y-1">
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      router.push('/billing');
                    }}
                    className="w-full px-2 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors text-center border border-indigo-200"
                  >
                    Manage Plan
                  </button>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      router.push('/plans');
                    }}
                    className="w-full px-2 py-1 text-[10px] text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors text-center"
                  >
                    View All Plans
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sign In / Sign Out */}
          <div className="border-t border-gray-200">
            {account ? (
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

