import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import SimplePageLayout from '@/components/SimplePageLayout';
import { createServerClient } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import CountyPageClient from './CountyPageClient';
import CountyMap from '@/components/counties/CountyMap';
import CountyEditButton from '@/components/counties/CountyEditButton';
import { StarIcon } from '@heroicons/react/24/solid';
import { County } from '@/features/admin/services/countyAdminService';
import Views from '@/components/ui/Views';

type Props = {
  params: Promise<{ slug: string }>;
};

// Pre-generate all county pages at build time for instant loading
export async function generateStaticParams() {
  const supabase = createServerClient();
  const { data: counties } = await supabase
    .from('counties')
    .select('slug')
    .not('slug', 'is', null);
  
  return (counties || []).map((county) => ({
    slug: county.slug!,
  }));
}

// ISR: Revalidate every hour, but serve stale content instantly
export const revalidate = 3600; // 1 hour
export const dynamicParams = false; // Only serve pre-generated pages

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createServerClient();
  
  const { data: county } = await supabase
    .from('counties')
    .select('name, population, area_sq_mi, meta_title, meta_description')
    .eq('slug', slug)
    .single();

  if (!county) {
    return {
      title: 'County Not Found | MNUDA',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const countyMeta = county as {
    name: string;
    population: number;
    area_sq_mi: number;
    meta_title: string | null;
    meta_description: string | null;
  };

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const url = `${baseUrl}/explore/county/${slug}`;
  const title = countyMeta.meta_title || `${countyMeta.name}, Minnesota | County Information`;
  const description = countyMeta.meta_description || `${countyMeta.name}, Minnesota. Population: ${countyMeta.population.toLocaleString()}, Area: ${countyMeta.area_sq_mi.toLocaleString()} sq mi. Information about ${countyMeta.name} County including cities, demographics, and resources.`;
  const countyNameShort = countyMeta.name.replace(/\s+County$/, '');

  return {
    title,
    description,
    keywords: [
      `${countyMeta.name}`,
      `${countyNameShort} County`,
      'Minnesota county',
      'MN county',
      'county information',
      'county demographics',
      'county population',
      'Minnesota geography',
    ],
    openGraph: {
      title,
      description,
      url,
      siteName: 'MNUDA',
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    alternates: {
      canonical: url,
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

export default async function CountyPage({ params }: Props) {
  const { slug } = await params;
  const supabase = createServerClient();

  // Check if user is admin
  const auth = await getServerAuth();
  const isAdmin = auth?.role === 'admin';

  // Fetch the selected county
  const { data: county, error: countyError } = await supabase
    .from('counties')
    .select('*')
    .eq('slug', slug)
    .single();

  if (countyError || !county) {
    notFound();
  }

  // Type assertion for county data with additional fields
  const countyData = county as County & { 
    slug: string | null;
    view_count?: number;
  };

  // Extract county name without "County" suffix for matching cities
  const countyNameBase = countyData.name.replace(/\s+County$/, '');

  // Fetch cities in this county (cities.county is a text field that may contain the county name)
  const { data: cities, error: citiesError } = await supabase
    .from('cities')
    .select('id, name, slug, population, favorite, website_url')
    .or(`county.ilike.%${countyNameBase}%,county.ilike.%${countyData.name}%`)
    .order('population', { ascending: false })
    .limit(50);

  if (citiesError) {
    // Log error but continue with empty array
    console.error('[CountyPage] Error fetching cities:', citiesError);
  }

  const citiesData = (cities || []) as Array<{
    id: string;
    name: string;
    slug: string | null;
    population: number;
    favorite: boolean;
    website_url: string | null;
  }>;

  // Fetch all other counties for navigation
  const { data: otherCounties, error: otherCountiesError } = await supabase
    .from('counties')
    .select('id, name, slug')
    .neq('id', countyData.id)
    .order('name', { ascending: true });

  if (otherCountiesError) {
    // Log error but continue with empty array
    console.error('[CountyPage] Error fetching other counties:', otherCountiesError);
  }

  const otherCountiesData = (otherCounties || []) as Array<{
    id: string;
    name: string;
    slug: string | null;
  }>;

  return (
    <SimplePageLayout contentPadding="px-[10px] py-3" hideFooter={false}>
      <CountyPageClient countyId={countyData.id} countySlug={countyData.slug || slug} />
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
            <li>
              <Link href="/explore/counties" className="hover:text-gray-900 transition-colors">
                Counties
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 font-medium" aria-current="page">{countyData.name}</li>
          </ol>
        </nav>

        {/* Government-style header */}
        <div className="mb-3 pb-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-semibold text-gray-900">{countyData.name}</h1>
              {countyData.favorite && (
                <StarIcon className="w-3 h-3 text-gray-700" aria-label="Featured county" />
              )}
            </div>
            {isAdmin && (
              <CountyEditButton
                county={countyData}
                isAdmin={isAdmin}
              />
            )}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600">Minnesota</p>
            {countyData.view_count !== undefined && countyData.view_count > 0 && (
              <Views count={countyData.view_count} size="sm" className="text-gray-500" />
            )}
          </div>
        </div>

        {/* Quick Facts Cards - Scannable Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <div className="bg-white rounded-md border border-gray-200 p-[10px]">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Population</p>
            <p className="text-sm font-semibold text-gray-900">{formatNumber(countyData.population)}</p>
          </div>
          <div className="bg-white rounded-md border border-gray-200 p-[10px]">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Area</p>
            <p className="text-sm font-semibold text-gray-900">{formatArea(countyData.area_sq_mi)}</p>
          </div>
          <div className="bg-white rounded-md border border-gray-200 p-[10px]">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Cities</p>
            <p className="text-sm font-semibold text-gray-900">{citiesData.length}</p>
          </div>
          <div className="bg-white rounded-md border border-gray-200 p-[10px]">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Density</p>
            <p className="text-sm font-semibold text-gray-900">
              {countyData.area_sq_mi > 0 
                ? Math.round(countyData.population / countyData.area_sq_mi).toLocaleString()
                : 'N/A'
              }/sq mi
            </p>
          </div>
        </div>

        {/* Main content - text-heavy with inline links */}
        <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
          {/* Inline Map - Only for favorited counties */}
          {countyData.favorite && countyData.polygon && (
            <div className="mb-3">
              <CountyMap
                polygon={(countyData.polygon as GeoJSON.Polygon | GeoJSON.MultiPolygon | null) || null}
                countyName={countyData.name}
                height="300px"
              />
            </div>
          )}

          {/* Overview */}
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Overview</h2>
            <p className="mb-1.5">
              <strong className="text-gray-900">{countyData.name}</strong> is located in Minnesota with a population of <strong className="text-gray-900">{formatNumber(countyData.population)}</strong> residents 
              and covers an area of <strong className="text-gray-900">{formatArea(countyData.area_sq_mi)}</strong>. 
              {citiesData.length > 0 && (
                <span>
                  {' '}The county includes {citiesData.length} {citiesData.length === 1 ? 'city' : 'cities'}, including{' '}
                  {citiesData.slice(0, 5).map((city, idx) => (
                    <span key={city.id}>
                      {idx > 0 && idx < citiesData.slice(0, 5).length - 1 && ', '}
                      {idx === citiesData.slice(0, 5).length - 1 && citiesData.length > 1 && ' and '}
                      <Link href={`/explore/city/${city.slug}`} className="text-gray-700 underline hover:text-gray-900 transition-colors">
                        {city.name}
                      </Link>
                    </span>
                  ))}
                  {citiesData.length > 5 && (
                    <span>
                      {' '}and <Link href="/explore/counties" className="text-gray-700 underline hover:text-gray-900 transition-colors">others</Link>
                    </span>
                  )}
                  .
                </span>
              )}
            </p>
          </section>

          {/* Pro+ Subscription Section - Only for favorited counties */}
          {countyData.favorite && (
            <section className="bg-white rounded-md border border-gray-200 p-[10px]">
              <div className="flex items-start gap-2 mb-2">
                <div className="flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-gray-900 mb-1">Unlock Foreclosure Data with Pro+</h2>
                  <p className="text-xs text-gray-600 mb-2">
                    Get access to comprehensive foreclosure data for all {countyData.name} and all other favorited counties. 
                    Pro+ subscribers receive detailed foreclosure listings, property information, and market insights.
                  </p>
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-900">$80/month</p>
                      <p className="text-xs text-gray-500">Unlock all favorited counties</p>
                    </div>
                    <Link
                      href="/account/change-plan"
                      className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md hover:bg-gray-800 transition-colors"
                    >
                      Upgrade to Pro+
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Quick Links - Contextual Navigation */}
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Quick Links</h2>
            <ul className="list-disc list-inside space-y-0.5 ml-1">
              {citiesData.length > 0 && (
                <li>
                  <Link href="/explore/cities" className="text-gray-700 underline hover:text-gray-900 transition-colors">
                    View all {citiesData.length} cities in {countyData.name}
                  </Link>
                </li>
              )}
              <li>
                <Link href="/explore/counties" className="text-gray-700 underline hover:text-gray-900 transition-colors">
                  Browse all Minnesota counties
                </Link>
              </li>
              <li>
                <Link href="/explore" className="text-gray-700 underline hover:text-gray-900 transition-colors">
                  Explore Minnesota directory
                </Link>
              </li>
            </ul>
          </section>

          {/* Cities */}
          {citiesData.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Cities in {countyData.name}</h2>
              <p className="mb-1.5 text-xs text-gray-600">
                {countyData.name} includes the following {citiesData.length} {citiesData.length === 1 ? 'city' : 'cities'} and communities:
              </p>
              <div className="bg-white rounded-md border border-gray-200 p-[10px] mb-1.5">
                <ul className="list-none space-y-1 text-xs text-gray-600">
                  {citiesData.map((city) => (
                    <li key={city.id} className="leading-relaxed">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-gray-400">•</span>
                        <Link href={`/explore/city/${city.slug}`} className="text-gray-700 underline hover:text-gray-900 transition-colors font-medium">
                          {city.name}
                        </Link>
                        {city.favorite && (
                          <StarIcon className="w-3 h-3 text-gray-700 flex-shrink-0" aria-label="Featured city" />
                        )}
                        {city.population > 0 && (
                          <span className="text-gray-500">({formatNumber(city.population)} residents)</span>
                        )}
                        {city.website_url && (
                          <>
                            <span className="text-gray-400">•</span>
                            <a
                              href={city.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-500 hover:text-gray-700 underline transition-colors"
                            >
                              Website
                            </a>
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-gray-600">
                View all <Link href="/explore/cities" className="text-gray-700 underline hover:text-gray-900 transition-colors">Minnesota cities</Link> or 
                browse by <Link href="/explore/counties" className="text-gray-700 underline hover:text-gray-900 transition-colors">county</Link>.
              </p>
            </section>
          )}

          {/* Related Counties - Contextual Navigation */}
          {otherCountiesData.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Related Counties</h2>
              <p className="mb-1.5 text-xs text-gray-600">
                Browse information about other Minnesota counties:
              </p>
              <div className="bg-white rounded-md border border-gray-200 p-[10px] mb-1.5">
                <p className="text-xs text-gray-600 leading-relaxed">
                  {otherCountiesData.slice(0, 15).map((c, idx) => (
                    <span key={c.id}>
                      {idx > 0 && ', '}
                      <Link href={`/explore/county/${c.slug}`} className="text-gray-700 underline hover:text-gray-900 transition-colors">
                        {c.name.replace(/\s+County$/, '')}
                      </Link>
                    </span>
                  ))}
                  {otherCountiesData.length > 15 && (
                    <>... <Link href="/explore/counties" className="text-gray-700 underline hover:text-gray-900 transition-colors">view all {otherCountiesData.length} counties</Link></>
                  )}
                </p>
              </div>
            </section>
          )}
        </div>

        {/* Additional Information */}
        <section className="mt-3 pt-3 border-t border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Additional Information</h2>
          <p className="text-xs text-gray-600 mb-1.5">
            For comprehensive county information, demographics, and detailed statistics, visit the <Link href="/explore/counties" className="text-gray-700 underline hover:text-gray-900 transition-colors">Minnesota Counties Directory</Link>.
          </p>
          <p className="text-xs text-gray-500">
            Last updated: {new Date(countyData.updated_at || countyData.created_at).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}.
          </p>
        </section>
      </div>
    </SimplePageLayout>
  );
}

