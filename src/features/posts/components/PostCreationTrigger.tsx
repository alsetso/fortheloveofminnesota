'use client';

import { PhotoIcon, MapPinIcon } from '@heroicons/react/24/outline';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { Account } from '@/features/auth';

interface PostCreationTriggerProps {
  account: Account | null;
  onTextClick: () => void;
  onMediaClick: () => void;
  onMapClick: () => void;
  className?: string;
  showActions?: boolean;
}

export default function PostCreationTrigger({
  account,
  onTextClick,
  onMediaClick,
  onMapClick,
  className = '',
  showActions = true,
}: PostCreationTriggerProps) {
  return (
    <div className={`bg-white border border-gray-200 rounded-md p-[10px] ${className}`}>
      <div className="flex items-start gap-2">
        {/* Profile Photo */}
        <div className="flex-shrink-0">
          <ProfilePhoto 
            account={account}
            size="sm" 
          />
        </div>

        {/* Input Area */}
        <div className="flex-1">
          <button
            onClick={onTextClick}
            className="w-full px-[10px] py-[10px] text-left bg-gray-50 border border-gray-200 rounded-md hover:border-gray-300 transition-colors focus:outline-none focus:ring-1 focus:ring-gray-500 text-xs"
          >
            <span className="text-gray-500">Start a post</span>
          </button>

          {/* Action Options */}
          {showActions && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <button
                onClick={onMediaClick}
                className="flex items-center gap-2 px-[10px] py-[10px] text-gray-600 hover:bg-gray-50 rounded-md transition-colors group"
              >
                <PhotoIcon className="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
                <span className="text-xs font-medium">Media</span>
              </button>
              
              <button
                onClick={onMapClick}
                className="flex items-center gap-2 px-[10px] py-[10px] text-gray-600 hover:bg-gray-50 rounded-md transition-colors group"
              >
                <MapPinIcon className="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
                <span className="text-xs font-medium">Map</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
