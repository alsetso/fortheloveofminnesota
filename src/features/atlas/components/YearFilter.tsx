'use client';

import { useSearchParams, useRouter } from 'next/navigation';

export default function YearFilter() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get current year from URL
  const currentYearParam = searchParams.get('year');
  const currentYear = currentYearParam ? parseInt(currentYearParam, 10) : null;

  // Generate 100 years of options (current year back to 100 years ago)
  const currentYearValue = new Date().getFullYear();
  const years = Array.from({ length: 101 }, (_, i) => currentYearValue - i);

  const handleYearChange = (year: string) => {
    const url = new URL(window.location.href);
    
    if (year === '') {
      // Clear the year filter
      url.searchParams.delete('year');
    } else {
      // Set year filter
      url.searchParams.set('year', year);
    }
    
    router.push(url.pathname + url.search);
    
    // Trigger mentions reload
    window.dispatchEvent(new CustomEvent('mention-created'));
  };

  return (
    <div className="bg-white rounded-md border border-gray-200 p-[10px]">
      <div className="mb-2">
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Filter by Year
        </label>
        <select
          value={currentYear?.toString() || ''}
          onChange={(e) => handleYearChange(e.target.value)}
          className="w-full px-2 py-1.5 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-white"
        >
          <option value="">All Years</option>
          {years.map((year) => (
            <option key={year} value={year.toString()}>
              {year}
            </option>
          ))}
        </select>
        {currentYear && (
          <p className="text-[10px] text-gray-500 mt-0.5">
            Showing mentions from {currentYear}
          </p>
        )}
      </div>
    </div>
  );
}
