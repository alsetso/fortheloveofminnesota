'use client';

import type { PlanWithFeatures } from '@/lib/billing/types';

interface PlansPricingCardsProps {
  plans: PlanWithFeatures[];
  currentPlanSlug?: string | null;
  subscriptionStatus?: string | null;
  hasStripeCustomer?: boolean;
  onViewPlan: (plan: PlanWithFeatures) => void;
}

function getButtonLabel(
  plan: PlanWithFeatures,
  currentPlanSlug: string | null | undefined,
  subscriptionStatus: string | null | undefined,
  plans: PlanWithFeatures[],
  hasStripeCustomer?: boolean,
): string {
  const hasActiveSub = subscriptionStatus && ['active', 'trialing'].includes(subscriptionStatus);

  if (hasActiveSub && currentPlanSlug) {
    const isCurrent = plan.slug.toLowerCase() === currentPlanSlug.toLowerCase();
    if (isCurrent) return 'Current Plan';

    const currentPlan = plans.find((p) => p.slug.toLowerCase() === currentPlanSlug.toLowerCase());
    if (!currentPlan) return 'Subscribe';

    return plan.display_order > currentPlan.display_order ? 'Upgrade' : 'Downgrade';
  }

  if (hasStripeCustomer) return 'Subscribe';
  return 'View Plan';
}

export default function PlansPricingCards({ plans, currentPlanSlug, subscriptionStatus, hasStripeCustomer, onViewPlan }: PlansPricingCardsProps) {
  if (plans.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => {
        const isActive = currentPlanSlug && plan.slug.toLowerCase() === currentPlanSlug.toLowerCase();
        const priceDisplay =
          plan.price_monthly_cents === 0 ? 'Free' : `$${(plan.price_monthly_cents / 100).toFixed(0)}/mo`;
        const yearlyDisplay =
          plan.price_yearly_cents != null && plan.price_yearly_cents > 0
            ? `$${(plan.price_yearly_cents / 100 / 12).toFixed(1)}/mo billed yearly`
            : null;
        const label = getButtonLabel(plan, currentPlanSlug, subscriptionStatus, plans, hasStripeCustomer);
        const isCurrent = label === 'Current Plan';

        return (
          <div
            key={plan.id}
            className={`rounded-md border p-[10px] transition-colors ${
              isActive
                ? 'border-green-500/50 bg-green-500/5 dark:bg-green-500/10'
                : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-surface dark:hover:bg-surface-muted'
            }`}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground">{plan.name}</h3>
                {isActive && (
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-green-500 text-white dark:bg-green-600">
                    Active
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                <div className="text-lg font-bold text-gray-900 dark:text-foreground">{priceDisplay}</div>
                {yearlyDisplay && (
                  <div className="text-[10px] text-gray-500 dark:text-foreground-muted">{yearlyDisplay}</div>
                )}
              </div>
              {plan.description && (
                <p className="text-xs text-gray-600 line-clamp-2 dark:text-foreground-muted">{plan.description}</p>
              )}
              <button
                type="button"
                onClick={() => !isCurrent && onViewPlan(plan)}
                disabled={isCurrent}
                className={`mt-1 inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isCurrent
                    ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-default dark:border-white/5 dark:bg-surface dark:text-foreground-muted'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-surface-muted dark:text-foreground dark:hover:bg-surface-accent'
                }`}
              >
                {label}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
