'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

type TimeFilter = '24h' | '7d' | 'all';

export default function MentionTimeFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  // Initialize from URL
  useEffect(() => {
    const filterParam = searchParams.get('mention_time') as TimeFilter | null;
    if (filterParam && ['24h', '7d', 'all'].includes(filterParam)) {
      setTimeFilter(filterParam);
    } else {
      setTimeFilter('all');
    }
  }, [searchParams]);

  const handleFilterChange = (filter: TimeFilter) => {
    setTimeFilter(filter);
    const params = new URLSearchParams(searchParams.toString());
    
    if (filter === 'all') {
      params.delete('mention_time');
    } else {
      params.set('mention_time', filter);
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Mention Time Filter</h2>
      <div className="flex gap-1 rounded-md px-1 py-1 bg-gray-50 border border-gray-200">
        <button
          onClick={() => handleFilterChange('24h')}
          className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
            timeFilter === '24h'
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          24h
        </button>
        <button
          onClick={() => handleFilterChange('7d')}
          className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
            timeFilter === '7d'
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          7d
        </button>
        <button
          onClick={() => handleFilterChange('all')}
          className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
            timeFilter === 'all'
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          All
        </button>
      </div>
    </div>
  );
}
