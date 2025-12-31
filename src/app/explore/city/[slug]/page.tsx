import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import { createServerClient } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import Views from '@/components/ui/Views';
import CityPageClient from '@/features/atlas/components/CityPageClient';
import CityEditButton from '@/features/atlas/components/CityEditButton';
import CityMap from '@/features/atlas/components/CityMap';
import { City } from '@/features/admin/services/cityAdminService';
import { StarIcon } from '@heroicons/react/24/solid';
import { sanitizeCountyNameForQuery } from '@/lib/utils/querySanitization';
import { formatNumber } from '@/lib/utils/formatting';
import ExploreBreadcrumbs from '@/components/navigation/ExploreBreadcrumbs';
import { handleQueryError } from '@/lib/utils/errorHandling';
import type {
  NeighborhoodEntity,
  SchoolEntity,
  ParkEntity,
  WatertowerEntity,
  CemeteryEntity,
  GolfCourseEntity,
  HospitalEntity,
  AirportEntity,
  ChurchEntity,
  MunicipalEntity,
} from '@/types/explore';

type Props = {
  params: Promise<{ slug: string }>;
};

// Pre-generate all city pages at build time for instant loading
export async function generateStaticParams() {
  const supabase = createServerClient();
  const { data: cities } = await supabase
    .from('cities')
    .select('slug')
    .not('slug', 'is', null);
  
  return ((cities || []) as Array<{ slug: string }>).map((city) => ({
    slug: city.slug,
  }));
}

// ISR: Revalidate every hour, but serve stale content instantly
export const revalidate = 3600; // 1 hour
export const dynamicParams = false; // Only serve pre-generated pages

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createServerClient();
  
  const { data: city } = await supabase
    .from('cities')
    .select('name, population, county, meta_title, meta_description')
    .eq('slug', slug)
    .single();

  if (!city) {
    return generateNotFoundMetadata();
  }

  return generateCityMetadata(
    city as {
      name: string;
      population: number | null;
      county: string | null;
      meta_title: string | null;
      meta_description: string | null;
    },
    slug
  );
}

