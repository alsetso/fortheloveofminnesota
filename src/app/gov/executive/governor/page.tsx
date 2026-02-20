import { Metadata } from 'next';
import { getCivicPersonBySlug, getGovernorSubOrgs } from '@/features/civic/services/civicService';
import GovernorPageClient from './GovernorPageClient';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  return {
    title: 'Governor of Minnesota | Minnesota Government',
    description: 'Office of the Governor of Minnesota — Tim Walz, state departments, agencies, and boards.',
    openGraph: {
      title: 'Governor of Minnesota',
      url: `${baseUrl}/gov/executive/governor`,
    },
    alternates: { canonical: `${baseUrl}/gov/executive/governor` },
  };
}

export default async function GovernorPage() {
  const [personData, subOrgs] = await Promise.all([
    getCivicPersonBySlug('tim-walz'),
    getGovernorSubOrgs(),
  ]);

  return (
    <GovernorPageClient
      person={personData?.person ?? null}
      roleTitle={personData?.roles[0]?.title ?? 'Governor'}
      departments={subOrgs.departments}
      agencies={subOrgs.agencies}
      boards={subOrgs.boards}
    />
  );
}
