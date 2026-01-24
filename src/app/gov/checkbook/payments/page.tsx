import { Metadata } from 'next';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import CheckbookPageWrapper from '../CheckbookPageWrapper';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    title: 'Payments | State Checkbook | Minnesota Government | For the Love of Minnesota',
    description: 'View government payment transactions in Minnesota.',
    keywords: ['Minnesota payments', 'government payments', 'state transactions', 'Minnesota spending'],
    openGraph: {
      title: 'Payments | State Checkbook | Minnesota Government',
      description: 'View government payment transactions in Minnesota.',
      url: `${baseUrl}/gov/checkbook/payments`,
      siteName: 'For the Love of Minnesota',
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `${baseUrl}/gov/checkbook/payments`,
    },
  };
}

export default async function PaymentsPage() {
  return (
    <CheckbookPageWrapper>
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb Navigation */}
        <Breadcrumbs items={[
          { label: 'Minnesota', href: '/' },
          { label: 'Government', href: '/gov' },
          { label: 'State Checkbook', href: '/gov/checkbook' },
          { label: 'Payments', href: null },
        ]} />

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <h1 className="text-sm font-semibold text-gray-900">
            Payments
          </h1>
          <p className="text-xs text-gray-600">
            Government payment transactions in Minnesota
          </p>
        </div>

        {/* Coming Soon */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-1.5">
          <h2 className="text-xs font-semibold text-gray-900">
            Coming Soon
          </h2>
          <p className="text-xs text-gray-600">
            Payment transaction data will be available here soon. This section will include government payment disbursements, transaction details, and related financial records.
          </p>
        </div>
      </div>
    </CheckbookPageWrapper>
  );
}

