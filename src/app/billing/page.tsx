import { Metadata } from 'next';
import BillingPageClient from './BillingPageClient';

export const metadata: Metadata = {
  title: 'Billing & Plans - For the Love of Minnesota',
  description: 'Compare Hobby and Contributor plans. Upgrade to unlock advanced features including custom maps, all-time data, advanced analytics, and more.',
};

export default function BillingPage() {
  return <BillingPageClient />;
}
