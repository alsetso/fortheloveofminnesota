'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChartBarIcon, ChevronDownIcon, ChevronUpIcon, ChevronRightIcon, UserIcon, ClockIcon } from '@heroicons/react/24/outline';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import Image from 'next/image';
import { isCardVisible, type AnalyticsCardId } from '@/lib/analytics/cardVisibility';
import BillingFeatureGate from '@/components/billing/BillingFeatureGate';

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
  
  // Filter and UI state
  const [urlVisitFilter, setUrlVisitFilter] = useState<UrlVisitFilter>('all');
  const [displayLimit, setDisplayLimit] = useState(50);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(initialTimeFilter);
  const [isTimeFilterOpen, setIsTimeFilterOpen] = useState(false);
  const [visitHistoryOpen, setVisitHistoryOpen] = useState(false);
  const [expandedPinId, setExpandedPinId] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitioningTargetRef = useRef<TimeFilter | null>(null);
  const timeFilterRef = useRef<HTMLDivElement>(null);

  // Extract pin ID from view URL (for grouping)
  const getPinIdFromView = (view: View): string | null => {
    const mentionMatch = view.url.match(/\/mention\/([a-f0-9-]{36})/i);
    if (mentionMatch) return mentionMatch[1];
    const pinMatch = view.url.match(/[?&](?:pin|pinId)=([a-f0-9-]{36})/i);
    return pinMatch ? pinMatch[1] : null;
  };

  // Section 1: Profile view rows only (view_type === 'profile')
  const profileViewRows = useMemo(
    () => profileAndPinViewersList.filter((v) => v.view_type === 'profile'),
    [profileAndPinViewersList]
  );

  // Section 2: Pin/mention view rows (view_type === 'mention' | 'pin_click')
  const pinViewRows = useMemo(
    () => profileAndPinViewersList.filter((v) => v.view_type === 'mention' || v.view_type === 'pin_click'),
    [profileAndPinViewersList]
  );

  // Per-pin grouping: pinId -> { pinId, title, views }
  const pinGroups = useMemo(() => {
    const map = new Map<string, { pinId: string; title: string; views: View[] }>();
    for (const view of pinViewRows) {
      const pinId = getPinIdFromView(view);
      if (!pinId) continue;
      const existing = map.get(pinId);
      const title = view.content_title || 'Pin';
      if (existing) {
        existing.views.push(view);
      } else {
        map.set(pinId, { pinId, title, views: [view] });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.views.length - a.views.length);
  }, [pinViewRows]);

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
        return 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50';
      case 'mention':
      case 'pin_click':
        return 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/50';
      case 'post':
        return 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/50';
      case 'map':
        return 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50';
      default:
        return 'bg-surface-accent dark:bg-white/5 text-foreground-muted border-border-muted dark:border-white/10';
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
    if (newFilter === timeFilter) return;
    setIsTimeFilterOpen(false);
    setIsTransitioning(true);
    transitioningTargetRef.current = newFilter;
    setTimeFilter(newFilter);
    const params = new URLSearchParams(searchParams.toString());
    if (newFilter === '24h') {
      params.delete('time');
    } else {
      params.set('time', newFilter);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  // Clear transitioning when URL (and thus server data) has updated
  useEffect(() => {
    if (!isTransitioning || !transitioningTargetRef.current) return;
    const current = (searchParams.get('time') as TimeFilter | null) || '24h';
    if (current === transitioningTargetRef.current) {
      setIsTransitioning(false);
      transitioningTargetRef.current = null;
    }
  }, [searchParams, isTransitioning]);

  const getTimeFilterLabel = (tf: TimeFilter) => {
    switch (tf) {
      case '24h': return 'Last 24h';
      case '7d': return 'Last 7d';
      case '30d': return 'Last 30d';
      case '90d': return 'Last 90d';
      case 'all': return 'All time';
    }
  };

  // Skeleton for transitioning state (time filter change)
  const TransitionSkeleton = ({ className = '' }: { className?: string }) => (
    <div
      className={`rounded bg-surface-accent dark:bg-white/10 animate-pulse ${className}`}
      aria-hidden
    />
  );
  const ListSpinner = () => (
    <div className="flex items-center justify-center py-12" aria-label="Loading">
      <svg
        className="w-8 h-8 text-foreground-muted animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>
  );

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
        return 'border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-950/30';
      case 'green':
        return 'border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-950/30';
      case 'orange':
        return 'border-orange-200 dark:border-orange-800/50 bg-orange-50 dark:bg-orange-950/30';
      case 'teal':
        return 'border-teal-200 dark:border-teal-800/50 bg-teal-50 dark:bg-teal-950/30';
      case 'purple':
        return 'border-purple-200 dark:border-purple-800/50 bg-purple-50 dark:bg-purple-950/30';
      case 'indigo':
        return 'border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-950/30';
      default:
        return 'border-border-muted dark:border-white/10 bg-surface';
    }
  };

  // Table row component for reusability
  const TableRow = ({ view, isLastRow, showViewerColumns = true }: { view: View; isLastRow: boolean; showViewerColumns?: boolean }) => {
    const contentLink = getContentLink(view);
    
    return (
      <tr className="border-b border-border-muted dark:border-white/10 hover:bg-surface-accent dark:hover:bg-white/5 transition-colors">
        {/* Type Column */}
        <td className="p-[10px] border-r border-border-muted dark:border-white/10 align-middle">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border inline-block ${getViewTypeColor(view.view_type)}`}>
            {getViewTypeLabel(view.view_type, view.url)}
          </span>
        </td>
        
        {/* Content Column */}
        <td className="p-[10px] border-r border-border-muted dark:border-white/10 align-middle">
          <div className="min-w-[180px]">
            {view.content_title && contentLink ? (
              <Link
                href={contentLink}
                className="text-xs font-semibold text-foreground leading-snug truncate hover:text-lake-blue hover:underline transition-colors block"
                title={view.content_title}
              >
                {view.content_title}
              </Link>
            ) : view.content_title ? (
              <p className="text-xs font-semibold text-foreground leading-snug truncate" title={view.content_title}>
                {view.content_title}
              </p>
            ) : (
              <p className="text-xs text-foreground-muted">—</p>
            )}
          </div>
        </td>
        
        {/* URL Column */}
        <td className="p-[10px] border-r border-border-muted dark:border-white/10 align-middle">
          <div className="min-w-[200px]">
            {view.url ? (
              <Link
                href={view.url}
                className="text-xs text-foreground-muted hover:text-lake-blue hover:underline transition-colors break-all font-mono"
                title={view.url}
              >
                {formatUrl(view.url)}
              </Link>
            ) : (
              <p className="text-xs text-foreground-muted">—</p>
            )}
          </div>
        </td>
        
        {/* Date Column */}
        <td className="p-[10px] border-r border-border-muted dark:border-white/10 align-middle">
          <time className="text-xs text-foreground-muted whitespace-nowrap">
            {formatDate(view.viewed_at)}
          </time>
        </td>
        
        {/* Viewer Column - For Paid Users (hidden for "where you visited" - viewer is always you) */}
        {showViewerColumns && hasVisitorIdentitiesAccess && (
          <td className="p-[10px] border-r border-border-muted dark:border-white/10 align-middle">
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
                    <div className="w-5 h-5 rounded-full bg-surface-accent dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="w-3 h-3 text-foreground-muted" />
                    </div>
                  )}
                  <span className="text-xs text-foreground truncate group-hover:text-lake-blue transition-colors">
                    @{view.viewer_username}
                  </span>
                </Link>
              ) : (
                <span className="text-xs text-foreground-muted">Anonymous</span>
              )}
            </div>
          </td>
        )}
        
        {/* Admin Viewer Column - Shows viewer info + plan */}
        {showViewerColumns && isAdmin && (
          <td className={`p-[10px] align-middle border-l-2 border-r-2 ${isLastRow ? 'border-b-2' : ''} border-yellow-500 dark:border-yellow-600`}>
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
                      <div className="w-5 h-5 rounded-full bg-surface-accent dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                        <UserIcon className="w-3 h-3 text-foreground-muted" />
                      </div>
                    )}
                    <span className="text-xs text-foreground truncate group-hover:text-lake-blue transition-colors">
                      @{view.viewer_username}
                    </span>
                  </Link>
                  {view.viewer_plan && (
                    <div className="text-[10px] text-foreground-muted capitalize">
                      {view.viewer_plan}
                    </div>
                  )}
                </>
              ) : (
                <span className="text-xs text-foreground-muted">Anonymous</span>
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
          {isTransitioning ? (
            <>
              {/* Header — skeleton time selector */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ChartBarIcon className="w-4 h-4 text-foreground-muted" />
                  <h1 className="text-sm font-semibold text-foreground">Analytics</h1>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border-muted dark:border-white/10">
                  <ClockIcon className="w-3 h-3 text-foreground-muted" />
                  <TransitionSkeleton className="h-3.5 w-16" />
                </div>
              </div>
              {/* Stat cards — skeleton values */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {stats.map((stat) => (
                  <div key={stat.id} className={`border rounded-md p-[10px] ${getStatCardColor(stat.color)}`}>
                    <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wide">{stat.label}</p>
                    <TransitionSkeleton className="h-4 w-10 mt-0.5" />
                    <TransitionSkeleton className="h-3 w-full mt-1.5" />
                  </div>
                ))}
              </div>
              {/* Section 1 — Profile Views: spinner */}
              <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md overflow-hidden">
                <div className="p-[10px] border-b border-border-muted dark:border-white/10">
                  <h2 className="text-sm font-semibold text-foreground">Profile Views</h2>
                  <TransitionSkeleton className="h-3 w-48 mt-1.5" />
                </div>
                <ListSpinner />
              </div>
              {/* Section 2 — Pin Views: spinner */}
              <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md overflow-hidden">
                <div className="p-[10px] border-b border-border-muted dark:border-white/10">
                  <h2 className="text-sm font-semibold text-foreground">Pin Views</h2>
                  <TransitionSkeleton className="h-3 w-40 mt-1.5" />
                </div>
                <ListSpinner />
              </div>
              {/* Section 3 — Visit History: collapsed skeleton */}
              <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md overflow-hidden">
                <div className="flex items-center gap-2 p-[10px]">
                  <ChevronDownIcon className="w-4 h-4 text-foreground-muted flex-shrink-0" />
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Your Visit History</h2>
                    <TransitionSkeleton className="h-3 w-56 mt-1.5" />
                  </div>
                </div>
              </div>
              {/* Map Views: spinner */}
              <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md overflow-hidden">
                <div className="p-[10px] border-b border-border-muted dark:border-white/10">
                  <h2 className="text-sm font-semibold text-foreground">Map views</h2>
                  <TransitionSkeleton className="h-3 w-44 mt-1.5" />
                </div>
                <ListSpinner />
              </div>
            </>
          ) : (
            <>
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ChartBarIcon className="w-4 h-4 text-foreground-muted" />
              <h1 className="text-sm font-semibold text-foreground">Analytics</h1>
            </div>
            <div className="relative" ref={timeFilterRef}>
              <button
                type="button"
                onClick={() => setIsTimeFilterOpen((o) => !o)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-foreground bg-surface border border-border-muted dark:border-white/10 rounded-md hover:bg-surface-accent dark:hover:bg-white/10 transition-colors"
              >
                <ClockIcon className="w-3 h-3 text-foreground-muted" />
                {getTimeFilterLabel(timeFilter)}
                {isTimeFilterOpen ? (
                  <ChevronUpIcon className="w-3 h-3 text-foreground-muted" />
                ) : (
                  <ChevronDownIcon className="w-3 h-3 text-foreground-muted" />
                )}
              </button>
              {isTimeFilterOpen && (
                <div className="absolute right-0 mt-1 py-1 bg-surface border border-border-muted dark:border-white/10 rounded-md z-10 min-w-[140px]">
                  {(['24h', '7d', '30d', '90d', 'all'] as TimeFilter[]).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => handleTimeFilterChange(tf)}
                      className={`block w-full text-left px-3 py-1.5 text-xs ${timeFilter === tf ? 'font-semibold text-foreground bg-surface-accent dark:bg-white/10' : 'text-foreground-muted hover:bg-surface-accent dark:hover:bg-white/5'}`}
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
                <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wide">
                  {stat.label}
                </p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {stat.value}
                </p>
                <p className="text-[10px] text-foreground-muted mt-0.5 leading-tight">
                  {stat.description}
                </p>
              </div>
            ))}
          </div>

          {/* Section 1 — Profile Views */}
          <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md overflow-hidden">
            <div className="p-[10px] border-b border-border-muted dark:border-white/10">
              <h2 className="text-sm font-semibold text-foreground">Profile Views</h2>
              <p className="text-xs text-foreground-muted mt-0.5">
                People who visited your profile
              </p>
            </div>
            <BillingFeatureGate
              featureSlug="visitor_identities"
              upgradeHref="/pricing"
              fallback={
                <div className="p-4 space-y-2">
                  <p className="text-sm text-foreground">
                    Your profile was viewed {profileViews.toLocaleString()} times in the selected period.
                  </p>
                  <Link
                    href="/pricing"
                    className="text-xs font-medium text-lake-blue hover:underline inline-flex items-center gap-1"
                  >
                    Upgrade to Contributor to see who viewed your profile
                  </Link>
                </div>
              }
            >
              <div className="overflow-x-auto">
                {profileViewRows.length > 0 ? (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-accent dark:bg-white/5 border-b border-border-muted dark:border-white/10">
                        <th className="p-[10px] text-[10px] font-semibold text-foreground-muted uppercase tracking-wide border-r border-border-muted dark:border-white/10">Viewer</th>
                        <th className="p-[10px] text-[10px] font-semibold text-foreground-muted uppercase tracking-wide">When</th>
                        {isAdmin && (
                          <th className="p-[10px] text-[10px] font-semibold text-foreground-muted uppercase tracking-wide">Admin</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {profileViewRows.map((view, idx) => (
                        <tr key={view.id} className="border-b border-border-muted dark:border-white/10 hover:bg-surface-accent dark:hover:bg-white/5 transition-colors">
                          <td className="p-[10px] border-r border-border-muted dark:border-white/10 align-middle">
                            <div className="w-[150px]">
                              {view.viewer_username ? (
                                <Link href={`/${view.viewer_username}`} className="flex items-center gap-1.5 min-w-0 hover:opacity-80">
                                  {view.viewer_image_url ? (
                                    <Image src={view.viewer_image_url} alt={view.viewer_username} width={20} height={20} className="w-5 h-5 rounded-full object-cover flex-shrink-0" unoptimized={view.viewer_image_url.startsWith('data:') || view.viewer_image_url.includes('supabase.co')} />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-surface-accent dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                                      <UserIcon className="w-3 h-3 text-foreground-muted" />
                                    </div>
                                  )}
                                  <span className="text-xs text-foreground truncate">@{view.viewer_username}</span>
                                </Link>
                              ) : (
                                <span className="flex items-center gap-1.5 text-foreground-muted">
                                  <UserIcon className="w-5 h-5 text-foreground-muted" aria-hidden />
                                  <span className="text-xs">Anonymous</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-[10px] border-r border-border-muted dark:border-white/10 align-middle">
                            <time className="text-xs text-foreground-muted whitespace-nowrap">{formatDate(view.viewed_at)}</time>
                          </td>
                          {isAdmin && (
                            <td className="p-[10px] align-middle">
                              {view.viewer_username ? (
                                <>
                                  <span className="text-xs text-foreground block">@{view.viewer_username}</span>
                                  {view.viewer_plan && <span className="text-[10px] text-foreground-muted capitalize">{view.viewer_plan}</span>}
                                </>
                              ) : (
                                <span className="text-xs text-foreground-muted">Anonymous</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-xs text-foreground-muted">No profile views in this period</p>
                  </div>
                )}
              </div>
            </BillingFeatureGate>
          </div>

          {/* Section 2 — Pin Views */}
          <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md overflow-hidden">
            <div className="p-[10px] border-b border-border-muted dark:border-white/10">
              <h2 className="text-sm font-semibold text-foreground">Pin Views</h2>
              <p className="text-xs text-foreground-muted mt-0.5">
                Views across your pins
              </p>
            </div>
            <div className="p-[10px] space-y-2">
              {pinGroups.length > 0 ? (
                <>
                  {pinGroups.map((group) => (
                    <div key={group.pinId} className="border border-border-muted dark:border-white/10 rounded-md overflow-hidden">
                      <div className="flex items-center justify-between gap-2 p-3 bg-surface-accent/30 dark:bg-white/5">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/mention/${group.pinId}`}
                            className="text-xs font-semibold text-foreground hover:text-lake-blue hover:underline truncate block"
                            title={group.title}
                          >
                            {group.title}
                          </Link>
                          <p className="text-[10px] text-foreground-muted mt-0.5">
                            {group.views.length} view{group.views.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        {hasVisitorIdentitiesAccess && (
                          <button
                            type="button"
                            onClick={() => setExpandedPinId((id) => (id === group.pinId ? null : group.pinId))}
                            className="flex items-center gap-1 text-xs font-medium text-foreground-muted hover:text-foreground shrink-0"
                          >
                            {expandedPinId === group.pinId ? (
                              <ChevronUpIcon className="w-4 h-4" />
                            ) : (
                              <ChevronRightIcon className="w-4 h-4" />
                            )}
                            View viewers
                          </button>
                        )}
                      </div>
                      {hasVisitorIdentitiesAccess && expandedPinId === group.pinId && (
                        <div className="border-t border-border-muted dark:border-white/10 bg-surface">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-surface-accent dark:bg-white/5 border-b border-border-muted dark:border-white/10">
                                <th className="p-[10px] text-[10px] font-semibold text-foreground-muted uppercase tracking-wide border-r border-border-muted dark:border-white/10">Viewer</th>
                                <th className="p-[10px] text-[10px] font-semibold text-foreground-muted uppercase tracking-wide">When</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.views.map((view) => (
                                <tr key={view.id} className="border-b border-border-muted dark:border-white/10 last:border-b-0">
                                  <td className="p-[10px] border-r border-border-muted dark:border-white/10 align-middle">
                                    {view.viewer_username ? (
                                      <Link href={`/${view.viewer_username}`} className="flex items-center gap-1.5 min-w-0 hover:opacity-80">
                                        {view.viewer_image_url ? (
                                          <Image src={view.viewer_image_url} alt={view.viewer_username} width={20} height={20} className="w-5 h-5 rounded-full object-cover flex-shrink-0" unoptimized={view.viewer_image_url.startsWith('data:') || view.viewer_image_url.includes('supabase.co')} />
                                        ) : (
                                          <div className="w-5 h-5 rounded-full bg-surface-accent dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                                            <UserIcon className="w-3 h-3 text-foreground-muted" />
                                          </div>
                                        )}
                                        <span className="text-xs text-foreground truncate">@{view.viewer_username}</span>
                                      </Link>
                                    ) : (
                                      <span className="flex items-center gap-1.5 text-foreground-muted">
                                        <UserIcon className="w-5 h-5" aria-hidden />
                                        <span className="text-xs">Anonymous</span>
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-[10px] align-middle">
                                    <time className="text-xs text-foreground-muted whitespace-nowrap">{formatDate(view.viewed_at)}</time>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                  {!hasVisitorIdentitiesAccess && (
                    <div className="pt-2">
                      <Link
                        href="/pricing"
                        className="text-xs font-medium text-lake-blue hover:underline"
                      >
                        Upgrade to Contributor to see who viewed your pins
                      </Link>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-xs text-foreground-muted">No pin views in this period</p>
                  {!hasVisitorIdentitiesAccess && (
                    <Link href="/pricing" className="text-xs font-medium text-lake-blue hover:underline mt-2 inline-block">
                      Upgrade to Contributor to see who viewed your pins
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section 3 — Your Visit History (collapsed by default) */}
          <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md overflow-hidden">
            <button
              type="button"
              onClick={() => setVisitHistoryOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-2 p-[10px] text-left hover:bg-surface-accent dark:hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {visitHistoryOpen ? (
                  <ChevronUpIcon className="w-4 h-4 text-foreground-muted flex-shrink-0" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4 text-foreground-muted flex-shrink-0" />
                )}
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Your Visit History</h2>
                  <p className="text-xs text-foreground-muted mt-0.5">
                    {visitHistoryOpen ? 'Pages you viewed. Your visit may count toward others\' analytics.' : 'Pages you\'ve visited on Love of Minnesota'}
                  </p>
                </div>
              </div>
            </button>
            {visitHistoryOpen && (
              <>
                <div className="border-t border-border-muted dark:border-white/10 p-[10px]">
                  <div className="flex gap-1 mb-3">
                    {(['all', 'profile', 'mention', 'post'] as UrlVisitFilter[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setUrlVisitFilter(f)}
                        className={`px-2 py-1 text-[10px] font-medium rounded border transition-colors ${urlVisitFilter === f ? 'border-border-muted dark:border-white/20 bg-surface-accent dark:bg-white/10 text-foreground' : 'border-border-muted dark:border-white/10 text-foreground-muted hover:bg-surface-accent dark:hover:bg-white/5'}`}
                      >
                        {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? urlVisitCounts.all : urlVisitCounts[f]})
                      </button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto border-t border-border-muted dark:border-white/10">
                  {filteredUrlVisitHistory.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-accent dark:bg-white/5 border-b border-border-muted dark:border-white/10">
                          <th className="p-[10px] text-[10px] font-semibold text-foreground-muted uppercase tracking-wide border-r border-border-muted dark:border-white/10">Type</th>
                          <th className="p-[10px] text-[10px] font-semibold text-foreground-muted uppercase tracking-wide border-r border-border-muted dark:border-white/10">Content</th>
                          <th className="p-[10px] text-[10px] font-semibold text-foreground-muted uppercase tracking-wide border-r border-border-muted dark:border-white/10">URL</th>
                          <th className="p-[10px] text-[10px] font-semibold text-foreground-muted uppercase tracking-wide">When</th>
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
                      <p className="text-xs text-foreground-muted">No visits in this period</p>
                    </div>
                  )}
                </div>
                {filteredUrlVisitHistory.length >= displayLimit && userVisitHistory.length > displayLimit && (
                  <div className="p-[10px] border-t border-border-muted dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setDisplayLimit((l) => l + 50)}
                      className="text-xs text-foreground-muted hover:text-foreground underline"
                    >
                      Load more
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Map Views */}
          {mapViewsList.length > 0 && (
            <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md overflow-hidden">
              <div className="p-[10px] border-b border-border-muted dark:border-white/10">
                <h2 className="text-sm font-semibold text-foreground">Map views</h2>
                <p className="text-xs text-foreground-muted mt-0.5">
                  Visits to your maps by others
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-accent dark:bg-white/5 border-b border-border-muted dark:border-white/10">
                      <th className="p-[10px] text-[10px] font-semibold text-foreground-muted uppercase tracking-wide border-r border-border-muted dark:border-white/10">Map</th>
                      <th className="p-[10px] text-[10px] font-semibold text-foreground-muted uppercase tracking-wide border-r border-border-muted dark:border-white/10">URL</th>
                      <th className="p-[10px] text-[10px] font-semibold text-foreground-muted uppercase tracking-wide border-r border-border-muted dark:border-white/10">When</th>
                      {hasVisitorIdentitiesAccess && (
                        <th className="p-[10px] text-[10px] font-semibold text-foreground-muted uppercase tracking-wide border-r border-border-muted dark:border-white/10">Viewer</th>
                      )}
                      {isAdmin && (
                        <th className="p-[10px] text-[10px] font-semibold text-foreground-muted uppercase tracking-wide">Admin</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {mapViewsList.map((view, idx) => (
                      <tr key={view.id} className="border-b border-border-muted dark:border-white/10 hover:bg-surface-accent dark:hover:bg-white/5 transition-colors">
                        <td className="p-[10px] border-r border-border-muted dark:border-white/10 align-middle">
                          <span className="text-xs font-semibold text-foreground">
                            {view.content_title || 'Map'}
                          </span>
                        </td>
                        <td className="p-[10px] border-r border-border-muted dark:border-white/10 align-middle">
                          <Link
                            href={view.url}
                            className="text-xs text-foreground-muted hover:text-lake-blue hover:underline break-all font-mono"
                          >
                            {formatUrl(view.url)}
                          </Link>
                        </td>
                        <td className="p-[10px] border-r border-border-muted dark:border-white/10 align-middle">
                          <time className="text-xs text-foreground-muted whitespace-nowrap">
                            {formatDate(view.viewed_at)}
                          </time>
                        </td>
                        {hasVisitorIdentitiesAccess && (
                          <td className="p-[10px] border-r border-border-muted dark:border-white/10 align-middle">
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
                                  <div className="w-5 h-5 rounded-full bg-surface-accent dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                                    <UserIcon className="w-3 h-3 text-foreground-muted" />
                                  </div>
                                )}
                                <span className="text-xs text-foreground truncate">@{view.viewer_username}</span>
                              </Link>
                            ) : (
                              <span className="text-xs text-foreground-muted">Anonymous</span>
                            )}
                          </td>
                        )}
                        {isAdmin && (
                          <td className="p-[10px] align-middle">
                            {view.viewer_username ? (
                              <>
                                <span className="text-xs text-foreground block">@{view.viewer_username}</span>
                                {view.viewer_plan && (
                                  <span className="text-[10px] text-foreground-muted capitalize">{view.viewer_plan}</span>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-foreground-muted">Anonymous</span>
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
            </>
          )}
        </div>
      </div>
    </NewPageWrapper>
  );
}
