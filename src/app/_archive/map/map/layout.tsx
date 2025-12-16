import type { Metadata } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://mnuda.com';

export const metadata: Metadata = {
  title: 'Minnesota Real Estate Map | MNUDA - Development & Acquisition Opportunities',
  description: 'Interactive map of Minnesota showing real estate development opportunities, property acquisitions, and investment deals. Connect with real estate professionals across the state.',
  keywords: 'Minnesota real estate map, property map Minnesota, real estate development Minnesota, property acquisition map, investment opportunities Minnesota, Minnesota property listings',
  alternates: {
    canonical: `${baseUrl}/map`,
  },
  openGraph: {
    title: 'Minnesota Real Estate Map | MNUDA',
    description: 'Interactive map of Minnesota showing real estate development opportunities, property acquisitions, and investment deals.',
    url: `${baseUrl}/map`,
    siteName: 'MNUDA',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'MNUDA - Minnesota Real Estate Map',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Minnesota Real Estate Map | MNUDA',
    description: 'Interactive map of Minnesota showing real estate development opportunities and property acquisitions.',
    images: ['/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function MapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
