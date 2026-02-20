import { Metadata } from 'next';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
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
    <div className="max-w-7xl mx-auto px-[10px] py-3">
      <GovPageViewTracker />

      <Breadcrumbs items={[
        { label: 'Government', href: '/gov' },
        { label: 'People', href: null },
      ]} />

      <div className="mb-3 space-y-1.5">
        <h1 className="text-sm font-semibold text-foreground">People</h1>
        <p className="text-xs text-foreground-muted">
          All Minnesota government officials and elected representatives
        </p>
      </div>

      <PeoplePageClient />
    </div>
  );
}
