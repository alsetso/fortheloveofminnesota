import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import { createServerClient } from '@/lib/supabaseServer';
import { CitiesListView } from '@/features/atlas/components/CitiesListView';
import Link from 'next/link';
import { StarIcon } from '@heroicons/react/24/solid';
import { formatNumber } from '@/lib/utils/formatting';
import { generateCitiesStructuredData, generateBreadcrumbStructuredData } from '@/lib/utils/structuredData';
import ExploreBreadcrumbs from '@/components/navigation/ExploreBreadcrumbs';
import { handleQueryError } from '@/lib/utils/errorHandling';
import { generateCitiesMetadata } from '@/lib/utils/metadata';
import type { CityListItem } from '@/types/explore';

// ISR: Revalidate every hour for fresh data, but serve cached instantly
export const revalidate = 3600; // 1 hour

export async function generateMetadata(): Promise<Metadata> {
  const supabase = createServerClient();
  const { count } = await supabase
    .from('cities')
    .select('*', { count: 'exact', head: true });
  
  return generateCitiesMetadata(count || 0);
}


export default async function CitiesListPage() {
  const supabase = createServerClient();

  // Fetch all cities ordered by population (descending)
  const { data: cities, error } = await supabase
    .from('cities')
    .select('id, name, slug, population, county, favorite, website_url')
    .order('population', { ascending: false }) as { data: { id: string; name: string; slug: string; population: number | null; county: string | null; favorite: boolean | null; website_url: string | null }[] | null; error: any };

  const allCities: CityListItem[] = handleQueryError(
    error,
    'CitiesListPage: cities',
    (cities || []) as CityListItem[]
  );
  const totalPopulation = allCities.reduce((sum, c) => sum + (c.population || 0), 0);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const citiesWithPopulation = allCities.filter(c => c.population !== null) as { id: string; name: string; slug: string; population: number; county: string | null }[];
  const structuredData = generateCitiesStructuredData(citiesWithPopulation, totalPopulation);
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: 'Home', url: `${baseUrl}/` },
    { name: 'Explore', url: `${baseUrl}/explore` },
    { name: 'Cities', url: `${baseUrl}/explore/cities` },
  ]);

  return (
    <>
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
              { name: 'Explore', href: '/explore' },
              { name: 'Cities', href: '/explore/cities', isCurrentPage: true },
            ]}
          />

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
                .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
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
                    <span className="text-gray-600">{city.population !== null ? formatNumber(city.population) : 'N/A'}</span>
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
