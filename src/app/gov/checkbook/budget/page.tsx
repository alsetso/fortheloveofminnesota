import { Metadata } from 'next';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import BudgetSummary from './BudgetSummary';
import BudgetTable from './BudgetTable';
import StandardPageClient from '@/components/layout/StandardPageClient';

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
    <StandardPageClient contentClassName="h-full overflow-y-auto px-[10px] py-3">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb Navigation */}
        <Breadcrumbs items={[
          { label: 'Government', href: '/gov' },
          { label: 'State Checkbook', href: '/gov/checkbook' },
          { label: 'Budget', href: null },
        ]} />

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-sm font-semibold text-gray-900">
                Budget
              </h1>
              <p className="text-xs text-gray-600">
                Government budget allocations and spending in Minnesota
              </p>
            </div>
          </div>
        </div>

        {/* Budget Summary */}
        <div className="mb-3">
          <BudgetSummary />
        </div>

        {/* Budget Table */}
        <BudgetTable />
      </div>
    </StandardPageClient>
  );
}

