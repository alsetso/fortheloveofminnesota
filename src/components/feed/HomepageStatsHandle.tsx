'use client';

import { useState } from 'react';
import HomepageStatsModal from './HomepageStatsModal';

export default function HomepageStatsHandle() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      {/* Small handle at top center */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="absolute top-0 left-1/2 transform -translate-x-1/2 z-30 bg-white hover:bg-gray-50 border-b border-x border-gray-200 rounded-b-md px-2.5 py-1 transition-all"
        aria-label="View site statistics"
        title="View site statistics"
      >
        <div className="flex items-center gap-1">
          <div className="w-1 h-1 rounded-full bg-gray-500" />
          <div className="w-1 h-1 rounded-full bg-gray-500" />
          <div className="w-1 h-1 rounded-full bg-gray-500" />
        </div>
      </button>

      <HomepageStatsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}

