'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChartBarIcon, ChevronDownIcon, ChevronUpIcon, UserIcon, ClockIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import Image from 'next/image';
import { isCardVisible, type AnalyticsCardId } from '@/lib/analytics/cardVisibility';

interface View {
  id: string;
  url: string;
  viewed_at: string;
  account_id: string | null;
  viewer_username: string | null;
  viewer_image_url: string | null;
  viewer_plan: string | null;
  referrer_url: string | null;
  user_agent: string | null;
  view_type: 'profile' | 'mention' | 'post' | 'map' | 'other' | 'pin_click';
  content_title: string | null;
  content_preview: string | null;
  content_owner_username?: string | null;
  content_owner_image_url?: string | null;
}

type TimeFilter = '24h' | '7d' | '30d' | '90d' | 'all';
type UrlVisitFilter = 'all' | 'profile' | 'mention' | 'post';
type ProfilePinViewFilter = 'all' | 'profile' | 'mention' | 'pin_click';

interface AnalyticsClientProps {
  profileViews: number;
  pinViews: number;
  mentionPageViews: number;
  postViews: number;
  mapViews: number;
  liveMentions: number;
  totalPins: number;
  userVisitHistory: View[]; // Where the current user visited
  profileAndPinViewersList: View[]; // Who viewed the user's profile and pins
  mapViewsList: View[]; // Views of the current user's maps
  hasVisitorIdentitiesAccess: boolean;
  timeFilter: TimeFilter;
  isAdmin?: boolean;
}

