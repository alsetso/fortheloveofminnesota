'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { ArrowLeftIcon, UserIcon, ArrowTopRightOnSquareIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import PaymentScreen from './PaymentScreen';
import CreditsPaymentScreen from './CreditsPaymentScreen';

type PlanTab = 'contributor' | 'business' | 'government';

interface PaymentHistoryItem {
  id: string;
  eventType: string;
  amount: number | null;
  currency: string;
  description: string;
  status: 'success' | 'failed';
  date: string;
  processed: boolean;
  error: string | null;
  invoiceUrl?: string | null;
  invoicePdf?: string | null;
  receiptUrl?: string | null;
}

export default function UpgradeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { account, user } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const [showPaymentScreen, setShowPaymentScreen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanTab | null>(null);
  const [showCreditsPayment, setShowCreditsPayment] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const isPro = account?.plan === 'contributor' || account?.plan === 'plus';
  const isActive = account?.subscription_status === 'active' || account?.subscription_status === 'trialing';
  const isAuthenticated = !!user;

  // Check for credits success message
  useEffect(() => {
    const creditsParam = searchParams.get('credits');
    if (creditsParam === 'success') {
      // Credits purchase successful - could show toast notification here if needed
      // For now, silently handle success (user will see updated account state)
    }
  }, [searchParams]);

  // Check for URL hash on mount and when hash changes
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      if (hash === '#apply-credits') {
        setShowCreditsPayment(true);
      } else if (hash.startsWith('#apply-')) {
        let plan = hash.replace('#apply-', '');
        // Convert 'gov' hash to 'government' for internal use
        if (plan === 'gov') {
          plan = 'government';
        }
        const planTab = plan as PlanTab;
        if (['contributor', 'business', 'government'].includes(planTab)) {
          setSelectedPlan(planTab);
          setShowPaymentScreen(true);
        }
      } else {
        setShowPaymentScreen(false);
        setShowCreditsPayment(false);
        setSelectedPlan(null);
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);


  // Handle Apply buttons - update URL hash instead of opening email
  const handleApplyPlan = async (plan: PlanTab) => {
    if (plan === 'contributor') {
      // If already on Contributor plan, open billing portal
      if (account?.plan === 'contributor' && account?.stripe_customer_id) {
        try {
          const response = await fetch('/api/billing/create-portal-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to create billing portal session');
          }

          const data = await response.json();
          if (data.url) {
            window.open(data.url, '_blank', 'noopener,noreferrer');
          }
        } catch (error) {
          console.error('Error opening billing portal:', error);
          alert(error instanceof Error ? error.message : 'Failed to open billing portal');
        }
        return;
      }
    }

    // Otherwise, show payment/setup screen
    const planHash = plan === 'government' ? 'gov' : plan;
    router.push(`/billing#apply-${planHash}`);
    setSelectedPlan(plan);
    setShowPaymentScreen(true);
  };

  const handleApplyContributor = async () => {
    await handleApplyPlan('contributor');
  };

  const handleApplyBusiness = async () => {
    await handleApplyPlan('business');
  };

  const handleApplyGovernment = async () => {
    await handleApplyPlan('government');
  };



  const handleBackFromPayment = () => {
    router.push('/billing');
    setShowPaymentScreen(false);
    setSelectedPlan(null);
  };


  const handlePurchaseCredits = () => {
    if (!user) {
      openWelcome();
      return;
    }
    router.push('/billing#apply-credits');
    setShowCreditsPayment(true);
  };

  const handleBackFromCreditsPayment = () => {
    router.push('/billing');
    setShowCreditsPayment(false);
  };

  const getPlanDisplay = (plan: string | null | undefined) => {
    if (!plan) return 'Hobby';
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  const getRoleDisplay = (role: string | null | undefined) => {
    if (!role) return 'User';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  // Fetch payment history - must be before early returns
  useEffect(() => {
    if (!account?.stripe_customer_id) return;

    const fetchPaymentHistory = async () => {
      setLoadingHistory(true);
      try {
        const response = await fetch('/api/billing/payment-history');
        if (response.ok) {
          const data = await response.json();
          setPaymentHistory(data.payments || []);
        }
      } catch (error) {
        console.error('Error fetching payment history:', error);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchPaymentHistory();
  }, [account?.stripe_customer_id]);

  // Show credits payment screen if hash is present
  if (showCreditsPayment) {
    return (
      <CreditsPaymentScreen
        account={account}
        user={user}
        onBack={handleBackFromCreditsPayment}
      />
    );
  }

  // Show payment screen if hash is present
  if (showPaymentScreen && selectedPlan) {
    return (
      <PaymentScreen
        plan={selectedPlan}
        account={account}
        user={user}
        onBack={handleBackFromPayment}
      />
    );
  }

  return (
    <div className="max-w-[600px] mx-auto px-4 py-6 space-y-6">
      {/* Profile Card */}
      {account && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className={`relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 ${
              (account.plan === 'contributor' || account.plan === 'plus')
                ? 'p-[1px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600'
                : 'border border-gray-200'
            }`}>
              <div className="w-full h-full rounded-full overflow-hidden bg-white">
                {account.image_url ? (
                  <Image
                    src={account.image_url}
                    alt={account.username || 'Account'}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                    unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <UserIcon className="w-6 h-6 text-gray-400" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {account.first_name && account.last_name
                  ? `${account.first_name} ${account.last_name}`
                  : account.username || 'Account'}
              </div>
              {account.username && (
                <div className="text-xs text-gray-500 truncate">
                  @{account.username}
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-600">
                  {getRoleDisplay(account.role)}
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-600">
                  {getPlanDisplay(account.plan)} Plan
                </span>
              </div>
            </div>
            {account.stripe_customer_id && (
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/billing/create-portal-session', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                    });

                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({}));
                      throw new Error(errorData.error || 'Failed to create billing portal session');
                    }

                    const data = await response.json();
                    if (data.url) {
                      window.open(data.url, '_blank', 'noopener,noreferrer');
                    }
                  } catch (error) {
                    console.error('Error opening billing portal:', error);
                    alert(error instanceof Error ? error.message : 'Failed to open billing portal');
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors whitespace-nowrap"
              >
                Manage Billing
                <ArrowTopRightOnSquareIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Plan Cards */}
      <div className="space-y-3">
        {/* Contributor Card - Full Width */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 h-[250px] flex flex-col">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-gray-900">Contributor</h3>
              {account?.plan === 'contributor' && (
                <span className="px-1 py-0.5 text-[10px] font-medium text-gray-700 bg-gray-100 rounded-full">
                  Current
                </span>
              )}
            </div>
            <span className="text-xs font-medium text-gray-900">$20/mo.</span>
          </div>
          <div className="flex-1 flex flex-col justify-end">
            <p className="text-xs text-gray-600 mb-2">
              Unlock advanced analytics, unlimited custom maps, historical data, and professional export tools.
            </p>
            <button
              onClick={handleApplyContributor}
              className="w-full px-2 py-1 text-[10px] font-medium text-gray-900 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              {account?.plan === 'contributor' ? 'Manage' : 'Upgrade'}
            </button>
          </div>
        </div>

        {/* Business & Government Plans */}
        <div className="grid grid-cols-2 gap-3">
          {/* Business Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 h-[250px] flex flex-col">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold text-gray-900">Business</h3>
                {account?.plan === 'business' && (
                  <span className="px-1 py-0.5 text-[10px] font-medium text-gray-700 bg-gray-100 rounded-full">
                    Current
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-end">
              <p className="text-xs text-gray-600 mb-2">
                Connect your business with Minnesota. Verified profiles and statewide visibility.
              </p>
              <button
                onClick={handleApplyBusiness}
                className="w-full px-2 py-1 text-[10px] font-medium text-gray-900 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                {account?.plan === 'business' ? 'Manage' : 'Set up →'}
              </button>
            </div>
          </div>

          {/* Government Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 h-[250px] flex flex-col">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold text-gray-900">Government</h3>
                {account?.plan === 'gov' && (
                  <span className="px-1 py-0.5 text-[10px] font-medium text-gray-700 bg-gray-100 rounded-full">
                    Current
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-end">
              <p className="text-xs text-gray-600 mb-2">
                Help your residents love Minnesota more. Strategic initiatives and civic engagement tools.
              </p>
              <button
                onClick={handleApplyGovernment}
                className="w-full px-2 py-1 text-[10px] font-medium text-gray-900 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                {account?.plan === 'gov' ? 'Manage' : 'Set up →'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment History Section */}
      {account?.stripe_customer_id && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment History</h3>
          {loadingHistory ? (
            <div className="text-xs text-gray-500 text-center py-4">Loading payment history...</div>
          ) : paymentHistory.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-4">No payment history found</div>
          ) : (
            <div className="space-y-2">
              {paymentHistory.map((payment) => {
                const hasLink = payment.invoiceUrl || payment.invoicePdf || payment.receiptUrl;
                const linkUrl = payment.receiptUrl || payment.invoiceUrl || payment.invoicePdf;
                
                const CardContent = (
                  <div className="flex items-center justify-between p-2 border border-gray-100 rounded">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {payment.status === 'success' ? (
                        <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">
                          {payment.description || payment.eventType}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {new Date(payment.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {payment.amount !== null && (
                        <span className={`text-xs font-medium ${
                          payment.status === 'success' ? 'text-gray-900' : 'text-red-600'
                        }`}>
                          ${payment.amount.toFixed(2)}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        payment.status === 'success'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {payment.status === 'success' ? 'Success' : 'Failed'}
                      </span>
                    </div>
                  </div>
                );

                if (hasLink && linkUrl) {
                  return (
                    <a
                      key={payment.id}
                      href={linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block hover:bg-gray-50 transition-colors rounded"
                    >
                      {CardContent}
                    </a>
                  );
                }

                return <div key={payment.id}>{CardContent}</div>;
              })}
            </div>
          )}
        </div>
      )}

      {/* Additional Info */}
      <div className="text-center space-y-2">
        {account && (
          <p className="text-sm text-gray-600">
            Current Plan: <span className="font-medium capitalize">{account.plan || 'Hobby'}</span>
          </p>
        )}
        <p className="text-sm text-gray-600">
          Questions? Email us at{' '}
          <a 
            href="mailto:loveofminnesota@gmail.com" 
            className="text-red-500 hover:text-red-600 underline"
          >
            loveofminnesota@gmail.com
          </a>
        </p>
        <p className="text-xs text-gray-500">
          Please allow up to 24 hours for your subscription account status to reflect updates after payment.
        </p>
      </div>
    </div>
  );
}
