import { Metadata } from 'next';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import Link from 'next/link';
import { DocumentTextIcon, CurrencyDollarIcon, BanknotesIcon, ChartBarIcon } from '@heroicons/react/24/outline';
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    title: 'State Checkbook | Minnesota Government | For the Love of Minnesota',
    description: 'Access government financial data including contracts and payments in Minnesota.',
    keywords: ['Minnesota checkbook', 'government contracts', 'state payments', 'Minnesota spending'],
    openGraph: {
      title: 'State Checkbook | Minnesota Government',
      description: 'Access government financial data including contracts and payments in Minnesota.',
      url: `${baseUrl}/gov/checkbook`,
      siteName: 'For the Love of Minnesota',
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `${baseUrl}/gov/checkbook`,
    },
  };
}

export default async function CheckbookPage() {
  return (
    <div className="max-w-4xl mx-auto px-[10px] py-3">
        {/* Breadcrumb Navigation */}
        <Breadcrumbs items={[
          { label: 'Government', href: '/gov' },
          { label: 'State Checkbook', href: null },
        ]} />

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <h1 className="text-sm font-semibold text-foreground">
            State Checkbook
          </h1>
          <p className="text-xs text-foreground-muted">
            Government financial data and transparency information
          </p>
        </div>

        {/* Dataset Cards */}
        <div className="space-y-2">
          <Link
            href="/gov/checkbook/contracts"
            className="group bg-surface rounded-md border border-border p-[10px] hover:bg-surface-muted transition-colors block"
          >
            <div className="flex items-start gap-2">
              <div className="p-[10px] bg-surface-muted rounded-md group-hover:bg-surface-accent transition-colors flex-shrink-0">
                <DocumentTextIcon className="w-4 h-4 text-foreground-muted" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold text-foreground transition-colors">
                    Contracts
                  </h2>
                  <svg className="w-3 h-3 text-foreground-muted transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-xs text-foreground-muted">
                  View all government contracts and payments. Filter by agency, payee, year, and amount. Data from Transparency Minnesota.
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/gov/checkbook/payroll"
            className="group bg-surface rounded-md border border-border p-[10px] hover:bg-surface-muted transition-colors block"
          >
            <div className="flex items-start gap-2">
              <div className="p-[10px] bg-surface-muted rounded-md group-hover:bg-surface-accent transition-colors flex-shrink-0">
                <CurrencyDollarIcon className="w-4 h-4 text-foreground-muted" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold text-foreground transition-colors">
                    Payroll
                  </h2>
                  <svg className="w-3 h-3 text-foreground-muted transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-xs text-foreground-muted">
                  Government payroll data and employee compensation information.
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/gov/checkbook/payments"
            className="group bg-surface rounded-md border border-border p-[10px] hover:bg-surface-muted transition-colors block"
          >
            <div className="flex items-start gap-2">
              <div className="p-[10px] bg-surface-muted rounded-md group-hover:bg-surface-accent transition-colors flex-shrink-0">
                <BanknotesIcon className="w-4 h-4 text-foreground-muted" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold text-foreground transition-colors">
                    Payments
                  </h2>
                  <svg className="w-3 h-3 text-foreground-muted transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-xs text-foreground-muted">
                  Government payment transactions and disbursements.
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/gov/checkbook/budget"
            className="group bg-surface rounded-md border border-border p-[10px] hover:bg-surface-muted transition-colors block"
          >
            <div className="flex items-start gap-2">
              <div className="p-[10px] bg-surface-muted rounded-md group-hover:bg-surface-accent transition-colors flex-shrink-0">
                <ChartBarIcon className="w-4 h-4 text-foreground-muted" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold text-foreground transition-colors">
                    Budget
                  </h2>
                  <svg className="w-3 h-3 text-foreground-muted transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-xs text-foreground-muted">
                  Government budget information and financial planning data.
                </p>
              </div>
            </div>
          </Link>
        </div>
    </div>
  );
}

