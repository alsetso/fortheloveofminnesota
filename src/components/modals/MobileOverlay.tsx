'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

interface HomepageStats {
  last24Hours: {
    unique_visitors: number;
    total_views: number;
    accounts_viewed: number;
  };
  last7Days: {
    unique_visitors: number;
    total_views: number;
    accounts_viewed: number;
  };
  last30Days: {
    unique_visitors: number;
    total_views: number;
    accounts_viewed: number;
  };
}

export default function MobileOverlay() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<HomepageStats | null>(null);

  // Only show on homepage
  const isHomepage = pathname === '/';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && isVisible) {
      fetchStats();
    }
  }, [mounted, isVisible]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/analytics/homepage-stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    if (!mounted || !isHomepage) return;

    // Check if mobile (viewport width < 768px)
    const checkMobile = () => {
      const isMobile = window.innerWidth < 768;
      setIsVisible(isMobile);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [mounted, isHomepage]);

  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  const handleContinue = () => {
    setIsVisible(false);
  };

  if (!mounted || !isVisible || !isHomepage) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-white flex items-center justify-center p-[10px]">
      {/* Close Button */}
      <button
        onClick={handleContinue}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors"
        aria-label="Close"
      >
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <div className="flex flex-col items-center gap-3 max-w-sm w-full">
          {/* Logo */}
          <div className="w-full flex justify-center">
            <div className="max-w-[60px] max-h-[60px]">
              <Image
                src="/logo.png"
                alt="Logo"
                width={60}
                height={60}
                className="w-full h-auto"
                unoptimized
                priority
              />
            </div>
          </div>

          {/* Branding Image - smaller */}
          <div className="w-full flex justify-center">
            <Image
              src="/mid_text For the love of mn.png"
              alt="For the Love of Minnesota"
              width={240}
              height={64}
              className="w-auto h-auto max-w-full"
              unoptimized
              priority
            />
          </div>

          {/* Message */}
          <div className="text-center space-y-1.5">
            <p className="text-sm text-gray-600">
              Our site is better on desktop and iOS app in 2026 with your support. Here are some quick stats to help you understand how we're doing.
            </p>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="flex items-stretch gap-2 w-full">
              {/* Last 24 Hours */}
              <div className="flex-1 p-2 bg-gray-50 rounded-md border border-gray-200">
                <div className="text-[10px] font-medium text-gray-900 mb-0.5">
                  24 Hour
                </div>
                <div className="text-[10px] text-gray-600">
                  <span className="font-semibold text-gray-900">{stats.last24Hours.unique_visitors.toLocaleString()}</span> visitors
                </div>
              </div>

              {/* Last Week */}
              <div className="flex-1 p-2 bg-gray-50 rounded-md border border-gray-200">
                <div className="text-[10px] font-medium text-gray-900 mb-0.5">
                  Last Week
                </div>
                <div className="text-[10px] text-gray-600">
                  <span className="font-semibold text-gray-900">{stats.last7Days.unique_visitors.toLocaleString()}</span> visitors
                </div>
              </div>

              {/* Last Month */}
              <div className="flex-1 p-2 bg-gray-50 rounded-md border border-gray-200">
                <div className="text-[10px] font-medium text-gray-900 mb-0.5">
                  Last Month
                </div>
                <div className="text-[10px] text-gray-600">
                  <span className="font-semibold text-gray-900">{stats.last30Days.unique_visitors.toLocaleString()}</span> visitors
                </div>
              </div>
            </div>
          )}

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            className="w-full px-4 py-3 text-sm font-medium text-white rounded-md transition-colors hover:opacity-90 flex items-center justify-center gap-2"
            style={{ backgroundColor: '#EF4444' }}
          >
            <Image
              src="/heart.png"
              alt="Heart"
              width={16}
              height={16}
              className="w-4 h-4"
              unoptimized
            />
            Continue on Mobile
          </button>

          {/* Share Text */}
          <p className="text-xs text-gray-600 text-center">
            Share the map with friends and family who love Minnesota.
          </p>
        </div>
    </div>
  );
}

