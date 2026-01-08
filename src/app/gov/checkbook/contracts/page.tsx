import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import CheckbookTable from './CheckbookTable';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    title: 'Contracts | State Checkbook | Minnesota Government | For the Love of Minnesota',
    description: 'View all government contracts and payments in Minnesota.',
    keywords: ['Minnesota checkbook', 'government contracts', 'state payments', 'Minnesota spending'],
    openGraph: {
      title: 'Contracts | State Checkbook | Minnesota Government',
      description: 'View all government contracts and payments in Minnesota.',
      url: `${baseUrl}/gov/checkbook/contracts`,
      siteName: 'For the Love of Minnesota',
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `${baseUrl}/gov/checkbook/contracts`,
    },
  };
}

export default async function ContractsPage() {
  return (
    <SimplePageLayout contentPadding="px-[10px] py-3">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb Navigation */}
        <Breadcrumbs items={[
          { label: 'Minnesota', href: '/' },
          { label: 'Government', href: '/gov' },
          { label: 'State Checkbook', href: '/gov/checkbook' },
          { label: 'Contracts', href: null },
        ]} />

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-sm font-semibold text-gray-900">
                Contracts
              </h1>
              <p className="text-xs text-gray-600">
                All government contracts and payments in Minnesota
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">
                Data Uploaded Dec 30 2:52
              </p>
              <a
                href="https://mn.gov/mmb/transparency-mn/contracts-grants.jsp"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Source →
              </a>
            </div>
          </div>
        </div>

        {/* Checkbook Table */}
        <CheckbookTable />
      </div>
    </SimplePageLayout>
  );
}

