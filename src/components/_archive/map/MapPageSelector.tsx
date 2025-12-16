'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface MapPage {
  href: string;
  label: string;
}

const MAP_PAGES: MapPage[] = [
  { href: '/map', label: 'Map' },
  { href: '/map/areas', label: 'Areas' },
  { href: '/map/skip-trace', label: 'Skip Trace' },
  { href: '/my-homes', label: 'My Homes' },
];

export default function MapPageSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Find current page or default to first
  const currentPage = MAP_PAGES.find(page => 
    pathname === page.href || pathname.startsWith(page.href + '/')
  ) || MAP_PAGES[0];

  const handlePageChange = (href: string) => {
    if (href === pathname) {
      setIsOpen(false);
      return;
    }
    router.push(href);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 text-sm font-medium text-gray-800 hover:bg-white transition-colors"
        style={{ pointerEvents: 'auto' }}
      >
        <span>{currentPage.label}</span>
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[99]"
            onClick={() => setIsOpen(false)}
            style={{ pointerEvents: 'auto' }}
          />
          <div
            className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-[100] min-w-[140px]"
            style={{ pointerEvents: 'auto' }}
          >
            {MAP_PAGES.map((page) => (
              <button
                key={page.href}
                onClick={() => handlePageChange(page.href)}
                className={`
                  w-full text-left px-4 py-2 text-sm font-medium transition-colors
                  ${currentPage.href === page.href
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                {page.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}



