'use client';

import { usePathname } from 'next/navigation';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useHeaderTheme } from '@/contexts/HeaderThemeContext';
import AccountDropdown from '@/features/auth/components/AccountDropdown';
import MapSearchInput from './MapSearchInput';

interface AppHeaderProps {
  /** When set, account image click opens this (e.g. AppMenu) instead of the account dropdown */
  onAccountImageClick?: () => void;
}

/**
 * App header for the live overlay: account image + search.
 */
export default function AppHeader({ onAccountImageClick }: AppHeaderProps) {
  const pathname = usePathname();
  const { isSearchActive } = useHeaderTheme();

  const closeSearch = () => {
    const newUrl = pathname + (typeof window !== 'undefined' ? window.location.search : '');
    if (typeof window === 'undefined') return;
    window.history.pushState({}, '', newUrl);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  return (
    <header
      className={`flex-shrink-0 flex items-center gap-2 p-2 ${isSearchActive ? 'bg-white' : ''}`}
      data-container="app-header"
      aria-label="App header"
    >
      <div className="flex-shrink-0">
        <AccountDropdown variant="light" onTriggerClick={onAccountImageClick} />
      </div>
      <div className="flex-1 min-w-0">
        <MapSearchInput />
      </div>
      {isSearchActive && (
        <a
          href={pathname}
          onClick={(e) => {
            e.preventDefault();
            closeSearch();
          }}
          className="flex-shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 no-underline"
          aria-label="Close search"
        >
          <XMarkIcon className="w-4 h-4" />
        </a>
      )}
    </header>
  );
}
