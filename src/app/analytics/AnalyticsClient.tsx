'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChartBarIcon, EyeIcon, ChevronDownIcon, ChevronUpIcon, ArrowTopRightOnSquareIcon, UserIcon, ClockIcon, InformationCircleIcon, MapIcon } from '@heroicons/react/24/outline';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import Image from 'next/image';
import { isCardVisible, type AnalyticsCardId } from '@/lib/analytics/cardVisibility';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';

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
  view_type: 'profile' | 'mention' | 'post' | 'map' | 'other';
  content_title: string | null;
  content_preview: string | null;
  content_owner_username?: string | null;
  content_owner_image_url?: string | null;
}

type TimeFilter = '24h' | '7d' | '30d' | '90d' | 'all';
type UrlVisitFilter = 'all' | 'profile' | 'mention' | 'post';

interface AnalyticsClientProps {
  profileViews: number;
  pinViews: number;
  mentionPageViews: number;
  postViews: number;
  mapViews: number;
  liveMentions: number;
  totalPins: number;
  userVisitHistory: View[]; // Where the current user visited
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
  mapViewsList,
  hasVisitorIdentitiesAccess,
  timeFilter: initialTimeFilter,
  isAdmin = false,
}: AnalyticsClientProps) {
  const { openWelcome } = useAppModalContextSafe();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const totalViews = profileViews + pinViews + mentionPageViews + postViews + mapViews;
  
  // Separate filter states
  const [urlVisitFilter, setUrlVisitFilter] = useState<UrlVisitFilter>('all');
  const [displayLimit, setDisplayLimit] = useState(50);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(initialTimeFilter);
  const [isTimeFilterOpen, setIsTimeFilterOpen] = useState(false);
  const [viewerInfoOpen, setViewerInfoOpen] = useState(false);
  const [adminViewerInfoOpen, setAdminViewerInfoOpen] = useState(false);
  const viewerInfoRef = useRef<HTMLDivElement>(null);
  const adminViewerInfoRef = useRef<HTMLDivElement>(null);

  // Close popups when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (viewerInfoRef.current && !viewerInfoRef.current.contains(event.target as Node)) {
        setViewerInfoOpen(false);
      }
      if (adminViewerInfoRef.current && !adminViewerInfoRef.current.contains(event.target as Node)) {
        setAdminViewerInfoOpen(false);
      }
    };
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };

    if (viewerInfoOpen || adminViewerInfoOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [viewerInfoOpen, adminViewerInfoOpen]);

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
        if (url?.includes('/mention/')) {
          return 'Mention Page';
        } else if (url?.includes('?pin=') || url?.includes('?pinId=')) {
          return 'Map Pin Click';
        }
        return 'Mention';
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
      const profileMatch = view.url.match(/\/profile\/([^/?]+)/);
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
  const TableRow = ({ view, isLastRow }: { view: View; isLastRow: boolean }) => {
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
        
        {/* Viewer Column - For Paid Users */}
        {hasVisitorIdentitiesAccess && (
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
        {isAdmin && (
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
        <div className="max-w-[600px] mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChartBarIcon className="w-4 h-4 text-gray-700" />
            <h1 className="text-sm font-semibold text-gray-900">Analytics</h1>
          </div>
        </div>

        {/* Coming Soon */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <div className="flex flex-col items-center justify-center py-12">
            <ChartBarIcon className="w-12 h-12 text-gray-400 mb-3" />
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Coming Soon</h2>
            <p className="text-xs text-gray-500 text-center">
              Analytics features are under development
            </p>
          </div>
        </div>
        </div>
      </div>
    </NewPageWrapper>
  );
}
