import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCivicPersonBySlug } from '@/features/civic/services/civicService';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import PersonPageClient from './PersonPageClient';
import PersonAvatar from '@/features/civic/components/PersonAvatar';
import LastEditedIndicator from '@/features/civic/components/LastEditedIndicator';
import EntityEditHistory from '@/features/civic/components/EntityEditHistory';
import { getServerAuth } from '@/lib/authServer';
import GovSidebarBroadcaster from '@/components/gov/GovSidebarBroadcaster';

export const revalidate = 3600;

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCivicPersonBySlug(slug);

  if (!data) {
    return {
      title: 'Person Not Found',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const { person, roles } = data;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const url = `${baseUrl}/gov/person/${slug}`;
  const title = `${person.name} | Minnesota Government`;
  const roleTitles = roles.map(r => r.title).join(', ');
  const description = `${person.name}${person.party ? ` (${person.party})` : ''} - ${roleTitles || 'Minnesota government official'}.`;

  return {
    title,
    description,
    keywords: [person.name, 'Minnesota government', person.party || '', 'Minnesota official'],
    openGraph: {
      title,
      description,
      url,
      siteName: 'For the Love of Minnesota',
      images: person.photo_url ? [
        {
          url: person.photo_url,
          width: 1200,
          height: 630,
          alt: person.name,
        },
      ] : [
        {
          url: '/seo_share_public_image.png',
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: person.name,
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function PersonPage({ params }: Props) {
  const { slug } = await params;
  const data = await getCivicPersonBySlug(slug);
  const auth = await getServerAuth();
  const isAdmin = auth?.role === 'admin';

  if (!data) {
    notFound();
  }

  const { person, roles, building } = data;

  const partyColor = person.party === 'DFL' ? 'text-blue-600' :
                     person.party === 'R' || person.party === 'Republican' ? 'text-red-600' :
                     person.party ? 'text-gray-600' : '';

  // Primary role for display below name
  const primaryRole = roles[0];
  const primaryOrg = primaryRole?.org;

  // Group roles by org for the roles section
  const rolesByOrg = new Map<string, typeof roles>();
  roles.forEach(role => {
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
        <Breadcrumbs items={[
          { label: 'Minnesota', href: '/' },
          { label: 'Government', href: '/gov' },
          ...(primaryOrg ? [{ label: primaryOrg.name, href: `/gov/org/${primaryOrg.slug}` }] : []),
          { label: person.name, href: null },
        ]} />

        {/* Hero */}
        <div className="mt-2 border border-gray-200 rounded-md p-4">
          <div className="flex items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <PersonAvatar name={person.name} photoUrl={person.photo_url} size="lg" />
              <div>
                <h1 className="text-sm font-semibold text-gray-900">{person.name}</h1>
                {primaryRole && (
                  <p className="text-xs text-gray-600 mt-0.5">{primaryRole.title}</p>
                )}
                {primaryOrg && (
                  <Link href={`/gov/org/${primaryOrg.slug}`} className="text-[10px] text-blue-600 hover:underline mt-0.5 block">
                    {primaryOrg.name}
                  </Link>
                )}
                {person.party && (
                  <span className={`text-[10px] font-medium mt-1 inline-block ${partyColor}`}>
                    {person.party}
                  </span>
                )}
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

        {/* Contact block — only render if at least one field exists */}
        {hasContact && (
          <div className="mt-3">
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">Contact</h2>
            <div className="border border-gray-200 rounded-md p-3 space-y-1.5">
              {person.email && (
                <div className="text-xs text-gray-600">
                  <span className="font-medium text-gray-700">Email:</span>{' '}
                  <a href={`mailto:${person.email}`} className="text-blue-600 hover:underline">
                    {person.email}
                  </a>
                </div>
              )}
              {person.phone && (
                <div className="text-xs text-gray-600">
                  <span className="font-medium text-gray-700">Phone:</span>{' '}
                  <a href={`tel:${person.phone.replace(/[^+\d]/g, '')}`} className="hover:underline">
                    {person.phone}
                  </a>
                </div>
              )}
              {person.address && (
                <div className="text-xs text-gray-600">
                  <span className="font-medium text-gray-700">Address:</span> {person.address}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Building block */}
        {building && (
          <div className="mt-3">
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">Location</h2>
            <div className="border border-gray-200 rounded-md p-3">
              <Link href={`/gov/building/${building.slug ?? building.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                {building.name}
              </Link>
              {building.full_address && (
                <p className="text-[10px] text-gray-500 mt-0.5">{building.full_address}</p>
              )}
            </div>
          </div>
        )}

        {/* Roles section */}
        <div className="mt-3">
          <h2 className="text-xs font-semibold text-gray-900 mb-1.5">
            {rolesByOrg.size <= 1 ? 'Current Role' : 'Roles'}
          </h2>
          {rolesByOrg.size > 0 ? (
            <div className="space-y-2">
              {Array.from(rolesByOrg.entries()).map(([orgId, orgRoles]) => {
                const org = orgRoles[0]?.org;
                if (!org) return null;
                return (
                  <div key={orgId} className="border border-gray-200 rounded-md p-3">
                    <Link href={`/gov/org/${org.slug}`} className="text-xs font-semibold text-gray-900 hover:underline block mb-1">
                      {org.name}
                    </Link>
                    <div className="space-y-0.5">
                      {orgRoles.map((role, idx) => (
                        <div key={idx} className="text-xs text-gray-600 flex items-center gap-1.5">
                          <span>{role.title}</span>
                          {role.start_date && (
                            <span className="text-[10px] text-gray-400">
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
            <div className="border border-gray-200 rounded-md p-3">
              <p className="text-xs text-gray-400">No current roles on record.</p>
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="mt-6 pt-6 border-t border-gray-300">
            <EntityEditHistory tableName="people" recordId={person.id} recordName={person.name} showHeader={true} />
          </div>
        )}
      </div>
    </>
  );
}

