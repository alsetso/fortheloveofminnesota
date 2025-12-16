import { Metadata } from 'next';
import SimplePageLayout from '@/components/SimplePageLayout';
import BusinessPageClient from './BusinessPageClient';

export const metadata: Metadata = {
  title: 'For Pages | Minnesota Pages Directory | MNUDA',
  description: 'List your page in the official Minnesota Pages Directory. Increase visibility, build credibility, and connect with customers across Minnesota.',
  openGraph: {
    title: 'For Pages | Minnesota Pages Directory | MNUDA',
    description: 'List your page in the official Minnesota Pages Directory. Increase visibility, build credibility, and connect with customers across Minnesota.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://mnuda.com'}/business`,
    siteName: 'MNUDA',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'Minnesota Business Directory',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function BusinessLandingPage() {
  return (
    <SimplePageLayout backgroundColor="bg-[#f4f2ef]" contentPadding="px-0" footerVariant="light" hideFooter>
      <BusinessPageClient />
    </SimplePageLayout>
  );
}

