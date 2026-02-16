'use client';

import { useState, useEffect } from 'react';
import { useAuthStateSafe } from '@/features/auth';
import PlansPricingCards from '@/components/billing/PlansPricingCards';
import PlansComparisonTable from '@/components/billing/PlansComparisonTable';
import PlanPaymentModal from '@/components/billing/PlanPaymentModal';
import type { PlanWithFeatures } from '@/lib/billing/types';

interface PlansPageClientProps {
  currentPlanSlug?: string | null;
  subscriptionStatus?: string | null;
}

export default function PlansPageClient({ currentPlanSlug, subscriptionStatus }: PlansPageClientProps) {
  const { account } = useAuthStateSafe();
  const [plans, setPlans] = useState<PlanWithFeatures[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewPlanSlug, setViewPlanSlug] = useState<string | null>(null);
  const [viewPlanInitial, setViewPlanInitial] = useState<PlanWithFeatures | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/billing/plans');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setPlans(data.plans ?? []);
      } catch {
        if (!cancelled) setPlans([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleViewPlan = (plan: PlanWithFeatures) => {
    setViewPlanInitial(plan);
    setViewPlanSlug(plan.slug);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <h2 className="text-sm font-semibold text-foreground">Plans & Features</h2>
        <p className="text-xs text-foreground-muted mt-0.5">
          Compare plans and their features
        </p>
      </div>

      {/* Pricing cards (try this design) */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <p className="text-xs font-medium text-foreground-muted mb-3">Plans</p>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-700" />
          </div>
        ) : (
          <PlansPricingCards
            plans={plans}
            currentPlanSlug={currentPlanSlug}
            subscriptionStatus={subscriptionStatus}
            hasStripeCustomer={!!account?.stripe_customer_id}
            onViewPlan={handleViewPlan}
          />
        )}
      </div>

      {/* Plans comparison table */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <p className="text-xs font-medium text-foreground-muted mb-3">Feature comparison</p>
        <PlansComparisonTable
          currentPlanSlug={currentPlanSlug}
          initialPlans={plans}
          onViewPlan={handleViewPlan}
        />
      </div>

      {viewPlanSlug && (
        <PlanPaymentModal
          planSlug={viewPlanSlug}
          isOpen
          onClose={() => {
            setViewPlanSlug(null);
            setViewPlanInitial(null);
          }}
          account={account ?? undefined}
          initialPlan={
            viewPlanInitial?.slug.toLowerCase() === viewPlanSlug.toLowerCase() ? viewPlanInitial : undefined
          }
          currentPlanSlug={currentPlanSlug}
          subscriptionStatus={subscriptionStatus}
          allPlans={plans}
        />
      )}
    </div>
  );
}
