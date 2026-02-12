'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChartBarIcon, EyeIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline';

interface AnalyticsStats {
  profile?: {
    views: number;
    growth?: number;
  };
  mentions?: {
    count: number;
    growth?: number;
  };
  posts?: {
    count: number;
    growth?: number;
  };
  maps?: {
    views: number;
    growth?: number;
  };
}

export default function HomeAnalyticsSidebar() {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
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
        console.error('Error fetching analytics stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto scrollbar-hide p-[10px] space-y-3">
          <div className="bg-white border border-gray-200 rounded-md p-[10px]">
            <div className="animate-pulse space-y-3">
              <div className="h-3 w-20 bg-gray-200 rounded" />
              <div className="h-6 w-16 bg-gray-200 rounded" />
              <div className="h-2 w-32 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-hide p-[10px] space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <ChartBarIcon className="w-4 h-4 text-gray-600" />
          <h2 className="text-xs font-semibold text-gray-900">Analytics</h2>
        </div>

        {/* Analytics Card */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <Link
            href="/analytics"
            className="block hover:bg-gray-50 transition-colors rounded-md -m-[10px] p-[10px]"
          >
            <div className="space-y-3">
              {/* Description */}
              <p className="text-xs text-gray-600">
                View your profile, mention, post, and map analytics
              </p>

              {/* Stats Preview */}
              {stats && (
                <div className="space-y-2">
                  {stats.profile && (
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-gray-500">Profile views</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-900">
                          {stats.profile.views?.toLocaleString() || '0'}
                        </span>
                        {stats.profile.growth !== undefined && stats.profile.growth !== 0 && (
                          <div className={`flex items-center gap-0.5 ${
                            stats.profile.growth > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            <ArrowTrendingUpIcon className={`w-3 h-3 ${stats.profile.growth < 0 && 'rotate-180'}`} />
                            <span className="text-[10px] font-medium">
                              {Math.abs(Math.round(stats.profile.growth))}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CTA */}
              <div className="pt-1.5 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">View analytics</span>
                  <EyeIcon className="w-3 h-3 text-gray-500" />
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Live Map Analytics */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <Link
            href="/maps"
            className="block hover:bg-gray-50 transition-colors rounded-md -m-[10px] p-[10px]"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ChartBarIcon className="w-4 h-4 text-gray-600" />
                <h3 className="text-xs font-semibold text-gray-900">Live Map</h3>
              </div>
              <p className="text-xs text-gray-600">
                View real-time visit statistics and page analytics
              </p>
              <div className="pt-1.5 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">View map</span>
                  <EyeIcon className="w-3 h-3 text-gray-500" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
