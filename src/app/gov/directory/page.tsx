import { Metadata } from 'next';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import GovPageViewTracker from '../components/GovPageViewTracker';
import DirectoryPageClient from './DirectoryPageClient';
import { getDirectoryOverview } from '@/features/civic/services/civicService';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';

  return {
    title: 'Directory | Minnesota Government | For the Love of Minnesota',
    description: 'Browse Minnesota government organizations, people, and roles.',
    keywords: ['Minnesota government', 'government directory', 'organizations', 'officials', 'roles'],
    openGraph: {
      title: 'Directory | Minnesota Government',
      description: 'Browse Minnesota government organizations, people, and roles.',
      url: `${baseUrl}/gov/directory`,
      siteName: 'For the Love of Minnesota',
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `${baseUrl}/gov/directory`,
    },
  };
}

export default async function DirectoryPage() {
  const overview = await getDirectoryOverview();

  return (
    <div className="max-w-7xl mx-auto px-[10px] py-3">
      <GovPageViewTracker />

      <Breadcrumbs items={[
        { label: 'Government', href: '/gov' },
        { label: 'Directory', href: null },
      ]} />

      <DirectoryPageClient overview={overview} />
    </div>
  );
}
