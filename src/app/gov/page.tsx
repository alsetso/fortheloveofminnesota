import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import GovOrgChart from './GovOrgChart';
import GovContent from './GovContent';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import GovPageViewTracker from './components/GovPageViewTracker';
import { getCivicOrgTree } from '@/features/civic/services/civicService';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    title: 'Minnesota Government Leadership | For the Love of Minnesota',
    description: 'Visual tree of Minnesota government leadership from Governor Tim Walz down through executive, legislative, and judicial branches.',
    keywords: ['Minnesota government', 'Minnesota leadership', 'Tim Walz', 'Minnesota officials', 'Minnesota elected officials'],
    openGraph: {
      title: 'Minnesota Government Leadership | For the Love of Minnesota',
      description: 'Visual tree of Minnesota government leadership from Governor Tim Walz down through executive, legislative, and judicial branches.',
      url: `${baseUrl}/gov`,
      siteName: 'For the Love of Minnesota',
      images: [
        {
          url: '/logo.png',
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: 'Minnesota Government Leadership',
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
  const branches = await getCivicOrgTree();

  return (
    <SimplePageLayout contentPadding="px-[10px] py-3" footerVariant="light">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb Navigation */}
        <Breadcrumbs items={[
          { label: 'Home', href: '/' },
          { label: 'Government', href: null },
        ]} />

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <h1 className="text-sm font-semibold text-gray-900">
            Minnesota Government Explained
          </h1>
          <p className="text-xs text-gray-600">
            How power works, who decides, and where participation matters.
          </p>
        </div>

        {/* Organizational Chart */}
        <GovOrgChart branches={branches} />

        {/* Content Sections */}
        <GovContent />
      </div>
      <GovPageViewTracker />
    </SimplePageLayout>
  );
}
