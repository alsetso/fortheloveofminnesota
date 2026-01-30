'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChartBarIcon, EyeIcon, ChevronDownIcon, ChevronUpIcon, ArrowTopRightOnSquareIcon, UserIcon, ClockIcon } from '@heroicons/react/24/outline';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import Image from 'next/image';

interface View {
  id: string;
  url: string;
  viewed_at: string;
  account_id: string | null;
  viewer_username: string | null;
  viewer_image_url: string | null;
  referrer_url: string | null;
  user_agent: string | null;
  view_type: 'profile' | 'mention' | 'post' | 'map' | 'other';
  content_title: string | null;
  content_preview: string | null;
}

type TimeFilter = '24h' | '7d' | '30d' | '90d' | 'all';
type ViewFilter = 'all' | 'profile' | 'mention' | 'post' | 'map';

interface AnalyticsClientProps {
  profileViews: number;
  mentionViews: number;
  postViews: number;
  mapViews: number;
  allViews: View[];
  hasVisitorIdentitiesAccess: boolean;
  timeFilter: TimeFilter;
}

export default function AnalyticsClient({
  profileViews,
  mentionViews,
  postViews,
  mapViews,
  allViews,
  hasVisitorIdentitiesAccess,
  timeFilter: initialTimeFilter,
}: AnalyticsClientProps) {
  const { openWelcome } = useAppModalContextSafe();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const totalViews = profileViews + mentionViews + postViews + mapViews;
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [filter, setFilter] = useState<ViewFilter>('all');
  const [displayLimit, setDisplayLimit] = useState(50); // Production-ready: pagination
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(initialTimeFilter);
  const [isTimeFilterOpen, setIsTimeFilterOpen] = useState(false);

  const totalCounts = useMemo(() => {
    return {
      all: totalViews,
      profile: profileViews,
      mention: mentionViews,
      post: postViews,
      map: mapViews,
    } as const;
  }, [totalViews, profileViews, mentionViews, postViews, mapViews]);

  const loadedCounts = useMemo(() => {
    return {
      all: allViews.length,
      profile: allViews.filter(v => v.view_type === 'profile').length,
      mention: allViews.filter(v => v.view_type === 'mention').length,
      post: allViews.filter(v => v.view_type === 'post').length,
      map: allViews.filter(v => v.view_type === 'map').length,
    } as const;
  }, [allViews]);

  const getTotalCountForFilter = (f: ViewFilter) => {
    switch (f) {
      case 'all':
        return totalCounts.all;
      case 'profile':
        return totalCounts.profile;
      case 'mention':
        return totalCounts.mention;
      case 'post':
        return totalCounts.post;
      case 'map':
        return totalCounts.map;
    }
  };

  const getLoadedCountForFilter = (f: ViewFilter) => {
    switch (f) {
      case 'all':
        return loadedCounts.all;
      case 'profile':
        return loadedCounts.profile;
      case 'mention':
        return loadedCounts.mention;
      case 'post':
        return loadedCounts.post;
      case 'map':
        return loadedCounts.map;
    }
  };

  // Update time filter when URL changes
  useEffect(() => {
    const urlTimeFilter = searchParams.get('time') as TimeFilter | null;
    if (urlTimeFilter && ['24h', '7d', '30d', '90d', 'all'].includes(urlTimeFilter)) {
      setTimeFilter(urlTimeFilter);
    } else {
      // Default to 24h if no param
      setTimeFilter('24h');
    }
  }, [searchParams]);

  const handleTimeFilterChange = (newFilter: TimeFilter) => {
    setTimeFilter(newFilter);
    setIsTimeFilterOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    
    if (newFilter === '24h') {
      // Default to 24h, so remove param
      params.delete('time');
    } else {
      params.set('time', newFilter);
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  const getTimeFilterLabel = (tf: TimeFilter) => {
    switch (tf) {
      case '24h': return 'Last 24 hours';
      case '7d': return 'Last 7 days';
      case '30d': return 'Last 30 days';
      case '90d': return 'Last 90 days';
      case 'all': return 'All time';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    // Relative time for recent views (production-ready UX)
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    if (diffMonths < 12) return `${diffMonths}mo ago`;
    
    // Fallback to formatted date for older views
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }).format(date);
  };

  const getViewTypeLabel = (type: string) => {
    switch (type) {
      case 'profile':
        return 'Profile';
      case 'mention':
        return 'Mention';
      case 'post':
        return 'Post';
      case 'map':
        return 'Map';
      default:
        return 'Other';
    }
  };

  const getViewTypeColor = (type: string) => {
    switch (type) {
      case 'profile':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'mention':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'post':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'map':
        return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getContentLink = (view: View): string | null => {
    if (view.view_type === 'mention') {
      // Extract mention ID from URL
      const mentionMatch = view.url.match(/\/mention\/([a-f0-9-]{36})/i);
      if (mentionMatch) return `/mention/${mentionMatch[1]}`;
      
      const pinMatch = view.url.match(/[?&](?:pin|pinId)=([a-f0-9-]{36})/i);
      if (pinMatch) return `/mention/${pinMatch[1]}`;
      
      return null;
    }
    
    if (view.view_type === 'post') {
      const postMatch = view.url.match(/\/post\/([a-f0-9-]{36})/i);
      if (postMatch) return `/post/${postMatch[1]}`;
      return null;
    }
    
    if (view.view_type === 'profile') {
      // Extract username from profile URL
      const profileMatch = view.url.match(/\/profile\/([^/?]+)/);
      if (profileMatch) return `/${profileMatch[1]}`;
      return null;
    }
    
    if (view.view_type === 'map') {
      // Extract map ID or slug from URL
      const mapMatch = view.url.match(/^\/map\/([^/?]+)/);
      if (mapMatch) return `/map/${mapMatch[1]}`;
      return null;
    }
    
    return null;
  };

  const filteredViews = useMemo(() => {
    const views = filter === 'all' ? allViews : allViews.filter(view => view.view_type === filter);
    return views.slice(0, displayLimit); // Production-ready: pagination
  }, [allViews, filter, displayLimit]);

  const hasMoreViews = useMemo(() => {
    const loaded = getLoadedCountForFilter(filter);
    return loaded > displayLimit;
  }, [allViews, filter, displayLimit]);

  const totalForFilter = getTotalCountForFilter(filter);
  const loadedForFilter = getLoadedCountForFilter(filter);

  const stats = [
    {
      label: 'Profile Views',
      value: profileViews.toLocaleString(),
      description: 'Total views of your profile page',
      color: 'blue',
    },
    {
      label: 'Mention Views',
      value: mentionViews.toLocaleString(),
      description: 'Total views across all your mentions',
      color: 'green',
    },
    {
      label: 'Post Views',
      value: postViews.toLocaleString(),
      description: 'Total views across all your posts',
      color: 'purple',
    },
    {
      label: 'Map Views',
      value: mapViews.toLocaleString(),
      description: 'Total views across all your maps',
      color: 'indigo',
    },
  ];

  const getStatCardColor = (color: string) => {
    switch (color) {
      case 'blue':
        return 'border-blue-200 bg-blue-50';
      case 'green':
        return 'border-green-200 bg-green-50';
      case 'purple':
        return 'border-purple-200 bg-purple-50';
      case 'indigo':
        return 'border-indigo-200 bg-indigo-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  return (
    <PageWrapper
      headerContent={null}
      searchComponent={
        <MapSearchInput
          onLocationSelect={() => {
            // Handle location selection if needed
          }}
        />
      }
      accountDropdownProps={{
        onAccountClick: () => {
          // Handle account click
        },
        onSignInClick: openWelcome,
      }}
      searchResultsComponent={<SearchResults />}
    >
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChartBarIcon className="w-4 h-4 text-gray-700" />
            <h1 className="text-sm font-semibold text-gray-900">Analytics</h1>
          </div>
          {/* Time Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsTimeFilterOpen(!isTimeFilterOpen)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              <ClockIcon className="w-4 h-4" />
              <span className="text-[10px] font-medium">{getTimeFilterLabel(timeFilter)}</span>
              <ChevronDownIcon className={`w-3 h-3 transition-transform ${isTimeFilterOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isTimeFilterOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsTimeFilterOpen(false)}
                />
                <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                  {(['24h', '7d', '30d', '90d', 'all'] as TimeFilter[]).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => handleTimeFilterChange(tf)}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        timeFilter === tf
                          ? 'bg-gray-100 text-gray-900 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      } ${tf === '24h' ? 'rounded-t-md' : tf === 'all' ? 'rounded-b-md' : ''}`}
                    >
                      {getTimeFilterLabel(tf)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Total Views Card */}
        <div className="border border-gray-200 rounded-md bg-white p-[10px]">
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Total Views</p>
            <p className="text-2xl font-semibold text-gray-900">
              {totalViews.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`border rounded-md p-[10px] space-y-1 ${getStatCardColor(stat.color)}`}
            >
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="text-xl font-semibold text-gray-900">
                {stat.value}
              </p>
              <p className="text-xs text-gray-500">{stat.description}</p>
            </div>
          ))}
        </div>

        {/* All Views List */}
        <div className="space-y-3">
          {/* Accordion Header */}
          <button
            onClick={() => setIsAccordionOpen(!isAccordionOpen)}
            className="w-full flex items-center justify-between p-[10px] border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <EyeIcon className="w-4 h-4 text-gray-700" />
              <h2 className="text-sm font-semibold text-gray-900">
                All Views ({totalForFilter.toLocaleString()})
              </h2>
              {filter !== 'all' && (
                <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                  {filter}
                </span>
              )}
            </div>
            {isAccordionOpen ? (
              <ChevronUpIcon className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 text-gray-600" />
            )}
          </button>

          {/* Filter Options */}
          {isAccordionOpen && (
            <div className="border border-gray-200 rounded-md bg-white p-[10px]">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setFilter('all');
                    setIsAccordionOpen(false);
                  }}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    filter === 'all'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All ({totalCounts.all})
                </button>
                <button
                  onClick={() => {
                    setFilter('profile');
                    setIsAccordionOpen(false);
                  }}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    filter === 'profile'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  Profile ({totalCounts.profile})
                </button>
                <button
                  onClick={() => {
                    setFilter('mention');
                    setIsAccordionOpen(false);
                  }}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    filter === 'mention'
                      ? 'bg-green-600 text-white'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  Mention ({totalCounts.mention})
                </button>
                <button
                  onClick={() => {
                    setFilter('post');
                    setIsAccordionOpen(false);
                  }}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    filter === 'post'
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                >
                  Post ({totalCounts.post})
                </button>
                <button
                  onClick={() => {
                    setFilter('map');
                    setIsAccordionOpen(false);
                  }}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    filter === 'map'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  }`}
                >
                  Map ({totalCounts.map})
                </button>
              </div>
            </div>
          )}

          {/* Scrollable Views List - Table Layout */}
          <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto overflow-x-auto scrollbar-hide">
              {filteredViews.length === 0 ? (
                <div className="p-[10px] text-center">
                  <p className="text-xs text-gray-500">No views yet</p>
                </div>
              ) : (
                <table className="w-full text-xs border-collapse min-w-[600px]">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 w-[80px]">
                          Type
                        </th>
                        <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 min-w-[200px]">
                          Content
                        </th>
                        <th className="p-[10px] text-left font-semibold text-gray-900 border-r border-gray-200 w-[140px]">
                          Viewed
                        </th>
                        <th className="p-[10px] text-left font-semibold text-gray-900 w-[150px]">
                          Viewer
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredViews.map((view) => {
                        const contentLink = getContentLink(view);
                        
                        return (
                          <tr
                            key={view.id}
                            className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            {/* Type Column */}
                            <td className="p-[10px] border-r border-gray-200 align-middle hover:ring-1 hover:ring-gray-300 hover:ring-inset transition-all">
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border inline-block ${getViewTypeColor(view.view_type)}`}>
                                {getViewTypeLabel(view.view_type)}
                              </span>
                            </td>
                            
                            {/* Content Column */}
                            <td className="p-[10px] border-r border-gray-200 align-middle hover:ring-1 hover:ring-gray-300 hover:ring-inset transition-all">
                              <div className="min-w-[200px]">
                                {view.content_title && contentLink ? (
                                  <Link
                                    href={contentLink}
                                    className="text-xs font-semibold text-gray-900 leading-snug truncate hover:text-blue-600 hover:underline transition-colors block"
                                  >
                                    {view.content_title}
                                  </Link>
                                ) : view.content_title ? (
                                  <p className="text-xs font-semibold text-gray-900 leading-snug truncate">
                                    {view.content_title}
                                  </p>
                                ) : (
                                  <p className="text-xs text-gray-400">—</p>
                                )}
                              </div>
                            </td>
                            
                            {/* Date Column */}
                            <td className="p-[10px] border-r border-gray-200 align-middle hover:ring-1 hover:ring-gray-300 hover:ring-inset transition-all">
                              <time className="text-xs text-gray-600 whitespace-nowrap">
                                {formatDate(view.viewed_at)}
                              </time>
                            </td>
                            
                            {/* Viewer Column */}
                            <td className="p-[10px] align-middle hover:ring-1 hover:ring-gray-300 hover:ring-inset transition-all">
                              <div className="w-[150px]">
                                {hasVisitorIdentitiesAccess ? (
                                  <>
                                    {view.viewer_username ? (
                                      <Link
                                        href={`/${view.viewer_username}`}
                                        className="flex items-center gap-1.5 min-w-0 hover:opacity-80 transition-opacity group"
                                      >
                                        {view.viewer_image_url ? (
                                          <Image
                                            src={view.viewer_image_url}
                                            alt={view.viewer_username}
                                            width={20}
                                            height={20}
                                            className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                                            unoptimized={view.viewer_image_url.startsWith('data:') || view.viewer_image_url.includes('supabase.co')}
                                          />
                                        ) : (
                                          <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                            <UserIcon className="w-3 h-3 text-gray-500" />
                                          </div>
                                        )}
                                        <span className="text-xs text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                                          @{view.viewer_username}
                                        </span>
                                      </Link>
                                    ) : (
                                      <span className="text-xs text-gray-500">Anonymous</span>
                                    )}
                                  </>
                                ) : (
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <div className="relative w-5 h-5 rounded-full flex-shrink-0 overflow-hidden">
                                      {view.viewer_image_url ? (
                                        <>
                                          <Image
                                            src={view.viewer_image_url}
                                            alt=""
                                            width={20}
                                            height={20}
                                            className="w-5 h-5 rounded-full object-cover blur-sm"
                                            unoptimized={view.viewer_image_url.startsWith('data:') || view.viewer_image_url.includes('supabase.co')}
                                          />
                                          <div className="absolute inset-0 bg-gray-200/30" />
                                        </>
                                      ) : (
                                        <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center blur-sm">
                                          <UserIcon className="w-3 h-3 text-gray-500" />
                                        </div>
                                      )}
                                    </div>
                                    <Link
                                      href="/billing"
                                      className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium truncate"
                                    >
                                      Upgrade to View
                                    </Link>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
            </div>
            
            {/* Load More Button - Production-ready pagination */}
            {hasMoreViews && (
              <div className="border-t border-gray-200 p-[10px] bg-gray-50">
                <button
                  onClick={() => setDisplayLimit(prev => prev + 50)}
                  className="w-full px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Load More ({filteredViews.length} of {loadedForFilter} loaded)
                </button>
                {loadedForFilter < totalForFilter && (
                  <p className="mt-1 text-[10px] text-gray-500 text-center">
                    Showing most recent {loadedForFilter.toLocaleString()} of {totalForFilter.toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
