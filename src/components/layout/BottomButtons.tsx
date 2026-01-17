'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CameraIcon, Cog6ToothIcon, ChartBarIcon, MapPinIcon, UserIcon, FolderIcon, XMarkIcon, HomeIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { CameraIcon as CameraIconSolid, Cog6ToothIcon as Cog6ToothIconSolid, ChartBarIcon as ChartBarIconSolid, MapPinIcon as MapPinIconSolid, UserIcon as UserIconSolid, FolderIcon as FolderIconSolid, HomeIcon as HomeIconSolid } from '@heroicons/react/24/solid';
import Image from 'next/image';
import { useAuthStateSafe } from '@/features/auth';

export type BottomButtonType = 'create' | 'home' | 'settings' | 'analytics' | 'location' | 'collections' | 'account' | 'info' | null;

interface BottomButtonsProps {
  activeButton: BottomButtonType | null;
  onButtonClick: (button: BottomButtonType) => void;
  isPopupOpen?: boolean;
  modalState?: {
    isAccountModalOpen: boolean;
    openAccount: () => void;
    openMapStyles: () => void;
    openDynamicSearch: (data?: any, type?: 'news' | 'people') => void;
    closeAccount: () => void;
    closeMapStyles: () => void;
    closeDynamicSearch: () => void;
    isModalOpen: (type: 'account' | 'mapStyles' | 'dynamicSearch') => boolean;
  };
  openAccount?: (tab?: string) => void;
  imagePreview?: string | null;
  onRemoveImage?: () => void;
}

/**
 * Fixed bottom navigation bar with 5 buttons
 * Create (camera), Home, and Account buttons
 */
