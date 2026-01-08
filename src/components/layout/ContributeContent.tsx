'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStateSafe, AccountService } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { 
  MapPinIcon, 
  HomeIcon, 
  PencilSquareIcon,
  EnvelopeIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import AddAtlasLocationTool from './AddAtlasLocationTool';
import AddPlaceModal from './AddPlaceModal';

interface ContributeContentProps {
  map?: any;
  mapLoaded?: boolean;
}

export default function ContributeContent({ map, mapLoaded }: ContributeContentProps = {}) {
  const { account, isLoading } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const [showAddAtlasTool, setShowAddAtlasTool] = useState(false);
  const [showAddPlaceModal, setShowAddPlaceModal] = useState(false);
  const router = useRouter();
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });

  // Listen for blur style and map style changes
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

  // Use transparent backgrounds and white text when satellite + blur
  const useTransparentUI = useBlurStyle && currentMapStyle === 'satellite';

  const getPlanDisplay = (plan: string | null | undefined): string => {
    if (!plan) return 'No Plan';
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  const getRoleDisplay = (role: string | null | undefined): string => {
    if (!role) return 'General';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="space-y-3">
        <div className="text-center py-4">
          <p className={`text-xs mb-3 ${useTransparentUI ? 'text-white/80' : 'text-gray-600'}`}>Sign in to contribute to Love of Minnesota.</p>
          <button
            onClick={openWelcome}
            className="w-full px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* User Profile Section */}
      <div className={`border-b pb-4 ${useTransparentUI ? 'border-white/20' : 'border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <ProfilePhoto account={account} size="md" editable={false} />
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-semibold truncate ${useTransparentUI ? 'text-white' : 'text-gray-900'}`}>
              {AccountService.getDisplayName(account)}
            </div>
            {account.username && (
              <div className={`text-xs truncate ${useTransparentUI ? 'text-white/80' : 'text-gray-600'}`}>
                @{account.username}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] ${useTransparentUI ? 'text-white/70' : 'text-gray-500'}`}>
                {getRoleDisplay(account.role)}
              </span>
              <span className={`text-[10px] ${useTransparentUI ? 'text-white/50' : 'text-gray-400'}`}>•</span>
              <span className={`text-[10px] ${useTransparentUI ? 'text-white/70' : 'text-gray-500'}`}>
                {getPlanDisplay(account.plan)}
              </span>
            </div>
          </div>
          {account.username && (
            <button
              onClick={() => router.push(`/profile/${account.username}`)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors flex-shrink-0 ${
                useTransparentUI
                  ? 'text-white bg-white/10 border border-white/20 hover:bg-white/20'
                  : 'text-gray-700 bg-white border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>View Profile</span>
            </button>
          )}
        </div>
      </div>

      {/* Action Icons */}
      <div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowAddPlaceModal(true)}
            className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-md min-w-[80px] transition-colors ${
              useTransparentUI
                ? 'bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/30'
                : 'bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
            }`}
            title="Add Place"
          >
            <MapPinIcon className={`w-5 h-5 ${useTransparentUI ? 'text-white' : 'text-gray-700'}`} />
            <span className={`text-[10px] font-medium text-center ${useTransparentUI ? 'text-white' : 'text-gray-700'}`}>Add Place</span>
          </button>
          
          <div className="relative min-w-[80px] group">
            <button
              className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-md min-w-[80px] cursor-not-allowed transition-opacity ${
                useTransparentUI
                  ? 'bg-white/10 border border-white/20'
                  : 'bg-white border border-gray-200'
              }`}
              title="Update Place"
              disabled
            >
              <PencilSquareIcon className={`w-5 h-5 ${useTransparentUI ? 'text-white' : 'text-gray-700'}`} />
              <span className={`text-[10px] font-medium text-center ${useTransparentUI ? 'text-white' : 'text-gray-700'}`}>Update Place</span>
            </button>
            <div className={`absolute inset-0 flex items-center justify-center rounded-md transition-opacity opacity-0 group-hover:opacity-100 group-active:opacity-100 ${
              useTransparentUI ? 'bg-white/20' : 'bg-white/90'
            }`}>
              <span className={`text-[10px] font-medium ${useTransparentUI ? 'text-white' : 'text-gray-600'}`}>Coming Soon</span>
            </div>
          </div>
          
          <div className="relative min-w-[80px] group">
            <button
              className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-md min-w-[80px] cursor-not-allowed transition-opacity ${
                useTransparentUI
                  ? 'bg-white/10 border border-white/20'
                  : 'bg-white border border-gray-200'
              }`}
              title="Add Home (private)"
              disabled
            >
              <HomeIcon className={`w-5 h-5 ${useTransparentUI ? 'text-white' : 'text-gray-700'}`} />
              <span className={`text-[10px] font-medium text-center ${useTransparentUI ? 'text-white' : 'text-gray-700'}`}>Add Home</span>
              <span className={`text-[9px] ${useTransparentUI ? 'text-white/70' : 'text-gray-500'}`}>(private)</span>
            </button>
            <div className={`absolute inset-0 flex items-center justify-center rounded-md transition-opacity opacity-0 group-hover:opacity-100 group-active:opacity-100 ${
              useTransparentUI ? 'bg-white/20' : 'bg-white/90'
            }`}>
              <span className={`text-[10px] font-medium ${useTransparentUI ? 'text-white' : 'text-gray-600'}`}>Coming Soon</span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Tools */}
      {account?.role === 'admin' && (
        <div className={`border-t pt-4 ${useTransparentUI ? 'border-white/20' : 'border-gray-200'}`}>
          <div className="space-y-2">
            <h4 className={`text-xs font-semibold uppercase tracking-wide ${useTransparentUI ? 'text-white' : 'text-gray-900'}`}>
              Admin Tools
            </h4>
            {showAddAtlasTool ? (
              <AddAtlasLocationTool
                map={map}
                mapLoaded={mapLoaded || false}
                onClose={() => setShowAddAtlasTool(false)}
              />
            ) : (
              <button
                onClick={() => setShowAddAtlasTool(true)}
                className={`w-full px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${
                  useTransparentUI
                    ? 'text-white bg-white/10 border border-white/20 hover:bg-white/20'
                    : 'text-gray-700 bg-white border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <MapPinIcon className="w-4 h-4" />
                Add Atlas Locations
              </button>
            )}
          </div>
        </div>
      )}

      {/* Admin Qualification */}
      {account?.role !== 'admin' && (
        <div className={`border-t pt-4 ${useTransparentUI ? 'border-white/20' : 'border-gray-200'}`}>
          <div className={`flex items-start gap-2 p-3 rounded-md ${
            useTransparentUI ? 'bg-white/10' : 'bg-gray-50'
          }`}>
            <EnvelopeIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
              useTransparentUI ? 'text-white/80' : 'text-gray-500'
            }`} />
            <div className="flex-1 min-w-0">
              <p className={`text-xs mb-1 ${useTransparentUI ? 'text-white/90' : 'text-gray-700'}`}>
                Email{' '}
                <a
                  href="mailto:loveoveminnesota@gmail.com"
                  className={`underline ${
                    useTransparentUI
                      ? 'text-white hover:text-white/80'
                      : 'text-indigo-600 hover:text-indigo-700'
                  }`}
                >
                  loveoveminnesota@gmail.com
                </a>
                {' '}to see if you qualify to be a Love of Minnesota Admin.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add Place Modal */}
      <AddPlaceModal
        isOpen={showAddPlaceModal}
        onClose={() => setShowAddPlaceModal(false)}
        map={map}
      />
    </div>
  );
}

