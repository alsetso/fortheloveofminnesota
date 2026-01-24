'use client';

import Link from 'next/link';

interface MentionCardProps {
  mention: {
    id: string;
    lat: number;
    lng: number;
    description: string | null;
    image_url: string | null;
    account_id: string | null;
    mention_type?: {
      emoji: string;
      name: string;
    } | null;
  };
}

export default function MentionCard({ mention }: MentionCardProps) {
  const truncatedDescription = mention.description
    ? mention.description.length > 45
      ? mention.description.substring(0, 45) + '...'
      : mention.description
    : 'No description';

  return (
    <Link
      href={`/map?lat=${mention.lat}&lng=${mention.lng}&zoom=15`}
      className="block bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Mention Type Emoji */}
        {mention.mention_type && (
          <div className="flex-shrink-0 text-lg">
            {mention.mention_type.emoji}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {mention.mention_type && (
            <div className="text-xs font-medium text-gray-600 mb-1">
              {mention.mention_type.name}
            </div>
          )}
          <p className="text-sm text-gray-900 line-clamp-2">
            {truncatedDescription}
          </p>
        </div>

        {/* Image Thumbnail (if available) */}
        {mention.image_url && (
          <div className="flex-shrink-0">
            <img
              src={mention.image_url}
              alt="Mention"
              className="w-12 h-12 rounded object-cover"
            />
          </div>
        )}
      </div>
    </Link>
  );
}
