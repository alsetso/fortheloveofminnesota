'use client';

import { useState, useEffect } from 'react';
import { ChartBarIcon, ClockIcon } from '@heroicons/react/24/outline';

interface PageStats {
  total_loads: number;
  unique_visitors: number;
  accounts_active: number;
}

type TimePeriod = 24 | 168;

interface PageStatsCardProps {
  pageSlug?: 'business' | 'directory';
  pageId?: string;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export default function PageStatsCard({ pageSlug, pageId }: PageStatsCardProps) {
  const [stats, setStats] = useState<PageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(24);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Validate that exactly one prop is provided
    if (!pageSlug && !pageId) {
      console.error('PageStatsCard: Either pageSlug or pageId must be provided');
      setLoading(false);
      setError('Invalid configuration');
      return;
    }

    if (pageSlug && pageId) {
      console.error('PageStatsCard: Cannot provide both pageSlug and pageId');
      setLoading(false);
      setError('Invalid configuration');
      return;
    }

    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const params = new URLSearchParams({
          hours: timePeriod.toString(),
        });
        
        if (pageSlug) {
          params.set('page', pageSlug);
        } else if (pageId) {
          params.set('id', pageId);
        }

        // Business stats API removed - not prioritizing business/pages
        setError('Business stats not available');
        setLoading(false);
        setStats({
          total_loads: 0,
          unique_visitors: 0,
          accounts_active: 0,
        });
        return;
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch stats' }));
          console.error('[PageStatsCard] API error:', errorData);
          throw new Error(errorData.error || 'Failed to fetch stats');
        }
        
        const data = await response.json();
        console.log('[PageStatsCard] Received stats:', data);
        
        // Validate response structure
        if (typeof data.total_loads !== 'number' || typeof data.unique_visitors !== 'number' || typeof data.accounts_active !== 'number') {
          console.error('[PageStatsCard] Invalid data format:', data);
          throw new Error('Invalid stats data format');
        }
        
        setStats(data);
      } catch (error) {
        console.error('Error fetching page stats:', error);
        setError(error instanceof Error ? error.message : 'Failed to load stats');
        // Set default values on error
        setStats({
          total_loads: 0,
          unique_visitors: 0,
          accounts_active: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Auto-refresh stats every 30 seconds
    const interval = setInterval(() => {
      fetchStats();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [pageSlug, pageId, timePeriod]);

  const toggleTimePeriod = () => {
    setTimePeriod(prev => prev === 24 ? 168 : 24);
    // Stats will auto-refresh via useEffect dependency
  };

  const handleRefresh = () => {
    if (!pageSlug && !pageId) return;
    
    setLoading(true);
    setError(null);
    
    const params = new URLSearchParams({
      hours: timePeriod.toString(),
    });
    
    if (pageSlug) {
      params.set('page', pageSlug);
    } else if (pageId) {
      params.set('id', pageId);
    }

    // Business stats API removed - not prioritizing business/pages
    setError('Business stats not available');
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          <div className="h-6 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          <div className="h-6 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const statsData = stats || {
    total_loads: 0,
    unique_visitors: 0,
    accounts_active: 0,
  };

  const pageLabel = pageSlug === 'business' ? 'Pages' : pageSlug === 'directory' ? 'Directory' : 'Page Stats';

  return (
    <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-[10px] py-[10px] border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChartBarIcon className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-medium text-gray-900">{pageLabel} Stats</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              className="p-[10px] rounded-md hover:bg-gray-50 transition-colors group"
              title="Refresh stats"
              aria-label="Refresh stats"
              disabled={loading}
            >
              <svg 
                className={`w-4 h-4 text-gray-500 group-hover:text-gray-700 ${loading ? 'animate-spin' : ''}`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={toggleTimePeriod}
              className="p-[10px] rounded-md hover:bg-gray-50 transition-colors group"
              title={timePeriod === 24 ? 'Switch to 7 days' : 'Switch to 24 hours'}
              aria-label={timePeriod === 24 ? 'Switch to 7 days' : 'Switch to 24 hours'}
            >
              <ClockIcon className="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
            </button>
          </div>
        </div>
        <div className="mt-0.5 flex items-center justify-between">
          <span className="text-[10px] text-gray-400">
            {timePeriod === 24 ? 'Last 24 hours' : 'Last 7 days'}
          </span>
          {error && (
            <span className="text-[10px] text-red-500" title={error}>
              Error loading
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-[10px] py-[10px] space-y-3">
        {/* Visitors (unique) */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Visitors</span>
            <span className="text-xs font-medium text-gray-900">
              {formatNumber(statsData.unique_visitors)}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">Unique visitors</p>
        </div>

        {/* Loads (total views) */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Loads</span>
            <span className="text-xs font-medium text-gray-900">
              {formatNumber(statsData.total_loads)}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">Total views</p>
        </div>

        {/* Accounts Active */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Accounts Active</span>
            <span className="text-xs font-medium text-gray-900">
              {formatNumber(statsData.accounts_active)}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">Unique accounts</p>
        </div>
      </div>
    </div>
  );
}

