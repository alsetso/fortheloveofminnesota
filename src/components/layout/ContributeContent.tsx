'use client';

import { useState } from 'react';
import { useAuthStateSafe, AccountService } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { 
  MapPinIcon, 
  HomeIcon, 
  PencilSquareIcon,
  EnvelopeIcon 
} from '@heroicons/react/24/outline';
import AddAtlasLocationTool from './AddAtlasLocationTool';

interface ContributeContentProps {
  map?: any;
  mapLoaded?: boolean;
}

export default function ContributeContent({ map, mapLoaded }: ContributeContentProps = {}) {
  const { account, isLoading } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const [showAddAtlasTool, setShowAddAtlasTool] = useState(false);

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
          <p className="text-xs text-gray-600 mb-3">Sign in to contribute to Love of Minnesota.</p>
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
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <ProfilePhoto account={account} size="md" editable={false} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">
              {AccountService.getDisplayName(account)}
            </div>
            {account.username && (
              <div className="text-xs text-gray-600 truncate">
                @{account.username}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-gray-500">
                {getRoleDisplay(account.role)}
              </span>
              <span className="text-[10px] text-gray-400">•</span>
              <span className="text-[10px] text-gray-500">
                {getPlanDisplay(account.plan)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Icons */}
      <div>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[80px]">
            <button
              className="flex flex-col items-center justify-center gap-1.5 p-3 bg-white border border-gray-200 rounded-md min-w-[80px] opacity-60 cursor-not-allowed"
              title="Add Place"
              disabled
            >
              <MapPinIcon className="w-5 h-5 text-gray-700" />
              <span className="text-[10px] font-medium text-gray-700 text-center">Add Place</span>
            </button>
            <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-md">
              <span className="text-[10px] font-medium text-gray-600">Coming Soon</span>
            </div>
          </div>
          
          <div className="relative min-w-[80px]">
            <button
              className="flex flex-col items-center justify-center gap-1.5 p-3 bg-white border border-gray-200 rounded-md min-w-[80px] opacity-60 cursor-not-allowed"
              title="Update Place"
              disabled
            >
              <PencilSquareIcon className="w-5 h-5 text-gray-700" />
              <span className="text-[10px] font-medium text-gray-700 text-center">Update Place</span>
            </button>
            <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-md">
              <span className="text-[10px] font-medium text-gray-600">Coming Soon</span>
            </div>
          </div>
          
          <div className="relative min-w-[80px]">
            <button
              className="flex flex-col items-center justify-center gap-1.5 p-3 bg-white border border-gray-200 rounded-md min-w-[80px] opacity-60 cursor-not-allowed"
              title="Add Home (private)"
              disabled
            >
              <HomeIcon className="w-5 h-5 text-gray-700" />
              <span className="text-[10px] font-medium text-gray-700 text-center">Add Home</span>
              <span className="text-[9px] text-gray-500">(private)</span>
            </button>
            <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-md">
              <span className="text-[10px] font-medium text-gray-600">Coming Soon</span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Tools */}
      {account?.role === 'admin' && (
        <div className="border-t border-gray-200 pt-4">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
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
                className="w-full px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
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
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-md">
            <EnvelopeIcon className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-700 mb-1">
                Email{' '}
                <a
                  href="mailto:loveoveminnesota@gmail.com"
                  className="text-indigo-600 hover:text-indigo-700 underline"
                >
                  loveoveminnesota@gmail.com
                </a>
                {' '}to see if you qualify to be a Love of Minnesota Admin.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

