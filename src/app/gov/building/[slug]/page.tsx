import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCivicBuildingById } from '@/features/civic/services/civicService';
import Breadcrumbs from '@/components/civic/Breadcrumbs';
import PersonAvatar from '@/features/civic/components/PersonAvatar';
import LastEditedIndicator from '@/features/civic/components/LastEditedIndicator';
import EntityEditHistory from '@/features/civic/components/EntityEditHistory';
import { getServerAuth } from '@/lib/authServer';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import BuildingPageClient from './BuildingPageClient';
import CopyButton from './CopyButton';
import { getDisplayRole } from '@/features/civic/utils/roleFromTitle';
import { BuildingStorefrontIcon, MapPinIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

export const revalidate = 3600;

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCivicBuildingById(slug);

  if (!data) {
    return {
      title: 'Building Not Found',
      robots: { index: false, follow: false },
    };
  }

  const { building } = data;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const url = `${baseUrl}/gov/building/${slug}`;
  const title = `${building.name ?? 'Building'} | Minnesota Government`;
  const description = building.description ?? `${building.name ?? 'Civic building'} — ${building.full_address ?? 'Minnesota'}.`;

  return {
    title,
    description,
    keywords: [building.name ?? '', 'Minnesota government', building.type ?? '', 'civic building'],
    openGraph: {
      title,
      description,
      url,
      siteName: 'For the Love of Minnesota',
      images: building.cover_images?.[0]
        ? [{ url: building.cover_images[0], width: 1200, height: 630, alt: building.name ?? 'Building' }]
        : [{ url: '/seo_share_public_image.png', width: 1200, height: 630, type: 'image/png', alt: title }],
      locale: 'en_US',
      type: 'website',
    },
    alternates: { canonical: url },
  };
}

export default async function BuildingPage({ params }: Props) {
  const { slug } = await params;
  const data = await getCivicBuildingById(slug);
  const auth = await getServerAuth();
  const isAdmin = auth?.role === 'admin';

  if (!data) notFound();

  const { building, people, orgs } = data;
  const heroImage = building.cover_images?.[0];

  return (
    <NewPageWrapper>
      <div className="max-w-4xl mx-auto px-[10px] py-3">
        <Breadcrumbs items={[
          { label: 'Minnesota', href: '/' },
          { label: 'Government', href: '/gov' },
          { label: 'Buildings', href: '/gov' },
          { label: building.name ?? 'Building', href: null },
        ]} />

        {/* Hero image */}
        {heroImage && (
          <div className="mb-3 w-full aspect-video rounded-md overflow-hidden bg-gray-100">
            <img src={heroImage} alt={building.name ?? ''} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Header */}
        <div className="mb-3 space-y-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <BuildingStorefrontIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />
              <h1 className="text-sm font-semibold text-gray-900">
                {building.name ?? building.type ?? 'Unnamed building'}
              </h1>
              {building.type && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-gray-200 text-gray-500 uppercase tracking-wide">
                  {building.type}
                </span>
              )}
            </div>
            <BuildingPageClient building={building} isAdmin={isAdmin} />
          </div>

          {isAdmin && <LastEditedIndicator tableName="buildings" recordId={building.id} />}

          {/* Details card */}
          <div className="bg-white rounded-md border border-gray-200 p-[10px] space-y-1.5">
            {building.full_address && (
              <div className="flex items-start gap-1.5 text-xs text-gray-600">
                <MapPinIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(building.full_address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {building.full_address}
                  </a>
                  <CopyButton text={building.full_address} />
                </div>
              </div>
            )}
            {building.website && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <GlobeAltIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <a
                  href={building.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {building.website}
                </a>
              </div>
            )}
            {building.lat != null && building.lng != null && (
              <div className="text-xs text-gray-500 font-mono pl-5">
                {Number(building.lat).toFixed(5)}, {Number(building.lng).toFixed(5)}
              </div>
            )}
          </div>

          {/* Description */}
          {building.description && (
            <div className="bg-white rounded-md border border-gray-200 p-[10px]">
              <p className="text-xs font-medium text-gray-500 mb-1">About</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{building.description}</p>
            </div>
          )}

          {/* Image gallery */}
          {building.cover_images && building.cover_images.length > 1 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Photos</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {building.cover_images.map((url, i) => (
                  <div key={i} className="w-20 h-20 flex-shrink-0 rounded-md overflow-hidden border border-gray-200">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* People */}
        {people.length > 0 && (
          <div className="mb-3 space-y-1.5">
            <h2 className="text-xs font-semibold text-gray-900">People ({people.length})</h2>
            <div className="bg-white rounded-md border border-gray-200 divide-y divide-gray-100">
              {people.map((person) => (
                <Link
                  key={person.id}
                  href={person.slug ? `/gov/person/${person.slug}` : '#'}
                  className="flex items-center gap-2 px-[10px] py-2 hover:bg-gray-50 transition-colors"
                >
                  <PersonAvatar name={person.name} photoUrl={person.photo_url} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{person.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {getDisplayRole(person.title, []) || '—'}
                    </p>
                  </div>
                  {person.party && (
                    <span className="ml-auto text-[10px] text-gray-500 flex-shrink-0">{person.party}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Orgs */}
        {orgs.length > 0 && (
          <div className="mb-3 space-y-1.5">
            <h2 className="text-xs font-semibold text-gray-900">Organizations ({orgs.length})</h2>
            <div className="bg-white rounded-md border border-gray-200 divide-y divide-gray-100">
              {orgs.map((org) => (
                <Link
                  key={org.id}
                  href={`/gov/org/${org.slug}`}
                  className="flex items-center gap-2 px-[10px] py-2 hover:bg-gray-50 transition-colors"
                >
                  <BuildingStorefrontIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{org.name}</p>
                    {org.org_type && (
                      <p className="text-[10px] text-gray-500 truncate capitalize">{org.org_type}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Admin edit history */}
        {isAdmin && (
          <div className="mt-6 pt-6 border-t border-gray-300">
            <EntityEditHistory
              tableName="buildings"
              recordId={building.id}
              recordName={building.name ?? 'Building'}
              showHeader
            />
          </div>
        )}
      </div>
    </NewPageWrapper>
  );
}
