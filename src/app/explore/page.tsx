import { Metadata } from 'next';
import Link from 'next/link';
import SimplePageLayout from '@/components/SimplePageLayout';
import ExplorePageClient from './ExplorePageClient';
import { BuildingOffice2Icon, RectangleGroupIcon, MapIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { createServerClient } from '@/lib/supabaseServer';

// ISR: Revalidate every hour for fresh data, but serve cached instantly
export const revalidate = 3600; // 1 hour

export async function generateMetadata(): Promise<Metadata> {
  const supabase = createServerClient();
  const { count: cityCount } = await supabase
    .from('cities')
    .select('*', { count: 'exact', head: true });
  const { count: countyCount } = await supabase
    .from('counties')
    .select('*', { count: 'exact', head: true });
  
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    title: 'Explore Minnesota | Complete Directory of All Cities & Counties in MN | For the Love of Minnesota',
    description: `Explore Minnesota through comprehensive directories of all ${countyCount || 87} counties and ${cityCount || 'hundreds of'} cities. Discover population data, geographic information, demographics, official county websites, and detailed profiles for every location in Minnesota. Your complete guide to the Land of 10,000 Lakes.`,
    keywords: [
      'Minnesota cities',
      'Minnesota counties',
      'MN cities directory',
      'MN counties directory',
      'Minnesota demographics',
      'Minnesota population',
      'Minnesota geography',
      'Twin Cities',
      'Minneapolis',
      'St. Paul',
      'Hennepin County',
      'Ramsey County',
      'Minnesota locations',
      'MN city data',
      'MN county data',
    ],
    openGraph: {
      title: 'Explore Minnesota | Complete Directory of All Cities & Counties in MN | For the Love of Minnesota',
      description: `Explore Minnesota through comprehensive directories of all ${countyCount || 87} counties and ${cityCount || 'hundreds of'} cities. Discover population data, geographic information, and detailed profiles for every location in Minnesota.`,
      url: `${baseUrl}/explore`,
      siteName: 'For the Love of Minnesota',
      images: [
        {
          url: '/logo.png',
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: 'Explore Minnesota - Complete Cities and Counties Directory',
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Explore Minnesota | Complete Directory of All Cities & Counties in MN',
      description: `Explore Minnesota through comprehensive directories of all ${countyCount || 87} counties and ${cityCount || 'hundreds of'} cities.`,
      images: ['/logo.png'],
    },
    alternates: {
      canonical: `${baseUrl}/explore`,
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

function generateStructuredData(cityCount: number, countyCount: number, favoriteCounties: Array<{ name: string; slug: string; website_url: string | null }>) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Explore Minnesota - Cities and Counties Directory',
    description: `Comprehensive directory of ${countyCount} Minnesota counties and ${cityCount} cities with population data, geographic information, official websites, and detailed location profiles.`,
    url: `${baseUrl}/explore`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: 2,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          item: {
            '@type': 'CollectionPage',
            name: 'Minnesota Cities Directory',
            url: `${baseUrl}/explore/cities`,
            description: `Complete directory of all ${cityCount} cities in Minnesota`,
          },
        },
        {
          '@type': 'ListItem',
          position: 2,
          item: {
            '@type': 'CollectionPage',
            name: 'Minnesota Counties Directory',
            url: `${baseUrl}/explore/counties`,
            description: `Complete directory of all ${countyCount} counties in Minnesota`,
          },
        },
      ],
    },
    about: {
      '@type': 'State',
      name: 'Minnesota',
      '@id': 'https://www.wikidata.org/wiki/Q1527',
      sameAs: 'https://en.wikipedia.org/wiki/Minnesota',
    },
    hasPart: favoriteCounties.slice(0, 10).map((county, index) => ({
      '@type': 'County',
      name: county.name,
      url: `${baseUrl}/explore/county/${county.slug}`,
      ...(county.website_url && { sameAs: county.website_url }),
    })),
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
    ],
  };
}

