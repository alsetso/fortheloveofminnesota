'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { ArrowLeftIcon, UserIcon, ArrowTopRightOnSquareIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import PaymentScreen from './PaymentScreen';
import CreditsPaymentScreen from './CreditsPaymentScreen';
import type { BillingPlan, BillingFeature } from '@/lib/billing/types';

type PlanTab = 'contributor' | 'government';

interface PlanWithFeatures extends BillingPlan {
  features: (BillingFeature & { isInherited: boolean })[];
  directFeatureCount: number;
  inheritedFeatureCount: number;
}

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
  const [plans, setPlans] = useState<PlanWithFeatures[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string | null>(null);
  
  // Check if user has a paid plan (contributor or plus)
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
        setSelectedPlanSlug(null);
      } else if (hash.startsWith('#apply-')) {
        let plan = hash.replace('#apply-', '');
        // Convert 'gov' hash to 'government' for internal use
        if (plan === 'gov') {
          plan = 'government';
        }
        const planTab = plan as PlanTab;
        if (['contributor', 'government'].includes(planTab)) {
          setSelectedPlan(planTab);
          setShowPaymentScreen(true);
          setSelectedPlanSlug(null);
        }
      } else if (hash.startsWith('#plan-')) {
        const planSlug = hash.replace('#plan-', '');
        setSelectedPlanSlug(planSlug);
        setShowPaymentScreen(false);
        setShowCreditsPayment(false);
        setSelectedPlan(null);
      } else {
        setShowPaymentScreen(false);
        setShowCreditsPayment(false);
        setSelectedPlan(null);
        setSelectedPlanSlug(null);
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [plans]);


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

  // Fetch plans and features from database
  useEffect(() => {
    const fetchPlans = async () => {
      setLoadingPlans(true);
      try {
        const response = await fetch('/api/billing/plans');
        if (response.ok) {
          const data = await response.json();
          setPlans(data.plans || []);
        } else {
          console.error('Failed to fetch plans');
        }
      } catch (error) {
        console.error('Error fetching plans:', error);
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchPlans();
  }, []);

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
    <div className="w-full space-y-6">
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

      {/* Plan Detail View */}
      {selectedPlanSlug && (() => {
        const selectedPlan = plans.find(p => p.slug === selectedPlanSlug);
        if (!selectedPlan) return null;
        
        const isCurrentPlan = account?.plan === selectedPlan.slug;
        const priceDisplay = selectedPlan.price_monthly_cents === 0 
          ? 'Free' 
          : `$${(selectedPlan.price_monthly_cents / 100).toFixed(0)}/mo`;
        const priceYearly = selectedPlan.price_yearly_cents 
          ? `$${(selectedPlan.price_yearly_cents / 100).toFixed(0)}/yr` 
          : null;
        
        const directFeatures = selectedPlan.features.filter(f => !f.isInherited);
        const inheritedFeatures = selectedPlan.features.filter(f => f.isInherited);
        
        return (
          <div className="mb-6">
            {/* Header - Inline */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">{selectedPlan.name}</h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">{priceDisplay}</span>
                  {priceYearly && (
                    <span className="text-sm text-gray-500">or {priceYearly}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  router.push('/billing');
                  setSelectedPlanSlug(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            {selectedPlan.description && (
              <p className="text-gray-600 mb-4">{selectedPlan.description}</p>
            )}
            
            {/* Features in Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {directFeatures.map((feature) => (
                  <div key={feature.id} className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      {feature.emoji ? (
                        <span className="text-lg">{feature.emoji}</span>
                      ) : (
                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{feature.name}</div>
                      {feature.description && (
                        <div className="text-xs text-gray-500 mt-0.5">{feature.description}</div>
                      )}
                    </div>
                  </div>
                ))}
                {inheritedFeatures.map((feature) => (
                  <div key={feature.id} className="flex items-start gap-2 opacity-75">
                    <div className="flex-shrink-0 mt-0.5">
                      {feature.emoji ? (
                        <span className="text-lg">{feature.emoji}</span>
                      ) : (
                        <CheckCircleIcon className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-700">
                        {feature.name}
                        <span className="text-xs text-gray-500 ml-2">(inherited)</span>
                      </div>
                      {feature.description && (
                        <div className="text-xs text-gray-500 mt-0.5">{feature.description}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Billing Management - Inline */}
            <div className="space-y-3">
              <div className="flex gap-3">
                {isCurrentPlan && account?.stripe_customer_id && (
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/billing/create-portal-session', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
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
                    className="px-6 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                  >
                    Manage Billing
                  </button>
                )}
                
                {/* Upgrade Button - Show for plans with pricing that aren't the current plan */}
                {!isCurrentPlan && selectedPlan.price_monthly_cents > 0 && (
                  <button
                    onClick={async () => {
                      try {
                        setLoadingPlans(true);
                        const response = await fetch('/api/billing/checkout', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            plan: selectedPlan.slug,
                            period: 'monthly',
                          }),
                        });
                        
                        if (!response.ok) {
                          const errorData = await response.json().catch(() => ({}));
                          throw new Error(errorData.error || 'Failed to create checkout session');
                        }
                        
                        const data = await response.json();
                        if (data.url) {
                          window.location.href = data.url;
                        }
                      } catch (error) {
                        console.error('Error creating checkout session:', error);
                        alert(error instanceof Error ? error.message : 'Failed to start checkout');
                      } finally {
                        setLoadingPlans(false);
                      }
                    }}
                    disabled={loadingPlans}
                    className="px-6 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingPlans ? 'Loading...' : 'Upgrade'}
                  </button>
                )}
              </div>
              
              {/* Promotional Text */}
              {!isCurrentPlan && selectedPlan.price_monthly_cents > 0 && (
                <p className="text-sm text-gray-600">
                  Email{' '}
                  <a 
                    href="mailto:loveofminnesota@gmail.com" 
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    loveofminnesota@gmail.com
                  </a>
                  {' '}for 15% off with an annual subscription
                </p>
              )}
            </div>
            
            {/* Payment History - Only show for current plan if history exists */}
            {isCurrentPlan && account?.stripe_customer_id && paymentHistory.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 mt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment History</h3>
                {loadingHistory ? (
                  <div className="text-xs text-gray-500 text-center py-4">Loading payment history...</div>
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
          </div>
        );
      })()}

      {/* Plan Cards - Hide when detail view is open */}
      {!selectedPlanSlug && (
        <>
          {loadingPlans ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
          <p className="mt-3 text-sm text-gray-500">Loading plans...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const isCurrentPlan = account?.plan === plan.slug;
            const priceDisplay = plan.price_monthly_cents === 0 
              ? 'Free' 
              : `$${(plan.price_monthly_cents / 100).toFixed(0)}/mo`;
            
            // Format plan description or use default
            const planDescription = plan.description || 
              (plan.slug === 'hobby' ? 'Get started with basic features.' :
               plan.slug === 'contributor' ? 'Unlock advanced analytics and unlimited maps.' :
               'Premium features for your needs.');
            
            // Get direct features count
            const directFeatures = plan.features.filter(f => !f.isInherited);
            const featureCount = plan.features.length;
            
            const handlePlanClick = () => {
              router.push(`/billing#plan-${plan.slug}`);
              setSelectedPlanSlug(plan.slug);
            };
            
            const buttonText = isCurrentPlan 
              ? 'View Details' 
              : plan.slug === 'hobby' 
                ? 'View Details' 
                : plan.slug === 'government' || plan.slug === 'gov'
                  ? 'View Details'
                  : 'View Details';
            
            return (
              <div 
                key={plan.id} 
                className={`relative bg-white border rounded-lg p-4 flex flex-col transition-all hover:shadow-md ${
                  isCurrentPlan 
                    ? 'border-green-500 shadow-sm' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Header */}
                <div className="mb-3 flex items-start justify-between">
                  <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  <span className="text-sm font-medium text-gray-500">{priceDisplay}</span>
                </div>
                
                {/* Description */}
                <p className="text-xs text-gray-600 mb-3 line-clamp-2">{planDescription}</p>
                
                {/* Feature Count */}
                <div className="mb-4 text-xs text-gray-500">
                  {featureCount} feature{featureCount !== 1 ? 's' : ''}
                  {plan.inheritedFeatureCount > 0 && (
                    <span> ({plan.inheritedFeatureCount} inherited)</span>
                  )}
                </div>
                
                {/* Action Button */}
                <button
                  onClick={handlePlanClick}
                  className={`w-full py-2 px-3 rounded-md font-semibold text-xs transition-all mt-auto focus:outline-none active:scale-[0.98] ${
                    isCurrentPlan
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {buttonText}
                </button>
              </div>
            );
          })}
        </div>
      )}
        </>
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
