import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import { getServerAuth } from '@/lib/authServer';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { getAccountIdForUser } from '@/lib/server/getAccountId';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import CommunityEditsClient from './CommunityEditsClient';

export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const url = `${baseUrl}/gov/community-edits`;
  const title = 'Community Edits | Minnesota Government';
  const description = 'View all community edits to the Minnesota government directory.';

  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'For the Love of Minnesota',
      type: 'website',
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function CommunityEditsPage() {
  const auth = await getServerAuth();
  let accountId: string | null = null;

  // Get account ID if user is authenticated (for "Mine" filter)
  if (auth) {
    try {
      const supabase = await createServerClientWithAuth();
      accountId = await getAccountIdForUser(auth as { id: string }, supabase);
    } catch (error) {
      // If account not found, continue without accountId (user can still view all edits)
      console.error('Error getting account ID:', error);
    }
  }

  return (
    <SimplePageLayout contentPadding="px-[10px] py-3" footerVariant="light">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb Navigation */}
        <Breadcrumbs items={[
          { label: 'Home', href: '/' },
          { label: 'Government', href: '/gov' },
          { label: 'Community Edits', href: null },
        ]} />

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <h1 className="text-sm font-semibold text-gray-900">
            Community Edits
          </h1>
          <p className="text-xs text-gray-600">
            All community edits to the Minnesota government directory.
          </p>
        </div>

        <CommunityEditsClient accountId={accountId} />
      </div>
    </SimplePageLayout>
  );
}

