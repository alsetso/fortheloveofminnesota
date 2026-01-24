'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import MentionTypeFilterContent from './MentionTypeFilterContent';

interface MentionTypeFilterPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MentionTypeFilterPopup({ isOpen, onClose }: MentionTypeFilterPopupProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">Filter by Mention Type</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <MentionTypeFilterContent onClose={onClose} />
      </div>
    </div>
  );
}
