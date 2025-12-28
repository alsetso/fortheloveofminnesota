import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import Link from 'next/link';
import LegislativeChart from './LegislativeChart';
import LegislativePageClient from './LegislativePageClient';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    title: 'Minnesota Legislative Branch | For the Love of Minnesota',
    description: 'Minnesota Legislative Branch structure including the Senate and House of Representatives.',
    keywords: ['Minnesota legislature', 'Minnesota Senate', 'Minnesota House of Representatives', 'Minnesota legislative branch'],
    openGraph: {
      title: 'Minnesota Legislative Branch | For the Love of Minnesota',
      description: 'Minnesota Legislative Branch structure including the Senate and House of Representatives.',
      url: `${baseUrl}/gov/legislative`,
      siteName: 'For the Love of Minnesota',
      images: [
        {
          url: '/logo.png',
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: 'Minnesota Legislative Branch',
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `${baseUrl}/gov/legislative`,
    },
  };
}

export default function LegislativePage() {
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
            <li>
              <Link href="/gov" className="hover:text-gray-900 transition-colors">
                Government
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 font-medium" aria-current="page">Legislative</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <h1 className="text-sm font-semibold text-gray-900">
            Minnesota Legislative Branch
          </h1>
          <p className="text-xs text-gray-600">
            The Minnesota Legislature is a bicameral body consisting of the Senate and House of Representatives.
          </p>
        </div>

        {/* Legislative Chart */}
        <LegislativeChart />
      </div>
      <LegislativePageClient />
    </SimplePageLayout>
  );
}