export default async function ExplorePage() {
  const supabase = createServerClient();
  
  // Fetch quick stats for preview
  const { count: cityCount } = await supabase
    .from('cities')
    .select('*', { count: 'exact', head: true });
  
  const { count: countyCount } = await supabase
    .from('counties')
    .select('*', { count: 'exact', head: true });

  // Fetch favorite counties with website URLs
  const { data: favoriteCounties } = await supabase
    .from('counties')
    .select('name, slug, website_url, population, area_sq_mi')
    .eq('favorite', true)
    .order('population', { ascending: false })
    .limit(21);

  // Fetch top cities by population for quick links
  const { data: topCities } = await supabase
    .from('cities')
    .select('name, slug, population, favorite, website_url')
    .order('population', { ascending: false })
    .limit(10);

  // Fetch top counties by population
  const { data: topCounties } = await supabase
    .from('counties')
    .select('name, slug, population, area_sq_mi')
    .order('population', { ascending: false })
    .limit(10);

  // Fetch largest counties by area
  const { data: largestCounties } = await supabase
    .from('counties')
    .select('name, slug, area_sq_mi, population')
    .order('area_sq_mi', { ascending: false })
    .limit(5);

  // Calculate total population
  const { data: allCounties } = await supabase
    .from('counties')
    .select('population');
  const totalPopulation = allCounties?.reduce((sum, c) => sum + c.population, 0) || 0;

  const structuredData = generateStructuredData(
    cityCount || 0,
    countyCount || 87,
    favoriteCounties || []
  );
  const breadcrumbData = generateBreadcrumbStructuredData();

  return (
    <>
      <ExplorePageClient />
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
              <li className="text-gray-900 font-medium" aria-current="page">Explore</li>
            </ol>
          </nav>

          {/* Header */}
          <div className="mb-3">
            <h1 className="text-sm font-semibold text-gray-900 mb-2">
              Explore Minnesota
            </h1>
            <p className="text-xs text-gray-600 max-w-3xl mb-2">
              Discover the great state of Minnesota through comprehensive directories of cities and counties. 
              Explore population data, geographic information, demographics, and unique characteristics of each location.
            </p>
            <p className="text-xs text-gray-500 max-w-3xl">
              Whether you&apos;re researching demographics, planning a visit, or looking for detailed information about Minnesota locations, 
              our directories provide access to comprehensive data about all cities and counties in the Land of 10,000 Lakes.
            </p>
          </div>

          {/* Enhanced Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <div className="bg-white rounded-md p-[10px] border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <BuildingOffice2Icon className="w-4 h-4 text-gray-600" />
                <h3 className="text-xs font-semibold text-gray-900">Cities</h3>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-0.5">{cityCount || 0}</p>
              <Link href="/explore/cities" className="text-xs text-gray-600 hover:text-gray-900 transition-colors">
                View all →
              </Link>
            </div>
            <div className="bg-white rounded-md p-[10px] border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <RectangleGroupIcon className="w-4 h-4 text-gray-600" />
                <h3 className="text-xs font-semibold text-gray-900">Counties</h3>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-0.5">{countyCount || 87}</p>
              <Link href="/explore/counties" className="text-xs text-gray-600 hover:text-gray-900 transition-colors">
                View all →
              </Link>
            </div>
            <div className="bg-white rounded-md p-[10px] border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <ChartBarIcon className="w-4 h-4 text-gray-600" />
                <h3 className="text-xs font-semibold text-gray-900">Population</h3>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-0.5">
                {totalPopulation.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">Total state population</p>
            </div>
            <div className="bg-white rounded-md p-[10px] border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <MapIcon className="w-4 h-4 text-gray-600" />
                <h3 className="text-xs font-semibold text-gray-900">Featured</h3>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-0.5">{favoriteCounties?.length || 0}</p>
              <p className="text-xs text-gray-500">Counties with websites</p>
            </div>
          </div>

          {/* Main Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl mb-3">
            <Link
              href="/explore/cities"
              className="group bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-[10px] bg-gray-100 rounded-md group-hover:bg-gray-200 transition-colors">
                  <BuildingOffice2Icon className="w-4 h-4 text-gray-700" />
                </div>
                <h2 className="text-xs font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">
                  Cities Directory
                </h2>
              </div>
              <p className="text-xs text-gray-600 mb-2">
                Explore all Minnesota cities. Discover population, county information, and detailed characteristics of each city.
              </p>
              <div className="flex items-center text-xs text-gray-700 font-medium group-hover:underline">
                Browse Cities
                <svg className="w-3 h-3 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            <Link
              href="/explore/counties"
              className="group bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-[10px] bg-gray-100 rounded-md group-hover:bg-gray-200 transition-colors">
                  <RectangleGroupIcon className="w-4 h-4 text-gray-700" />
                </div>
                <h2 className="text-xs font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">
                  Counties Directory
                </h2>
              </div>
              <p className="text-xs text-gray-600 mb-2">
                Explore all 87 Minnesota counties. Discover population, area, and detailed information about each county.
              </p>
              <div className="flex items-center text-xs text-gray-700 font-medium group-hover:underline">
                Browse Counties
                <svg className="w-3 h-3 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          </div>

          {/* Quick Links Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            {/* Top Cities by Population */}
            <div className="bg-white rounded-md border border-gray-200 p-[10px]">
              <div className="flex items-center gap-1.5 mb-2">
                <MapIcon className="w-4 h-4 text-gray-600" />
                <h2 className="text-xs font-semibold text-gray-900">Top Cities by Population</h2>
              </div>
              <ul className="space-y-1">
                {topCities?.map((city, idx) => (
                  <li key={city.slug}>
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="text-gray-500 mr-1.5 flex-shrink-0">{idx + 1}.</span>
                        <Link
                          href={`/explore/city/${city.slug}`}
                          className="text-xs text-gray-700 hover:text-gray-900 hover:underline"
                        >
                          {city.name}
                        </Link>
                        {city.favorite && (
                          <StarIcon className="w-3 h-3 text-gray-700 flex-shrink-0" aria-label="Featured city" />
                        )}
                        {city.website_url && (
                          <a
                            href={city.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-500 hover:text-gray-700 underline flex-shrink-0"
                          >
                            Website
                          </a>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 group-hover:text-gray-700 flex-shrink-0 ml-2">
                        {city.population.toLocaleString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <Link
                href="/explore/cities"
                className="mt-2 inline-block text-xs text-gray-600 hover:text-gray-900 transition-colors"
              >
                View all cities →
              </Link>
            </div>

            {/* Top Counties by Population */}
            <div className="bg-white rounded-md border border-gray-200 p-[10px]">
              <div className="flex items-center gap-1.5 mb-2">
                <ChartBarIcon className="w-4 h-4 text-gray-600" />
                <h2 className="text-xs font-semibold text-gray-900">Top Counties by Population</h2>
              </div>
              <ul className="space-y-1">
                {topCounties?.map((county, idx) => (
                  <li key={county.slug}>
                    <Link
                      href={`/explore/county/${county.slug}`}
                      className="text-xs text-gray-700 hover:text-gray-900 hover:underline flex items-center justify-between group"
                    >
                      <span>
                        <span className="text-gray-500 mr-1.5">{idx + 1}.</span>
                        {county.name.replace(/\s+County$/, '')}
                      </span>
                      <span className="text-xs text-gray-500 group-hover:text-gray-700">
                        {county.population.toLocaleString()}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/explore/counties"
                className="mt-2 inline-block text-xs text-gray-600 hover:text-gray-900 transition-colors"
              >
                View all counties →
              </Link>
            </div>
          </div>

          {/* Largest Counties by Area */}
          {largestCounties && largestCounties.length > 0 && (
            <div className="bg-white rounded-md border border-gray-200 p-[10px] mb-3">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Largest Counties by Area</h2>
              <div className="space-y-1.5">
                {largestCounties.map((county, idx) => (
                  <div key={county.slug} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 w-4">{idx + 1}.</span>
                      <Link
                        href={`/explore/county/${county.slug}`}
                        className="text-gray-700 hover:text-gray-900 transition-colors"
                      >
                        {county.name.replace(/\s+County$/, '')}
                      </Link>
                    </div>
                    <div className="text-gray-600">
                      {county.area_sq_mi?.toLocaleString()} sq mi
                      {county.population && (
                        <span className="text-gray-500 ml-2">
                          ({county.population.toLocaleString()} residents)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Enhanced SEO Content */}
          <div className="space-y-3 mt-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">About Minnesota Locations</h2>
              <p className="text-xs text-gray-600 leading-relaxed mb-2">
                Minnesota is home to {cityCount || 'hundreds of'} incorporated cities and {countyCount || 87} counties, each with its own unique characteristics, 
                demographics, and geographic features. Our comprehensive directories provide detailed information about every location 
                in the state, from major metropolitan areas like the <Link href="/explore/city/minneapolis" className="text-gray-700 underline hover:text-gray-900 transition-colors">Twin Cities</Link> (Minneapolis and <Link href="/explore/city/st-paul" className="text-gray-700 underline hover:text-gray-900 transition-colors">St. Paul</Link>) 
                to smaller communities throughout Greater Minnesota.
              </p>
              <p className="text-xs text-gray-600 leading-relaxed mb-2">
                Whether you&apos;re researching population trends, planning a relocation, studying demographics, or simply exploring the 
                diverse communities that make up Minnesota, our directories serve as your complete resource for location-based information. 
                Explore <Link href="/explore/county/hennepin" className="text-gray-700 underline hover:text-gray-900 transition-colors">Hennepin County</Link> (home to Minneapolis), 
                <Link href="/explore/county/ramsey" className="text-gray-700 underline hover:text-gray-900 transition-colors"> Ramsey County</Link> (home to St. Paul), 
                and all other Minnesota counties with official website links and comprehensive data.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">What You Can Explore</h3>
              <div className="bg-white rounded-md border border-gray-200 p-[10px]">
                <ul className="list-disc list-inside space-y-1 text-xs text-gray-600 ml-1">
                  <li>
                    <strong className="text-gray-900">City Profiles:</strong> Population data, county location, demographics, and detailed city information. 
                    Browse the <Link href="/explore/cities" className="text-gray-700 underline hover:text-gray-900 transition-colors">complete cities directory</Link> to find information about Minneapolis, St. Paul, Rochester, Duluth, and all other Minnesota cities.
                  </li>
                  <li>
                    <strong className="text-gray-900">County Profiles:</strong> Area measurements, population statistics, geographic data, official county websites, and county characteristics. 
                    Explore the <Link href="/explore/counties" className="text-gray-700 underline hover:text-gray-900 transition-colors">complete counties directory</Link> for all 87 Minnesota counties.
                  </li>
                  <li>
                    <strong className="text-gray-900">Official County Websites:</strong> Direct links to official government websites for featured counties, providing access to county services, 
                    resources, and official information.
                  </li>
                  <li>
                    <strong className="text-gray-900">Location Data:</strong> Comprehensive geographic and demographic information for research, planning, relocation, and business decisions.
                  </li>
                  <li>
                    <strong className="text-gray-900">Quick Navigation:</strong> Easy access to popular cities and counties with direct links to detailed pages, sorted by population, area, and other metrics.
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Minnesota Regions & Metro Areas</h3>
              <p className="text-xs text-gray-600 leading-relaxed mb-2">
                Minnesota is organized into distinct regions, each with unique characteristics:
              </p>
              <div className="bg-white rounded-md border border-gray-200 p-[10px]">
                <ul className="list-disc list-inside space-y-1 text-xs text-gray-600 ml-1">
                  <li>
                    <strong className="text-gray-900">Twin Cities Metro:</strong> The seven-county metropolitan area including 
                    <Link href="/explore/county/hennepin" className="text-gray-700 underline hover:text-gray-900 transition-colors"> Hennepin</Link>, 
                    <Link href="/explore/county/ramsey" className="text-gray-700 underline hover:text-gray-900 transition-colors"> Ramsey</Link>, 
                    <Link href="/explore/county/dakota" className="text-gray-700 underline hover:text-gray-900 transition-colors"> Dakota</Link>, 
                    <Link href="/explore/county/anoka" className="text-gray-700 underline hover:text-gray-900 transition-colors"> Anoka</Link>, 
                    <Link href="/explore/county/washington" className="text-gray-700 underline hover:text-gray-900 transition-colors"> Washington</Link>, 
                    <Link href="/explore/county/scott" className="text-gray-700 underline hover:text-gray-900 transition-colors"> Scott</Link>, and 
                    <Link href="/explore/county/carver" className="text-gray-700 underline hover:text-gray-900 transition-colors"> Carver</Link> counties.
                  </li>
                  <li>
                    <strong className="text-gray-900">Greater Minnesota:</strong> All areas outside the Twin Cities metro, including regional centers like 
                    <Link href="/explore/city/rochester" className="text-gray-700 underline hover:text-gray-900 transition-colors"> Rochester</Link> (Olmsted County), 
                    <Link href="/explore/city/duluth" className="text-gray-700 underline hover:text-gray-900 transition-colors"> Duluth</Link> (St. Louis County), and other communities throughout the state.
                  </li>
                  <li>
                    <strong className="text-gray-900">Northern Minnesota:</strong> Including <Link href="/explore/county/st-louis" className="text-gray-700 underline hover:text-gray-900 transition-colors">St. Louis County</Link> (the largest county by area) and other northern counties.
                  </li>
                  <li>
                    <strong className="text-gray-900">Southern Minnesota:</strong> Including agricultural regions and communities along the Minnesota River and Mississippi River.
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Getting Started</h3>
              <p className="text-xs text-gray-600 leading-relaxed mb-2">
                Use the directories above to browse cities and counties. Each directory page provides search and filter capabilities, 
                allowing you to find specific locations quickly. Click on any city or county name to view detailed profiles with 
                comprehensive information about that location. Featured counties include direct links to official government websites 
                for easy access to county services and resources.
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Start by exploring the <Link href="/explore/cities" className="text-gray-700 underline hover:text-gray-900 transition-colors">Minnesota Cities Directory</Link> or 
                the <Link href="/explore/counties" className="text-gray-700 underline hover:text-gray-900 transition-colors">Minnesota Counties Directory</Link> to discover detailed information about any location in the Land of 10,000 Lakes.
              </p>
            </div>
          </div>
        </div>
      </SimplePageLayout>
    </>
  );
}
