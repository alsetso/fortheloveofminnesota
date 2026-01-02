import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import PayrollTable from './PayrollTable';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    title: 'Payroll | State Checkbook | Minnesota Government | For the Love of Minnesota',
    description: 'View government payroll data in Minnesota.',
    keywords: ['Minnesota payroll', 'government payroll', 'state employee salaries', 'Minnesota spending'],
    openGraph: {
      title: 'Payroll | State Checkbook | Minnesota Government',
      description: 'View government payroll data in Minnesota.',
      url: `${baseUrl}/gov/checkbook/payroll`,
      siteName: 'For the Love of Minnesota',
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `${baseUrl}/gov/checkbook/payroll`,
    },
  };
}

export default async function PayrollPage() {
  return (
    <SimplePageLayout contentPadding="px-[10px] py-3">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb Navigation */}
        <Breadcrumbs items={[
          { label: 'Home', href: '/' },
          { label: 'Government', href: '/gov' },
          { label: 'State Checkbook', href: '/gov/checkbook' },
          { label: 'Payroll', href: null },
        ]} />

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-sm font-semibold text-gray-900">
                Payroll
              </h1>
              <p className="text-xs text-gray-600">
                Government employee payroll and compensation data in Minnesota
              </p>
            </div>
          </div>
        </div>

        {/* Payroll Table */}
        <PayrollTable />
      </div>
    </SimplePageLayout>
  );
}

