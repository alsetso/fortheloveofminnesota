'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import { useAuthStateSafe } from '@/features/auth';
import SchemaSidebar from '@/components/admin/SchemaSidebar';
import Link from 'next/link';
import { ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface DashboardStats {
  accounts: {
    total: number;
    newLast7Days: number;
  };
  subscriptions: {
    total: number;
    active: number;
    newLast7Days: number;
    byStatus: Record<string, number>;
  };
  content: {
    maps: number;
    posts: number;
  };
  recentActivity: number;
}

interface RouteInfo {
  path: string;
  filePath: string;
  hasMetadata: boolean;
  hasGenerateMetadata: boolean;
  metadataType: 'static' | 'dynamic' | 'none';
  routePattern: string;
  segments: string[];
  isDynamic: boolean;
  isCatchAll: boolean;
  isOptionalCatchAll: boolean;
  isDraft: boolean;
  metadata?: {
    title?: string;
    description?: string;
    keywords?: string[];
    robots?: any;
    openGraph?: any;
    twitter?: any;
  };
}

interface RouteGroup {
  path: string;
  primarySegment: string;
  routes: RouteInfo[];
  subGroups: RouteGroup[];
  hasMetadata: boolean;
  metadataType: 'static' | 'dynamic' | 'none';
  isDynamic: boolean;
}

interface RoutesData {
  routes: RouteInfo[];
  groupedRoutes: RouteGroup[];
  stats: {
    total: number;
    withMetadata: number;
    staticMetadata: number;
    dynamicMetadata: number;
    noMetadata: number;
    dynamicRoutes: number;
    catchAllRoutes: number;
    draftRoutes: number;
    productionRoutes: number;
  };
}

type TabType = 'stats' | 'routes';

export default function DashboardClient() {
  const { account, user } = useAuthStateSafe();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [routesData, setRoutesData] = useState<RoutesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('stats');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'production'>('all');

  // Verify admin access
  useEffect(() => {
    if (!user) {
      return;
    }
    
    if (account !== undefined && account !== null && account.role !== 'admin') {
      console.warn('[Dashboard] Access denied - account role:', account.role);
      router.push('/');
    }
  }, [account, user, router]);

  // Fetch dashboard stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/dashboard/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch routes data when tab is active
  useEffect(() => {
    if (activeTab === 'routes' && !routesData && !routesLoading) {
      setRoutesLoading(true);
      fetch('/api/admin/dashboard/routes')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) setRoutesData(data);
        })
        .catch(error => console.error('Error fetching routes:', error))
        .finally(() => setRoutesLoading(false));
    }
  }, [activeTab, routesData, routesLoading]);

  if (loading) {
    return (
      <>
        <PageViewTracker />
        <NewPageWrapper
          leftSidebar={<SchemaSidebar />}
        >
          <div className="p-[10px]">
            <div className="text-center py-12">
              <p className="text-xs text-foreground-muted">Loading...</p>
            </div>
          </div>
        </NewPageWrapper>
      </>
    );
  }

  if (user && account && account.role !== 'admin') {
    return (
      <>
        <PageViewTracker />
        <NewPageWrapper
          leftSidebar={<SchemaSidebar />}
        >
          <div className="p-[10px]">
            <div className="max-w-md mx-auto mt-12">
              <div className="bg-surface border border-border p-[10px]">
                <h2 className="text-sm font-semibold text-foreground mb-2">Access Denied</h2>
                <p className="text-xs text-foreground-muted">
                  This page requires admin access. Please sign in with an admin account.
                </p>
              </div>
            </div>
          </div>
        </NewPageWrapper>
      </>
    );
  }

  const subscriptionStatuses = stats?.subscriptions.byStatus || {};

  return (
    <>
      <PageViewTracker />
      <NewPageWrapper
        leftSidebar={
          <SchemaSidebar
            onTableSelect={(schema, table) => {
              router.push(`/admin/database/${schema}/${table}`);
            }}
          />
        }
      >
        {/* Header Section - Controls own padding */}
        <div className="p-[10px] border-b border-border-muted">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-sm font-semibold text-foreground mb-0.5">Admin Dashboard</h1>
              <p className="text-xs text-foreground-muted">Platform statistics & route analysis</p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/admin/systems"
                className="px-2 py-1 text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
              >
                Systems
              </Link>
              <Link
                href="/admin/billing"
                className="px-2 py-1 text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
              >
                Billing
              </Link>
              <Link
                href="/analytics"
                className="px-2 py-1 text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
              >
                Analytics
              </Link>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 border-b border-border-muted">
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                activeTab === 'stats'
                  ? 'text-foreground border-lake-blue'
                  : 'text-foreground-muted border-transparent hover:text-foreground'
              }`}
            >
              Platform Stats
            </button>
            <button
              onClick={() => setActiveTab('routes')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                activeTab === 'routes'
                  ? 'text-foreground border-lake-blue'
                  : 'text-foreground-muted border-transparent hover:text-foreground'
              }`}
            >
              Routes & SEO
            </button>
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'stats' && (
          <>
            {/* Main Stats Table - No outer padding, touches edges */}
            <div className="border-b border-border-muted overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-surface-accent border-b border-border">
                <tr>
                  <th className="p-[10px] text-left font-semibold text-foreground border-r border-border-muted">
                    Metric
                  </th>
                  <th className="p-[10px] text-right font-semibold text-foreground border-r border-border-muted">
                    Total
                  </th>
                  <th className="p-[10px] text-right font-semibold text-foreground border-r border-border-muted">
                    Last 7 Days
                  </th>
                  <th className="p-[10px] text-right font-semibold text-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Accounts Row */}
                <tr className="border-b border-border-muted hover:bg-surface-accent">
                  <td className="p-[10px] text-foreground border-r border-border-muted font-medium">
                    Accounts
                  </td>
                  <td className="p-[10px] text-right text-foreground border-r border-border-muted font-mono">
                    {stats?.accounts.total.toLocaleString() || '0'}
                  </td>
                  <td className="p-[10px] text-right text-foreground-muted border-r border-border-muted font-mono">
                    +{stats?.accounts.newLast7Days || 0}
                  </td>
                  <td className="p-[10px] text-right text-foreground-subtle">
                    —
                  </td>
                </tr>

                {/* Subscriptions Row */}
                <tr className="border-b border-border-muted hover:bg-surface-accent">
                  <td className="p-[10px] text-foreground border-r border-border-muted font-medium">
                    Subscriptions
                  </td>
                  <td className="p-[10px] text-right text-foreground border-r border-border-muted font-mono">
                    {stats?.subscriptions.total.toLocaleString() || '0'}
                  </td>
                  <td className="p-[10px] text-right text-foreground-muted border-r border-border-muted font-mono">
                    +{stats?.subscriptions.newLast7Days || 0}
                  </td>
                  <td className="p-[10px] text-right text-foreground-subtle">
                    {stats?.subscriptions.active || 0} active
                  </td>
                </tr>

                {/* Maps Row */}
                <tr className="border-b border-border-muted hover:bg-surface-accent">
                  <td className="p-[10px] text-foreground border-r border-border-muted font-medium">
                    Maps
                  </td>
                  <td className="p-[10px] text-right text-foreground border-r border-border-muted font-mono">
                    {stats?.content.maps.toLocaleString() || '0'}
                  </td>
                  <td className="p-[10px] text-right text-foreground-muted border-r border-border-muted font-mono">
                    —
                  </td>
                  <td className="p-[10px] text-right text-foreground-subtle">
                    —
                  </td>
                </tr>

                {/* Posts Row */}
                <tr className="border-b border-border-muted hover:bg-surface-accent">
                  <td className="p-[10px] text-foreground border-r border-border-muted font-medium">
                    Posts
                  </td>
                  <td className="p-[10px] text-right text-foreground border-r border-border-muted font-mono">
                    {stats?.content.posts.toLocaleString() || '0'}
                  </td>
                  <td className="p-[10px] text-right text-foreground-muted border-r border-border-muted font-mono">
                    —
                  </td>
                  <td className="p-[10px] text-right text-foreground-subtle">
                    —
                  </td>
                </tr>

              </tbody>
            </table>
          </div>
        </div>

        {/* Subscription Status Table - No outer padding, touches edges */}
        {Object.keys(subscriptionStatuses).length > 0 && (
          <div className="border-b border-border-muted overflow-hidden">
            <div className="p-[10px] border-b border-border bg-surface-accent">
              <h3 className="text-xs font-semibold text-foreground">Subscription Status Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-surface-accent border-b border-border">
                  <tr>
                    <th className="p-[10px] text-left font-semibold text-foreground border-r border-border-muted">
                      Status
                    </th>
                    <th className="p-[10px] text-right font-semibold text-foreground">
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(subscriptionStatuses)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([status, count]) => (
                      <tr key={status} className="border-b border-border-muted hover:bg-surface-accent last:border-b-0">
                        <td className="p-[10px] text-foreground border-r border-border-muted capitalize">
                          {status.replace(/_/g, ' ')}
                        </td>
                        <td className="p-[10px] text-right text-foreground font-mono">
                          {count}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
          </>
        )}

        {activeTab === 'routes' && (
          <div className="p-[10px]">
            {routesLoading ? (
              <div className="text-center py-12">
                <p className="text-xs text-foreground-muted">Scanning routes...</p>
              </div>
            ) : routesData ? (
              <>
                {/* Routes Stats */}
                <div className="mb-4 grid grid-cols-2 md:grid-cols-6 gap-2">
                  <div className="bg-surface border border-border p-[10px]">
                    <div className="text-xs text-foreground-muted mb-0.5">Total Routes</div>
                    <div className="text-sm font-semibold text-foreground">{routesData.stats.total}</div>
                  </div>
                  <div className="bg-surface border border-border p-[10px]">
                    <div className="text-xs text-foreground-muted mb-0.5">Production</div>
                    <div className="text-sm font-semibold text-foreground text-green-600">{routesData.stats.productionRoutes}</div>
                  </div>
                  <div className="bg-surface border border-border p-[10px]">
                    <div className="text-xs text-foreground-muted mb-0.5">Draft</div>
                    <div className="text-sm font-semibold text-foreground text-orange-600">{routesData.stats.draftRoutes}</div>
                  </div>
                  <div className="bg-surface border border-border p-[10px]">
                    <div className="text-xs text-foreground-muted mb-0.5">With Metadata</div>
                    <div className="text-sm font-semibold text-foreground">{routesData.stats.withMetadata}</div>
                  </div>
                  <div className="bg-surface border border-border p-[10px]">
                    <div className="text-xs text-foreground-muted mb-0.5">No Metadata</div>
                    <div className="text-sm font-semibold text-foreground text-red-600">{routesData.stats.noMetadata}</div>
                  </div>
                  <div className="bg-surface border border-border p-[10px]">
                    <div className="text-xs text-foreground-muted mb-0.5">Dynamic Routes</div>
                    <div className="text-sm font-semibold text-foreground">{routesData.stats.dynamicRoutes}</div>
                  </div>
                </div>

                {/* Search, Filter, and View Mode */}
                <div className="mb-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="Search routes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-surface border border-border rounded-md text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-lake-blue"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'draft' | 'production')}
                    className="px-3 py-1.5 text-xs bg-surface border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-lake-blue"
                  >
                    <option value="all">All Status</option>
                    <option value="production">Production</option>
                    <option value="draft">Draft</option>
                  </select>
                  <button
                    onClick={() => setViewMode(viewMode === 'grouped' ? 'flat' : 'grouped')}
                    className="px-3 py-1.5 text-xs font-medium bg-surface border border-border rounded-md text-foreground-muted hover:text-foreground hover:bg-surface-accent transition-colors"
                  >
                    {viewMode === 'grouped' ? 'Flat View' : 'Grouped View'}
                  </button>
                </div>

                {/* Routes Display */}
                {viewMode === 'grouped' ? (
                  <div className="border border-border-muted rounded-md overflow-hidden">
                    <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
                      {routesData.groupedRoutes
                        .map(group => {
                          // Filter group routes and sub-groups by search and status
                          const filteredGroup = {
                            ...group,
                            routes: group.routes.filter(route => {
                              // Status filter
                              if (statusFilter === 'draft' && !route.isDraft) return false;
                              if (statusFilter === 'production' && route.isDraft) return false;
                              
                              // Search filter
                              if (searchQuery) {
                                const query = searchQuery.toLowerCase();
                                return (
                                  route.path.toLowerCase().includes(query) ||
                                  route.filePath.toLowerCase().includes(query) ||
                                  route.metadata?.title?.toLowerCase().includes(query)
                                );
                              }
                              return true;
                            }),
                            subGroups: group.subGroups.map(sg => ({
                              ...sg,
                              routes: sg.routes.filter(route => {
                                if (statusFilter === 'draft' && !route.isDraft) return false;
                                if (statusFilter === 'production' && route.isDraft) return false;
                                if (searchQuery) {
                                  const query = searchQuery.toLowerCase();
                                  return (
                                    route.path.toLowerCase().includes(query) ||
                                    route.filePath.toLowerCase().includes(query) ||
                                    route.metadata?.title?.toLowerCase().includes(query)
                                  );
                                }
                                return true;
                              }),
                            })),
                          };
                          return filteredGroup;
                        })
                        .filter(group => group.routes.length > 0 || group.subGroups.some(sg => sg.routes.length > 0))
                        .map((group) => (
                          <RouteGroupComponent
                            key={group.path}
                            group={group}
                            searchQuery={searchQuery}
                            expandedGroups={expandedGroups}
                            setExpandedGroups={setExpandedGroups}
                            level={0}
                          />
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="border border-border-muted overflow-hidden rounded-md">
                    <div className="overflow-x-auto max-h-[calc(100vh-400px)]">
                      <table className="w-full text-xs border-collapse">
                        <thead className="bg-surface-accent border-b border-border sticky top-0">
                          <tr>
                            <th className="p-[10px] text-left font-semibold text-foreground border-r border-border-muted">
                              Route
                            </th>
                            <th className="p-[10px] text-left font-semibold text-foreground border-r border-border-muted">
                              Status
                            </th>
                            <th className="p-[10px] text-left font-semibold text-foreground border-r border-border-muted">
                              Pattern
                            </th>
                            <th className="p-[10px] text-left font-semibold text-foreground border-r border-border-muted">
                              Metadata
                            </th>
                            <th className="p-[10px] text-left font-semibold text-foreground border-r border-border-muted">
                              Title
                            </th>
                            <th className="p-[10px] text-left font-semibold text-foreground">
                              Description
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {routesData.routes
                            .filter(route => {
                              // Status filter
                              if (statusFilter === 'draft' && !route.isDraft) return false;
                              if (statusFilter === 'production' && route.isDraft) return false;
                              
                              // Search filter
                              if (searchQuery) {
                                const query = searchQuery.toLowerCase();
                                return (
                                  route.path.toLowerCase().includes(query) ||
                                  route.filePath.toLowerCase().includes(query) ||
                                  route.metadata?.title?.toLowerCase().includes(query)
                                );
                              }
                              return true;
                            })
                            .map((route) => (
                              <tr 
                                key={route.path} 
                                className="border-b border-border-muted hover:bg-surface-accent last:border-b-0"
                              >
                                <td className="p-[10px] text-foreground border-r border-border-muted font-mono text-[10px]">
                                  {route.path || '/'}
                                </td>
                                <td className="p-[10px] border-r border-border-muted">
                                  {route.isDraft ? (
                                    <span className="px-1 py-0.5 bg-orange-500/20 text-orange-600 rounded text-[9px] font-medium">
                                      Draft
                                    </span>
                                  ) : (
                                    <span className="px-1 py-0.5 bg-green-500/20 text-green-600 rounded text-[9px] font-medium">
                                      Production
                                    </span>
                                  )}
                                </td>
                                <td className="p-[10px] text-foreground-muted border-r border-border-muted font-mono text-[10px]">
                                {route.routePattern}
                                {route.isDynamic && (
                                  <span className="ml-1 px-1 py-0.5 bg-lake-blue/20 text-lake-blue rounded text-[9px]">
                                    {route.isCatchAll ? 'catch-all' : route.isOptionalCatchAll ? 'opt-catch' : 'dynamic'}
                                  </span>
                                )}
                              </td>
                              <td className="p-[10px] border-r border-border-muted">
                                <div className="flex flex-col gap-0.5">
                                  {route.hasMetadata && (
                                    <span className="text-[9px] px-1 py-0.5 bg-green-500/20 text-green-600 rounded w-fit">
                                      static
                                    </span>
                                  )}
                                  {route.hasGenerateMetadata && (
                                    <span className="text-[9px] px-1 py-0.5 bg-blue-500/20 text-blue-600 rounded w-fit">
                                      dynamic
                                    </span>
                                  )}
                                  {!route.hasMetadata && !route.hasGenerateMetadata && (
                                    <span className="text-[9px] px-1 py-0.5 bg-red-500/20 text-red-600 rounded w-fit">
                                      none
                                    </span>
                                  )}
                                </div>
                              </td>
                                <td className="p-[10px] text-foreground border-r border-border-muted max-w-[200px] truncate">
                                  {route.metadata?.title || (
                                    <span className="text-foreground-subtle italic">—</span>
                                  )}
                                </td>
                                <td className="p-[10px] text-foreground-muted max-w-[300px] truncate">
                                  {route.metadata?.description || (
                                    <span className="text-foreground-subtle italic">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-xs text-foreground-muted">No routes data available</p>
              </div>
            )}
          </div>
        )}
      </NewPageWrapper>
    </>
  );
}

// Route Group Component for hierarchical display
function RouteGroupComponent({
  group,
  searchQuery,
  expandedGroups,
  setExpandedGroups,
  level,
}: {
  group: RouteGroup;
  searchQuery: string;
  expandedGroups: Set<string>;
  setExpandedGroups: React.Dispatch<React.SetStateAction<Set<string>>>;
  level: number;
}) {
  const isExpanded = expandedGroups.has(group.path);
  const hasChildren = group.routes.length > 0 || group.subGroups.length > 0;
  const totalRoutes = group.routes.length + group.subGroups.reduce((sum, sg) => sum + sg.routes.length, 0);
  
  // Routes and sub-groups are already filtered by parent
  const filteredRoutes = group.routes;
  const filteredSubGroups = group.subGroups;
  
  // If no routes or sub-groups after filtering, don't render
  if (filteredRoutes.length === 0 && filteredSubGroups.length === 0) {
    return null;
  }
  
  const toggleExpanded = () => {
    const newExpanded = new Set(expandedGroups);
    if (isExpanded) {
      newExpanded.delete(group.path);
    } else {
      newExpanded.add(group.path);
    }
    setExpandedGroups(newExpanded);
  };
  
  return (
    <div className="border-b border-border-muted last:border-b-0">
      {/* Group Header */}
      <div 
        className={`flex items-center gap-2 p-[10px] hover:bg-surface-accent transition-colors ${
          level > 0 ? 'bg-surface-muted' : ''
        }`}
        style={{ paddingLeft: `${10 + level * 16}px` }}
      >
        {hasChildren && (
          <button
            onClick={toggleExpanded}
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center hover:bg-surface-accent rounded"
          >
            {isExpanded ? (
              <ChevronDownIcon className="w-3 h-3 text-foreground-muted" />
            ) : (
              <ChevronRightIcon className="w-3 h-3 text-foreground-muted" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-4" />}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground text-xs font-mono">
              {group.path === '/' ? '/' : group.path}
            </span>
            {group.isDynamic && (
              <span className="px-1 py-0.5 bg-lake-blue/20 text-lake-blue rounded text-[9px]">
                dynamic
              </span>
            )}
            {group.routes.some(r => r.isDraft) && (
              <span className="px-1 py-0.5 bg-orange-500/20 text-orange-600 rounded text-[9px]">
                draft
              </span>
            )}
            {group.routes.some(r => !r.isDraft) && (
              <span className="px-1 py-0.5 bg-green-500/20 text-green-600 rounded text-[9px]">
                production
              </span>
            )}
            {group.hasMetadata && (
              <span className={`text-[9px] px-1 py-0.5 rounded ${
                group.metadataType === 'static' 
                  ? 'bg-green-500/20 text-green-600'
                  : 'bg-blue-500/20 text-blue-600'
              }`}>
                {group.metadataType}
              </span>
            )}
            {!group.hasMetadata && (
              <span className="text-[9px] px-1 py-0.5 bg-red-500/20 text-red-600 rounded">
                no metadata
              </span>
            )}
            <span className="text-[9px] text-foreground-muted">
              ({totalRoutes} {totalRoutes === 1 ? 'route' : 'routes'})
            </span>
          </div>
        </div>
      </div>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div>
          {/* Direct routes in this group */}
          {filteredRoutes.map((route) => (
            <div
              key={route.path}
              className="border-b border-border-muted/50 hover:bg-surface-accent/50 transition-colors"
              style={{ paddingLeft: `${26 + level * 16}px` }}
            >
              <div className="p-[10px] flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] text-foreground">{route.path}</span>
                    {route.isDynamic && (
                      <span className="px-1 py-0.5 bg-lake-blue/20 text-lake-blue rounded text-[9px]">
                        {route.isCatchAll ? 'catch-all' : route.isOptionalCatchAll ? 'opt-catch' : 'dynamic'}
                      </span>
                    )}
                    {route.isDraft ? (
                      <span className="px-1 py-0.5 bg-orange-500/20 text-orange-600 rounded text-[9px]">
                        draft
                      </span>
                    ) : (
                      <span className="px-1 py-0.5 bg-green-500/20 text-green-600 rounded text-[9px]">
                        production
                      </span>
                    )}
                    <div className="flex gap-1">
                      {route.hasMetadata && (
                        <span className="text-[9px] px-1 py-0.5 bg-green-500/20 text-green-600 rounded">
                          static
                        </span>
                      )}
                      {route.hasGenerateMetadata && (
                        <span className="text-[9px] px-1 py-0.5 bg-blue-500/20 text-blue-600 rounded">
                          dynamic
                        </span>
                      )}
                      {!route.hasMetadata && !route.hasGenerateMetadata && (
                        <span className="text-[9px] px-1 py-0.5 bg-red-500/20 text-red-600 rounded">
                          none
                        </span>
                      )}
                    </div>
                  </div>
                  {route.metadata?.title && (
                    <div className="text-[10px] text-foreground-muted mb-0.5 truncate">
                      {route.metadata.title}
                    </div>
                  )}
                  {route.metadata?.description && (
                    <div className="text-[9px] text-foreground-subtle truncate">
                      {route.metadata.description}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Sub-groups */}
          {filteredSubGroups.map((subGroup) => (
            <RouteGroupComponent
              key={subGroup.path}
              group={subGroup}
              searchQuery={searchQuery}
              expandedGroups={expandedGroups}
              setExpandedGroups={setExpandedGroups}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