export default function AnalyticsClient({
  profileViews,
  pinViews,
  mentionPageViews,
  postViews,
  mapViews,
  liveMentions,
  totalPins: _totalPins,
  userVisitHistory,
  profileAndPinViewersList,
  mapViewsList,
  hasVisitorIdentitiesAccess,
  timeFilter: initialTimeFilter,
  isAdmin = false,
}: AnalyticsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const totalViews = profileViews + pinViews + mentionPageViews + postViews + mapViews;
  
  // Separate filter states
  const [urlVisitFilter, setUrlVisitFilter] = useState<UrlVisitFilter>('all');
  const [profilePinViewFilter, setProfilePinViewFilter] = useState<ProfilePinViewFilter>('all');
  const [displayLimit, setDisplayLimit] = useState(50);
  const [profilePinDisplayLimit, setProfilePinDisplayLimit] = useState(50);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(initialTimeFilter);
  const [isTimeFilterOpen, setIsTimeFilterOpen] = useState(false);
  const timeFilterRef = useRef<HTMLDivElement>(null);

  // Close time filter when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (timeFilterRef.current && !timeFilterRef.current.contains(event.target as Node)) {
        setIsTimeFilterOpen(false);
      }
    };
    if (isTimeFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTimeFilterOpen]);

  // Filter profile/pin viewers by type
  const filteredProfilePinViewers = useMemo(() => {
    let list = profileAndPinViewersList;
    if (profilePinViewFilter !== 'all') {
      list = list.filter((v) => v.view_type === profilePinViewFilter);
    }
    return list.slice(0, profilePinDisplayLimit);
  }, [profileAndPinViewersList, profilePinViewFilter, profilePinDisplayLimit]);

  const profilePinViewCounts = useMemo(
    () => ({
      all: profileAndPinViewersList.length,
      profile: profileAndPinViewersList.filter((v) => v.view_type === 'profile').length,
      mention: profileAndPinViewersList.filter((v) => v.view_type === 'mention').length,
      pin_click: profileAndPinViewersList.filter((v) => v.view_type === 'pin_click').length,
    }),
    [profileAndPinViewersList]
  );

  // Filter URL visit history by type
  const filteredUrlVisitHistory = useMemo(() => {
    if (urlVisitFilter === 'all') {
      return userVisitHistory.slice(0, displayLimit);
    }
    return userVisitHistory.filter(view => view.view_type === urlVisitFilter).slice(0, displayLimit);
  }, [userVisitHistory, urlVisitFilter, displayLimit]);

  // Counts for URL visit history
  const urlVisitCounts = useMemo(() => {
    return {
      all: userVisitHistory.length,
      profile: userVisitHistory.filter(v => v.view_type === 'profile').length,
      mention: userVisitHistory.filter(v => v.view_type === 'mention').length,
      post: userVisitHistory.filter(v => v.view_type === 'post').length,
    };
  }, [userVisitHistory]);

  // Total counts for display
  const totalCounts = useMemo(() => {
    return {
      profile: profileViews,
      mention: pinViews + mentionPageViews,
      post: postViews,
      map: mapViews,
    } as const;
  }, [profileViews, pinViews, mentionPageViews, postViews, mapViews]);

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }).format(date);
  };

  const getViewTypeLabel = (type: string, url?: string) => {
    switch (type) {
      case 'profile':
        return 'Profile View';
      case 'mention':
        if (url?.includes('/mention/')) return 'Mention Page';
        if (url?.includes('?pin=') || url?.includes('?pinId=')) return 'Map Pin Click';
        return 'Mention';
      case 'pin_click':
        return 'Map Pin Click';
      case 'post':
        return 'Post View';
      case 'map':
        return 'Map View';
      default:
        return 'Other';
    }
  };

  const getViewTypeColor = (type: string) => {
    switch (type) {
      case 'profile':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'mention':
      case 'pin_click':
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
    if (view.view_type === 'mention' || view.view_type === 'pin_click') {
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
      const profileMatch = view.url.match(/^\/([^/?#]+)(?:\?|$)/);
      if (profileMatch) return `/${profileMatch[1]}`;
      return null;
    }
    
    if (view.view_type === 'map') {
      const mapMatch = view.url.match(/^\/map\/([^/?]+)/);
      if (mapMatch) return `/map/${mapMatch[1]}`;
      return null;
    }
    
    return null;
  };

  const formatUrl = (url: string): string => {
    if (url.includes('?pin=') || url.includes('?pinId=')) {
      return url;
    }
    return url.split('?')[0];
  };

  // Update time filter when URL changes
  useEffect(() => {
    const urlTimeFilter = searchParams.get('time') as TimeFilter | null;
    if (urlTimeFilter && ['24h', '7d', '30d', '90d', 'all'].includes(urlTimeFilter)) {
      setTimeFilter(urlTimeFilter);
    } else {
      setTimeFilter('24h');
    }
  }, [searchParams]);

  const handleTimeFilterChange = (newFilter: TimeFilter) => {
    setTimeFilter(newFilter);
    setIsTimeFilterOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    
    if (newFilter === '24h') {
      params.delete('time');
    } else {
      params.set('time', newFilter);
    }
    
    router.push(`${pathname}?${params.toString()}`);
  };

  const getTimeFilterLabel = (tf: TimeFilter) => {
    switch (tf) {
      case '24h': return 'Last 24h';
      case '7d': return 'Last 7d';
      case '30d': return 'Last 30d';
      case '90d': return 'Last 90d';
      case 'all': return 'All time';
    }
  };

  // Analytics cards
  const allStats = [
    {
      id: 'liveMentions' as AnalyticsCardId,
      label: 'Live Mentions',
      value: liveMentions.toLocaleString(),
      description: 'Pins on the live map',
      color: 'green',
    },
    {
      id: 'profileViews' as AnalyticsCardId,
      label: 'Profile Views',
      value: profileViews.toLocaleString(),
      description: 'Total views of your profile page',
      color: 'blue',
    },
    {
      id: 'totalPinViews' as AnalyticsCardId,
      label: 'Total Pin Views',
      value: pinViews.toLocaleString(),
      description: 'Views from map clicks',
      color: 'orange',
    },
    {
      id: 'totalMentionViews' as AnalyticsCardId,
      label: 'Total Mention Views',
      value: mentionPageViews.toLocaleString(),
      description: 'Views from mention detail pages',
      color: 'teal',
    },
    {
      id: 'postViews' as AnalyticsCardId,
      label: 'Post Views',
      value: postViews.toLocaleString(),
      description: 'Views of your posts',
      color: 'purple',
    },
    {
      id: 'mapViews' as AnalyticsCardId,
      label: 'Map Views',
      value: mapViews.toLocaleString(),
      description: 'Views of your maps',
      color: 'indigo',
    },
  ];

  // Filter stats based on admin visibility settings
  const stats = allStats.filter((stat) => isCardVisible(stat.id, isAdmin));

  const getStatCardColor = (color: string) => {
    switch (color) {
      case 'blue':
        return 'border-blue-200 bg-blue-50';
      case 'green':
        return 'border-green-200 bg-green-50';
      case 'orange':
        return 'border-orange-200 bg-orange-50';
      case 'teal':
        return 'border-teal-200 bg-teal-50';
      case 'purple':
        return 'border-purple-200 bg-purple-50';
      case 'indigo':
        return 'border-indigo-200 bg-indigo-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  // Table row component for reusability
  const TableRow = ({ view, isLastRow, showViewerColumns = true }: { view: View; isLastRow: boolean; showViewerColumns?: boolean }) => {
    const contentLink = getContentLink(view);
    
    return (
      <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
        {/* Type Column */}
        <td className="p-[10px] border-r border-gray-200 align-middle">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border inline-block ${getViewTypeColor(view.view_type)}`}>
            {getViewTypeLabel(view.view_type, view.url)}
          </span>
        </td>
        
        {/* Content Column */}
        <td className="p-[10px] border-r border-gray-200 align-middle">
          <div className="min-w-[180px]">
            {view.content_title && contentLink ? (
              <Link
                href={contentLink}
                className="text-xs font-semibold text-gray-900 leading-snug truncate hover:text-blue-600 hover:underline transition-colors block"
                title={view.content_title}
              >
                {view.content_title}
              </Link>
            ) : view.content_title ? (
              <p className="text-xs font-semibold text-gray-900 leading-snug truncate" title={view.content_title}>
                {view.content_title}
              </p>
            ) : (
              <p className="text-xs text-gray-400">—</p>
            )}
          </div>
        </td>
        
        {/* URL Column */}
        <td className="p-[10px] border-r border-gray-200 align-middle">
          <div className="min-w-[200px]">
            {view.url ? (
              <Link
                href={view.url}
                className="text-xs text-gray-600 hover:text-blue-600 hover:underline transition-colors break-all font-mono"
                title={view.url}
              >
                {formatUrl(view.url)}
              </Link>
            ) : (
              <p className="text-xs text-gray-400">—</p>
            )}
          </div>
        </td>
        
        {/* Date Column */}
        <td className="p-[10px] border-r border-gray-200 align-middle">
          <time className="text-xs text-gray-600 whitespace-nowrap">
            {formatDate(view.viewed_at)}
          </time>
        </td>
        
        {/* Viewer Column - For Paid Users (hidden for "where you visited" - viewer is always you) */}
        {showViewerColumns && hasVisitorIdentitiesAccess && (
          <td className="p-[10px] border-r border-gray-200 align-middle">
            <div className="w-[150px]">
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
            </div>
          </td>
        )}
        
        {/* Admin Viewer Column - Shows viewer info + plan */}
        {showViewerColumns && isAdmin && (
          <td className={`p-[10px] align-middle border-l-2 border-r-2 ${isLastRow ? 'border-b-2' : ''} border-yellow-500`}>
            <div className="w-[180px] space-y-1">
              {view.viewer_username ? (
                <>
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
                  {view.viewer_plan && (
                    <div className="text-[10px] text-gray-500 capitalize">
                      {view.viewer_plan}
                    </div>
                  )}
                </>
              ) : (
                <span className="text-xs text-gray-500">Anonymous</span>
              )}
            </div>
          </td>
        )}
      </tr>
    );
  };

  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      rightSidebar={<RightSidebar />}
    >
      <div className="w-full py-6">
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ChartBarIcon className="w-4 h-4 text-gray-700" />
              <h1 className="text-sm font-semibold text-gray-900">Analytics</h1>
            </div>
            <div className="relative" ref={timeFilterRef}>
              <button
                type="button"
                onClick={() => setIsTimeFilterOpen((o) => !o)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                <ClockIcon className="w-3 h-3 text-gray-500" />
                {getTimeFilterLabel(timeFilter)}
                {isTimeFilterOpen ? (
                  <ChevronUpIcon className="w-3 h-3 text-gray-500" />
                ) : (
                  <ChevronDownIcon className="w-3 h-3 text-gray-500" />
                )}
              </button>
              {isTimeFilterOpen && (
                <div className="absolute right-0 mt-1 py-1 bg-white border border-gray-200 rounded-md z-10 min-w-[140px]">
                  {(['24h', '7d', '30d', '90d', 'all'] as TimeFilter[]).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => handleTimeFilterChange(tf)}
                      className={`block w-full text-left px-3 py-1.5 text-xs ${timeFilter === tf ? 'font-semibold text-gray-900 bg-gray-50' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      {getTimeFilterLabel(tf)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {stats.map((stat) => (
              <div
                key={stat.id}
                className={`border rounded-md p-[10px] ${getStatCardColor(stat.color)}`}
              >
                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                  {stat.label}
                </p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                  {stat.value}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">
                  {stat.description}
                </p>
              </div>
            ))}
          </div>

          {/* Who Viewed Your Account & Pins */}
          {profileAndPinViewersList.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <div className="p-[10px] border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">Who viewed your account & pins</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  People who viewed your profile or pins
                </p>
                <div className="flex gap-1 mt-3">
                  {(['all', 'profile', 'mention', 'pin_click'] as ProfilePinViewFilter[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setProfilePinViewFilter(f)}
                      className={`px-2 py-1 text-[10px] font-medium rounded border transition-colors ${profilePinViewFilter === f ? 'border-gray-400 bg-gray-100 text-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                    >
                      {f === 'all' ? 'All' : f === 'profile' ? 'Profile' : f === 'mention' ? 'Mention' : 'Map Pin'} ({f === 'all' ? profilePinViewCounts.all : profilePinViewCounts[f]})
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-[10px] text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Type</th>
                      <th className="p-[10px] text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Content</th>
                      <th className="p-[10px] text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">When</th>
                      {hasVisitorIdentitiesAccess && (
                        <th className="p-[10px] text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Viewer</th>
                      )}
                      {isAdmin && (
                        <th className="p-[10px] text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Admin</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfilePinViewers.map((view) => {
                      const contentLink = getContentLink(view);
                      return (
                        <tr key={view.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="p-[10px] border-r border-gray-200 align-middle">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border inline-block ${getViewTypeColor(view.view_type)}`}>
                              {getViewTypeLabel(view.view_type, view.url)}
                            </span>
                          </td>
                          <td className="p-[10px] border-r border-gray-200 align-middle">
                            <div className="min-w-[180px]">
                              {view.content_title && contentLink ? (
                                <Link href={contentLink} className="text-xs font-semibold text-gray-900 hover:text-blue-600 hover:underline truncate block" title={view.content_title}>
                                  {view.content_title}
                                </Link>
                              ) : view.content_title ? (
                                <p className="text-xs font-semibold text-gray-900 truncate" title={view.content_title}>{view.content_title}</p>
                              ) : (
                                <p className="text-xs text-gray-400">—</p>
                              )}
                            </div>
                          </td>
                          <td className="p-[10px] border-r border-gray-200 align-middle">
                            <time className="text-xs text-gray-600 whitespace-nowrap">{formatDate(view.viewed_at)}</time>
                          </td>
                          {hasVisitorIdentitiesAccess && (
                            <td className="p-[10px] border-r border-gray-200 align-middle">
                              {view.viewer_username ? (
                                <Link href={`/${view.viewer_username}`} className="flex items-center gap-1.5 min-w-0 hover:opacity-80">
                                  {view.viewer_image_url ? (
                                    <Image src={view.viewer_image_url} alt={view.viewer_username} width={20} height={20} className="w-5 h-5 rounded-full object-cover flex-shrink-0" unoptimized={view.viewer_image_url.startsWith('data:') || view.viewer_image_url.includes('supabase.co')} />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                      <UserIcon className="w-3 h-3 text-gray-500" />
                                    </div>
                                  )}
                                  <span className="text-xs text-gray-900 truncate">@{view.viewer_username}</span>
                                </Link>
                              ) : (
                                <span className="text-xs text-gray-500">Anonymous</span>
                              )}
                            </td>
                          )}
                          {isAdmin && (
                            <td className="p-[10px] align-middle">
                              {view.viewer_username ? (
                                <>
                                  <span className="text-xs text-gray-900 block">@{view.viewer_username}</span>
                                  {view.viewer_plan && <span className="text-[10px] text-gray-500 capitalize">{view.viewer_plan}</span>}
                                </>
                              ) : (
                                <span className="text-xs text-gray-500">Anonymous</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredProfilePinViewers.length >= profilePinDisplayLimit && profileAndPinViewersList.length > profilePinDisplayLimit && (
                <div className="p-[10px] border-t border-gray-200">
                  <button type="button" onClick={() => setProfilePinDisplayLimit((l) => l + 50)} className="text-xs text-gray-600 hover:text-gray-900 underline">
                    Load more
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Where You Visited */}
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="p-[10px] border-b border-gray-200">
              <div className="flex items-start gap-2">
                <InformationCircleIcon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Where you visited</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Pages you viewed. Your visit may count toward others' analytics.
                  </p>
                </div>
              </div>
              <div className="flex gap-1 mt-3">
                {(['all', 'profile', 'mention', 'post'] as UrlVisitFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setUrlVisitFilter(f)}
                    className={`px-2 py-1 text-[10px] font-medium rounded border transition-colors ${urlVisitFilter === f ? 'border-gray-400 bg-gray-100 text-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                  >
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? urlVisitCounts.all : urlVisitCounts[f]})
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              {filteredUrlVisitHistory.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-[10px] text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Type</th>
                      <th className="p-[10px] text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Content</th>
                      <th className="p-[10px] text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">URL</th>
                      <th className="p-[10px] text-[10px] font-semibold text-gray-500 uppercase tracking-wide">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUrlVisitHistory.map((view, idx) => (
                      <TableRow
                        key={view.id}
                        view={view}
                        isLastRow={idx === filteredUrlVisitHistory.length - 1}
                        showViewerColumns={false}
                      />
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-xs text-gray-500">No visits in this period</p>
                </div>
              )}
            </div>
            {filteredUrlVisitHistory.length >= displayLimit && userVisitHistory.length > displayLimit && (
              <div className="p-[10px] border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setDisplayLimit((l) => l + 50)}
                  className="text-xs text-gray-600 hover:text-gray-900 underline"
                >
                  Load more
                </button>
              </div>
            )}
          </div>

          {/* Map Views */}
          {mapViewsList.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <div className="p-[10px] border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">Map views</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Visits to your maps by others
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-[10px] text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Map</th>
                      <th className="p-[10px] text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">URL</th>
                      <th className="p-[10px] text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">When</th>
                      {hasVisitorIdentitiesAccess && (
                        <th className="p-[10px] text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Viewer</th>
                      )}
                      {isAdmin && (
                        <th className="p-[10px] text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Admin</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {mapViewsList.map((view, idx) => (
                      <tr key={view.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="p-[10px] border-r border-gray-200 align-middle">
                          <span className="text-xs font-semibold text-gray-900">
                            {view.content_title || 'Map'}
                          </span>
                        </td>
                        <td className="p-[10px] border-r border-gray-200 align-middle">
                          <Link
                            href={view.url}
                            className="text-xs text-gray-600 hover:text-blue-600 hover:underline break-all font-mono"
                          >
                            {formatUrl(view.url)}
                          </Link>
                        </td>
                        <td className="p-[10px] border-r border-gray-200 align-middle">
                          <time className="text-xs text-gray-600 whitespace-nowrap">
                            {formatDate(view.viewed_at)}
                          </time>
                        </td>
                        {hasVisitorIdentitiesAccess && (
                          <td className="p-[10px] border-r border-gray-200 align-middle">
                            {view.viewer_username ? (
                              <Link
                                href={`/${view.viewer_username}`}
                                className="flex items-center gap-1.5 min-w-0 hover:opacity-80"
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
                                <span className="text-xs text-gray-900 truncate">@{view.viewer_username}</span>
                              </Link>
                            ) : (
                              <span className="text-xs text-gray-500">Anonymous</span>
                            )}
                          </td>
                        )}
                        {isAdmin && (
                          <td className="p-[10px] align-middle">
                            {view.viewer_username ? (
                              <>
                                <span className="text-xs text-gray-900 block">@{view.viewer_username}</span>
                                {view.viewer_plan && (
                                  <span className="text-[10px] text-gray-500 capitalize">{view.viewer_plan}</span>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-gray-500">Anonymous</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </NewPageWrapper>
  );
}
