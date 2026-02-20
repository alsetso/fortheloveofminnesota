import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCivicOrgBySlug } from '@/features/civic/services/civicService';
import OfficerPageClient from './OfficerPageClient';

export const revalidate = 3600;

const OFFICER_SLUGS = [
  'lieutenant-governor',
  'attorney-general',
  'secretary-of-state',
  'state-auditor',
] as const;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const org = await getCivicOrgBySlug(slug);
  if (!org) return { title: 'Not Found' };
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  return {
    title: `${org.name} | Minnesota Government`,
    description: `Office of the ${org.name} — Minnesota executive branch.`,
    openGraph: { title: org.name, url: `${baseUrl}/gov/executive/${slug}` },
    alternates: { canonical: `${baseUrl}/gov/executive/${slug}` },
  };
}

export default async function OfficerPage({ params }: Props) {
  const { slug } = await params;

  if (!OFFICER_SLUGS.includes(slug as (typeof OFFICER_SLUGS)[number])) {
    notFound();
  }

  const org = await getCivicOrgBySlug(slug);
  if (!org) notFound();

  const currentRole = org.roles?.[0] ?? null;
  const person = currentRole?.person ?? null;

  return (
    <OfficerPageClient
      orgName={org.name}
      orgSlug={org.slug}
      person={person ?? null}
      roleTitle={currentRole?.title ?? org.name}
    />
  );
}
