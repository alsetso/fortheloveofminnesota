import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import { createServerClient } from '@/lib/supabaseServer';
import Link from 'next/link';
import Image from 'next/image';
import { getVisibleAtlasTypes } from '@/features/atlas/services/atlasTypesService';

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
      
      if (error) {
        console.warn(`[AtlasPage] Error fetching count for ${type.slug}:`, error);
        return { slug: type.slug, count: 0 };
      }
      
      return { slug: type.slug, count: count || 0 };
    } catch (error) {
      console.error(`[AtlasPage] Error fetching count for ${type.slug}:`, error);
      return { slug: type.slug, count: 0 };
    }
  });

  const counts = await Promise.all(countPromises);
  const countMap = counts.reduce((acc, { slug, count }) => {
    acc[slug] = count;
    return acc;
  }, {} as Record<string, number>);

  return (
    <SimplePageLayout contentPadding="px-[10px] py-3" footerVariant="light">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb Navigation */}
        <nav className="mb-3" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-xs text-gray-600">
            <li>
              <Link href="/" className="hover:text-gray-900 transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/explore" className="hover:text-gray-900 transition-colors">
                Explore
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 font-medium" aria-current="page">Atlas</li>
          </ol>
        </nav>

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
            return (
              <Link
                key={type.slug}
                href={`/explore/atlas/${type.slug}`}
                className="bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors"
              >
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
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-gray-900">{type.name}</h3>
                      {count > 0 && (
                        <span className="text-[10px] text-gray-500">({count.toLocaleString()})</span>
                      )}
                    </div>
                    {type.description && (
                      <p className="text-xs text-gray-600">{type.description}</p>
                    )}
                  </div>
                </div>
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

