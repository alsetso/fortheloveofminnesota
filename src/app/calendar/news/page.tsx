import { Metadata } from 'next';
import Link from 'next/link';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import NewsPageClient from '@/features/news/components/NewsPageClient';

export const metadata: Metadata = {
  title: 'News | For the Love of Minnesota',
  description: 'Stay updated with the latest Minnesota news, breaking stories, local updates, and community events.',
  keywords: [
    'Minnesota news',
    'Minnesota breaking news',
    'Minnesota local news',
    'Twin Cities news',
    'Minnesota headlines',
    'Minnesota community news',
  ],
  openGraph: {
    title: 'News | For the Love of Minnesota',
    description: 'Stay updated with the latest Minnesota news, breaking stories, local updates, and community events.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/calendar/news`,
    siteName: 'For the Love of Minnesota',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'For the Love of Minnesota',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'News | For the Love of Minnesota',
    description: 'Stay updated with the latest Minnesota news, breaking stories, local updates, and community events.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/calendar/news`,
  },
};

export default function NewsPage() {
  return (
    <SimplePageLayout containerMaxWidth="7xl" backgroundColor="bg-[#f4f2ef]" contentPadding="px-[10px] py-3">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav className="mb-3" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-xs text-gray-600">
            <li>
              <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/calendar" className="hover:text-gray-900 transition-colors">Calendar</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 font-medium" aria-current="page">News</li>
          </ol>
        </nav>

        {/* Page Header */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px] mb-3">
          <h1 className="text-sm font-semibold text-gray-900">Minnesota News</h1>
          <p className="text-xs text-gray-600 mt-1">
            Stay updated with the latest Minnesota news, breaking stories, and community updates.
          </p>
        </div>

        {/* Main Content - 2 Column Layout */}
        <NewsPageClient />
      </div>
    </SimplePageLayout>
  );
}

