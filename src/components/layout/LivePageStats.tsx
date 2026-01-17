'use client';

import { useState, useEffect, useMemo } from 'react';

/**
 * Live Page Stats Component
 * Displays 24-hour and total visit statistics for the /live page
 */
export default function LivePageStats() {
  const [visitStats, setVisitStats] = useState<{ last24Hours: number; previous24Hours: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // Calculate if trending (volume + growth)
  const isTrending = useMemo(() => {
    if (!visitStats) return false;
    const { last24Hours, previous24Hours } = visitStats;
    
    // Minimum volume threshold: 30+ visits
    if (last24Hours < 30) return false;
    
    // If no previous data, any volume >= 30 is trending
    if (previous24Hours === 0) return true;
    
    // Calculate growth percentage
    const growth = ((last24Hours - previous24Hours) / previous24Hours) * 100;
    
    // Trending if 20%+ growth
    return growth >= 20;
  }, [visitStats]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/analytics/homepage-stats');
        if (response.ok) {
          const data = await response.json();
          setVisitStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch homepage stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !visitStats) {
    return (
      <div className="p-3 bg-gray-50 rounded-md">
        <p className="text-xs text-gray-500 mb-1">Live Page Visits</p>
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!visitStats) {
    return (
      <div className="p-3 bg-gray-50 rounded-md">
        <p className="text-xs text-gray-500 mb-1">Live Page Visits</p>
        <p className="text-sm text-gray-400">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-500">Last 24 Hours</p>
          {isTrending && <span className="text-sm">🔥</span>}
        </div>
        <p className="text-2xl font-semibold text-gray-900">
          {visitStats.last24Hours.toLocaleString()}
        </p>
        {visitStats.previous24Hours > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            Previous 24h: {visitStats.previous24Hours.toLocaleString()}
          </p>
        )}
      </div>
      
      <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
        <p className="text-xs font-medium text-gray-500 mb-2">Total Visits</p>
        <p className="text-2xl font-semibold text-gray-900">
          {visitStats.total.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
