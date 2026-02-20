import { Metadata } from 'next';
import { getLegislativeMembers } from '@/features/civic/services/civicService';
import LegislativePageClient from './LegislativePageClient';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  return {
    title: 'Minnesota Legislature | For the Love of Minnesota',
    description: 'Minnesota State Senate (67 members) and House of Representatives (134 members).',
    openGraph: {
      title: 'Minnesota Legislature',
      url: `${baseUrl}/gov/legislative`,
    },
    alternates: { canonical: `${baseUrl}/gov/legislative` },
  };
}

export default async function LegislativePage() {
  const [senators, houseMembers] = await Promise.all([
    getLegislativeMembers('mn-senate'),
    getLegislativeMembers('mn-house'),
  ]);

  return (
    <LegislativePageClient senators={senators} houseMembers={houseMembers} />
  );
}