export default function BottomButtons({ activeButton, onButtonClick, isPopupOpen = false, modalState, openAccount, imagePreview, onRemoveImage }: BottomButtonsProps) {
  const router = useRouter();
  const { account } = useAuthStateSafe();
  // Initialize with consistent defaults to avoid hydration mismatch
  const [useBlurStyle, setUseBlurStyle] = useState(false);
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>('streets');
  const [mounted, setMounted] = useState(false);

  // Initialize client-side values after mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const blurStyle = (window as any).__useBlurStyle === true;
      const mapStyle = (window as any).__currentMapStyle || 'streets';
      setUseBlurStyle(blurStyle);
      setCurrentMapStyle(mapStyle);
    }
  }, []);

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

  const useWhiteText = useBlurStyle && currentMapStyle === 'satellite';
  const useTransparentUI = useBlurStyle && currentMapStyle === 'satellite';

  const baseClasses = `flex flex-col items-center justify-center gap-0 px-2 py-2 transition-colors group`;

  return (
    <nav 
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[50] transition-all duration-300 ease-out ${
        isPopupOpen ? 'translate-y-[calc(100%+1rem)] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}
      style={{ 
        paddingBottom: 'env(safe-area-inset-bottom)',
        maxWidth: '600px',
        width: 'calc(100% - 2rem)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Container 1: Create Button (Left) */}
        <button
          onClick={() => onButtonClick('create')}
          className={`w-14 h-14 rounded-full transition-all ${
            activeButton === 'create'
              ? useTransparentUI
                ? 'bg-white/30 border-2 border-white/50 shadow-lg'
                : 'bg-white border-2 border-gray-300 shadow-lg'
              : useTransparentUI
                ? 'bg-white/10 border-2 border-white/30 hover:bg-white/20 hover:border-white/40'
                : 'bg-white border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
          }`}
          aria-label="Create"
        >
          {activeButton === 'create' ? (
            <CameraIconSolid className={`w-6 h-6 ${useWhiteText ? 'text-white' : 'text-gray-900'}`} />
          ) : (
            <CameraIcon className={`w-6 h-6 ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`} />
          )}
        </button>

        {/* Container 2: Middle Buttons OR Image Preview */}
        {account && (
          <>
            {imagePreview ? (
              <div className={`h-14 px-3 rounded-full flex items-center gap-3 transition-all ${
                useTransparentUI
                  ? 'bg-white/20 border-2 border-white/50 shadow-lg'
                  : 'bg-white border-2 border-red-500 shadow-lg'
              }`}>
                <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border-2 border-gray-300">
                  <Image
                    src={imagePreview}
                    alt="Image preview"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <p className={`text-xs font-bold leading-tight ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
                    Click map to drop
                  </p>
                  <p className={`text-[10px] leading-tight ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`}>
                    Image ready to place
                  </p>
                </div>
                {onRemoveImage && (
                  <button
                    onClick={onRemoveImage}
                    className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-red-600 hover:text-red-700 transition-colors"
                    aria-label="Remove image"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className={`h-14 px-2 rounded-full flex items-center gap-1.5 transition-all ${
                useTransparentUI
                  ? 'bg-white/10 border-2 border-white/30'
                  : 'bg-white border-2 border-gray-200'
              }`}>
                {/* Collections Button */}
                <button
                  onClick={() => onButtonClick('collections')}
                  className={`w-8 h-8 rounded-full transition-colors ${
                    activeButton === 'collections'
                      ? useWhiteText ? 'bg-white/20' : 'bg-gray-100'
                      : 'hover:bg-gray-50/50'
                  }`}
                  aria-label="Collections"
                >
                  {activeButton === 'collections' ? (
                    <FolderIconSolid className={`w-4 h-4 ${useWhiteText ? 'text-white' : 'text-gray-900'}`} />
                  ) : (
                    <FolderIcon className={`w-4 h-4 ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`} />
                  )}
                </button>

                {/* Analytics Button */}
                <button
                  onClick={() => onButtonClick('analytics')}
                  className={`w-8 h-8 rounded-full transition-colors ${
                    activeButton === 'analytics'
                      ? useWhiteText ? 'bg-white/20' : 'bg-gray-100'
                      : 'hover:bg-gray-50/50'
                  }`}
                  aria-label="Analytics"
                >
                  {activeButton === 'analytics' ? (
                    <ChartBarIconSolid className={`w-4 h-4 ${useWhiteText ? 'text-white' : 'text-gray-900'}`} />
                  ) : (
                    <ChartBarIcon className={`w-4 h-4 ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`} />
                  )}
                </button>

                {/* Info Button */}
                <button
                  onClick={() => onButtonClick('info')}
                  className={`w-8 h-8 rounded-full transition-colors ${
                    activeButton === 'info'
                      ? useWhiteText ? 'bg-white/20' : 'bg-gray-100'
                      : 'hover:bg-gray-50/50'
                  }`}
                  aria-label="Information"
                >
                  <InformationCircleIcon className={`w-4 h-4 ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`} />
                </button>
              </div>
            )}
          </>
        )}

        {/* Container 3: Account Button (Right) */}
        {account ? (
          <button
            onClick={() => onButtonClick('settings')}
            className={`w-14 h-14 rounded-full overflow-hidden transition-colors ${
              (account.plan === 'pro' || account.plan === 'plus')
                ? 'p-[2px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600'
                : useTransparentUI
                  ? 'bg-white/10 border-2 border-white/30 hover:bg-white/20 hover:border-white/40'
                  : 'bg-white border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
            }`}
            aria-label="Settings"
          >
            <div className="w-full h-full rounded-full overflow-hidden bg-white">
              {account.image_url ? (
                <Image
                  src={account.image_url}
                  alt={account.username || 'Account'}
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                  unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
                />
              ) : (
                <div className="w-full h-full bg-gray-100">
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-gray-600">
                    {account.username?.[0]?.toUpperCase() || account.first_name?.[0]?.toUpperCase() || 'A'}
                  </span>
                </div>
              )}
            </div>
          </button>
        ) : (
          <button
            onClick={() => onButtonClick('account')}
            className={`w-14 h-14 rounded-full transition-all ${
              useTransparentUI
                ? 'bg-white/10 border-2 border-white/30 hover:bg-white/20 hover:border-white/40'
                : 'bg-white border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
            }`}
            aria-label="Account"
          >
            <UserIcon className={`w-6 h-6 ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`} />
          </button>
        )}
      </div>
    </nav>
  );
}
