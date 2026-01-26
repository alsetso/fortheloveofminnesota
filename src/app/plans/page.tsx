import { Metadata } from 'next';
import StandardPageClient from '@/components/layout/StandardPageClient';
import PlansPageClient from './PlansPageClient';

export const metadata: Metadata = {
  title: 'Pricing Plans - For the Love of Minnesota',
  description: 'Compare pricing plans and features. Choose the plan that fits your needs with transparent pricing and feature limits.',
};

export default function PlansPage() {
  return (
    <StandardPageClient>
      <PlansPageClient />
    </StandardPageClient>
  );
}
