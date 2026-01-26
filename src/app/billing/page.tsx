import { Metadata } from 'next';
import BillingPageClient from './BillingPageClient';
import { getPlansWithFeatures, getPlanBySlug } from '@/lib/billing/server';

export const metadata: Metadata = {
  title: 'Billing & Plans - For the Love of Minnesota',
  description: 'Compare Hobby and Contributor plans. Upgrade to unlock advanced features including custom maps, all-time data, advanced analytics, and more.',
};

interface BillingPageProps {
  searchParams: Promise<{ plan?: string }> | { plan?: string };
}

export default async function BillingPage(props: BillingPageProps) {
  // Handle both Promise and direct searchParams (Next.js 13+ vs 14+)
  const searchParams = await (props.searchParams instanceof Promise ? props.searchParams : Promise.resolve(props.searchParams));
  
  // Fetch plans on the server for faster initial load
  const plans = await getPlansWithFeatures();
  
  // Pre-fetch the selected plan if plan parameter exists
  // This allows the modal to open instantly with the correct plan data
  // SECURITY: Validate plan exists and is active before showing modal
  const planSlug = typeof searchParams.plan === 'string' ? searchParams.plan : null;
  let selectedPlan = null;
  
  if (planSlug) {
    // Validate plan exists and is active (security check)
    const plan = await getPlanBySlug(planSlug);
    if (plan && plan.is_active) {
      selectedPlan = plan;
    }
    // If plan doesn't exist or is inactive, planSlug will be set but selectedPlan will be null
    // The client component will handle this gracefully
  }

  return (
    <BillingPageClient 
      initialPlans={plans}
      initialSelectedPlan={selectedPlan}
      initialPlanSlug={selectedPlan ? planSlug : null} // Only set if plan is valid
    />
  );
}
