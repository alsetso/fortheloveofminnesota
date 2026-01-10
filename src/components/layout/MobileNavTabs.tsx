'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { PlusIcon as PlusIconSolid, WrenchScrewdriverIcon as WrenchScrewdriverIconSolid } from '@heroicons/react/24/solid';
import { useAuthStateSafe } from '@/features/auth';

export type MobileNavTab = 'contribute' | 'tools';

interface MobileNavTabsProps {
  activeTab: MobileNavTab | null;
  onTabClick: (tab: MobileNavTab) => void;
  isSheetOpen?: boolean; // Whether a sheet is open (news or contribute)
}


/**
 * Fixed bottom tab bar with 3 tabs: Create, Controls, Contribute/Sign In
 * Always visible on mobile, positioned at z-50 (above sheets)
 */
export default function MobileNavTabs({ activeTab, onTabClick, isSheetOpen = false }: MobileNavTabsProps) {
  const { account } = useAuthStateSafe();
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });

  // Listen for blur style changes
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

  // Text color logic: white only when blur AND satellite, otherwise dark
  const useWhiteText = useBlurStyle && currentMapStyle === 'satellite';
  const useTransparentUI = useBlurStyle && currentMapStyle === 'satellite';

  const baseClasses = `flex flex-col items-center justify-center gap-0 px-2 py-2 transition-colors group`;

  return (
    <nav 
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[50] border rounded-lg shadow-lg transition-all duration-300 ease-out ${
        useBlurStyle 
          ? 'bg-transparent backdrop-blur-md border-white/20' 
          : 'bg-white border-gray-200'
      } ${
        isSheetOpen ? 'translate-y-[calc(100%+1rem)] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-center gap-5 h-14 px-3">
        {/* Contribute Tab (only when signed in) */}
        {account && (
          <button
            onClick={() => onTabClick('contribute')}
            className={baseClasses}
            aria-label="Contribute"
          >
            <div className={`p-1.5 rounded-md transition-colors ${
              useTransparentUI
                ? 'group-hover:bg-white/10'
                : useBlurStyle
                ? 'group-hover:bg-white/20'
                : 'group-hover:bg-gray-100'
            }`}>
            {activeTab === 'contribute' ? (
              <PlusIconSolid className={`w-5 h-5 ${useWhiteText ? 'text-white' : 'text-gray-900'}`} />
            ) : (
              <PlusIcon className={`w-5 h-5 ${useWhiteText ? 'text-white/80' : 'text-gray-500'}`} />
            )}
            </div>
            <span className={`text-[10px] font-medium mt-0.5 ${
              activeTab === 'contribute' 
                ? useWhiteText ? 'text-white' : 'text-gray-900'
                : useWhiteText ? 'text-white/80' : 'text-gray-500'
            }`}>
              Contribute
            </span>
          </button>
        )}

        {/* Tools Tab */}
        <button
          onClick={() => onTabClick('tools')}
            className={baseClasses}
          aria-label="Tools"
        >
          <div className={`p-1.5 rounded-md transition-colors ${
            useTransparentUI
              ? 'group-hover:bg-white/10'
              : useBlurStyle
              ? 'group-hover:bg-white/20'
              : 'group-hover:bg-gray-100'
          }`}>
          {activeTab === 'tools' ? (
            <WrenchScrewdriverIconSolid className={`w-5 h-5 ${useWhiteText ? 'text-white' : 'text-gray-900'}`} />
          ) : (
            <WrenchScrewdriverIcon className={`w-5 h-5 ${useWhiteText ? 'text-white/80' : 'text-gray-500'}`} />
          )}
          </div>
          <span className={`text-[10px] font-medium mt-0.5 ${
            activeTab === 'tools' 
              ? useWhiteText ? 'text-white' : 'text-gray-900'
              : useWhiteText ? 'text-white/80' : 'text-gray-500'
          }`}>
            Tools
            </span>
        </button>
      </div>
    </nav>
  );
}

