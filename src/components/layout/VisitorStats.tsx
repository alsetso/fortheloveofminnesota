'use client';

import { useState, useEffect } from 'react';

interface VisitorStatsData {
  totalVisitors: number;
  todayVisitors: number;
}

export default function VisitorStats() {
  const [stats, setStats] = useState<VisitorStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/analytics/live-visitors');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Error fetching visitor stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !stats) {
    return (
      <div className="fixed bottom-4 left-4 z-50 bg-white border border-gray-200 rounded-md p-[10px] shadow-sm">
        <div className="text-xs text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-white border border-gray-200 rounded-md p-[10px] shadow-sm">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-600">Total Visitors</span>
          <span className="text-xs font-semibold text-gray-900">
            {stats.totalVisitors.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-600">Today&apos;s Visitors</span>
          <span className="text-xs font-semibold text-gray-900">
            {stats.todayVisitors.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

