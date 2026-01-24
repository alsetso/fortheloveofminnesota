import { Metadata } from 'next';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import StandardPageClient from '@/components/layout/StandardPageClient';
import GovPageViewTracker from '../components/GovPageViewTracker';
import PeoplePageClient from './PeoplePageClient';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    title: 'People | Minnesota Government | For the Love of Minnesota',
    description: 'View all Minnesota government officials and elected representatives organized by party.',
    keywords: ['Minnesota government', 'Minnesota officials', 'elected officials', 'government directory'],
    openGraph: {
      title: 'People | Minnesota Government',
      description: 'View all Minnesota government officials and elected representatives organized by party.',
      url: `${baseUrl}/gov/people`,
      siteName: 'For the Love of Minnesota',
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `${baseUrl}/gov/people`,
    },
  };
}

export default async function PeoplePage() {
  return (
    <StandardPageClient>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <GovPageViewTracker />
        
        {/* Breadcrumb Navigation */}
        <Breadcrumbs items={[
          { label: 'Government', href: '/gov' },
          { label: 'People', href: null },
        ]} />

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <h1 className="text-sm font-semibold text-gray-900">
            People
          </h1>
          <p className="text-xs text-gray-600">
            All Minnesota government officials and elected representatives
          </p>
        </div>

        {/* Two-column layout with governor at top */}
        <PeoplePageClient />
      </div>
    </StandardPageClient>
  );
}
