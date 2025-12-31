import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import { getServerAuth } from '@/lib/authServer';
import GovAdminClient from './GovAdminClient';

export const revalidate = 0; // Always fresh for admin

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Civic Admin | For the Love of Minnesota',
    description: 'Admin interface for managing civic organizations, people, and roles.',
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function GovAdminPage() {
  const auth = await getServerAuth();
  
  if (!auth) {
    redirect('/?modal=account&tab=settings&redirect=/gov/admin&message=Please sign in to access admin panel');
  }
  
  if (auth.role !== 'admin') {
    redirect('/?message=Access denied. Admin privileges required.');
  }

  return (
    <SimplePageLayout contentPadding="px-[10px] py-3" footerVariant="light">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb Navigation */}
        <Breadcrumbs items={[
          { label: 'Home', href: '/' },
          { label: 'Government', href: '/gov' },
          { label: 'Admin', href: null },
        ]} />

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <h1 className="text-sm font-semibold text-gray-900">
            Civic Data Admin
          </h1>
          <p className="text-xs text-gray-600">
            Manage organizations, people, and roles. All fields are editable inline.
          </p>
        </div>

        {/* Admin Interface */}
        <GovAdminClient />
      </div>
    </SimplePageLayout>
  );
}

