import { Metadata } from 'next';
import GovPageClient from './GovPageClient';

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
  return <GovPageClient />;
}
