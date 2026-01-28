'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getMapUrl } from '@/lib/maps/urls';

interface MapView {
  id: string;
  name: string;
  slug: string | null;
  view_count: number;
  last_viewed: string;
  first_viewed: string;
}

interface ViewsUsageData {
  views: MapView[];
  total_count: number;
  total_views: number;
  page: number;
  limit: number;
  total_pages: number;
  date_range: '30' | '90' | 'all';
}

interface ViewsUsageSectionProps {
  accountId: string | null;
}

export default function ViewsUsageSection({ accountId }: ViewsUsageSectionProps) {
  const [dateRange, setDateRange] = useState<'30' | '90' | 'all'>('30');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ViewsUsageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) {
      setLoading(false);
      return;
    }

    const fetchViews = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const params = new URLSearchParams({
          date_range: dateRange,
          page: page.toString(),
          limit: '20',
        });
        
        const response = await fetch(`/api/billing/views-usage?${params}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch views');
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching views usage:', err);
        setError(err instanceof Error ? err.message : 'Failed to load views');
        setData({
          views: [],
          total_count: 0,
          total_views: 0,
          page: 1,
          limit: 20,
          total_pages: 0,
          date_range: dateRange,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchViews();
  }, [accountId, dateRange, page]);

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  if (!accountId) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-[10px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Views & Usage</h3>
        
        {/* Date Range Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setDateRange('30');
              setPage(1);
            }}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
              dateRange === '30'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            30
          </button>
          <button
            onClick={() => {
              setDateRange('90');
              setPage(1);
            }}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
              dateRange === '90'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            90
          </button>
          <button
            onClick={() => {
              setDateRange('all');
              setPage(1);
            }}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
              dateRange === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-xs text-gray-500 py-4 text-center">Loading...</div>
      )}

      {error && !loading && (
        <div className="text-xs text-red-600 py-4 text-center">{error}</div>
      )}

      {!loading && !error && data && (
        <>
          {data.views.length === 0 ? (
            <div className="text-xs text-gray-500 py-4 text-center">
              No map views recorded yet.
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-semibold text-gray-900">Map</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-900">Views</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-900">Last Viewed</th>
                      <th className="text-left py-2 px-2 font-semibold text-gray-900">First Viewed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.views.map((view) => (
                      <tr
                        key={view.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-2 px-2">
                          <Link
                            href={getMapUrl({ id: view.id, slug: view.slug || undefined })}
                            className="text-gray-900 hover:text-gray-700 font-medium"
                          >
                            {view.name || 'Unnamed Map'}
                          </Link>
                        </td>
                        <td className="py-2 px-2 text-right text-gray-600">
                          {view.view_count.toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-gray-600">
                          {formatDate(view.last_viewed)}
                        </td>
                        <td className="py-2 px-2 text-gray-600">
                          {formatDate(view.first_viewed)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td className="py-2 px-2 font-semibold text-gray-900">Total</td>
                      <td className="py-2 px-2 text-right font-semibold text-gray-900">
                        {data.total_views.toLocaleString()}
                      </td>
                      <td colSpan={2} className="py-2 px-2 text-gray-500 text-xs">
                        {data.total_count} {data.total_count === 1 ? 'map' : 'maps'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Pagination */}
              {data.total_pages > 1 && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500">
                    Page {data.page} of {data.total_pages}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                      disabled={page === data.total_pages}
                      className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
