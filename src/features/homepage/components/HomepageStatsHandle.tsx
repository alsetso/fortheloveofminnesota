'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { PublicMapPinService } from '@/features/map-pins/services/publicMapPinService';
import HomepageStatsModal from './HomepageStatsModal';

export default function HomepageStatsHandle() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pinCount, setPinCount] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const currentYearParam = searchParams.get('year');
  const currentYear = new Date().getFullYear();
  const displayYear = currentYearParam || currentYear.toString();
  const isFilterActive = !!currentYearParam;

  // Fetch pin count when year filter is active
  useEffect(() => {
    if (currentYearParam) {
      const fetchCount = async () => {
        try {
          const count = await PublicMapPinService.getPinCountWithFilters({ 
            year: parseInt(currentYearParam, 10) 
          });
          setPinCount(count);
        } catch (error) {
          console.error('Error fetching pin count:', error);
          setPinCount(null);
        }
      };
      fetchCount();
    } else {
      setPinCount(null);
    }
  }, [currentYearParam]);

  return (
    <>
      {/* Small handle at top center */}
      <button
        onClick={() => setIsModalOpen(true)}
        className={`absolute top-0 left-1/2 transform -translate-x-1/2 z-30 border-b border-l border-r border-gray-200 rounded-b-md px-2 py-0.5 transition-all flex items-center gap-1 ${
          isFilterActive
            ? 'bg-white text-gray-900 font-semibold'
            : 'bg-white hover:bg-gray-50 text-gray-700'
        }`}
        aria-label="View site statistics and year filter"
        title={isFilterActive ? `Filtered by ${displayYear}${pinCount !== null ? ` (${pinCount.toLocaleString()} pins)` : ''}` : 'View site statistics and year filter'}
      >
        <span className="text-xs">{displayYear}</span>
        {isFilterActive && pinCount !== null && (
          <span className="text-[10px] text-gray-500 font-normal">({pinCount.toLocaleString()})</span>
        )}
        <ChevronRightIcon className="w-3 h-3 text-gray-400" />
      </button>

      <HomepageStatsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}


