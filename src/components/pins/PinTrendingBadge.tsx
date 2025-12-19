'use client';

import { useState, useEffect } from 'react';
import { FireIcon } from '@heroicons/react/24/solid';

interface PinTrendingBadgeProps {
  pinId: string;
  hours?: number;
  minViews?: number;
  className?: string;
}

export default function PinTrendingBadge({ pinId, hours = 24, minViews = 5, className = '' }: PinTrendingBadgeProps) {
  const [isTrending, setIsTrending] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pinId) {
      setLoading(false);
      return;
    }

    const checkTrending = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/analytics/pin-stats?pin_id=${pinId}&hours=${hours}`);
        if (!response.ok) {
          throw new Error('Failed to check trending status');
        }
        const data = await response.json();
        const views = data.stats?.total_views || 0;
        setViewCount(views);
        setIsTrending(views >= minViews);
      } catch (err) {
        console.error('[PinTrendingBadge] Error checking trending:', err);
        setIsTrending(false);
      } finally {
        setLoading(false);
      }
    };

    checkTrending();
  }, [pinId, hours, minViews]);

  if (loading || !isTrending) {
    return null;
  }

  return (
    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 border border-orange-200 rounded text-[10px] font-medium text-orange-700 ${className}`}>
      <FireIcon className="w-2.5 h-2.5" />
      <span>Trending</span>
      {viewCount > 0 && (
        <span className="text-orange-600">({viewCount})</span>
      )}
    </div>
  );
}

