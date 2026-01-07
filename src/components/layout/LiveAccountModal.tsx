'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon, CameraIcon } from '@heroicons/react/24/outline';
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
import { useAuthStateSafe, AccountService, Account } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import ProfilePhoto from '@/components/shared/ProfilePhoto';

const LAST_SELECTED_ACCOUNT_KEY = 'LAST_SELECTED_ACCOUNT';

interface LiveAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: typeof UserIcon;
  onClick: () => void;
  disabled?: boolean;
}

export default function LiveAccountModal({ isOpen, onClose }: LiveAccountModalProps) {
  const { account, user, isLoading, activeAccountId, setActiveAccountId } = useAuthStateSafe();
  const { openAccount, openWelcome } = useAppModalContextSafe();
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [isAccountsExpanded, setIsAccountsExpanded] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);

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
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
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

  const displayName = account ? AccountService.getDisplayName(account) : 'User';
  const userEmail = user?.email || '';

  // Build menu items
  const menuItems: MenuItem[] = [
    {
      id: 'profile',
      label: 'Your profile',
      icon: UserIcon,
      onClick: () => {
        onClose();
        openAccount('profile');
      },
    },
    {
      id: 'timeline',
      label: 'Your timeline',
      icon: ClockIcon,
      onClick: () => {
        onClose();
        // Navigate to timeline or show timeline view
        window.location.href = account?.username ? `/profile/${account.username}` : '/';
      },
    },
    {
      id: 'location-sharing',
      label: 'Location sharing',
      icon: ShareIcon,
      onClick: () => {
        onClose();
        openAccount('settings');
      },
      disabled: true, // Coming soon
    },
    {
      id: 'offline-maps',
      label: 'Offline maps',
      icon: CloudArrowDownIcon,
      onClick: () => {
        onClose();
        // Coming soon
      },
      disabled: true,
    },
    {
      id: 'your-data',
      label: 'Your data in Maps',
      icon: ShieldCheckIcon,
      onClick: () => {
        onClose();
        openAccount('settings');
      },
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Cog6ToothIcon,
      onClick: () => {
        onClose();
        openAccount('settings');
      },
    },
    {
      id: 'add-place',
      label: 'Add a missing place',
      icon: MapPinIcon,
      onClick: () => {
        onClose();
        // Could open a form or navigate to contribute
      },
      disabled: true, // Coming soon
    },
    {
      id: 'add-business',
      label: 'Add your business',
      icon: BuildingStorefrontIcon,
      onClick: () => {
        onClose();
        // Could open business form
      },
      disabled: true, // Coming soon
    },
    {
      id: 'help',
      label: 'Help & Feedback',
      icon: QuestionMarkCircleIcon,
      onClick: () => {
        onClose();
        // Could open help modal or navigate to help page
        window.open('mailto:loveoveminnesota@gmail.com', '_blank');
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center pointer-events-auto">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 pointer-events-auto"
        onClick={onClose}
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
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Account Information Section */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-200">
            <div className="flex items-start gap-3 mb-3">
              {/* Profile Picture with Camera Icon */}
              <div className="relative flex-shrink-0">
                <ProfilePhoto account={account} size="lg" editable={false} />
                <button
                  onClick={() => {
                    onClose();
                    openAccount('profile');
                  }}
                  className="absolute bottom-0 right-0 w-6 h-6 bg-white rounded-full border-2 border-white flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors"
                  aria-label="Change profile picture"
                >
                  <CameraIcon className="w-3 h-3 text-gray-600" />
                </button>
              </div>

              {/* Name and Email */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 truncate mb-1">
                  {displayName}
                </h3>
                {userEmail && (
                  <p className="text-xs text-gray-600 truncate">
                    {userEmail}
                  </p>
                )}
              </div>
            </div>

            {/* Manage Account Button */}
            <button
              onClick={() => {
                onClose();
                openAccount('settings');
              }}
              className="w-full px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors text-left"
            >
              Manage your account
            </button>
          </div>

          {/* Other Accounts Section - Only show if role is admin */}
          {account && account.role === 'admin' && (
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

          {/* Menu Items */}
          <div className="py-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-900 hover:bg-gray-50 transition-colors ${
                    item.disabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Icon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

