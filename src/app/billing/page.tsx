import { Metadata } from 'next';
import SimpleNav from '@/components/layout/SimpleNav';
import UpgradeContent from '@/features/upgrade/components/UpgradeContent';

export const metadata: Metadata = {
  title: 'Billing & Plans - For the Love of Minnesota',
  description: 'Compare Hobby and Contributor plans. Upgrade to unlock advanced features including custom maps, all-time data, advanced analytics, and more.',
};

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SimpleNav />
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <UpgradeContent />
      </div>
    </div>
  );
}
