import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import Breadcrumbs from '@/components/civic/Breadcrumbs';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    title: 'Budget | State Checkbook | Minnesota Government | For the Love of Minnesota',
    description: 'View government budget information in Minnesota.',
    keywords: ['Minnesota budget', 'government budget', 'state budget', 'Minnesota spending'],
    openGraph: {
      title: 'Budget | State Checkbook | Minnesota Government',
      description: 'View government budget information in Minnesota.',
      url: `${baseUrl}/gov/checkbook/budget`,
      siteName: 'For the Love of Minnesota',
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `${baseUrl}/gov/checkbook/budget`,
    },
  };
}

export default async function BudgetPage() {
  return (
    <SimplePageLayout contentPadding="px-[10px] py-3" footerVariant="light">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb Navigation */}
        <Breadcrumbs items={[
          { label: 'Home', href: '/' },
          { label: 'Government', href: '/gov' },
          { label: 'State Checkbook', href: '/gov/checkbook' },
          { label: 'Budget', href: null },
        ]} />

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <h1 className="text-sm font-semibold text-gray-900">
            Budget
          </h1>
          <p className="text-xs text-gray-600">
            Government budget information in Minnesota
          </p>
        </div>

        {/* Coming Soon */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-1.5">
          <h2 className="text-xs font-semibold text-gray-900">
            Coming Soon
          </h2>
          <p className="text-xs text-gray-600">
            Budget information will be available here soon. This section will include government budget data, financial planning information, and related fiscal records.
          </p>
        </div>
      </div>
    </SimplePageLayout>
  );
}

