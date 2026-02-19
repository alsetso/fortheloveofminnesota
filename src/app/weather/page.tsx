import { Metadata } from 'next';
import WeatherPageClient from './WeatherPageClient';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';

  return {
    title: 'Minnesota Weather | For the Love of Minnesota',
    description:
      'Live weather conditions, forecasts, and alerts for cities across Minnesota.',
    keywords: [
      'Minnesota weather',
      'MN forecast',
      'Minnesota weather alerts',
      'Minneapolis weather',
      'Duluth weather',
      'Rochester weather',
    ],
    openGraph: {
      title: 'Minnesota Weather | For the Love of Minnesota',
      description:
        'Live weather conditions, forecasts, and alerts for cities across Minnesota.',
      url: `${baseUrl}/weather`,
      siteName: 'For the Love of Minnesota',
      images: [
        {
          url: '/seo_share_public_image.png',
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: 'Minnesota Weather',
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `${baseUrl}/weather`,
    },
  };
}

export default function WeatherPage() {
  return <WeatherPageClient />;
}
