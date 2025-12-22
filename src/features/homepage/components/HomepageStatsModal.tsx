'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { useToast } from '@/features/ui/hooks/useToast';

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
  const searchParams = useSearchParams();
  const router = useRouter();
  const { info } = useToast();
  
  // Get current year from URL or default to current year
  const currentYearParam = searchParams.get('year');
  const currentYear = currentYearParam ? parseInt(currentYearParam, 10) : null;
  
  // Generate 100 years of options (current year back to 100 years ago)
  const currentYearValue = new Date().getFullYear();
  const years = Array.from({ length: 101 }, (_, i) => currentYearValue - i);

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

  const handleYearChange = async (year: string) => {
    const url = new URL(window.location.href);
    
    if (year === '') {
      // Clear the year filter
      url.searchParams.delete('year');
    } else {
      // Set year filter
      url.searchParams.set('year', year);
      
      // Show toast notification
      info(`Minnesota in ${year}`);
      
      // Close the modal
      onClose();
    }
    
    router.push(url.pathname + url.search);
    
    // Trigger pins reload
    window.dispatchEvent(new CustomEvent('mention-created'));
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
          {/* Logo and Share Message */}
          <div className="flex flex-col items-center text-center space-y-3">
            <Image
              src="/logo.png"
              alt="Minnesota with heart"
              width={80}
              height={80}
              className="object-contain"
            />
            <p className="text-xs text-gray-600 leading-relaxed max-w-xs">
              Help us grow this community! Share the map with friends and family who love Minnesota.
            </p>
          </div>
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
            <div className="flex items-stretch gap-2">
              {/* Last 24 Hours */}
              <div className="flex-1 p-2 bg-gray-50 rounded-md border border-gray-200">
                <div className="text-[10px] font-medium text-gray-900 mb-0.5">
                  Last 24 Hours
                </div>
                <div className="text-[10px] text-gray-600">
                  <span className="font-semibold text-gray-900">{stats.last24Hours.unique_visitors.toLocaleString()}</span> visitors
                </div>
              </div>

              {/* Last 7 Days */}
              <div className="flex-1 p-2 bg-gray-50 rounded-md border border-gray-200">
                <div className="text-[10px] font-medium text-gray-900 mb-0.5">
                  Last Week
                </div>
                <div className="text-[10px] text-gray-600">
                  <span className="font-semibold text-gray-900">{stats.last7Days.unique_visitors.toLocaleString()}</span> visitors
                </div>
              </div>

              {/* Last 30 Days */}
              <div className="flex-1 p-2 bg-gray-50 rounded-md border border-gray-200">
                <div className="text-[10px] font-medium text-gray-900 mb-0.5">
                  Last Month
                </div>
                <div className="text-[10px] text-gray-600">
                  <span className="font-semibold text-gray-900">{stats.last30Days.unique_visitors.toLocaleString()}</span> visitors
                </div>
              </div>
            </div>
          )}

          {/* Year Filter Selector - Always visible */}
          <div className="pt-2 border-t border-gray-200">
            <div className="mb-2">
              <h3 className="text-xs font-semibold text-gray-900 mb-0.5">
                TimeTravel Archive
              </h3>
              <p className="text-[10px] text-gray-600 leading-relaxed">
                Past memories, events, and milestones in Minnesota. Select a year.
              </p>
            </div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Filter Mentions by Year
            </label>
            <select
              value={currentYear?.toString() || ''}
              onChange={(e) => handleYearChange(e.target.value)}
              className="w-full px-2 py-1.5 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-white"
            >
              <option value="">All Years</option>
              {years.map((year) => (
                <option key={year} value={year.toString()}>
                  {year}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-500 mt-1">
              Show only mentions from selected year (100 year range)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}



