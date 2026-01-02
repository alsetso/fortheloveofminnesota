'use client';

import { UsersIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useAuthStateSafe } from '@/features/auth';

export default function CommunityBanner() {
  const { openModal } = useAppModalContextSafe();
  const { account } = useAuthStateSafe();
  const isAuthenticated = !!account;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px] mb-3">
      <div className="flex items-start gap-2">
        <UsersIcon className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <h2 className="text-xs font-semibold text-gray-900">
            Community-Built Directory
          </h2>
          <p className="text-[10px] text-gray-600 leading-relaxed">
            This directory is maintained by the Minnesota community. Anyone can contribute by updating contact information, descriptions, and other details. All edits are tracked and visible to ensure transparency and accuracy.
          </p>
          {!isAuthenticated && (
            <button
              onClick={() => openModal('account')}
              className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-gray-900 hover:text-gray-700 transition-colors"
            >
              <PencilSquareIcon className="w-3 h-3" />
              <span>Sign in to contribute</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

