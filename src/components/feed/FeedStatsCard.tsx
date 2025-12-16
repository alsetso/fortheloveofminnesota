'use client';

import { useState, useEffect } from 'react';

interface FeedStats {
  total_loads: number;
  unique_visitors: number;
  accounts_active: number;
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

export default function FeedStatsCard() {
  const [stats, setStats] = useState<FeedStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/analytics/feed-stats?hours=24`);
        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching feed stats:', error);
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
  }, []);

  if (loading) {
    return (
      <div className="text-xs text-gray-500 space-y-0.5">
        <div>Visitors: —</div>
        <div>Loads: —</div>
        <div>Accounts: —</div>
      </div>
    );
  }

  const statsData = stats || {
    total_loads: 0,
    unique_visitors: 0,
    accounts_active: 0,
  };

  return (
    <div className="text-xs text-gray-600 space-y-0.5">
      <div>
        <span className="text-gray-500">Visitors:</span>{' '}
        <span className="text-gray-900">{formatNumber(statsData.unique_visitors)}</span>
      </div>
      <div>
        <span className="text-gray-500">Loads:</span>{' '}
        <span className="text-gray-900">{formatNumber(statsData.total_loads)}</span>
      </div>
      <div>
        <span className="text-gray-500">Accounts:</span>{' '}
        <span className="text-gray-900">{formatNumber(statsData.accounts_active)}</span>
      </div>
    </div>
  );
}

