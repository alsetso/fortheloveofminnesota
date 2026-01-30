'use client';

import { memo } from 'react';

/**
 * Hero section component - extracted from LandingPage for reuse
 * Memoized to prevent unnecessary re-renders
 */
const HeroSection = memo(function HeroSection() {
  return (
    <div className="bg-white">
      {/* Hero Content */}
      <div className="flex flex-col items-center justify-center px-6 py-12 space-y-6">
        {/* Main Heading */}
        <div className="text-center space-y-3 max-w-md">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight">
            <span className="text-lg sm:text-xl font-normal text-gray-500 block mb-1">
              Share what you love.
            </span>
            Discover what Minnesotans do.
          </h1>
          <p className="text-base sm:text-lg font-medium text-gray-700 leading-relaxed">
            A social map of Minnesota built from real places, real moments, and real recommendations — not algorithms.
          </p>
        </div>
      </div>
    </div>
  );
});

HeroSection.displayName = 'HeroSection';

export default HeroSection;
