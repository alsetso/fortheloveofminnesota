'use client';

import { useState, useEffect } from 'react';

interface VisitorStatsData {
  visitors: number;
  period: 'today' | 'total';
}

type TimeFilter = 'today' | 'total';

export default function VisitorStats() {
  const [stats, setStats] = useState<VisitorStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });

  // Use white text when transparent blur + satellite map
  const useWhiteText = useBlurStyle && currentMapStyle === 'satellite';

  // Listen for blur style and map style changes
  useEffect(() => {
    const handleBlurStyleChange = (e: CustomEvent) => {
      setUseBlurStyle(e.detail.useBlurStyle);
    };
    
    const handleMapStyleChange = (e: CustomEvent) => {
      setCurrentMapStyle(e.detail.mapStyle);
    };

    window.addEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    window.addEventListener('map-style-change', handleMapStyleChange as EventListener);
    return () => {
      window.removeEventListener('blur-style-change', handleBlurStyleChange as EventListener);
      window.removeEventListener('map-style-change', handleMapStyleChange as EventListener);
    };
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/analytics/live-visitors?period=${timeFilter}`);
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
  }, [timeFilter]);

  const handleClick = () => {
    setTimeFilter(prev => prev === 'today' ? 'total' : 'today');
    setLoading(true);
  };

  const displayText = timeFilter === 'total' ? 'total' : 'today';

  return (
    <button
      onClick={handleClick}
      className={`fixed bottom-4 left-4 z-50 rounded-md px-2 py-1.5 shadow-sm transition-colors cursor-pointer hover:opacity-80 ${
        useBlurStyle
          ? 'bg-transparent backdrop-blur-md border-2 border-transparent'
          : 'bg-white border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {loading || !stats ? (
        <div className={`text-xs ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>...</div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className={`text-xs ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`}>
            Views:
          </span>
          <span className={`text-xs font-semibold ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
            {stats.visitors.toLocaleString()}
          </span>
          <span className={`text-[10px] ${useWhiteText ? 'text-white/60' : 'text-gray-500'}`}>
            {displayText}
          </span>
        </div>
      )}
    </button>
  );
}

