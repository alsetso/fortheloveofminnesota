import { Metadata } from 'next';
import { getExecutiveOfficers, getGovernorSubOrgs } from '@/features/civic/services/civicService';
import ExecutivePageClient from './ExecutivePageClient';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  return {
    title: 'Executive Branch | Minnesota Government',
    description: 'Minnesota executive branch — Governor, Lieutenant Governor, Attorney General, Secretary of State, State Auditor, and state departments.',
    openGraph: {
      title: 'Executive Branch | Minnesota Government',
      url: `${baseUrl}/gov/executive`,
    },
    alternates: { canonical: `${baseUrl}/gov/executive` },
  };
}

export default async function ExecutivePage() {
  const [officers, subOrgs] = await Promise.all([
    getExecutiveOfficers(),
    getGovernorSubOrgs(),
  ]);

  return (
    <ExecutivePageClient
      officers={officers}
      departments={subOrgs.departments}
      agencies={subOrgs.agencies}
      boards={subOrgs.boards}
    />
  );
}
