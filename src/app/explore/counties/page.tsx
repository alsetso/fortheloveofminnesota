import { Metadata } from 'next';
import SimplePageLayout from '@/components/SimplePageLayout';
import { createServerClient } from '@/lib/supabaseServer';
import { CountiesListView } from '@/components/counties/CountiesListView';
import Link from 'next/link';
import { StarIcon } from '@heroicons/react/24/solid';
import CountiesListClient from './CountiesListClient';

// ISR: Revalidate every hour for fresh data, but serve cached instantly
export const revalidate = 3600; // 1 hour

export async function generateMetadata(): Promise<Metadata> {
  const supabase = createServerClient();
  const { count } = await supabase
    .from('counties')
    .select('*', { count: 'exact', head: true });
  
  const countyCount = count || 87;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    title: `Minnesota Counties Directory | Complete List of All ${countyCount} Counties in MN | MNUDA`,
    description: `Complete directory of all ${countyCount} Minnesota counties. Browse all counties by name, population, and area. Find detailed information about Hennepin County, Ramsey County, Dakota County, and all other Minnesota counties. Updated directory with population data and county profiles.`,
    keywords: ['Minnesota counties', 'MN counties', 'county directory', 'Hennepin County', 'Ramsey County', 'Dakota County', 'Minnesota demographics', 'county population', 'Minnesota geography'],
    openGraph: {
      title: `Minnesota Counties Directory | Complete List of All ${countyCount} Counties in MN | MNUDA`,
      description: `Complete directory of all ${countyCount} Minnesota counties. Browse counties by name, population, and area. Find detailed information about every county in Minnesota.`,
      url: `${baseUrl}/explore/counties`,
      siteName: 'MNUDA',
      images: [
        {
          url: '/logo.png',
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: 'Minnesota Counties Directory - Complete List of All Counties in Minnesota',
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Minnesota Counties Directory | Complete List of All ${countyCount} Counties in MN`,
      description: `Complete directory of all ${countyCount} Minnesota counties. Browse counties by name, population, and area.`,
      images: ['/logo.png'],
    },
    alternates: {
      canonical: `${baseUrl}/explore/counties`,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

function formatArea(area: number): string {
  return `${formatNumber(area)} sq mi`;
}

function generateStructuredData(counties: Array<{ id: string; name: string; slug: string; population: number; area_sq_mi: number | null }>) {
  const totalPopulation = counties.reduce((sum, c) => sum + c.population, 0);
  const totalArea = counties.reduce((sum, c) => sum + Number(c.area_sq_mi || 0), 0);
  
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Minnesota Counties Directory',
    description: `Complete directory of all ${counties.length} counties in Minnesota with population data, area information, and county profiles.`,
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/explore/counties`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: counties.length,
      itemListElement: counties.slice(0, 50).map((county, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'County',
          name: county.name,
          url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/explore/county/${county.slug}`,
          population: county.population,
          area: county.area_sq_mi ? {
            '@type': 'QuantitativeValue',
            value: county.area_sq_mi,
            unitCode: 'MI2',
          } : undefined,
        },
      })),
    },
    about: {
      '@type': 'State',
      name: 'Minnesota',
      '@id': 'https://www.wikidata.org/wiki/Q1527',
    },
    statistics: {
      '@type': 'StatisticalPopulation',
      populationTotal: totalPopulation,
      numberOfItems: counties.length,
      areaTotal: totalArea,
    },
  };
}

function generateBreadcrumbStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Explore',
        item: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/explore`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Counties',
        item: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/explore/counties`,
      },
    ],
  };
}

export default async function CountiesListPage() {
  const supabase = createServerClient();

  // Fetch all counties ordered by name
  const { data: counties, error } = await supabase
    .from('counties')
    .select('id, name, slug, population, area_sq_mi, favorite')
    .order('name', { ascending: true });

  if (error) {
    // Log error but continue with empty array to prevent page crash
    console.error('[CountiesListPage] Error fetching counties:', error);
  }

  const allCounties = counties || [];
  const totalPopulation = allCounties.reduce((sum, c) => sum + c.population, 0);
  const totalArea = allCounties.reduce((sum, c) => sum + Number(c.area_sq_mi || 0), 0);
  const structuredData = generateStructuredData(allCounties);
  const breadcrumbData = generateBreadcrumbStructuredData();

  return (
    <>
      <CountiesListClient />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      <SimplePageLayout contentPadding="px-[10px] py-3" footerVariant="light">
        <div className="max-w-7xl mx-auto">
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
              <li className="text-gray-900 font-medium" aria-current="page">Counties</li>
            </ol>
          </nav>

          {/* Header */}
          <div className="mb-3 space-y-1.5">
            <h1 className="text-sm font-semibold text-gray-900">
              Minnesota Counties Directory
            </h1>
            <p className="text-xs text-gray-600">
              Complete directory of all <strong>{allCounties.length} counties</strong> in Minnesota. 
              Browse counties alphabetically, explore county profiles, and discover detailed information about each county including population data, area measurements, and unique characteristics.
            </p>
            <p className="text-xs text-gray-500">
              Find information about major counties like Hennepin County, Ramsey County, Dakota County, and all other Minnesota counties. 
              Each county profile includes population statistics, geographic area, and links to detailed county pages.
            </p>
          </div>

          {/* Counties List/Grid with Toggle */}
          <div className="mb-3">
            <CountiesListView counties={allCounties} />
          </div>

          {/* Summary Stats */}
          <div className="bg-white rounded-md border border-gray-200 p-[10px] mb-3">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Minnesota Counties Summary Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Total Counties
                </p>
                <p className="text-sm font-semibold text-gray-900">{allCounties.length}</p>
                <p className="text-xs text-gray-600 mt-0.5">All counties in Minnesota</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Total Population
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatNumber(totalPopulation)}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">Combined population of all counties</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Total Area
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatArea(totalArea)}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">Total land area of Minnesota</p>
              </div>
            </div>
          </div>

          {/* Quick Reference - Top Counties by Population */}
          <div className="bg-white rounded-md border border-gray-200 p-[10px] mb-3">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Top Counties by Population</h2>
            <div className="space-y-1.5">
              {allCounties
                .sort((a, b) => b.population - a.population)
                .slice(0, 10)
                .map((county, idx) => (
                  <div key={county.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 w-4">{idx + 1}.</span>
                      <Link 
                        href={`/explore/county/${county.slug}`} 
                        className="text-gray-700 underline hover:text-gray-900 transition-colors"
                      >
                        {county.name.replace(/\s+County$/, '')}
                      </Link>
                      {county.favorite && (
                        <StarIcon className="w-3 h-3 text-gray-700" aria-label="Featured county" />
                      )}
                    </div>
                    <span className="text-gray-600">{formatNumber(county.population)}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Additional SEO Content */}
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-1.5">About Minnesota Counties</h2>
              <p className="text-xs text-gray-600 leading-relaxed mb-1.5">
                Minnesota consists of {allCounties.length} counties, each with its own unique characteristics, population, and geographic area. 
                This comprehensive directory provides access to detailed information about each county, including population data, area measurements, and links to individual county profiles.
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Whether you&apos;re researching demographics, planning a visit, or looking for information about a specific Minnesota county, this directory serves as your complete guide to all counties in the Land of 10,000 Lakes.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-1.5">Popular Minnesota Counties</h3>
              <ul className="list-disc list-inside space-y-0.5 text-xs text-gray-600 ml-1">
                <li><Link href="/explore/county/hennepin" className="text-gray-700 underline hover:text-gray-900 transition-colors">Hennepin County</Link> - Most populous county, home to Minneapolis</li>
                <li><Link href="/explore/county/ramsey" className="text-gray-700 underline hover:text-gray-900 transition-colors">Ramsey County</Link> - Home to St. Paul, the state capital</li>
                <li><Link href="/explore/county/dakota" className="text-gray-700 underline hover:text-gray-900 transition-colors">Dakota County</Link> - Third most populous county</li>
                <li><Link href="/explore/county/anoka" className="text-gray-700 underline hover:text-gray-900 transition-colors">Anoka County</Link> - Fourth most populous county</li>
                <li><Link href="/explore/county/washington" className="text-gray-700 underline hover:text-gray-900 transition-colors">Washington County</Link> - Fifth most populous county</li>
              </ul>
            </div>
          </div>
        </div>
      </SimplePageLayout>
    </>
  );
}
