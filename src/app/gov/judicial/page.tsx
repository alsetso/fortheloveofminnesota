import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import Link from 'next/link';
import JudicialChart from './JudicialChart';
import JudicialPageClient from './JudicialPageClient';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    title: 'Minnesota Judicial Branch | For the Love of Minnesota',
    description: 'Minnesota Judicial Branch structure including the Supreme Court, Court of Appeals, and District Courts.',
    keywords: ['Minnesota courts', 'Minnesota Supreme Court', 'Minnesota judicial branch', 'Minnesota court system'],
    openGraph: {
      title: 'Minnesota Judicial Branch | For the Love of Minnesota',
      description: 'Minnesota Judicial Branch structure including the Supreme Court, Court of Appeals, and District Courts.',
      url: `${baseUrl}/gov/judicial`,
      siteName: 'For the Love of Minnesota',
      images: [
        {
          url: '/logo.png',
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: 'Minnesota Judicial Branch',
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `${baseUrl}/gov/judicial`,
    },
  };
}

export default function JudicialPage() {
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
            <li className="text-gray-900 font-medium" aria-current="page">Judicial</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <h1 className="text-sm font-semibold text-gray-900">
            Minnesota Judicial Branch
          </h1>
          <p className="text-xs text-gray-600">
            The Minnesota Judicial Branch consists of the Supreme Court, Court of Appeals, and District Courts.
          </p>
        </div>

        {/* Judicial Chart */}
        <JudicialChart />
      </div>
      <JudicialPageClient />
    </SimplePageLayout>
  );
}

