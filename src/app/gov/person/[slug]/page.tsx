import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import Link from 'next/link';
import { getCivicPersonBySlug } from '@/features/civic/services/civicService';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import PersonPageClient from './PersonPageClient';
import PersonAvatar from '@/features/civic/components/PersonAvatar';
import LastEditedIndicator from '@/features/civic/components/LastEditedIndicator';
import EntityEditHistory from '@/features/civic/components/EntityEditHistory';
import { getServerAuth } from '@/lib/authServer';

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
          url: '/logo.png',
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

  const { person, roles } = data;
  const partyColor = person.party === 'DFL' ? 'text-blue-600' : 
                     person.party === 'Republican' ? 'text-red-600' : 
                     person.party ? 'text-gray-600' : '';

  // Group roles by org
  const rolesByOrg = new Map<string, typeof roles>();
  roles.forEach(role => {
    if (role.org) {
      if (!rolesByOrg.has(role.org.id)) {
        rolesByOrg.set(role.org.id, []);
      }
      rolesByOrg.get(role.org.id)!.push(role);
    }
  });

  return (
    <SimplePageLayout contentPadding="px-[10px] py-3">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb Navigation */}
        <Breadcrumbs items={[
          { label: 'Minnesota', href: '/' },
          { label: 'Government', href: '/gov' },
          { label: person.name, href: null },
        ]} />

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <PersonAvatar 
                name={person.name} 
                photoUrl={person.photo_url}
                size="lg"
              />
              <h1 className="text-sm font-semibold text-gray-900">
                {person.name}
              </h1>
              {person.party && (
                <span className={`text-xs font-medium ${partyColor}`}>
                  {person.party}
                </span>
              )}
            </div>
            <PersonPageClient person={person} isAdmin={isAdmin} />
          </div>
          
          <LastEditedIndicator tableName="people" recordId={person.id} />
          
          {/* Contact Information */}
          <div className="bg-white rounded-md border border-gray-200 p-[10px] space-y-1.5">
            {person.phone && (
              <div className="text-xs text-gray-600">
                <span className="font-medium text-gray-700">Phone:</span> {person.phone}
              </div>
            )}
            {!person.phone && (
              <div className="text-xs text-gray-400">
                <span className="font-medium text-gray-500">Phone:</span> <span className="italic">Not available</span>
              </div>
            )}
            
            {person.email && (
              <div className="text-xs text-gray-600">
                <span className="font-medium text-gray-700">Email:</span>{' '}
                <a href={`mailto:${person.email}`} className="hover:underline text-blue-600">
                  {person.email}
                </a>
              </div>
            )}
            {!person.email && (
              <div className="text-xs text-gray-400">
                <span className="font-medium text-gray-500">Email:</span> <span className="italic">Not available</span>
              </div>
            )}
            
            {person.address && (
              <div className="text-xs text-gray-600">
                <span className="font-medium text-gray-700">Address:</span> {person.address}
              </div>
            )}
            {!person.address && (
              <div className="text-xs text-gray-400">
                <span className="font-medium text-gray-500">Address:</span> <span className="italic">Not available</span>
              </div>
            )}
          </div>
        </div>

        {/* Roles by Organization */}
        {rolesByOrg.size > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-gray-900">Current Roles</h2>
            {Array.from(rolesByOrg.entries()).map(([orgId, orgRoles]) => {
              const org = orgRoles[0]?.org;
              if (!org) return null;

              // Group roles by title (in case person has multiple roles with same title)
              const rolesByTitle = new Map<string, typeof orgRoles>();
              orgRoles.forEach(role => {
                if (!rolesByTitle.has(role.title)) {
                  rolesByTitle.set(role.title, []);
                }
                rolesByTitle.get(role.title)!.push(role);
              });

              return (
                <div key={orgId} className="bg-white rounded-md border border-gray-200 p-[10px]">
                  <div className="space-y-1.5">
                    <Link
                      href={`/gov/org/${org.slug}`}
                      className="text-xs font-semibold text-gray-900 hover:underline"
                    >
                      {org.name}
                    </Link>
                    <div className="space-y-0.5">
                      {Array.from(rolesByTitle.entries()).map(([title, titleRoles]) => (
                        <div key={title} className="text-xs text-gray-600">
                          {title}
                          {titleRoles.length > 1 && (
                            <span className="text-[10px] text-gray-500 ml-1">
                              ({titleRoles.length} positions)
                            </span>
                          )}
                          {titleRoles[0].start_date && (
                            <span className="text-[10px] text-gray-500 ml-1">
                              (since {new Date(titleRoles[0].start_date).getFullYear()})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {roles.length === 0 && (
          <div className="bg-white rounded-md border border-gray-200 p-[10px]">
            <p className="text-xs text-gray-600">No current roles.</p>
          </div>
        )}

        {/* Page Break */}
        <div className="mt-6 pt-6 border-t border-gray-300">
          {/* Edit History */}
          <EntityEditHistory 
            tableName="people" 
            recordId={person.id} 
            recordName={person.name}
            showHeader={true}
          />
        </div>
      </div>
    </SimplePageLayout>
  );
}

