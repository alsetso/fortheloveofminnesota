import { Metadata } from 'next';
import PricingPageClient from './PricingPageClient';

export const metadata: Metadata = {
  title: 'Pricing | For the Love of Minnesota',
  description: 'Simple, transparent pricing. Public (free) and Contributor plans.',
  openGraph: {
    title: 'Pricing | For the Love of Minnesota',
    description: 'Simple, transparent pricing. Public (free) and Contributor plans.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/pricing`,
    siteName: 'For the Love of Minnesota',
  },
  robots: { index: true, follow: true },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/pricing`,
  },
};

export default function PricingPage() {
  return <PricingPageClient />;
}
