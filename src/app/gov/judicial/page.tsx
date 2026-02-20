import { Metadata } from 'next';
import { getJudicialData } from '@/features/civic/services/civicService';
import JudicialPageClient from './JudicialPageClient';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  return {
    title: 'Judicial Branch | Minnesota Government',
    description: 'Minnesota judicial branch — Supreme Court, Court of Appeals, District Courts, and the 10 judicial districts.',
    openGraph: {
      title: 'Judicial Branch | Minnesota Government',
      url: `${baseUrl}/gov/judicial`,
    },
    alternates: { canonical: `${baseUrl}/gov/judicial` },
  };
}

export default async function JudicialPage() {
  const { courts, leaders, districts } = await getJudicialData();
  return <JudicialPageClient courts={courts} leaders={leaders} districts={districts} />;
}
