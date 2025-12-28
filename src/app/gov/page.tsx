import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import Link from 'next/link';
import GovOrgChart from './GovOrgChart';
import GovPageClient from './GovPageClient';

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

export default function GovPage() {
  return (
    <SimplePageLayout contentPadding="px-[10px] py-3" footerVariant="light">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb Navigation */}
        <nav className="mb-3" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-xs text-gray-600">
            <li>
              <Link href="/" className="hover:text-gray-900 transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 font-medium" aria-current="page">Government</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <h1 className="text-sm font-semibold text-gray-900">
            Minnesota Government Leadership
          </h1>
          <p className="text-xs text-gray-600">
            Visual organizational chart of Minnesota government structure showing the three branches and their key departments.
          </p>
        </div>

        {/* Organizational Chart */}
        <GovOrgChart />
      </div>
      <GovPageClient />
    </SimplePageLayout>
  );
}