export default async function CityPage({ params }: Props) {
  const { slug } = await params;
  const supabase = createServerClient();

  // Check if user is admin
  const auth = await getServerAuth();
  const isAdmin = auth?.role === 'admin';

  // Fetch the selected city
  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('*')
    .eq('slug', slug)
    .single();

  if (cityError || !city) {
    notFound();
  }

  // Type assertion for city data - matches City interface from admin service
  const cityData = city as City & { 
    boundary_lines?: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
    population: number | null;
    county: string | null;
  };

  // Find county by name to get county slug
  let countySlug: string | null = null;
  if (cityData.county) {
    const countyName = cityData.county.includes('County') 
      ? cityData.county 
      : `${cityData.county} County`;
    const { data: county } = await supabase
      .from('counties')
      .select('slug')
      .ilike('name', countyName)
      .single();
    if (county) {
      countySlug = (county as { slug: string | null }).slug;
    }
  }

  // Fetch all cities in the same county (matching county page logic)
  let sameCountyCitiesData: Array<{
    id: string;
    name: string;
    slug: string | null;
    population: number | null;
    favorite: boolean | null;
    website_url: string | null;
  }> = [];
  
  if (cityData.county) {
    // Sanitize county name for safe use in queries
    const { base: countyNameBase, full: countyNameFull } = sanitizeCountyNameForQuery(cityData.county);
    
    const { data: sameCountyCities, error: sameCountyError } = await supabase
      .from('cities')
      .select('id, name, slug, population, favorite, website_url')
      .or(`county.ilike.%${countyNameBase}%,county.ilike.%${countyNameFull}%`)
      .order('population', { ascending: false })
      .limit(100); // High limit to get all cities in county
    
    sameCountyCitiesData = handleQueryError(
      sameCountyError,
      'CityPage: same county cities',
      (sameCountyCities || []) as Array<{
      id: string;
      name: string;
      slug: string | null;
      population: number | null;
      favorite: boolean | null;
      website_url: string | null;
    }>;
  }

  // Fetch other favorite cities (more useful than just top cities)
  const { data: favoriteCities, error: favoriteCitiesError } = await supabase
    .from('cities')
    .select('id, name, slug, population, county, favorite, website_url')
    .eq('favorite', true)
    .neq('id', cityData.id)
    .order('population', { ascending: false })
    .limit(20);

  const favoriteCitiesData: Array<{
    id: string;
    name: string;
    slug: string | null;
    population: number | null;
    county: string | null;
    favorite: boolean | null;
    website_url: string | null;
  }> = handleQueryError(
    favoriteCitiesError,
    'CityPage: favorite cities',
    (favoriteCities || []) as Array<{
      id: string;
      name: string;
      slug: string | null;
      population: number | null;
      county: string | null;
      favorite: boolean | null;
      website_url: string | null;
    }>
  );

  // Fetch all atlas entities for this city in parallel
  const cityId = cityData.id;
  
  const [
    neighborhoodsResult,
    schoolsResult,
    parksResult,
    watertowersResult,
    cemeteriesResult,
    golfCoursesResult,
    hospitalsResult,
    airportsResult,
    churchesResult,
    municipalsResult,
  ] = await Promise.all([
    supabase.from('neighborhoods').select('id, name, slug, lat, lng, description').eq('city_id', cityId).order('name'),
    supabase.from('schools').select('id, name, slug, lat, lng, school_type, description').eq('city_id', cityId).order('name'),
    supabase.from('parks').select('id, name, slug, lat, lng, park_type, description').eq('city_id', cityId).order('name'),
    supabase.from('watertowers').select('id, name, slug, lat, lng, description').eq('city_id', cityId).order('name'),
    supabase.from('cemeteries').select('id, name, slug, lat, lng, description').eq('city_id', cityId).order('name'),
    supabase.from('golf_courses').select('id, name, slug, lat, lng, course_type, holes, description').eq('city_id', cityId).order('name'),
    supabase.from('hospitals').select('id, name, slug, lat, lng, hospital_type, description').eq('city_id', cityId).order('name'),
    supabase.from('airports').select('id, name, slug, lat, lng, airport_type, iata_code, icao_code, description').eq('city_id', cityId).order('name'),
    supabase.from('churches').select('id, name, slug, lat, lng, church_type, denomination, description').eq('city_id', cityId).order('name'),
    supabase.from('municipals').select('id, name, slug, lat, lng, municipal_type, description').eq('city_id', cityId).order('name'),
  ]);

  const neighborhoods = neighborhoodsResult.data;
  const schools = schoolsResult.data;
  const parks = parksResult.data;
  const watertowers = watertowersResult.data;
  const cemeteries = cemeteriesResult.data;
  const golfCourses = golfCoursesResult.data;
  const hospitals = hospitalsResult.data;
  const airports = airportsResult.data;
  const churches = churchesResult.data;
  const municipals = municipalsResult.data;

  // Type assertions for atlas entities
  const neighborhoodsData: NeighborhoodEntity[] = (neighborhoods || []) as NeighborhoodEntity[];
  const schoolsData: SchoolEntity[] = (schools || []) as SchoolEntity[];
  const parksData: ParkEntity[] = (parks || []) as ParkEntity[];
  const watertowersData: WatertowerEntity[] = (watertowers || []) as WatertowerEntity[];
  const cemeteriesData: CemeteryEntity[] = (cemeteries || []) as CemeteryEntity[];
  const golfCoursesData: GolfCourseEntity[] = (golfCourses || []) as GolfCourseEntity[];
  const hospitalsData: HospitalEntity[] = (hospitals || []) as HospitalEntity[];
  const airportsData: AirportEntity[] = (airports || []) as AirportEntity[];
  const churchesData: ChurchEntity[] = (churches || []) as ChurchEntity[];
  const municipalsData: MunicipalEntity[] = (municipals || []) as MunicipalEntity[];

  return (
    <SimplePageLayout contentPadding="px-[10px] py-3" hideFooter={false}>
      <CityPageClient cityId={cityData.id} citySlug={cityData.slug || slug} />
      <div className="max-w-4xl mx-auto">
        <ExploreBreadcrumbs
          items={[
            { name: 'Home', href: '/' },
            { name: 'Explore', href: '/explore' },
            { name: 'Cities', href: '/explore/cities' },
            { name: cityData.name, href: `/explore/city/${cityData.slug || slug}`, isCurrentPage: true },
          ]}
        />

        {/* Government-style header */}
        <div className="mb-3 pb-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-semibold text-gray-900">{cityData.name}</h1>
              {cityData.favorite && (
                <StarIcon className="w-3 h-3 text-gray-700" aria-label="Featured city" />
              )}
            </div>
            {isAdmin && (
              <CityEditButton
                city={cityData}
                isAdmin={isAdmin}
              />
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-600">Minnesota{cityData.county && `, ${cityData.county}`}</p>
              {cityData.website_url && (
                <Link
                  href={cityData.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:text-gray-700 underline transition-colors"
                >
                  Official Website
                </Link>
              )}
            </div>
            {cityData.view_count !== undefined && cityData.view_count !== null && cityData.view_count > 0 && (
              <Views count={cityData.view_count} size="sm" className="text-gray-500" />
            )}
          </div>
        </div>

        {/* Quick Facts Cards - Scannable Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <div className="bg-white rounded-md border border-gray-200 p-[10px]">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Population</p>
            <p className="text-sm font-semibold text-gray-900">{cityData.population !== null ? formatNumber(cityData.population) : 'N/A'}</p>
          </div>
          {cityData.county && (
            <div className="bg-white rounded-md border border-gray-200 p-[10px]">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">County</p>
              <p className="text-sm font-semibold text-gray-900">
                {countySlug ? (
                  <Link href={`/explore/county/${countySlug}`} className="text-gray-700 underline hover:text-gray-900 transition-colors">
                    {cityData.county}
                  </Link>
                ) : (
                  cityData.county
                )}
              </p>
            </div>
          )}
          {sameCountyCitiesData.length > 0 && (
            <div className="bg-white rounded-md border border-gray-200 p-[10px]">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Cities in County</p>
              <p className="text-sm font-semibold text-gray-900">{sameCountyCitiesData.length + 1}</p>
            </div>
          )}
          {/* Empty placeholder to maintain grid alignment when county or cities data is missing */}
          {(!cityData.county || sameCountyCitiesData.length === 0) && (
            <div className="bg-white rounded-md border border-gray-200 p-[10px] hidden md:block">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Location</p>
              <p className="text-sm font-semibold text-gray-900">Minnesota</p>
            </div>
          )}
        </div>

        {/* Main content - text-heavy with inline links */}
        <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
          {/* Inline Map - Only if city has coordinates or boundary lines */}
          {(cityData.boundary_lines || (cityData.lat && cityData.lng)) && (
            <div className="mb-3">
              <CityMap
                coordinates={cityData.lat && cityData.lng ? { lat: parseFloat(cityData.lat.toString()), lng: parseFloat(cityData.lng.toString()) } : null}
                boundaryLines={cityData.boundary_lines as GeoJSON.Polygon | GeoJSON.MultiPolygon | null | undefined}
                cityName={cityData.name}
                height="300px"
              />
            </div>
          )}

          {/* Overview */}
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Overview</h2>
            <p className="mb-1.5">
              <strong className="text-gray-900">{cityData.name}</strong> is located in Minnesota
              {cityData.county && (
                <>
                  {' '}in <strong className="text-gray-900">{cityData.county}</strong>
                  {countySlug && (
                    <> (<Link href={`/explore/county/${countySlug}`} className="text-gray-700 underline hover:text-gray-900 transition-colors">county information</Link>)</>
                  )}
                </>
              )}
              {' '}with a population of <strong className="text-gray-900">{cityData.population !== null ? formatNumber(cityData.population) : 'N/A'}</strong> residents.
              {sameCountyCitiesData.length > 0 && (
                <span>
                  {' '}The city is part of {cityData.county || 'the county'}, which includes {sameCountyCitiesData.length} other {sameCountyCitiesData.length === 1 ? 'city' : 'cities'}, including{' '}
                  {sameCountyCitiesData.slice(0, 3).map((city, idx) => (
                    <span key={city.id}>
                      {idx > 0 && idx < Math.min(sameCountyCitiesData.length, 3) - 1 && ', '}
                      {idx === Math.min(sameCountyCitiesData.length, 3) - 1 && sameCountyCitiesData.length > 1 && ' and '}
                      {city.slug ? (
                        <Link href={`/explore/city/${city.slug}`} className="text-gray-700 underline hover:text-gray-900 transition-colors">
                          {city.name}
                        </Link>
                      ) : (
                        <span>{city.name}</span>
                      )}
                    </span>
                  ))}
                  {sameCountyCitiesData.length > 3 && (
                    <span>
                      {' '}and <Link href="/explore/cities" className="text-gray-700 underline hover:text-gray-900 transition-colors">others</Link>
                    </span>
                  )}
                  .
                </span>
              )}
            </p>
          </section>

          {/* Quick Links - Contextual Navigation */}
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Quick Links</h2>
            <ul className="list-disc list-inside space-y-0.5 ml-1">
              {cityData.county && countySlug && (
                <li>
                  <Link href={`/explore/county/${countySlug}`} className="text-gray-700 underline hover:text-gray-900 transition-colors">
                    View {cityData.county} county information
                  </Link>
                </li>
              )}
              {sameCountyCitiesData.length > 0 && (
                <li>
                  <Link href="/explore/cities" className="text-gray-700 underline hover:text-gray-900 transition-colors">
                    View other cities in {cityData.county}
                  </Link>
                </li>
              )}
              <li>
                <Link href="/explore/cities" className="text-gray-700 underline hover:text-gray-900 transition-colors">
                  Browse all Minnesota cities
                </Link>
              </li>
              <li>
                <Link href="/explore" className="text-gray-700 underline hover:text-gray-900 transition-colors">
                  Explore Minnesota directory
                </Link>
              </li>
            </ul>
          </section>

          {/* Cities in Same County */}
          {cityData.county && sameCountyCitiesData.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Cities in {cityData.county}</h2>
              <p className="mb-1.5 text-xs text-gray-600">
                {cityData.county} includes the following {sameCountyCitiesData.length + 1} {(sameCountyCitiesData.length + 1) === 1 ? 'city' : 'cities'} and communities:
              </p>
              <div className="bg-white rounded-md border border-gray-200 p-[10px] mb-1.5">
                <ul className="list-none space-y-1 text-xs text-gray-600">
                  {(() => {
                    // Combine current city with county cities, ensuring no duplicates
                    const allCountyCities = [
                      { id: cityData.id, name: cityData.name, slug: cityData.slug, population: cityData.population ?? null, favorite: cityData.favorite ?? null, website_url: cityData.website_url },
                      ...sameCountyCitiesData.filter(c => c.id !== cityData.id)
                    ];
                    
                    return allCountyCities
                      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
                      .map((c) => (
                        <li key={c.id} className="leading-relaxed">
                          <span className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-gray-400">•</span>
                            {c.slug ? (
                              <Link href={`/explore/city/${c.slug}`} className="text-gray-700 underline hover:text-gray-900 transition-colors font-medium">
                                {c.name}
                              </Link>
                            ) : (
                              <span className="text-gray-700 font-medium">{c.name}</span>
                            )}
                            {c.favorite && (
                              <StarIcon className="w-3 h-3 text-gray-700 flex-shrink-0" aria-label="Featured city" />
                            )}
                            {c.population !== null && c.population > 0 && (
                              <span className="text-gray-500">({formatNumber(c.population)} residents)</span>
                            )}
                            {c.website_url && (
                              <>
                                <span className="text-gray-400">•</span>
                                <a
                                  href={c.website_url}
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
                      ));
                  })()}
                </ul>
              </div>
              <p className="text-xs text-gray-600">
                {countySlug ? (
                  <>View complete information about <Link href={`/explore/county/${countySlug}`} className="text-gray-700 underline hover:text-gray-900 transition-colors">{cityData.county} county</Link> or browse all <Link href="/explore/cities" className="text-gray-700 underline hover:text-gray-900 transition-colors">Minnesota cities</Link>.</>
                ) : (
                  <>Browse all <Link href="/explore/cities" className="text-gray-700 underline hover:text-gray-900 transition-colors">Minnesota cities</Link>.</>
                )}
              </p>
            </section>
          )}

          {/* Other Featured Cities */}
          {favoriteCitiesData.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Other Featured Cities</h2>
              <p className="mb-1.5 text-xs text-gray-600">
                Explore other major Minnesota cities with official websites and comprehensive information:
              </p>
              <div className="bg-white rounded-md border border-gray-200 p-[10px] mb-1.5">
                <p className="text-xs text-gray-600 leading-relaxed">
                  {favoriteCitiesData.slice(0, 15).map((c, idx) => (
                    <span key={c.id}>
                      {idx > 0 && ', '}
                      {c.slug ? (
                        <Link href={`/explore/city/${c.slug}`} className="text-gray-700 underline hover:text-gray-900 transition-colors">
                          {c.name}
                        </Link>
                      ) : (
                        <span>{c.name}</span>
                      )}
                    </span>
                  ))}
                  {favoriteCitiesData.length > 15 && (
                    <>... <Link href="/explore/cities" className="text-gray-700 underline hover:text-gray-900 transition-colors">view all featured cities</Link></>
                  )}
                </p>
              </div>
            </section>
          )}
        </div>

          {/* Atlas Entities Sections */}
          {(neighborhoodsData && neighborhoodsData.length > 0) && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Neighborhoods ({neighborhoodsData.length})</h2>
              <div className="bg-white rounded-md border border-gray-200 p-[10px]">
                <ul className="list-none space-y-1 text-xs text-gray-600">
                  {neighborhoodsData.map((n) => (
                    <li key={n.id} className="leading-relaxed">
                      <span className="text-gray-400">•</span> {n.name}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {(schoolsData && schoolsData.length > 0) && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Schools ({schoolsData.length})</h2>
              <div className="bg-white rounded-md border border-gray-200 p-[10px]">
                <ul className="list-none space-y-1 text-xs text-gray-600">
                  {schoolsData.map((s) => (
                    <li key={s.id} className="leading-relaxed">
                      <span className="text-gray-400">•</span> {s.name}{s.school_type && <span className="text-gray-500"> ({s.school_type})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {(parksData && parksData.length > 0) && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Parks ({parksData.length})</h2>
              <div className="bg-white rounded-md border border-gray-200 p-[10px]">
                <ul className="list-none space-y-1 text-xs text-gray-600">
                  {parksData.map((p) => (
                    <li key={p.id} className="leading-relaxed">
                      <span className="text-gray-400">•</span> {p.name}{p.park_type && <span className="text-gray-500"> ({p.park_type})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {(watertowersData && watertowersData.length > 0) && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Watertowers ({watertowersData.length})</h2>
              <div className="bg-white rounded-md border border-gray-200 p-[10px]">
                <ul className="list-none space-y-1 text-xs text-gray-600">
                  {watertowersData.map((w) => (
                    <li key={w.id} className="leading-relaxed">
                      <span className="text-gray-400">•</span> {w.name}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {(cemeteriesData && cemeteriesData.length > 0) && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Cemeteries ({cemeteriesData.length})</h2>
              <div className="bg-white rounded-md border border-gray-200 p-[10px]">
                <ul className="list-none space-y-1 text-xs text-gray-600">
                  {cemeteriesData.map((c) => (
                    <li key={c.id} className="leading-relaxed">
                      <span className="text-gray-400">•</span> {c.name}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {(golfCoursesData && golfCoursesData.length > 0) && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Golf Courses ({golfCoursesData.length})</h2>
              <div className="bg-white rounded-md border border-gray-200 p-[10px]">
                <ul className="list-none space-y-1 text-xs text-gray-600">
                  {golfCoursesData.map((g) => (
                    <li key={g.id} className="leading-relaxed">
                      <span className="text-gray-400">•</span> {g.name}{g.course_type && <span className="text-gray-500"> ({g.course_type})</span>}{g.holes && <span className="text-gray-500"> - {g.holes} holes</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {(hospitalsData && hospitalsData.length > 0) && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Hospitals ({hospitalsData.length})</h2>
              <div className="bg-white rounded-md border border-gray-200 p-[10px]">
                <ul className="list-none space-y-1 text-xs text-gray-600">
                  {hospitalsData.map((h) => (
                    <li key={h.id} className="leading-relaxed">
                      <span className="text-gray-400">•</span> {h.name}{h.hospital_type && <span className="text-gray-500"> ({h.hospital_type})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {(airportsData && airportsData.length > 0) && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Airports ({airportsData.length})</h2>
              <div className="bg-white rounded-md border border-gray-200 p-[10px]">
                <ul className="list-none space-y-1 text-xs text-gray-600">
                  {airportsData.map((a) => (
                    <li key={a.id} className="leading-relaxed">
                      <span className="text-gray-400">•</span> {a.name}{a.airport_type && <span className="text-gray-500"> ({a.airport_type})</span>}{a.iata_code && <span className="text-gray-500"> - {a.iata_code}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {(churchesData && churchesData.length > 0) && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Churches ({churchesData.length})</h2>
              <div className="bg-white rounded-md border border-gray-200 p-[10px]">
                <ul className="list-none space-y-1 text-xs text-gray-600">
                  {churchesData.map((c) => (
                    <li key={c.id} className="leading-relaxed">
                      <span className="text-gray-400">•</span> {c.name}{c.denomination && <span className="text-gray-500"> ({c.denomination})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {(municipalsData && municipalsData.length > 0) && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Municipal Buildings ({municipalsData.length})</h2>
              <div className="bg-white rounded-md border border-gray-200 p-[10px]">
                <ul className="list-none space-y-1 text-xs text-gray-600">
                  {municipalsData.map((m) => (
                    <li key={m.id} className="leading-relaxed">
                      <span className="text-gray-400">•</span> {m.name}{m.municipal_type && <span className="text-gray-500"> ({m.municipal_type})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Additional Information */}
        <section className="mt-3 pt-3 border-t border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900 mb-1.5">Additional Information</h2>
          <p className="text-xs text-gray-600 mb-1.5">
            For comprehensive city information, demographics, and detailed statistics, visit the <Link href="/explore/cities" className="text-gray-700 underline hover:text-gray-900 transition-colors">Minnesota Cities Directory</Link>.
          </p>
          <p className="text-xs text-gray-500">
            Last updated: {new Date(cityData.updated_at || cityData.created_at).toLocaleDateString('en-US', { 
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

