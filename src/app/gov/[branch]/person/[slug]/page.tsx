import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCivicPersonBySlug } from '@/features/civic/services/civicService';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import PersonPageClient from '@/app/gov/person/[slug]/PersonPageClient';
import PersonAvatar from '@/features/civic/components/PersonAvatar';
import PartyBadge from '@/components/gov/PartyBadge';
import GovBadge from '@/components/gov/GovBadge';
import LastEditedIndicator from '@/features/civic/components/LastEditedIndicator';
import EntityEditHistory from '@/features/civic/components/EntityEditHistory';
import { getServerAuth } from '@/lib/authServer';
import GovSidebarBroadcaster from '@/components/gov/GovSidebarBroadcaster';

export const revalidate = 3600;

const BRANCHES = ['executive', 'legislative', 'judicial'] as const;
type BranchSlug = (typeof BRANCHES)[number];

type Props = { params: Promise<{ branch: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { branch, slug } = await params;
  if (!BRANCHES.includes(branch as BranchSlug)) return { title: 'Not Found' };
  const data = await getCivicPersonBySlug(slug);
  if (!data) {
    return { title: 'Person Not Found', robots: { index: false, follow: false } };
  }
  const { person, roles } = data;
  const primaryOrg = roles[0]?.org;
  if (primaryOrg?.branch !== branch) {
    return { title: 'Not Found', robots: { index: false, follow: false } };
  }
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const url = `${baseUrl}/gov/${branch}/person/${slug}`;
  const title = `${person.name} | Minnesota Government`;
  const roleTitles = roles.map((r) => r.title).join(', ');
  const description = `${person.name}${person.party ? ` (${person.party})` : ''} - ${roleTitles || 'Minnesota government official'}.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'For the Love of Minnesota',
      images: person.photo_url
        ? [{ url: person.photo_url, width: 1200, height: 630, alt: person.name }]
        : [{ url: '/seo_share_public_image.png', width: 1200, height: 630, type: 'image/png', alt: person.name }],
      locale: 'en_US',
      type: 'website',
    },
    alternates: { canonical: url },
  };
}

export default async function BranchPersonPage({ params }: Props) {
  const { branch, slug } = await params;
  if (!BRANCHES.includes(branch as BranchSlug)) notFound();

  const data = await getCivicPersonBySlug(slug);
  const auth = await getServerAuth();
  const isAdmin = auth?.role === 'admin';

  if (!data) notFound();

  const { person, roles, building } = data;
  const primaryRole = roles[0];
  const primaryOrg = primaryRole?.org;
  const personBranch = primaryOrg?.branch ?? null;
  if (personBranch !== branch) notFound();

  const branchLabel =
    branch === 'executive' ? 'Executive' : branch === 'legislative' ? 'Legislative' : 'Judicial';
  const breadcrumbItems = [
    { label: 'Government', href: '/gov' },
    { label: `${branchLabel} Branch`, href: `/gov/${branch}` },
    ...(primaryOrg ? [{ label: primaryOrg.name, href: `/gov/${branch}/agency/${primaryOrg.slug}` }] : []),
    { label: person.name, href: null },
  ];

  const rolesByOrg = new Map<string, typeof roles>();
  roles.forEach((role) => {
    if (role.org) {
      if (!rolesByOrg.has(role.org.id)) rolesByOrg.set(role.org.id, []);
      rolesByOrg.get(role.org.id)!.push(role);
    }
  });
  const hasContact = !!(person.phone || person.email || person.address);

  return (
    <>
      <GovSidebarBroadcaster
        data={{
          branch,
          personName: person.name,
          personSlug: person.slug ?? undefined,
          roleTitle: primaryRole?.title ?? null,
          primaryOrg: primaryOrg ? { name: primaryOrg.name, slug: primaryOrg.slug } : null,
          contact: {
            email: person.email ?? null,
            phone: person.phone ?? null,
          },
          personBuilding: building ? { name: building.name, slug: building.slug ?? null } : null,
        }}
      />
      <div className="max-w-4xl mx-auto px-[10px] py-3">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="mt-2 border border-border rounded-md p-4 bg-surface">
          <div className="flex items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <PersonAvatar name={person.name} photoUrl={person.photo_url} size="lg" />
              <div>
                <h1 className="text-sm font-semibold text-foreground">{person.name}</h1>
                {primaryRole && (
                  <p className="text-xs text-foreground-muted mt-0.5">{primaryRole.title}</p>
                )}
                {primaryOrg && (
                  <Link
                    href={`/gov/${branch}/agency/${primaryOrg.slug}`}
                    className="text-[10px] text-accent hover:underline mt-0.5 block"
                  >
                    {primaryOrg.name}
                  </Link>
                )}
                {person.district && (
                  <p className="text-[10px] text-foreground-muted mt-0.5">
                    <span className="font-medium">District:</span> {person.district}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <PartyBadge party={person.party} />
                  {primaryRole?.role_type && (
                    <GovBadge label={primaryRole.role_type} variant="gray" />
                  )}
                </div>
              </div>
            </div>
            <PersonPageClient person={person} isAdmin={isAdmin} />
          </div>
        </div>

        {isAdmin && (
          <div className="mt-1">
            <LastEditedIndicator tableName="people" recordId={person.id} />
          </div>
        )}

        {hasContact && (
          <div className="mt-3">
            <h2 className="text-xs font-semibold text-foreground mb-1.5">Contact</h2>
            <div className="border border-border rounded-md p-3 space-y-1.5 bg-surface">
              {person.email && (
                <div className="text-xs text-foreground-muted">
                  <span className="font-medium text-foreground">Email:</span>{' '}
                  <a href={`mailto:${person.email}`} className="text-accent hover:underline">
                    {person.email}
                  </a>
                </div>
              )}
              {person.phone && (
                <div className="text-xs text-foreground-muted">
                  <span className="font-medium text-foreground">Phone:</span>{' '}
                  <a
                    href={`tel:${person.phone.replace(/[^+\d]/g, '')}`}
                    className="hover:underline"
                  >
                    {person.phone}
                  </a>
                </div>
              )}
              {person.address && (
                <div className="text-xs text-foreground-muted">
                  <span className="font-medium text-foreground">Address:</span> {person.address}
                </div>
              )}
            </div>
          </div>
        )}

        {building && (
          <div className="mt-3">
            <h2 className="text-xs font-semibold text-foreground mb-1.5">Location</h2>
            <div className="border border-border rounded-md p-3 bg-surface">
              <Link
                href={`/gov/${branch}/building/${building.slug ?? building.id}`}
                className="text-xs font-medium text-accent hover:underline"
              >
                {building.name}
              </Link>
              {building.full_address && (
                <p className="text-[10px] text-foreground-muted mt-0.5">{building.full_address}</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-3">
          <h2 className="text-xs font-semibold text-foreground mb-1.5">
            {rolesByOrg.size <= 1 ? 'Current Role' : 'Roles'}
          </h2>
          {rolesByOrg.size > 0 ? (
            <div className="space-y-2">
              {Array.from(rolesByOrg.entries()).map(([orgId, orgRoles]) => {
                const org = orgRoles[0]?.org;
                if (!org) return null;
                return (
                  <div key={orgId} className="border border-border rounded-md p-3 bg-surface">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <Link
                        href={`/gov/${branch}/agency/${org.slug}`}
                        className="text-xs font-semibold text-foreground hover:underline"
                      >
                        {org.name}
                      </Link>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {org.branch && <GovBadge label={org.branch} />}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {orgRoles.map((role, idx) => (
                        <div
                          key={idx}
                          className="text-xs text-foreground-muted flex items-center gap-1.5 flex-wrap"
                        >
                          <span>{role.title}</span>
                          {role.role_type && (
                            <GovBadge label={role.role_type} variant="gray" />
                          )}
                          {role.start_date && (
                            <span className="text-[10px] text-foreground-muted">
                              since {new Date(role.start_date).getFullYear()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border border-border rounded-md p-3 bg-surface">
              <p className="text-xs text-foreground-muted">No current roles on record.</p>
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="mt-6 pt-6 border-t border-border">
            <EntityEditHistory
              tableName="people"
              recordId={person.id}
              recordName={person.name}
              showHeader={true}
            />
          </div>
        )}
      </div>
    </>
  );
}
