'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ChartBarIcon,
  DocumentTextIcon,
  UserIcon,
  BuildingOfficeIcon,
  FunnelIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

type EntityType = 'post' | 'account' | 'business' | 'page';

interface EntityWithViews {
  entity_type: EntityType;
  entity_id: string;
  entity_slug: string | null;
  title: string;
  total_views: number; // Filtered views from page_views table (respects date filters)
  unique_visitors: number;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  created_at: string;
  url: string;
}

const entityTypeLabels: Record<EntityType, string> = {
  post: 'Posts',
  account: 'Profile',
  business: 'Businesses',
  page: 'Pages',
};

const entityTypeIcons: Record<EntityType, typeof DocumentTextIcon> = {
  post: DocumentTextIcon,
  account: UserIcon,
  business: BuildingOfficeIcon,
  page: BuildingOfficeIcon,
};

export default function AnalyticsClient() {
  const [entities, setEntities] = useState<EntityWithViews[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [selectedType, setSelectedType] = useState<EntityType | 'all'>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sortBy, setSortBy] = useState<'views' | 'recent' | 'created'>('recent');

  useEffect(() => {
    const fetchEntities = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (selectedType !== 'all') {
          params.set('entity_type', selectedType);
        }
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);

        const response = await fetch(`/api/analytics/my-entities?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load analytics');
        }

        // Sort entities
        const sorted = [...(data.entities || [])];
        if (sortBy === 'views') {
          sorted.sort((a, b) => b.total_views - a.total_views);
        } else if (sortBy === 'created') {
          sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } else {
          // recent (default) - already sorted by API
        }

        setEntities(sorted);
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchEntities();
  }, [selectedType, dateFrom, dateTo, sortBy]);

  // Group entities by type for summary
  const summary = entities.reduce((acc, entity) => {
    if (!acc[entity.entity_type]) {
      acc[entity.entity_type] = { count: 0, totalViews: 0, uniqueVisitors: 0 };
    }
    acc[entity.entity_type].count++;
    acc[entity.entity_type].totalViews += entity.total_views;
    acc[entity.entity_type].uniqueVisitors += entity.unique_visitors;
    return acc;
  }, {} as Record<EntityType, { count: number; totalViews: number; uniqueVisitors: number }>);

  const totalEntities = entities.length;
  const totalViews = entities.reduce((sum, e) => sum + e.total_views, 0);
  const totalUniqueVisitors = entities.reduce((sum, e) => sum + e.unique_visitors, 0);

  return (
    <div>
        {/* Header */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-[10px] bg-white border border-gray-200 rounded-md">
              <ChartBarIcon className="w-4 h-4 text-gray-700" />
            </div>
            <h1 className="text-sm font-semibold text-gray-900">Analytics</h1>
          </div>
          <p className="text-xs text-gray-600">View page analytics for all your public content</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
          <div className="bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Entities</div>
            <div className="text-xs font-semibold text-gray-900">{totalEntities}</div>
          </div>
          <div className="bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Views</div>
            <div className="text-xs font-semibold text-gray-700">{totalViews.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Unique Visitors</div>
            <div className="text-xs font-semibold text-gray-700">
              {entities.reduce((sum, e) => sum + e.unique_visitors, 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Avg Views/Entity</div>
            <div className="text-xs font-semibold text-gray-900">
              {totalEntities > 0 ? Math.round(totalViews / totalEntities).toLocaleString() : '0'}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-md border border-gray-200 p-[10px] mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="p-[10px] bg-gray-100 rounded-md">
                <FunnelIcon className="w-3 h-3 text-gray-700" />
              </div>
              <span className="text-xs font-medium text-gray-700">Filters</span>
            </div>

            {/* Entity Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as EntityType | 'all')}
              className="px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500 transition-colors"
            >
              <option value="all">All Types</option>
              {Object.entries(entityTypeLabels).map(([type, label]) => (
                <option key={type} value={type}>{label}</option>
              ))}
            </select>

            {/* Date From */}
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="w-3 h-3 text-gray-600" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500 transition-colors"
                placeholder="From"
              />
            </div>

            {/* Date To */}
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500 transition-colors"
                placeholder="To"
              />
            </div>

            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'views' | 'recent' | 'created')}
              className="px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500 transition-colors ml-auto"
            >
              <option value="recent">Sort by Recent Views</option>
              <option value="views">Sort by Total Views</option>
              <option value="created">Sort by Created Date</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-md border border-gray-200 p-[10px] text-center">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-gray-600">Loading analytics...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
            <p className="text-xs text-gray-700">{error}</p>
          </div>
        )}

        {/* Entities List */}
        {!loading && !error && (
          <>
            {entities.length === 0 ? (
              <div className="bg-white rounded-md border border-gray-200 p-[10px] text-center">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <ChartBarIcon className="w-4 h-4 text-gray-600" />
                </div>
                <p className="text-xs text-gray-700 font-medium mb-1">No entities found</p>
                <p className="text-xs text-gray-500">
                  {selectedType !== 'all' || dateFrom || dateTo
                    ? 'Try adjusting your filters'
                    : 'Create some public content to see analytics'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {entities.map((entity) => {
                  const Icon = entityTypeIcons[entity.entity_type] || DocumentTextIcon;

                  return (
                    <Link
                      key={`${entity.entity_type}-${entity.entity_id}`}
                      href={entity.url}
                      className="block bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-[10px] bg-gray-100 rounded-md">
                              <Icon className="w-3 h-3 text-gray-700 flex-shrink-0" />
                            </div>
                            <span className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                              {entityTypeLabels[entity.entity_type] || 'Unknown'}
                            </span>
                          </div>
                          <h3 className="text-xs font-semibold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors">
                            {entity.title}
                          </h3>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div className="p-[10px] bg-gray-50 rounded-md border border-gray-100">
                              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Total Views</div>
                              <div className="text-xs font-semibold text-gray-700">{entity.total_views.toLocaleString()}</div>
                            </div>
                            <div className="p-[10px] bg-gray-50 rounded-md border border-gray-100">
                              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Unique Visitors</div>
                              <div className="text-xs font-semibold text-gray-700">{entity.unique_visitors.toLocaleString()}</div>
                            </div>
                            <div className="p-[10px] bg-gray-50 rounded-md border border-gray-100">
                              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Last Viewed</div>
                              <div className="text-xs font-medium text-gray-600">
                                {entity.last_viewed_at
                                  ? formatDistanceToNow(new Date(entity.last_viewed_at), { addSuffix: true })
                                  : 'Never'}
                              </div>
                            </div>
                            <div className="p-[10px] bg-gray-50 rounded-md border border-gray-100">
                              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Created</div>
                              <div className="text-xs font-medium text-gray-600">
                                {formatDistanceToNow(new Date(entity.created_at), { addSuffix: true })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
    </div>
  );
}

