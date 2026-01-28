'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { UserCircleIcon, CreditCardIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import confetti from 'canvas-confetti';
import PageWrapper from '@/components/layout/PageWrapper';
import AccountSidebar from '@/components/billing/AccountSidebar';
import PaymentMethodsSidebar from '@/components/billing/PaymentMethodsSidebar';
import BillingSetup from '@/components/billing/BillingSetup';
import PlansKanbanView from '@/components/billing/PlansKanbanView';
import PlanPaymentModal from '@/components/billing/PlanPaymentModal';
import ViewsUsageSection from '@/components/billing/ViewsUsageSection';
import { useAuthStateSafe } from '@/features/auth';
import { useToast } from '@/features/ui/hooks/useToast';
import type { BillingPlan, BillingFeature } from '@/lib/billing/types';

interface PlanWithFeatures extends BillingPlan {
  features: (BillingFeature & { 
    isInherited: boolean;
    limit_value?: number | null;
    limit_type?: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
  })[];
  directFeatureCount: number;
  inheritedFeatureCount: number;
}

interface BillingPageClientProps {
  initialPlans?: PlanWithFeatures[];
  initialSelectedPlan?: PlanWithFeatures | null;
  initialPlanSlug?: string | null;
}

export default function BillingPageClient({ initialPlans, initialSelectedPlan, initialPlanSlug }: BillingPageClientProps) {
  const [isAccountSidebarOpen, setIsAccountSidebarOpen] = useState(false);
  const [isPaymentSidebarOpen, setIsPaymentSidebarOpen] = useState(false);
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string | null>(initialPlanSlug || null);
  const [showSuccessCelebration, setShowSuccessCelebration] = useState(false);
  const [purchasedPlanName, setPurchasedPlanName] = useState<string | null>(null);
  const celebrationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { account, user, refreshAccount } = useAuthStateSafe();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, info } = useToast();

  const hasStripeCustomer = !!account?.stripe_customer_id;

  // Sync plan parameter from URL with state (allows switching between plans)
  useEffect(() => {
    const planParam = searchParams.get('plan');
    
    if (planParam && planParam !== selectedPlanSlug) {
      // URL has a different plan - update state to trigger modal refresh
      setSelectedPlanSlug(planParam);
    } else if (!planParam && selectedPlanSlug) {
      // URL parameter was removed - clear selection
      setSelectedPlanSlug(null);
    }
  }, [searchParams, selectedPlanSlug]);

  // Trigger confetti animation
  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Left side confetti
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      
      // Right side confetti
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    return () => clearInterval(interval);
  };

  // Handle checkout status messages
  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout');
    const planParam = searchParams.get('plan');
    
    if (checkoutStatus === 'success') {
      // Get plan name from plan slug
      let planName = 'your plan';
      if (planParam && initialPlans) {
        const purchasedPlan = initialPlans.find(
          p => p.slug.toLowerCase() === planParam.toLowerCase()
        );
        if (purchasedPlan) {
          planName = purchasedPlan.name;
          setPurchasedPlanName(purchasedPlan.name);
        }
      }
      
      // Trigger confetti
      triggerConfetti();
      
      // Show success celebration toast
      setShowSuccessCelebration(true);
      
      // Show success message
      success('Subscription activated', 'Your plan has been successfully updated.');
      
      // Refresh account
      refreshAccount();
      
      // Close modal
      setSelectedPlanSlug(null);
      
      // Auto-hide celebration after 8 seconds
      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
      }
      celebrationTimeoutRef.current = setTimeout(() => {
        setShowSuccessCelebration(false);
        setPurchasedPlanName(null);
      }, 8000);
      
      // Clean up URL by removing checkout parameter (keep plan for a moment)
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('checkout');
      router.replace(newUrl.pathname + newUrl.search);
    } else if (checkoutStatus === 'canceled') {
      // Show subtle info message, keep modal open
      info('Payment canceled', 'You can try again when ready.');
      // Clean up URL by removing checkout parameter
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('checkout');
      router.replace(newUrl.pathname + newUrl.search);
    }
    
    return () => {
      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
      }
    };
  }, [searchParams, refreshAccount, success, info, router, initialPlans]);

  const handleCustomerCreated = async () => {
    // Refresh account data to get the new stripe_customer_id
    await refreshAccount();
  };

  const handleViewDetails = (planSlug: string) => {
    // Update URL with plan parameter to trigger modal
    router.push(`/billing?plan=${planSlug}`);
  };

  const headerContent = (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setIsAccountSidebarOpen(true)}
        className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-white/10 transition-colors"
        aria-label="Open account settings"
      >
        <UserCircleIcon className="w-5 h-5 text-white" />
      </button>
      {hasStripeCustomer && (
        <button
          onClick={() => setIsPaymentSidebarOpen(true)}
          className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-white/10 transition-colors"
          aria-label="Open payment methods"
        >
          <CreditCardIcon className="w-5 h-5 text-white" />
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Success Celebration Toast - Floating over content */}
      {showSuccessCelebration && purchasedPlanName && (
        <div className="fixed inset-0 z-[10000] pointer-events-none flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-2xl border border-gray-200 px-6 py-4 max-w-md mx-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pointer-events-auto">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="w-6 h-6 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  {purchasedPlanName} Plan Activated!
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Please allow up to 24 hours for your account to reflect your purchase.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowSuccessCelebration(false);
                  setPurchasedPlanName(null);
                  if (celebrationTimeoutRef.current) {
                    clearTimeout(celebrationTimeoutRef.current);
                  }
                }}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <PageWrapper headerContent={headerContent}>
        <div className="w-full h-full overflow-y-auto">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {/* Show billing setup if no Stripe customer */}
            {!hasStripeCustomer && (
              <BillingSetup 
                account={account} 
                onCustomerCreated={handleCustomerCreated}
              />
            )}
            
            {/* Plans Comparison Table */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Compare Plans</h2>
              <PlansKanbanView 
                onViewDetails={handleViewDetails} 
                currentPlanSlug={account?.plan}
                showCarousel={false}
                initialPlans={initialPlans}
              />
            </div>

            {/* Views & Usage Section */}
            <div className="mb-6">
              <ViewsUsageSection accountId={account?.id || null} />
            </div>
          </div>
        </div>
      </PageWrapper>
      
      <AccountSidebar
        isOpen={isAccountSidebarOpen}
        onClose={() => setIsAccountSidebarOpen(false)}
        account={account}
        user={user}
      />
      
      {hasStripeCustomer && (
        <PaymentMethodsSidebar
          isOpen={isPaymentSidebarOpen}
          onClose={() => setIsPaymentSidebarOpen(false)}
          account={account}
        />
      )}

      {/* Plan Payment Modal */}
      {selectedPlanSlug && (
        <PlanPaymentModal
          planSlug={selectedPlanSlug}
          isOpen={!!selectedPlanSlug}
          onClose={() => {
            // Clear plan parameter from URL when closing
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('plan');
            newUrl.searchParams.delete('checkout');
            router.replace(newUrl.pathname + (newUrl.search || ''));
            setSelectedPlanSlug(null);
          }}
          account={account}
          initialPlan={initialSelectedPlan && initialSelectedPlan.slug.toLowerCase() === selectedPlanSlug.toLowerCase() 
            ? initialSelectedPlan 
            : null}
        />
      )}

    </>
  );
}
