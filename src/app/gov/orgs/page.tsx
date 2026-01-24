import { Metadata } from 'next';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import StandardPageClient from '@/components/layout/StandardPageClient';
import GovTablesClient from '../GovTablesClient';
import { GovTabProvider } from '../contexts/GovTabContext';
import GovPageViewTracker from '../components/GovPageViewTracker';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    title: 'Organizations | Minnesota Government | For the Love of Minnesota',
    description: 'View all Minnesota government organizations in an organized table.',
    keywords: ['Minnesota government', 'Minnesota organizations', 'government directory'],
    openGraph: {
      title: 'Organizations | Minnesota Government',
      description: 'View all Minnesota government organizations in an organized table.',
      url: `${baseUrl}/gov/orgs`,
      siteName: 'For the Love of Minnesota',
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `${baseUrl}/gov/orgs`,
    },
  };
}

export default async function OrgsPage() {
  return (
    <StandardPageClient>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <GovPageViewTracker />
        
        {/* Breadcrumb Navigation */}
        <Breadcrumbs items={[
          { label: 'Government', href: '/gov' },
          { label: 'Organizations', href: null },
        ]} />

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <h1 className="text-sm font-semibold text-gray-900">
            Organizations
          </h1>
          <p className="text-xs text-gray-600">
            All Minnesota government organizations
          </p>
        </div>

        {/* Table */}
        <GovTabProvider initialTab="orgs">
          <GovTablesClient showTablesOnly={true} />
        </GovTabProvider>
      </div>
    </StandardPageClient>
  );
}
