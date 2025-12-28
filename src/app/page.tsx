import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import {
  HeartIcon,
  BuildingLibraryIcon,
  MapPinIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  ArrowRightIcon,
  MapIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import Image from 'next/image';
import { createServerClient } from '@/lib/supabaseServer';
import { getLatestNewsGen } from '@/features/news/services/newsService';
import { getVisibleAtlasTypes } from '@/features/atlas/services/atlasTypesService';

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

  // Fetch latest news
  const latestNews = await getLatestNewsGen();
  const apiResponse = latestNews?.api_response as {
    articles?: Array<{
      id: string;
      title: string;
      link: string;
      snippet: string;
      photoUrl?: string;
      thumbnailUrl?: string;
      publishedAt?: string;
      source?: {
        name?: string;
      };
    }>;
  } | null;
  const newsArticles = apiResponse?.articles || [];

  // Helper functions for source display
  const getSourceInitials = (sourceName: string | undefined): string => {
    if (!sourceName) return 'NEW';
    const cleaned = sourceName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return cleaned.slice(0, 3) || 'NEW';
  };

  const getSourceColor = (sourceName: string | undefined): { bg: string; text: string } => {
    const softColors = [
      { bg: 'bg-blue-100', text: 'text-blue-700' },
      { bg: 'bg-green-100', text: 'text-green-700' },
      { bg: 'bg-purple-100', text: 'text-purple-700' },
      { bg: 'bg-pink-100', text: 'text-pink-700' },
      { bg: 'bg-yellow-100', text: 'text-yellow-700' },
      { bg: 'bg-indigo-100', text: 'text-indigo-700' },
      { bg: 'bg-teal-100', text: 'text-teal-700' },
      { bg: 'bg-orange-100', text: 'text-orange-700' },
      { bg: 'bg-cyan-100', text: 'text-cyan-700' },
      { bg: 'bg-rose-100', text: 'text-rose-700' },
      { bg: 'bg-amber-100', text: 'text-amber-700' },
      { bg: 'bg-violet-100', text: 'text-violet-700' },
    ];

    if (!sourceName) return softColors[0];
    let hash = 0;
    for (let i = 0; i < sourceName.length; i++) {
      hash = sourceName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % softColors.length;
    return softColors[index];
  };

  return (
    <SimplePageLayout containerMaxWidth="7xl" backgroundColor="bg-[#f4f2ef]" contentPadding="px-[10px] py-3" footerVariant="dark">
      <div className="max-w-4xl mx-auto">
        <div className="space-y-6">
        {/* V4: Community-Focused Hero with Large Desktop Heading */}
        <section className="space-y-3 text-center py-8">
          <h1 className="text-sm md:text-3xl font-semibold text-gray-900 leading-tight">For the Love of 5,793,151 People in Minnesota</h1>
          <p className="text-xs text-gray-600 leading-relaxed">
            A living map of Minnesota–pin whats happening, what matters and what should be remembered.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2 border-t border-gray-100">
            <Link
              href="/map"
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors border border-red-700"
            >
              <MapIcon className="w-3 h-3" />
              <span>Live Map</span>
              <ArrowRightIcon className="w-3 h-3" />
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 rounded hover:bg-gray-100 hover:text-gray-900 transition-colors border border-gray-200"
            >
              <GlobeAltIcon className="w-3 h-3" />
              <span>Explore Minnesotas</span>
              <ArrowRightIcon className="w-3 h-3" />
            </Link>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">HOW IT WORKS</h2>
          <p className="text-xs text-gray-600">
            Drop pins on the map to archive special places, memories, and moments across Minnesota. Each mention becomes part of your personal collection and the community archive.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
            <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
              <div className="flex items-start gap-2">
                <MapPinIcon className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5 flex-1">
                  <p className="text-xs font-medium text-gray-900">Create Mentions</p>
                  <p className="text-xs text-gray-600">
                    Click anywhere on the Minnesota map to drop a pin. Add descriptions, photos, dates, and choose visibility.
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
              <div className="flex items-start gap-2">
                <HeartIcon className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5 flex-1">
                  <p className="text-xs font-medium text-gray-900">Organize Collections</p>
                  <p className="text-xs text-gray-600">
                    Group your mentions into themed collections. Build unique sets that tell your Minnesota story.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Atlas Tables Grid */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">ATLAS</h2>
          <p className="text-xs text-gray-600">
            Complete directory of all Minnesota atlas layers. Explore comprehensive geographic and demographic datasets covering cities, neighborhoods, schools, parks, lakes, hospitals, churches, and more.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
        </section>

        {/* News Section */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">NEWS</h2>
          {newsArticles.length > 0 ? (
            <>
              <div className="space-y-2">
                {newsArticles.map((article) => {
                  const sourceInitials = getSourceInitials(article.source?.name);
                  const sourceColor = getSourceColor(article.source?.name);
                  
                  return (
                    <Link
                      key={article.id}
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex gap-2">
                        {/* Source Avatar */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full ${sourceColor.bg} flex items-center justify-center border border-gray-200`}>
                          <span className={`text-[10px] font-semibold ${sourceColor.text} leading-none`}>
                            {sourceInitials}
                          </span>
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <h3 className="text-xs font-semibold text-gray-900 line-clamp-2">{article.title}</h3>
                          {article.snippet && (
                            <p className="text-xs text-gray-600 line-clamp-2">{article.snippet}</p>
                          )}
                          {article.publishedAt && (
                            <div className="flex items-center gap-1 pt-0.5">
                              <span className="text-[10px] text-gray-500">
                                {new Date(article.publishedAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <Link
                href="/news"
                className="inline-flex items-center gap-1 text-xs font-medium text-gray-900 hover:underline transition-colors"
              >
                <span>See More</span>
                <ArrowRightIcon className="w-3 h-3" />
              </Link>
            </>
          ) : (
            <p className="text-xs text-gray-600">No news articles available.</p>
          )}
        </section>
        </div>
      </div>
    </SimplePageLayout>
  );
}
