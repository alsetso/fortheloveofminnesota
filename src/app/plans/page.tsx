import { Metadata } from 'next';
import StandardPageClient from '@/components/layout/StandardPageClient';
import PlansPageClient from './PlansPageClient';
import { getPlansWithFeatures } from '@/lib/billing/server';

export const metadata: Metadata = {
  title: 'Pricing Plans - For the Love of Minnesota',
  description: 'Compare pricing plans and features. Choose the plan that fits your needs with transparent pricing and feature limits.',
};

export default async function PlansPage() {
  // Fetch plans on the server for faster initial load
  const plans = await getPlansWithFeatures();

  return (
    <StandardPageClient>
      <PlansPageClient initialPlans={plans} />
    </StandardPageClient>
  );
}
