'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { MentionService } from '@/features/mentions/services/mentionService';
import HomepageStatsModal from './HomepageStatsModal';

export default function HomepageStatsHandle() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mentionCount, setMentionCount] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const currentYearParam = searchParams.get('year');
  const currentYear = new Date().getFullYear();
  const displayYear = currentYearParam || currentYear.toString();
  const isFilterActive = !!currentYearParam;

  // Fetch mention count when year filter is active
  useEffect(() => {
    if (currentYearParam) {
      const fetchCount = async () => {
        try {
          const mentions = await MentionService.getMentions({ 
            year: parseInt(currentYearParam, 10) 
          });
          setMentionCount(mentions.length);
        } catch (error) {
          console.error('Error fetching mention count:', error);
          setMentionCount(null);
        }
      };
      fetchCount();
    } else {
      setMentionCount(null);
    }
  }, [currentYearParam]);

  return (
    <>
      {/* Small year toggle at top center of map */}
      <button
        onClick={() => setIsModalOpen(true)}
        className={`absolute top-4 left-1/2 -translate-x-1/2 z-[110] px-2 py-1 text-xs font-medium rounded-md border border-gray-200 transition-all flex items-center gap-1.5 ${
          isFilterActive
            ? 'bg-white text-gray-900 shadow-sm'
            : 'bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-white'
        }`}
        aria-label="Filter by year"
        title={isFilterActive ? `Filtered by ${displayYear}${mentionCount !== null ? ` (${mentionCount.toLocaleString()} mentions)` : ''}` : 'Filter by year'}
      >
        <span className="text-xs">{displayYear}</span>
        {isFilterActive && mentionCount !== null && (
          <span className="text-[10px] text-gray-500 font-normal">({mentionCount.toLocaleString()})</span>
        )}
      </button>

      <HomepageStatsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}


