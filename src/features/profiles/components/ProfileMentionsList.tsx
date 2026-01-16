'use client';

import Image from 'next/image';
import { formatPinDate } from '@/types/profile';
import type { ProfilePin } from '@/types/profile';

interface ProfileMentionsListProps {
  pins: ProfilePin[];
  isOwnProfile?: boolean;
  onViewMap?: () => void;
}

export default function ProfileMentionsList({ pins, isOwnProfile = false, onViewMap }: ProfileMentionsListProps) {
  // Filter pins based on visibility
  const filteredPins = pins.filter(pin => isOwnProfile || pin.visibility === 'public');
  
  if (filteredPins.length === 0) {
    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="bg-white rounded-md border border-gray-200 p-[10px]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">List</h2>
            {onViewMap && (
              <button
                onClick={onViewMap}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                View Map
              </button>
            )}
          </div>
        </div>
        <div className="bg-white rounded-md border border-gray-200 p-[10px]">
          <p className="text-xs text-gray-500 text-center py-6">No mentions found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">List</h2>
          {onViewMap && (
            <button
              onClick={onViewMap}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              View Map
            </button>
          )}
        </div>
      </div>

      {/* List Content */}
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
      <div className="relative">
        {/* Vertical Timeline */}
        {filteredPins.map((pin, index) => (
          <div key={pin.id} className="relative flex gap-3 pb-4 last:pb-0">
            {/* Timeline Circle and Line */}
            <div className="flex flex-col items-center flex-shrink-0">
              {/* Circle */}
              <div className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0 mt-1.5" />
              {/* Vertical Line - only show if not last item */}
              {index < filteredPins.length - 1 && (
                <div className="w-px h-full bg-gray-200 flex-1 min-h-[60px] mt-1" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Description */}
              {pin.description && (
                <p className="text-xs text-gray-900 leading-relaxed">
                  {pin.description}
                </p>
              )}

              {/* Media */}
              {pin.image_url && (
                <div className="relative w-full max-w-xs rounded-md overflow-hidden border border-gray-200">
                  <Image
                    src={pin.image_url}
                    alt={pin.description || 'Mention image'}
                    width={400}
                    height={300}
                    className="w-full h-auto object-cover"
                    unoptimized={pin.image_url.startsWith('data:') || pin.image_url.includes('supabase.co')}
                  />
                </div>
              )}
              {pin.video_url && (
                <div className="relative w-full max-w-xs rounded-md overflow-hidden border border-gray-200">
                  <video
                    src={pin.video_url}
                    controls
                    className="w-full h-auto"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}

              {/* Timestamp */}
              <p className="text-[10px] text-gray-500">
                {formatPinDate(pin.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
