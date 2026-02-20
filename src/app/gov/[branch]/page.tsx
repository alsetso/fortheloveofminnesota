import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBranchOrgs } from '@/features/civic/services/civicService';
import BranchPageClient from './BranchPageClient';

export const revalidate = 3600;

const BRANCHES = ['executive', 'legislative', 'judicial'] as const;
type BranchSlug = (typeof BRANCHES)[number];

type Props = { params: Promise<{ branch: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { branch } = await params;
  if (!BRANCHES.includes(branch as BranchSlug)) return { title: 'Not Found' };
  const title = `${branch.charAt(0).toUpperCase() + branch.slice(1)} Branch | Minnesota Government`;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  return {
    title,
    description: `Minnesota state government ${branch} branch — organizations and leadership.`,
    openGraph: { title, url: `${baseUrl}/gov/${branch}` },
    alternates: { canonical: `${baseUrl}/gov/${branch}` },
  };
}

export default async function BranchPage({ params }: Props) {
  const { branch } = await params;
  if (!BRANCHES.includes(branch as BranchSlug)) notFound();

  const orgs = await getBranchOrgs(branch as BranchSlug);

  return <BranchPageClient branch={branch as BranchSlug} orgs={orgs} />;
}
