import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import GovTablesClient from './GovTablesClient';
import GovPageViewTracker from './components/GovPageViewTracker';
import CommunityBanner from '@/features/civic/components/CommunityBanner';
import RecentEditsFeed from '@/features/civic/components/RecentEditsFeed';
import { GovTabProvider } from './contexts/GovTabContext';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    title: 'Minnesota Government Data | For the Love of Minnesota',
    description: 'View all Minnesota government organizations, people, and roles in organized tables.',
    keywords: ['Minnesota government', 'Minnesota leadership', 'Minnesota officials', 'Minnesota elected officials', 'government data'],
    openGraph: {
      title: 'Minnesota Government Data | For the Love of Minnesota',
      description: 'View all Minnesota government organizations, people, and roles in organized tables.',
      url: `${baseUrl}/gov`,
      siteName: 'For the Love of Minnesota',
      images: [
        {
          url: '/logo.png',
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: 'Minnesota Government Data',
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `${baseUrl}/gov`,
    },
  };
}

export default async function GovPage() {
  return (
    <SimplePageLayout containerMaxWidth="full" contentPadding="px-[10px] py-3" hideNav={false} hideFooter={false}>
      <GovPageViewTracker />
      <GovTabProvider>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Left Column: Tabs */}
          <div className="lg:col-span-3">
            <div className="lg:sticky lg:top-16 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
              {/* Header */}
              <div className="mb-3 space-y-1.5">
                <h1 className="text-sm font-semibold text-gray-900">
                  Minnesota Government Directory
                </h1>
                <p className="text-xs text-gray-600">
                  A community-maintained directory of Minnesota state government organizations, officials, and their roles.
                </p>
              </div>

              {/* Community Banner */}
              <CommunityBanner />

              {/* Tabs */}
              <GovTablesClient showTabsOnly={true} />
            </div>
          </div>

          {/* Middle Column: Tables */}
          <div className="lg:col-span-6">
            <GovTablesClient showTablesOnly={true} />
          </div>

          {/* Right Column: Recent Edits Feed */}
          <div className="lg:col-span-3">
            <div className="lg:sticky lg:top-16 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
              <RecentEditsFeed limit={20} />
            </div>
          </div>
        </div>
      </GovTabProvider>
    </SimplePageLayout>
  );
}
