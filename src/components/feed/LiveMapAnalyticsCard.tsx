'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowTrendingUpIcon, EyeIcon, ChartBarIcon } from '@heroicons/react/24/outline';

interface LiveMapStats {
  last24Hours: number;
  previous24Hours: number;
  total: number;
}

export default function LiveMapAnalyticsCard() {
  const [stats, setStats] = useState<LiveMapStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/analytics/homepage-stats', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Error fetching live map stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-20 bg-gray-200 rounded" />
          <div className="h-6 w-16 bg-gray-200 rounded" />
          <div className="h-2 w-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const growthRate = stats.previous24Hours > 0
    ? ((stats.last24Hours - stats.previous24Hours) / stats.previous24Hours) * 100
    : 0;
  const isGrowing = growthRate > 0;

  return (
    <Link
      href="/live"
      className="block bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 transition-colors"
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <ChartBarIcon className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Live Map</h3>
        </div>

        {/* Stats Grid */}
        <div className="space-y-1.5">
          {/* 24h Views */}
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-gray-500">Last 24h</span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-gray-900">
                {stats.last24Hours.toLocaleString()}
              </span>
              {growthRate !== 0 && (
                <div className={`flex items-center gap-0.5 ${
                  isGrowing ? 'text-green-600' : 'text-red-600'
                }`}>
                  <ArrowTrendingUpIcon className={`w-3 h-3 ${!isGrowing && 'rotate-180'}`} />
                  <span className="text-[10px] font-medium">
                    {Math.abs(Math.round(growthRate))}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Total Views */}
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-gray-500">Total</span>
            <span className="text-sm font-semibold text-gray-900">
              {stats.total.toLocaleString()}
            </span>
          </div>
        </div>

        {/* CTA */}
        <div className="pt-1.5 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">View map</span>
            <EyeIcon className="w-3 h-3 text-gray-500" />
          </div>
        </div>
      </div>
    </Link>
  );
}
