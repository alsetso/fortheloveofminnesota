'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { XMarkIcon, ChartBarIcon, UserIcon, CreditCardIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useAuth, AccountService, Account } from '@/features/auth';
import type { BillingData } from '@/lib/billingServer';
import AnalyticsClient from '@/components/feed/AnalyticsClient';
import SettingsClient from '@/app/account/settings/SettingsClient';
import BillingClient from '@/app/account/billing/BillingClient';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TabId;
  onAccountUpdate?: () => void | Promise<void>;
}

type TabId = 'analytics' | 'settings' | 'billing';

interface Tab {
  id: TabId;
  label: string;
  icon: typeof ChartBarIcon;
}

const tabs: Tab[] = [
  { id: 'analytics', label: 'Analytics', icon: ChartBarIcon },
  { id: 'settings', label: 'Settings', icon: UserIcon },
  { id: 'billing', label: 'Billing', icon: CreditCardIcon },
];

export default function AccountModal({ isOpen, onClose, initialTab, onAccountUpdate }: AccountModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab || 'settings');
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-[10px]">
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
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
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

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-[10px]">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {activeTab === 'analytics' && <AnalyticsClient />}
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
                      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Plans & Pricing</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left py-2 px-2 font-semibold text-gray-900">Name</th>
                                <th className="text-center py-2 px-2 font-semibold text-gray-900">Hobby</th>
                                <th className="text-center py-2 px-2 font-semibold text-gray-900">Pro</th>
                                <th className="text-center py-2 px-2 font-semibold text-gray-900">Pro+</th>
                              </tr>
                              <tr className="border-b border-gray-200">
                                <th className="text-left py-2 px-2 font-medium text-gray-700">Price</th>
                                <td className="text-center py-2 px-2 text-gray-600">$0</td>
                                <td className="text-center py-2 px-2 text-gray-600">$20</td>
                                <td className="text-center py-2 px-2 text-gray-600">$80</td>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-gray-100">
                                <td colSpan={4} className="py-2 px-2 font-medium text-gray-900 bg-gray-50">Hobby</td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-2 px-2 text-gray-600">Public Pins</td>
                                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-2 px-2 text-gray-600">Private pins</td>
                                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td colSpan={4} className="py-2 px-2 font-medium text-gray-900 bg-gray-50">Pro</td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-2 px-2 text-gray-600">Shareable Profile</td>
                                <td className="text-center py-2 px-2 text-gray-500">❌</td>
                                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-2 px-2 text-gray-600">Pin collections view</td>
                                <td className="text-center py-2 px-2 text-gray-500">❌</td>
                                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-2 px-2 text-gray-600">See who viewed your profile and pins</td>
                                <td className="text-center py-2 px-2 text-gray-500">❌</td>
                                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-2 px-2 text-gray-600">API: OpenAI</td>
                                <td className="text-center py-2 px-2 text-gray-500">❌</td>
                                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td colSpan={4} className="py-2 px-2 font-medium text-gray-900 bg-gray-50">Pro+</td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-2 px-2 text-gray-600">API: Skip Trace</td>
                                <td className="text-center py-2 px-2 text-gray-500">❌</td>
                                <td className="text-center py-2 px-2 text-gray-500">❌</td>
                                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                              </tr>
                              <tr>
                                <td className="py-2 px-2 text-gray-600">API: Zillow</td>
                                <td className="text-center py-2 px-2 text-gray-500">❌</td>
                                <td className="text-center py-2 px-2 text-gray-500">❌</td>
                                <td className="text-center py-2 px-2 text-gray-900">✔️</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
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



