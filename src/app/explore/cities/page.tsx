import { Metadata } from 'next';
import SimplePageLayout from '@/components/SimplePageLayout';
import { createServerClient } from '@/lib/supabaseServer';
import { CitiesListView } from '@/components/cities/CitiesListView';
import Link from 'next/link';
import { StarIcon } from '@heroicons/react/24/solid';
import CitiesListClient from './CitiesListClient';

// ISR: Revalidate every hour for fresh data, but serve cached instantly
export const revalidate = 3600; // 1 hour

export async function generateMetadata(): Promise<Metadata> {
  const supabase = createServerClient();
  const { count } = await supabase
    .from('cities')
    .select('*', { count: 'exact', head: true });
  
  const cityCount = count || 0;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    title: `Minnesota Cities Directory | Complete List of All Cities in MN | MNUDA`,
    description: `Complete directory of all Minnesota cities. Browse cities by population, county, and location. Find detailed information about Minneapolis, St. Paul, Duluth, Rochester, and all other Minnesota cities. Updated directory with population data and city profiles.`,
    keywords: ['Minnesota cities', 'MN cities', 'city directory', 'Minneapolis', 'St. Paul', 'Duluth', 'Rochester', 'Minnesota demographics', 'city population', 'Minnesota locations'],
    openGraph: {
      title: `Minnesota Cities Directory | Complete List of All Cities in MN | MNUDA`,
      description: `Complete directory of all Minnesota cities. Browse cities by population, county, and location. Find detailed information about every city in Minnesota.`,
      url: `${baseUrl}/explore/cities`,
      siteName: 'MNUDA',
      images: [
        {
          url: '/logo.png',
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: 'Minnesota Cities Directory - Complete List of All Cities in Minnesota',
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Minnesota Cities Directory | Complete List of All Cities in MN`,
      description: `Complete directory of all Minnesota cities. Browse cities by population, county, and location.`,
      images: ['/logo.png'],
    },
    alternates: {
      canonical: `${baseUrl}/explore/cities`,
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

function generateStructuredData(cities: Array<{ id: string; name: string; slug: string; population: number; county: string | null }>) {
  const totalPopulation = cities.reduce((sum, c) => sum + c.population, 0);
  
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Minnesota Cities Directory',
    description: `Complete directory of all ${cities.length} cities in Minnesota with population data and city profiles.`,
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/explore/cities`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: cities.length,
      itemListElement: cities.slice(0, 50).map((city, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'City',
          name: city.name,
          url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/explore/city/${city.slug}`,
          population: city.population,
          containedInPlace: city.county ? {
            '@type': 'County',
            name: city.county,
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
      numberOfItems: cities.length,
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
        name: 'Cities',
        item: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/explore/cities`,
      },
    ],
  };
}

export default async function CitiesListPage() {
  const supabase = createServerClient();

  // Fetch all cities ordered by population (descending)
  const { data: cities, error } = await supabase
    .from('cities')
    .select('id, name, slug, population, county, favorite, website_url')
    .order('population', { ascending: false });

  if (error) {
    // Log error but continue with empty array to prevent page crash
    console.error('[CitiesListPage] Error fetching cities:', error);
  }

  const allCities = cities || [];
  const totalPopulation = allCities.reduce((sum, c) => sum + c.population, 0);
  const structuredData = generateStructuredData(allCities);
  const breadcrumbData = generateBreadcrumbStructuredData();

  return (
    <>
      <CitiesListClient />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
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
              <li className="text-gray-900 font-medium" aria-current="page">Cities</li>
            </ol>
          </nav>

          {/* Header */}
          <div className="mb-3 space-y-1.5">
            <h1 className="text-sm font-semibold text-gray-900">
              Minnesota Cities Directory
            </h1>
            <p className="text-xs text-gray-600">
              Complete directory of all <strong>{allCities.length} cities</strong> in Minnesota. 
              Browse cities by population, explore city profiles, and discover detailed information about each location including population data, county information, and unique characteristics.
            </p>
            <p className="text-xs text-gray-500">
              Find information about major cities like Minneapolis, St. Paul, Duluth, Rochester, Bloomington, and all other Minnesota cities. 
              Each city profile includes population statistics, county location, and links to detailed city pages.
            </p>
          </div>

          {/* Cities List/Grid with Toggle */}
          <div className="mb-3">
            <CitiesListView cities={allCities} />
          </div>

          {/* Summary Stats */}
          <div className="bg-white rounded-md border border-gray-200 p-[10px] mb-3">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Minnesota Cities Summary Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Total Cities
                </p>
                <p className="text-sm font-semibold text-gray-900">{allCities.length}</p>
                <p className="text-xs text-gray-600 mt-0.5">Cities across all 87 Minnesota counties</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Total Population
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatNumber(totalPopulation)}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">Combined population of all Minnesota cities</p>
              </div>
            </div>
          </div>

          {/* Quick Reference - Top Cities by Population */}
          <div className="bg-white rounded-md border border-gray-200 p-[10px] mb-3">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Top Cities by Population</h2>
            <div className="space-y-1.5">
              {allCities
                .sort((a, b) => b.population - a.population)
                .slice(0, 10)
                .map((city, idx) => (
                  <div key={city.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 w-4">{idx + 1}.</span>
                      <Link 
                        href={`/explore/city/${city.slug}`} 
                        className="text-gray-700 underline hover:text-gray-900 transition-colors"
                      >
                        {city.name}
                      </Link>
                      {city.favorite && (
                        <StarIcon className="w-3 h-3 text-gray-700" aria-label="Featured city" />
                      )}
                      {city.county && (
                        <span className="text-gray-500">({city.county})</span>
                      )}
                    </div>
                    <span className="text-gray-600">{formatNumber(city.population)}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Additional SEO Content */}
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-1.5">About Minnesota Cities</h2>
              <p className="text-xs text-gray-600 leading-relaxed mb-1.5">
                Minnesota is home to {allCities.length} incorporated cities, ranging from major metropolitan areas like Minneapolis and St. Paul to smaller communities throughout the state. 
                This comprehensive directory provides access to detailed information about each city, including population data, county location, and links to individual city profiles.
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Whether you&apos;re researching demographics, planning a visit, or looking for information about a specific Minnesota city, this directory serves as your complete guide to all cities in the Land of 10,000 Lakes.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-1.5">Popular Minnesota Cities</h3>
              <ul className="list-disc list-inside space-y-0.5 text-xs text-gray-600 ml-1">
                <li><Link href="/explore/city/minneapolis" className="text-gray-700 underline hover:text-gray-900 transition-colors">Minneapolis</Link> - Largest city in Minnesota</li>
                <li><Link href="/explore/city/st-paul" className="text-gray-700 underline hover:text-gray-900 transition-colors">St. Paul</Link> - State capital and second-largest city</li>
                <li><Link href="/explore/city/rochester" className="text-gray-700 underline hover:text-gray-900 transition-colors">Rochester</Link> - Home of Mayo Clinic</li>
                <li><Link href="/explore/city/duluth" className="text-gray-700 underline hover:text-gray-900 transition-colors">Duluth</Link> - Major port city on Lake Superior</li>
                <li><Link href="/explore/city/bloomington" className="text-gray-700 underline hover:text-gray-900 transition-colors">Bloomington</Link> - Home of Mall of America</li>
              </ul>
            </div>
          </div>
        </div>
      </SimplePageLayout>
    </>
  );
}
