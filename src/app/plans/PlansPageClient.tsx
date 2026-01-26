'use client';

import { useRouter } from 'next/navigation';
import PlansKanbanView from '@/components/billing/PlansKanbanView';
import { useAuthStateSafe } from '@/features/auth';
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

interface PlansPageClientProps {
  initialPlans?: PlanWithFeatures[];
}

export default function PlansPageClient({ initialPlans }: PlansPageClientProps) {
  const router = useRouter();
  const { account } = useAuthStateSafe();

  const handleViewDetails = (planSlug: string) => {
    // Always redirect to billing page with plan parameter - it will handle auth
    if (account) {
      router.push(`/billing?plan=${planSlug}`);
    } else {
      // For non-authenticated users, redirect to sign in with return URL
      // This preserves the plan parameter through the auth flow
      const returnUrl = `/billing?plan=${planSlug}`;
      router.push(`/?redirect=${encodeURIComponent(returnUrl)}&message=${encodeURIComponent('Please sign in to continue with your plan selection')}`);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Compare Plans</h1>
      <PlansKanbanView 
        onViewDetails={handleViewDetails} 
        currentPlanSlug={account?.plan}
        showCarousel={false}
        initialPlans={initialPlans}
      />
    </div>
  );
}
