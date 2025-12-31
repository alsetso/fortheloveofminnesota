import { Metadata } from 'next';
import Link from 'next/link';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import CalendarPageClient from '@/features/calendar/components/CalendarPageClient';
import PageViewTracker from '@/components/analytics/PageViewTracker';

export const metadata: Metadata = {
  title: 'Calendar | For the Love of Minnesota',
  description: 'View Minnesota community events on a daily calendar. Navigate through upcoming and past events.',
  keywords: [
    'Minnesota calendar',
    'Minnesota events calendar',
    'community calendar',
    'Twin Cities calendar',
    'Minnesota event schedule',
  ],
  openGraph: {
    title: 'Calendar | For the Love of Minnesota',
    description: 'View Minnesota community events on a daily calendar. Navigate through upcoming and past events.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/calendar`,
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
    title: 'Calendar | For the Love of Minnesota',
    description: 'View Minnesota community events on a daily calendar. Navigate through upcoming and past events.',
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
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/calendar`,
  },
};

export default function CalendarPage() {
  return (
    <SimplePageLayout containerMaxWidth="7xl" backgroundColor="bg-[#f4f2ef]" contentPadding="px-[10px] py-3">
      <PageViewTracker />
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav className="mb-3" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-xs text-gray-600">
            <li>
              <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 font-medium" aria-current="page">Calendar</li>
          </ol>
        </nav>

        {/* Page Header */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px] mb-3">
          <h1 className="text-sm font-semibold text-gray-900">Minnesota Calendar</h1>
          <p className="text-xs text-gray-600 mt-1">
            View community events on a daily calendar. Navigate forward and back up to 365 days.
          </p>
        </div>

        {/* Main Content */}
        <CalendarPageClient />
      </div>
    </SimplePageLayout>
  );
}

