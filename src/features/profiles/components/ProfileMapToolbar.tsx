'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, LockClosedIcon, EyeIcon } from '@heroicons/react/24/outline';
import ProfileSidebar from './ProfileSidebar';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import type { ProfilePin, ProfileAccount } from '@/types/profile';

interface ProfileMapToolbarProps {
  accountUsername: string | null;
  accountName: string;
  pinCount: number;
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  pins: ProfilePin[];
  account: ProfileAccount;
  isOwnProfile: boolean;
  isGuest: boolean;
  viewMode?: 'owner' | 'visitor';
  onViewModeToggle?: () => void;
  showPrivatePins?: boolean;
  onTogglePrivatePins?: () => void;
  onLocationSelect?: (coordinates: { lat: number; lng: number }, placeName: string) => void;
  onAccountUpdate?: (updates: Partial<ProfileAccount>) => void;
}

export default function ProfileMapToolbar({
  accountUsername,
  accountName,
  pinCount,
  map,
  mapLoaded,
  pins,
  account,
  isOwnProfile,
  isGuest,
  viewMode,
  onViewModeToggle,
  showPrivatePins,
  onTogglePrivatePins,
  onLocationSelect,
  onAccountUpdate,
}: ProfileMapToolbarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // Calculate dropdown position relative to button
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  
  useEffect(() => {
    if (isDropdownOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isDropdownOpen]);

  return (
    <>
      <div className="fixed top-14 left-0 right-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-10 gap-3">
            {/* Left: Profile info with dropdown */}
            <div className="flex items-center gap-2 text-xs text-gray-600 min-w-0 flex-1">
              <button
                ref={buttonRef}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
                  isDropdownOpen 
                    ? 'bg-gray-100 text-gray-900' 
                    : 'hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {accountUsername && (
                  <span className="font-medium text-gray-900">@{accountUsername}</span>
                )}
                <ChevronDownIcon
                  className={`w-3 h-3 text-gray-400 transition-transform ${
                    isDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              
              <span className="text-gray-400">·</span>
              <span className="text-xs text-gray-500">{pinCount} pins</span>
            </div>

            {/* Center: View Mode Toggle and Private Pins Toggle (only for owners) */}
            {isOwnProfile && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* View Mode Toggle */}
                {viewMode && onViewModeToggle && (
                  <div className="flex items-center bg-gray-100 rounded p-0.5">
                    <button
                      onClick={() => viewMode === 'visitor' && onViewModeToggle()}
                      className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                        viewMode === 'owner'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Owner
                    </button>
                    <button
                      onClick={() => viewMode === 'owner' && onViewModeToggle()}
                      className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                        viewMode === 'visitor'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Visitor
                    </button>
                  </div>
                )}
                
                {/* Private Pins Toggle */}
                {showPrivatePins !== undefined && onTogglePrivatePins && (
                  <button
                    onClick={onTogglePrivatePins}
                    className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                      showPrivatePins
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}
                    title={showPrivatePins ? 'Hide private pins' : 'Show private pins'}
                  >
                    {showPrivatePins ? (
                      <LockClosedIcon className="w-3 h-3" />
                    ) : (
                      <EyeIcon className="w-3 h-3" />
                    )}
                    <span>{showPrivatePins ? 'Private' : 'Public'}</span>
                  </button>
                )}
              </div>
            )}
            
            {/* View as Visitor Link (if toggle not available) */}
            {isOwnProfile && (!viewMode || !onViewModeToggle) && accountUsername && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <a
                  href={`/profile/${accountUsername}?view=visitor`}
                  className="px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                  title="View as visitor"
                >
                  View as Visitor
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Card Dropdown */}
      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          className="fixed z-50 w-[300px] max-w-[calc(100vw-2rem)]"
          style={{ 
            top: `${dropdownPosition.top}px`, 
            left: `${Math.max(16, dropdownPosition.left)}px` 
          }}
        >
          {/* Visual connection line */}
          <div 
            className="absolute -top-1 left-4 w-0.5 h-1 bg-white"
            style={{ 
              boxShadow: '0 -1px 0 0 #e5e7eb',
            }}
          />
          <ProfileSidebar
            map={map}
            mapLoaded={mapLoaded}
            isOpen={true}
            pins={pins}
            account={account}
            isOwnProfile={isOwnProfile}
            isGuest={isGuest}
            onAccountUpdate={onAccountUpdate}
            variant="dropdown"
          />
        </div>
      )}
    </>
  );
}
