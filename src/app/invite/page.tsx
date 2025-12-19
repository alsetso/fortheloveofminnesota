import { Metadata } from 'next';
import InvitePageClient from './InvitePageClient';

export const metadata: Metadata = {
  title: 'Create Invitation | For the Love of Minnesota',
  description: 'Design beautiful digital postcards and invitations to share with friends and family. Create personalized Minnesota-themed invitations.',
  keywords: [
    'Minnesota invitations',
    'digital postcards',
    'Minnesota postcards',
    'invitation designer',
    'Minnesota events',
    'digital invitations',
  ],
  openGraph: {
    title: 'Create Invitation | For the Love of Minnesota',
    description: 'Design beautiful digital postcards and invitations to share with friends and family.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/invite`,
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
    title: 'Create Invitation | For the Love of Minnesota',
    description: 'Design beautiful digital postcards and invitations to share with friends and family.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/invite`,
  },
};

export default function InvitePage() {
  return <InvitePageClient />;
}

