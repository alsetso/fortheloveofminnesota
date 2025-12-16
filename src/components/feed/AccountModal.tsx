'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { XMarkIcon, ChartBarIcon, BellIcon, SparklesIcon, UserIcon, CreditCardIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useAuth, AccountService, Account } from '@/features/auth';
import type { BillingData } from '@/lib/billingServer';
import { isAccountComplete } from '@/lib/accountCompleteness';
import AnalyticsClient from '@/components/feed/AnalyticsClient';
import NotificationsClient from '@/app/_archive/account/notifications/NotificationsClient';
import SettingsClient from '@/app/_archive/account/settings/SettingsClient';
import BillingClient from '@/app/_archive/account/billing/BillingClient';
import ChangePlanClient from '@/app/_archive/account/change-plan/ChangePlanClient';
import OnboardingClient from '@/app/_archive/account/onboarding/OnboardingClient';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TabId;
  onAccountUpdate?: () => void | Promise<void>;
}

type TabId = 'analytics' | 'notifications' | 'onboarding' | 'settings' | 'billing';

interface Tab {
  id: TabId;
  label: string;
  icon: typeof ChartBarIcon;
}

const tabs: Tab[] = [
  { id: 'analytics', label: 'Analytics', icon: ChartBarIcon },
  { id: 'notifications', label: 'Notifications', icon: BellIcon },
  { id: 'onboarding', label: 'Onboarding', icon: SparklesIcon },
  { id: 'settings', label: 'Settings', icon: UserIcon },
  { id: 'billing', label: 'Billing', icon: CreditCardIcon },
];

export default function AccountModal({ isOpen, onClose, initialTab, onAccountUpdate }: AccountModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab || 'settings');
  const [accountComplete, setAccountComplete] = useState(true);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Update tab when initialTab changes
  useEffect(() => {
    if (initialTab && isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Check account completeness and force onboarding tab if incomplete
  // Wait until account is loaded (not loading) before checking
  useEffect(() => {
    if (isOpen && !loading && account) {
      const complete = isAccountComplete(account);
      setAccountComplete(complete);
      
      // Force onboarding tab if account is incomplete
      if (!complete) {
        setActiveTab('onboarding');
      }
    } else if (isOpen && !loading && !account) {
      // If account is null after loading, assume incomplete
      setAccountComplete(false);
      setActiveTab('onboarding');
    }
  }, [isOpen, loading, account]);

  // Fetch account data when modal opens
  useEffect(() => {
    if (isOpen && user) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const accountData = await AccountService.getCurrentAccount();
          setAccount(accountData);
          setUserEmail(user.email || '');

          // Fetch billing data if needed
          if (activeTab === 'billing') {
            try {
              const response = await fetch('/api/billing/data');
              if (response.ok) {
                const data = await response.json();
                setBillingData(data);
              }
            } catch (error) {
              console.error('Error fetching billing data:', error);
            }
          }
        } catch (error) {
          console.error('Error fetching account data:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [isOpen, user, activeTab]);

  // Fetch billing data when switching to billing tab
  useEffect(() => {
    if (isOpen && activeTab === 'billing' && !billingData) {
      const fetchBillingData = async () => {
        try {
          const response = await fetch('/api/billing/data');
          if (response.ok) {
            const data = await response.json();
            setBillingData(data);
          }
        } catch (error) {
          console.error('Error fetching billing data:', error);
        }
      };
      fetchBillingData();
    }
  }, [isOpen, activeTab, billingData]);

  // Reset showChangePlan when switching away from billing tab
  useEffect(() => {
    if (activeTab !== 'billing') {
      setShowChangePlan(false);
    }
  }, [activeTab]);

  // Handle change plan click from BillingClient
  const handleChangePlanClick = () => {
    setShowChangePlan(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-[10px]">
      {/* Backdrop - No click to close, user must explicitly close */}
      <div 
        className="absolute inset-0 bg-black/40"
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-md border border-gray-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-[10px] py-[10px] border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="relative w-6 h-6 flex-shrink-0">
              <Image
                src="/logo.png"
                alt="MNUDA"
                width={24}
                height={24}
                className="object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <h2 className="text-sm font-semibold text-gray-900">Account</h2>
              {!accountComplete && (
                <p className="text-[10px] text-gray-500">Please complete your profile to continue</p>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              // Prevent closing if account is incomplete
              if (!accountComplete) {
                return;
              }
              onClose();
            }}
            disabled={!accountComplete}
            className={`p-1 transition-colors ${
              accountComplete 
                ? 'text-gray-500 hover:text-gray-700' 
                : 'text-gray-300 cursor-not-allowed'
            }`}
            aria-label="Close"
            title={!accountComplete ? 'Please complete your profile to continue' : 'Close'}
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            // Disable tabs other than onboarding if account is incomplete
            const isDisabled = !accountComplete && tab.id !== 'onboarding';
            return (
              <button
                key={tab.id}
                onClick={() => {
                  // Prevent switching away from onboarding if account is incomplete
                  if (!accountComplete && tab.id !== 'onboarding') {
                    return;
                  }
                  setActiveTab(tab.id);
                }}
                disabled={isDisabled}
                className={`
                  flex items-center gap-1.5 px-[10px] py-2 text-xs font-medium transition-colors whitespace-nowrap border-b-2
                  ${activeTab === tab.id
                    ? 'text-gray-900 border-gray-900'
                    : isDisabled
                    ? 'text-gray-300 cursor-not-allowed border-transparent'
                    : 'text-gray-500 hover:text-gray-700 border-transparent'
                  }
                `}
                title={isDisabled ? 'Please complete your profile first' : undefined}
              >
                <Icon className="w-3 h-3" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-[10px]">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {activeTab === 'analytics' && <AnalyticsClient />}
              {activeTab === 'notifications' && <NotificationsClient />}
              {activeTab === 'onboarding' && account && (
                <OnboardingClient 
                  initialAccount={account} 
                  redirectTo={undefined}
                  onComplete={async () => {
                    // Refresh account data
                    try {
                      const accountData = await AccountService.getCurrentAccount();
                      setAccount(accountData);
                      const complete = isAccountComplete(accountData);
                      setAccountComplete(complete);
                      
                      // Call parent callback if provided
                      if (onAccountUpdate) {
                        await onAccountUpdate();
                      }
                    } catch (error) {
                      console.error('Error refreshing account after completion:', error);
                    }
                  }}
                />
              )}
              {activeTab === 'settings' && account && <SettingsClient initialAccount={account} userEmail={userEmail} />}
              {activeTab === 'billing' && (
                <>
                  {showChangePlan ? (
                    <div className="space-y-3">
                      <button
                        onClick={() => setShowChangePlan(false)}
                        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors mb-2"
                      >
                        <ArrowLeftIcon className="w-3 h-3" />
                        Back to Billing
                      </button>
                      {billingData && <ChangePlanClient initialBillingData={billingData} />}
                    </div>
                  ) : (
                    billingData && (
                      <BillingClient 
                        initialBillingData={billingData} 
                        onChangePlanClick={handleChangePlanClick}
                      />
                    )
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


