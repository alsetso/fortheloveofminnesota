import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import Link from 'next/link';
import ExecutiveChart from './ExecutiveChart';
import ExecutivePageClient from './ExecutivePageClient';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    title: 'Minnesota Executive Branch | For the Love of Minnesota',
    description: 'Minnesota Executive Branch structure including the Governor, Lieutenant Governor, and state departments.',
    keywords: ['Minnesota governor', 'Tim Walz', 'Minnesota executive branch', 'Minnesota state departments'],
    openGraph: {
      title: 'Minnesota Executive Branch | For the Love of Minnesota',
      description: 'Minnesota Executive Branch structure including the Governor, Lieutenant Governor, and state departments.',
      url: `${baseUrl}/gov/executive`,
      siteName: 'For the Love of Minnesota',
      images: [
        {
          url: '/logo.png',
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: 'Minnesota Executive Branch',
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `${baseUrl}/gov/executive`,
    },
  };
}

export default function ExecutivePage() {
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
            <li className="text-gray-900 font-medium" aria-current="page">Executive</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <h1 className="text-sm font-semibold text-gray-900">
            Minnesota Executive Branch
          </h1>
          <p className="text-xs text-gray-600">
            The Executive Branch is headed by the Governor and includes constitutional officers and state departments.
          </p>
        </div>

        {/* Executive Chart */}
        <ExecutiveChart />
      </div>
      <ExecutivePageClient />
    </SimplePageLayout>
  );
}

