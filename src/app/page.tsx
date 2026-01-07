import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import {
  BuildingLibraryIcon,
  GlobeAltIcon,
  UserGroupIcon,
  ScaleIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import Image from 'next/image';
import { createServerClient } from '@/lib/supabaseServer';
import { getVisibleAtlasTypes } from '@/features/atlas/services/atlasTypesService';
import HomepageViewTracker from '@/components/analytics/HomepageViewTracker';
import HomepageProfileColumn from '@/features/homepage/components/HomepageProfileColumn';
import HomepageNewsSection from '@/features/homepage/components/HomepageNewsSection';
import HomepageMapPreview from '@/features/homepage/components/HomepageMapPreview';

export const metadata: Metadata = {
  title: 'For the Love of Minnesota',
  description: "For the Love of Minnesota connects residents, neighbors, and professionals across the state. Drop a pin to archive a special part of your life in Minnesota.",
  keywords: 'Minnesota, Minnesota residents, Minnesota neighbors, Minnesota community, Minnesota locations, Minnesota cities, Minnesota counties, archive Minnesota, Minnesota memories, Minnesota stories',
  openGraph: {
    title: 'For the Love of Minnesota',
    description: "For the Love of Minnesota connects residents, neighbors, and professionals across the state. Drop a pin to archive a special part of your life in Minnesota.",
    url: 'https://fortheloveofminnesota.com',
    siteName: 'For the Love of Minnesota',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'For the Love of Minnesota',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
};

export default async function Home() {
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
        console.warn(`[HomePage] Error fetching count for ${type.slug}:`, error);
        return { slug: type.slug, count: 0 };
      }
      
      return { slug: type.slug, count: count || 0 };
    } catch (error) {
      console.error(`[HomePage] Error fetching count for ${type.slug}:`, error);
      return { slug: type.slug, count: 0 };
    }
  });

  const counts = await Promise.all(countPromises);
  const countMap = counts.reduce((acc, { slug, count }) => {
    acc[slug] = count;
    return acc;
  }, {} as Record<string, number>);

  return (
    <SimplePageLayout containerMaxWidth="full" backgroundColor="bg-[#f4f2ef]" contentPadding="py-3">
      <HomepageViewTracker />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 px-[10px]">
        {/* First Column: Profile Card */}
        <div className="lg:col-span-3">
          <div className="lg:sticky lg:top-16 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:max-w-[25rem]">
            <HomepageProfileColumn />
          </div>
        </div>

        {/* Middle Column: Main Content */}
        <div className="lg:col-span-6">
          <div className="space-y-6">
            {/* Hero Section */}
            <section className="space-y-4 text-center py-8 border-b border-gray-200">
              <div className="flex justify-center">
                <Image
                  src="/mid_text For the love of mn.png"
                  alt="For the Love of Minnesota"
                  width={600}
                  height={200}
                  className="w-full max-w-2xl h-auto"
                  priority
                  unoptimized
                />
              </div>
              <p className="text-xs text-gray-600 leading-relaxed max-w-2xl mx-auto px-4">
                Create and explore interactive maps of Minnesota. Drop pins to mark places, build custom maps for your community or business, and discover locations across the state through our comprehensive atlas layers.
              </p>
            </section>

            {/* Map Preview Section */}
            <section className="pt-4">
              <HomepageMapPreview />
            </section>

            {/* Atlas Tables Grid */}
            <section className="space-y-3 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <GlobeAltIcon className="w-4 h-4 text-gray-700" />
                <h2 className="text-sm font-semibold text-gray-900">EXPLORE</h2>
              </div>
              <p className="text-xs text-gray-600">
                Complete directory of all Minnesota atlas layers. Explore comprehensive geographic and demographic datasets covering cities, neighborhoods, schools, parks, lakes, hospitals, churches, and more.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                      href={`/map/atlas/${type.slug}`}
                      className="bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 hover:border-gray-300 transition-all group"
                    >
                      {content}
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* Business Collaboration CTA */}
            <section className="space-y-3 pt-6 border-t border-gray-200">
              <div className="bg-white rounded-md border border-gray-200 p-[10px]">
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-900">Business Collaborations</h3>
                  <p className="text-xs text-gray-600">
                    We're open to business collaborations and partnerships. Interested in working together?
                  </p>
                  <a
                    href="mailto:loveofminnesota@gmail.com"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    <span>loveofminnesota@gmail.com</span>
                  </a>
                </div>
              </div>
            </section>

            {/* Government Section */}
            <section className="space-y-3 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <BuildingLibraryIcon className="w-4 h-4 text-gray-700" />
                <h2 className="text-sm font-semibold text-gray-900">GOVERNMENT</h2>
              </div>
              <p className="text-xs text-gray-600">
                Understand how Minnesota government works, who holds power, and where citizens can engage effectively.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Link
                  href="/gov"
                  className="bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 hover:border-gray-300 transition-all space-y-2 group"
                >
                  <div className="flex items-start gap-2">
                    <UserGroupIcon className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5 group-hover:text-gray-900 transition-colors" />
                    <div className="space-y-0.5 flex-1">
                      <p className="text-xs font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">Power of Citizens</p>
                      <p className="text-xs text-gray-600">
                        Minnesota citizens hold ultimate power through voting, public participation, and direct engagement with government.
                      </p>
                    </div>
                  </div>
                </Link>
                <Link
                  href="/gov"
                  className="bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 hover:border-gray-300 transition-all space-y-2 group"
                >
                  <div className="flex items-start gap-2">
                    <ScaleIcon className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5 group-hover:text-gray-900 transition-colors" />
                    <div className="space-y-0.5 flex-1">
                      <p className="text-xs font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">Gov Officials in Three Branches</p>
                      <p className="text-xs text-gray-600">
                        Explore Minnesota's legislative, executive, and judicial branches. Understand who makes decisions and where authority lives.
                      </p>
                    </div>
                  </div>
                </Link>
                <Link
                  href="/gov/checkbook"
                  className="bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 hover:border-gray-300 transition-all space-y-2 group"
                >
                  <div className="flex items-start gap-2">
                    <CurrencyDollarIcon className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5 group-hover:text-gray-900 transition-colors" />
                    <div className="space-y-0.5 flex-1">
                      <p className="text-xs font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">Checkbook</p>
                      <p className="text-xs text-gray-600">
                        Access government financial data including contracts, payments, budgets, and state payroll for transparency and accountability.
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            </section>
          </div>
        </div>

        {/* Third Column: News */}
        <div className="lg:col-span-3">
          <div className="lg:sticky lg:top-16 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
            <HomepageNewsSection />
          </div>
        </div>
      </div>
    </SimplePageLayout>
  );
}
