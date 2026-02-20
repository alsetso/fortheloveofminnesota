import { Metadata } from 'next';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import GovTablesClient from '../GovTablesClient';
import { GovTabProvider } from '../contexts/GovTabContext';
import GovPageViewTracker from '../components/GovPageViewTracker';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    title: 'Roles | Minnesota Government | For the Love of Minnesota',
    description: 'View all roles linking people to organizations in Minnesota government.',
    keywords: ['Minnesota government', 'government roles', 'government positions', 'government directory'],
    openGraph: {
      title: 'Roles | Minnesota Government',
      description: 'View all roles linking people to organizations in Minnesota government.',
      url: `${baseUrl}/gov/roles`,
      siteName: 'For the Love of Minnesota',
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `${baseUrl}/gov/roles`,
    },
  };
}

export default async function RolesPage() {
  return (
    <div className="max-w-7xl mx-auto px-[10px] py-3">
      <GovPageViewTracker />

      <Breadcrumbs items={[
        { label: 'Government', href: '/gov' },
        { label: 'Roles', href: null },
      ]} />

      <div className="mb-3 space-y-1.5">
        <h1 className="text-sm font-semibold text-gray-900">Roles</h1>
        <p className="text-xs text-gray-600">
          All roles linking people to organizations in Minnesota government
        </p>
      </div>

      <GovTabProvider initialTab="roles">
        <GovTablesClient showTablesOnly={true} />
      </GovTabProvider>
    </div>
  );
}
