import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import { createServerClient } from '@/lib/supabaseServer';
import Link from 'next/link';
import Image from 'next/image';
import { getVisibleAtlasTypes } from '@/features/atlas/services/atlasTypesService';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import ExploreBreadcrumbs from '@/components/navigation/ExploreBreadcrumbs';
import { handleQueryError } from '@/lib/utils/errorHandling';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    title: 'Minnesota Atlas Directory | Complete Geographic Data',
    description: 'Complete directory of all Minnesota atlas layers including cities, neighborhoods, schools, parks, lakes, hospitals, churches, and more. Explore comprehensive geographic and demographic datasets.',
    keywords: ['Minnesota atlas', 'Minnesota geographic data', 'Minnesota POI', 'Minnesota points of interest', 'Minnesota locations', 'Minnesota datasets'],
    openGraph: {
      title: 'Minnesota Atlas Directory | Complete Geographic Data',
      description: 'Complete directory of all Minnesota atlas layers including cities, neighborhoods, schools, parks, lakes, hospitals, churches, and more.',
      url: `${baseUrl}/explore/atlas`,
      siteName: 'For the Love of Minnesota',
      images: [
        {
          url: '/logo.png',
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: 'Minnesota Atlas Directory',
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `${baseUrl}/explore/atlas`,
    },
  };
}

export default async function AtlasPage() {
  const supabase = createServerClient();
  
  // Fetch visible atlas types from database
  const visibleTypes = await getVisibleAtlasTypes();

  // Fetch counts for each visible atlas type
  const countPromises = visibleTypes.map(async (type) => {
    try {
      const { count, error } = await supabase
        .from('atlas_entities')
        .select('*', { count: 'exact', head: true })
        .eq('table_name', type.slug)
        .not('lat', 'is', null)
        .not('lng', 'is', null);
      
      return handleQueryError(
        error,
        `AtlasPage: count for ${type.slug}`,
        { slug: type.slug, count: count || 0 }
      );
    } catch (error) {
      return handleQueryError(
        error,
        `AtlasPage: count for ${type.slug}`,
        { slug: type.slug, count: 0 }
      );
    }
  });

  const counts = await Promise.all(countPromises);
  const countMap = counts.reduce((acc, { slug, count }) => {
    acc[slug] = count;
    return acc;
  }, {} as Record<string, number>);

  return (
    <SimplePageLayout contentPadding="px-[10px] py-3" footerVariant="light">
      <PageViewTracker />
      <div className="max-w-4xl mx-auto">
        <ExploreBreadcrumbs
          items={[
            { name: 'Home', href: '/' },
            { name: 'Explore', href: '/explore' },
            { name: 'Atlas', href: '/explore/atlas', isCurrentPage: true },
          ]}
        />

        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <h1 className="text-sm font-semibold text-gray-900">
            Minnesota Atlas Directory
          </h1>
          <p className="text-xs text-gray-600">
            Complete directory of all Minnesota atlas layers. Explore comprehensive geographic and demographic datasets covering cities, neighborhoods, schools, parks, lakes, hospitals, churches, and more.
          </p>
        </div>

        {/* Atlas Tables Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
          {visibleTypes.map((type) => {
            const count = countMap[type.slug] || 0;
            const isComingSoon = type.status === 'coming_soon';
            const content = (
                <div className="flex items-start gap-2">
                  {type.icon_path && (
                    <Image
                      src={type.icon_path}
                      alt={type.name}
                      width={16}
                      height={16}
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      unoptimized
                    />
                  )}
                  <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-gray-900">{type.name}</h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isComingSoon && (
                        <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          Coming Soon
                        </span>
                      )}
                      {count > 0 && !isComingSoon && (
                        <span className="text-[10px] text-gray-500">({count.toLocaleString()})</span>
                      )}
                    </div>
                    </div>
                    {type.description && (
                      <p className="text-xs text-gray-600">{type.description}</p>
                    )}
                  </div>
                </div>
            );

            if (isComingSoon) {
              return (
                <div
                  key={type.slug}
                  className="bg-white rounded-md border border-gray-200 p-[10px] opacity-75"
                >
                  {content}
                </div>
              );
            }

            return (
              <Link
                key={type.slug}
                href={`/explore/atlas/${type.slug}`}
                className="bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors"
              >
                {content}
              </Link>
            );
          })}
        </div>

        {/* Summary */}
        <div className="bg-white rounded-md border border-gray-200 p-[10px]">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">About the Atlas</h2>
          <p className="text-xs text-gray-600 leading-relaxed mb-1.5">
            The Minnesota Atlas contains comprehensive geographic and demographic data covering all 87 counties, hundreds of cities, and thousands of points of interest across the state. Each atlas layer provides detailed information about specific types of locations, from schools and parks to hospitals and churches.
          </p>
          <p className="text-xs text-gray-600 leading-relaxed">
            Click on any atlas layer above to view the complete directory of records for that category. All data is continuously updated with the latest Minnesota geographic information.
          </p>
        </div>
      </div>
    </SimplePageLayout>
  );
}

