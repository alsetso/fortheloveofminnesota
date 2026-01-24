'use client';

import Image from 'next/image';
import { formatPinDate } from '@/types/profile';
import type { ProfilePin } from '@/types/profile';
import { EyeIcon, HeartIcon } from '@heroicons/react/24/outline';

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
      <div className="p-6">
        <p className="text-sm text-gray-500 text-center py-8">No mentions found</p>
      </div>
    );
  }

  return (
    <div>
      {/* List Content */}
      <div className="p-6">
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

              {/* Metadata Row - Mention Type, Collection, Views, Likes */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Mention Type */}
                {pin.mention_type && (
                  <span className="text-[10px] text-gray-600">
                    {pin.mention_type.emoji} {pin.mention_type.name}
                  </span>
                )}
                
                {/* Collection Badge */}
                {pin.collection && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                    <span>{pin.collection.emoji}</span>
                    <span>{pin.collection.title}</span>
                  </span>
                )}
                
                {/* View Count */}
                {(pin.view_count !== undefined && pin.view_count > 0) && (
                  <div className="flex items-center gap-0.5 text-[10px] text-gray-500">
                    <EyeIcon className="w-3 h-3" />
                    <span>{pin.view_count}</span>
                  </div>
                )}
                
                {/* Like Count */}
                {(pin.likes_count !== undefined && pin.likes_count > 0) && (
                  <div className="flex items-center gap-0.5 text-[10px] text-gray-500">
                    <HeartIcon className="w-3 h-3" />
                    <span>{pin.likes_count}</span>
                  </div>
                )}
              </div>

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
