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
      {/* Small handle at top center */}
      <button
        onClick={() => setIsModalOpen(true)}
        className={`absolute top-0 left-1/2 transform -translate-x-1/2 z-30 border-b border-l border-r border-gray-200 rounded-b-md px-2 py-0.5 transition-all flex items-center gap-1 ${
          isFilterActive
            ? 'bg-white text-gray-900 font-semibold'
            : 'bg-white hover:bg-gray-50 text-gray-700'
        }`}
        aria-label="View site statistics and year filter"
        title={isFilterActive ? `Filtered by ${displayYear}${mentionCount !== null ? ` (${mentionCount.toLocaleString()} mentions)` : ''}` : 'View site statistics and year filter'}
      >
        <span className="text-xs">{displayYear}</span>
        {isFilterActive && mentionCount !== null && (
          <span className="text-[10px] text-gray-500 font-normal">({mentionCount.toLocaleString()})</span>
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


