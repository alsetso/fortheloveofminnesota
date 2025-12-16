'use client';

import { useState, useEffect } from 'react';
import { ChartBarIcon, ClockIcon } from '@heroicons/react/24/outline';

interface MapStats {
  total_loads: number;
  unique_visitors: number;
  accounts_active: number;
}

type TimePeriod = 24 | 168;

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export default function MapStats() {
  const [stats, setStats] = useState<MapStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(24);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/analytics/map-stats?hours=${timePeriod}`);
        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching map stats:', error);
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
    
    // Refresh stats every 30 seconds to show new visitors
    const interval = setInterval(fetchStats, 30000);
    
    return () => clearInterval(interval);
  }, [timePeriod]);

  const toggleTimePeriod = () => {
    setTimePeriod(prev => prev === 24 ? 168 : 24);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-md border border-gray-200 p-3 shadow-lg">
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

  return (
    <div className="bg-white rounded-md border border-gray-200 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ChartBarIcon className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs font-medium text-gray-900">Map Stats</span>
          </div>
          <button
            onClick={toggleTimePeriod}
            className="p-1 rounded hover:bg-gray-100 transition-colors group"
            title={timePeriod === 24 ? 'Switch to 7 days' : 'Switch to 24 hours'}
            aria-label={timePeriod === 24 ? 'Switch to 7 days' : 'Switch to 24 hours'}
          >
            <ClockIcon className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-700" />
          </button>
        </div>
        <div className="mt-0.5">
          <span className="text-[10px] text-gray-400">
            {timePeriod === 24 ? 'Last 24 hours' : 'Last 7 days'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="px-3 py-2 space-y-2.5">
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

