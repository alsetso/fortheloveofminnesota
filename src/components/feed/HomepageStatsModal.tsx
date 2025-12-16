'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface HomepageStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HomepageStats {
  last24Hours: {
    unique_visitors: number;
    total_views: number;
    accounts_viewed: number;
  };
  last7Days: {
    unique_visitors: number;
    total_views: number;
    accounts_viewed: number;
  };
  last30Days: {
    unique_visitors: number;
    total_views: number;
    accounts_viewed: number;
  };
}

export default function HomepageStatsModal({ isOpen, onClose }: HomepageStatsModalProps) {
  const [stats, setStats] = useState<HomepageStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && !stats) {
      fetchStats();
    }
  }, [isOpen]);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/analytics/homepage-stats');
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg border border-gray-200 shadow-xl max-w-md w-full mx-4 z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">
            For the Love of Minnesota
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="text-xs text-red-600 text-center py-4">
              {error}
            </div>
          )}

          {stats && !isLoading && (
            <div className="space-y-4">
              {/* Last 24 Hours */}
              <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                <div className="text-xs font-medium text-gray-900 mb-1">
                  Last 24 Hours
                </div>
                <div className="text-xs text-gray-600">
                  We had <span className="font-semibold text-gray-900">{stats.last24Hours.unique_visitors.toLocaleString()}</span> people load the site
                </div>
              </div>

              {/* Last 7 Days */}
              <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                <div className="text-xs font-medium text-gray-900 mb-1">
                  Last Week
                </div>
                <div className="text-xs text-gray-600">
                  We had <span className="font-semibold text-gray-900">{stats.last7Days.unique_visitors.toLocaleString()}</span> people load the site
                </div>
              </div>

              {/* Last 30 Days */}
              <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                <div className="text-xs font-medium text-gray-900 mb-1">
                  Last Month
                </div>
                <div className="text-xs text-gray-600">
                  We had <span className="font-semibold text-gray-900">{stats.last30Days.unique_visitors.toLocaleString()}</span> people load the site
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
