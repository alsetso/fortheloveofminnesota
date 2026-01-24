'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCircleIcon, CreditCardIcon } from '@heroicons/react/24/outline';
import PageWrapper from '@/components/layout/PageWrapper';
import AccountSidebar from '@/components/billing/AccountSidebar';
import PaymentMethodsSidebar from '@/components/billing/PaymentMethodsSidebar';
import BillingSetup from '@/components/billing/BillingSetup';
import PlansKanbanView from '@/components/billing/PlansKanbanView';
import { useAuthStateSafe } from '@/features/auth';

export default function BillingPageClient() {
  const [isAccountSidebarOpen, setIsAccountSidebarOpen] = useState(false);
  const [isPaymentSidebarOpen, setIsPaymentSidebarOpen] = useState(false);
  const { account, user, refreshAccount } = useAuthStateSafe();
  const router = useRouter();

  const hasStripeCustomer = !!account?.stripe_customer_id;

  const handleCustomerCreated = async () => {
    // Refresh account data to get the new stripe_customer_id
    await refreshAccount();
  };

  const handleViewDetails = (planSlug: string) => {
    router.push(`/billing#plan-${planSlug}`);
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
            
            {/* Kanban View of Plans */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Compare Plans</h2>
              <PlansKanbanView 
                onViewDetails={handleViewDetails} 
                currentPlanSlug={account?.plan}
              />
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
    </>
  );
}
