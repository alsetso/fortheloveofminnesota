'use client';

import { useState, useEffect } from 'react';
import { EyeIcon, UserIcon, ClockIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

interface PinStats {
  total_views: number;
  unique_viewers: number;
  accounts_viewed: number;
}

interface TimeRangeStats {
  label: string;
  total_views: number;
  unique_viewers: number;
  accounts_viewed: number;
}

interface PinStatsData {
  pin_id: string;
  stats: PinStats;
  time_ranges: TimeRangeStats[];
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_trend: Array<{ date: string; views: number }>;
}

interface PinStatsCardProps {
  pinId: string;
  hours?: number | null;
  className?: string;
  compact?: boolean;
}

export default function PinStatsCard({ pinId, hours = null, className = '', compact = false }: PinStatsCardProps) {
  const [stats, setStats] = useState<PinStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pinId) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ pin_id: pinId });
        if (hours !== null) {
          params.set('hours', hours.toString());
        }

        const response = await fetch(`/api/analytics/pin-stats?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch pin stats');
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('[PinStatsCard] Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Listen for pin view tracking events to refetch stats
    const handlePinViewTracked = (event: CustomEvent) => {
      if (event.detail.pin_id === pinId) {
        // Refetch stats when this pin's view is tracked
        fetchStats();
      }
    };

    window.addEventListener('pin-view-tracked', handlePinViewTracked as EventListener);

    return () => {
      window.removeEventListener('pin-view-tracked', handlePinViewTracked as EventListener);
    };
  }, [pinId, hours]);

  if (loading) {
    return (
      <div className={`bg-white border border-gray-200 rounded-md p-[10px] ${className}`}>
        <div className="text-xs text-gray-500 space-y-2">
          <div className="animate-pulse">Loading stats...</div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return null;
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-3 text-xs text-gray-600 ${className}`}>
        <div className="flex items-center gap-1">
          <EyeIcon className="w-3 h-3 text-gray-500" />
          <span className="font-medium text-gray-900">{stats.stats.total_views.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <UserIcon className="w-3 h-3 text-gray-500" />
          <span className="text-gray-600">{stats.stats.unique_viewers.toLocaleString()}</span>
        </div>
      </div>
    );
  }

  const currentRange = stats.time_ranges.find((r) => r.label === (hours === 24 ? '24h' : hours === 168 ? '7d' : hours === 720 ? '30d' : 'all')) || stats.time_ranges[stats.time_ranges.length - 1];

  return (
    <div className={`bg-white border border-gray-200 rounded-md p-[10px] space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-900">Pin Analytics</h3>
        <ChartBarIcon className="w-4 h-4 text-gray-500" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1">
            <EyeIcon className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-500">Views</span>
          </div>
          <div className="text-sm font-semibold text-gray-900">
            {currentRange.total_views.toLocaleString()}
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center gap-1">
            <UserIcon className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-500">Viewers</span>
          </div>
          <div className="text-sm font-semibold text-gray-900">
            {currentRange.unique_viewers.toLocaleString()}
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center gap-1">
            <UserIcon className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-500">Accounts</span>
          </div>
          <div className="text-sm font-semibold text-gray-900">
            {currentRange.accounts_viewed.toLocaleString()}
          </div>
        </div>
      </div>

      {stats.time_ranges.length > 1 && (
        <div className="space-y-1.5 pt-2 border-t border-gray-100">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Time Ranges</div>
          <div className="grid grid-cols-4 gap-1.5">
            {stats.time_ranges.map((range) => (
              <div key={range.label} className="text-center">
                <div className="text-[10px] text-gray-500 mb-0.5">{range.label}</div>
                <div className="text-xs font-medium text-gray-900">{range.total_views}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(stats.first_viewed_at || stats.last_viewed_at) && (
        <div className="space-y-1 pt-2 border-t border-gray-100">
          {stats.first_viewed_at && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <ClockIcon className="w-3 h-3 text-gray-400" />
              <span className="text-gray-500">First viewed:</span>
              <span className="text-gray-700">
                {formatDistanceToNow(new Date(stats.first_viewed_at), { addSuffix: true })}
              </span>
            </div>
          )}
          {stats.last_viewed_at && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <ClockIcon className="w-3 h-3 text-gray-400" />
              <span className="text-gray-500">Last viewed:</span>
              <span className="text-gray-700">
                {formatDistanceToNow(new Date(stats.last_viewed_at), { addSuffix: true })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

