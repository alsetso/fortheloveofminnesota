import { Metadata } from 'next';
import Link from 'next/link';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import InlineAtlasMap from '@/features/atlas/components/InlineAtlasMap';
import { BuildingOffice2Icon, RectangleGroupIcon, MapIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { createServerClient } from '@/lib/supabaseServer';
import { getVisibleAtlasTypes } from '@/features/atlas/services/atlasTypesService';
import { generateExploreStructuredData, generateBreadcrumbStructuredData } from '@/lib/utils/structuredData';
import ExploreBreadcrumbs from '@/components/navigation/ExploreBreadcrumbs';
import PageViewTracker from '@/components/analytics/PageViewTracker';

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
  
  return generateExploreMetadata(cityCount || 0, countyCount || 87);
}


export default async function ExplorePage() {
  const supabase = createServerClient();
  
  // Parallelize all independent queries for better performance
  const [
    visibleTypes,
    cityCountResult,
    countyCountResult,
    favoriteCountiesResult,
    topCitiesResult,
    topCountiesResult,
    largestCountiesResult,
    totalPopulationResult,
  ] = await Promise.all([
    getVisibleAtlasTypes(),
    supabase.from('cities').select('*', { count: 'exact', head: true }),
    supabase.from('counties').select('*', { count: 'exact', head: true }),
    supabase
      .from('counties')
      .select('name, slug, website_url, population, area_sq_mi')
      .eq('favorite', true)
      .order('population', { ascending: false })
      .limit(21),
    supabase
      .from('cities')
      .select('name, slug, population, favorite, website_url')
      .not('population', 'is', null)
      .order('population', { ascending: false })
      .limit(10),
    supabase
      .from('counties')
      .select('name, slug, population, area_sq_mi')
      .order('population', { ascending: false })
      .limit(10),
    supabase
      .from('counties')
      .select('name, slug, area_sq_mi, population')
      .order('area_sq_mi', { ascending: false })
      .limit(5),
    // Fetch only population column for aggregation (more efficient than fetching all data)
    supabase.from('counties').select('population'),
  ]);

  const cityCount = cityCountResult.count || 0;
  const countyCount = countyCountResult.count || 87;

  const favoriteCountiesData: FavoriteCounty[] = (favoriteCountiesResult.data || []) as FavoriteCounty[];
  const topCitiesData: TopCity[] = (topCitiesResult.data || []) as TopCity[];
  const topCountiesData: TopCounty[] = (topCountiesResult.data || []) as TopCounty[];
  const largestCountiesData: LargestCounty[] = (largestCountiesResult.data || []) as LargestCounty[];

  // Calculate total population from fetched data
  const totalPopulation = (totalPopulationResult.data || [] as Array<{ population: number }>).reduce((sum, c) => sum + c.population, 0);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const structuredData = generateExploreStructuredData(
    cityCount || 0,
    countyCount || 87,
    favoriteCountiesData
  );
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: 'Home', url: `${baseUrl}/` },
    { name: 'Explore', url: `${baseUrl}/explore` },
  ]);

  return (
    <>
      <PageViewTracker />
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
          <ExploreBreadcrumbs
            items={[
              { name: 'Home', href: '/' },
              { name: 'Explore', href: '/explore', isCurrentPage: true },
            ]}
          />

          {/* Header */}
          <div className="mb-3">
            <h1 className="text-sm font-semibold text-gray-900 mb-2">
              Explore Minnesota
            </h1>
            <p className="text-xs text-gray-600 max-w-3xl mb-2">
              Discover the great state of Minnesota through comprehensive directories of cities and counties. 
              Explore population data, geographic information, demographics, and unique characteristics of each location.
            </p>
            <p className="text-xs text-gray-500 max-w-3xl mb-3">
              Whether you&apos;re researching demographics, planning a visit, or looking for detailed information about Minnesota locations, 
              our directories provide access to comprehensive data about all cities and counties in the Land of 10,000 Lakes.
            </p>
          </div>

          {/* Inline Atlas Map */}
          <div className="mb-3">
            <InlineAtlasMap height="400px" />
            
            {/* Atlas Legend */}
            <div className="mt-3 bg-white rounded-md border border-gray-200 p-[10px]">
              <h3 className="text-xs font-semibold text-gray-900 mb-2">Map Legend</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {visibleTypes.map((type) => (
                  <Link
                    key={type.slug}
                    href={`/explore/atlas/${type.slug}`}
                    className="flex items-center gap-1.5 hover:text-gray-900 transition-colors"
                  >
                    {type.icon_path && (
                      <img src={type.icon_path} alt={type.name} className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="text-xs text-gray-600 hover:text-gray-900">{type.name}</span>
                  </Link>
                ))}
              </div>
            </div>
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
                {topCitiesData.map((city, idx) => (
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
                        {city.population !== null ? city.population.toLocaleString() : 'N/A'}
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
                {topCountiesData.map((county, idx) => (
                  <li key={county.slug || idx}>
                    {county.slug ? (
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
                    ) : (
                      <div className="text-xs text-gray-700 flex items-center justify-between">
                        <span>
                          <span className="text-gray-500 mr-1.5">{idx + 1}.</span>
                          {county.name.replace(/\s+County$/, '')}
                        </span>
                        <span className="text-xs text-gray-500">
                          {county.population.toLocaleString()}
                        </span>
                      </div>
                    )}
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
                {largestCountiesData.map((county, idx) => (
                  <div key={county.slug || idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 w-4">{idx + 1}.</span>
                      {county.slug ? (
                        <Link
                          href={`/explore/county/${county.slug}`}
                          className="text-gray-700 hover:text-gray-900 transition-colors"
                        >
                          {county.name.replace(/\s+County$/, '')}
                        </Link>
                      ) : (
                        <span className="text-gray-700">{county.name.replace(/\s+County$/, '')}</span>
                      )}
                    </div>
                    <div className="text-gray-600">
                      {county.area_sq_mi !== null ? `${county.area_sq_mi.toLocaleString()} sq mi` : 'N/A'}
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

          {/* Related Sections */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <h2 className="text-xs font-semibold text-gray-900 mb-2">Related</h2>
            <div className="flex flex-wrap gap-2">
              <Link href="/faqs" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
                FAQs
              </Link>
              <span className="text-gray-300">•</span>
              <Link href="/contact" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </SimplePageLayout>
    </>
  );
}
