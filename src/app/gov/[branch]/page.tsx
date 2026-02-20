import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getExecutiveOfficers,
  getGovernorSubAgencies,
  getLegislativeMembers,
  getJudicialData,
} from '@/features/civic/services/civicService';
import ExecutivePageClient from '../executive/ExecutivePageClient';
import LegislativePageClient from '../legislative/LegislativePageClient';
import JudicialPageClient from '../judicial/JudicialPageClient';

export const revalidate = 3600;

const BRANCHES = ['executive', 'legislative', 'judicial'] as const;
type BranchSlug = (typeof BRANCHES)[number];

type Props = { params: Promise<{ branch: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { branch } = await params;
  if (!BRANCHES.includes(branch as BranchSlug)) return { title: 'Not Found' };
  const branchLabel =
    branch === 'executive'
      ? 'Executive Branch'
      : branch === 'legislative'
        ? 'Minnesota Legislature'
        : 'Judicial Branch';
  const description =
    branch === 'executive'
      ? 'Minnesota executive branch — Governor, Lieutenant Governor, Attorney General, Secretary of State, State Auditor, and state departments.'
      : branch === 'legislative'
        ? 'Minnesota State Senate (67 members) and House of Representatives (134 members).'
        : 'Minnesota judicial branch — Supreme Court, Court of Appeals, District Courts, and the 10 judicial districts.';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  return {
    title: `${branchLabel} | Minnesota Government`,
    description,
    openGraph: {
      title: branchLabel,
      url: `${baseUrl}/gov/${branch}`,
    },
    alternates: { canonical: `${baseUrl}/gov/${branch}` },
  };
}

export default async function BranchPage({ params }: Props) {
  const { branch } = await params;
  if (!BRANCHES.includes(branch as BranchSlug)) notFound();

  if (branch === 'executive') {
    const [officers, subAgencies] = await Promise.all([
      getExecutiveOfficers(),
      getGovernorSubAgencies(),
    ]);
    return (
      <ExecutivePageClient
        officers={officers}
        departments={subAgencies.departments}
        agencies={subAgencies.agencies}
        boards={subAgencies.boards}
      />
    );
  }

  if (branch === 'legislative') {
    const [senators, houseMembers] = await Promise.all([
      getLegislativeMembers('mn-senate'),
      getLegislativeMembers('mn-house'),
    ]);
    return (
      <LegislativePageClient senators={senators} houseMembers={houseMembers} />
    );
  }

  if (branch === 'judicial') {
    const { courts, leaders, districts } = await getJudicialData();
    return (
      <JudicialPageClient courts={courts} leaders={leaders} districts={districts} />
    );
  }

  notFound();
}
