import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import GovTablesClient from '../../GovTablesClient';
import { GovTabProvider } from '../../contexts/GovTabContext';
import GovPageViewTracker from '../../components/GovPageViewTracker';
import { getServerAuth } from '@/lib/authServer';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    title: 'People Admin | Minnesota Government | For the Love of Minnesota',
    description: 'Admin interface for managing Minnesota government officials and elected representatives.',
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function PeopleAdminPage() {
  const auth = await getServerAuth();
  
  if (!auth || auth.role !== 'admin') {
    redirect('/gov/people');
  }

  return (
    <div className="max-w-7xl mx-auto px-[10px] py-3">
      <GovPageViewTracker />

      <Breadcrumbs items={[
        { label: 'Government', href: '/gov' },
        { label: 'People', href: '/gov/people' },
        { label: 'Admin', href: null },
      ]} />

      <div className="mb-3 space-y-1.5">
        <h1 className="text-sm font-semibold text-gray-900">People Admin</h1>
        <p className="text-xs text-gray-600">
          Admin interface for managing Minnesota government officials and elected representatives
        </p>
      </div>

      <GovTabProvider initialTab="people">
        <GovTablesClient showTablesOnly={true} />
      </GovTabProvider>
    </div>
  );
}
