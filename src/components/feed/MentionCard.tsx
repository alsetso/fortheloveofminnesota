'use client';

import { useRouter } from 'next/navigation';

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
  compact?: boolean;
}

export default function MentionCard({ mention, compact = false }: MentionCardProps) {
  const router = useRouter();
  const truncatedDescription = mention.description
    ? mention.description.length > 45
      ? mention.description.substring(0, 45) + '...'
      : mention.description
    : 'No description';

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Navigate to /live with coordinates and mention ID - will trigger URL watcher to zoom, highlight mention, and open sheet
    router.push(`/map/live?lat=${mention.lat}&lng=${mention.lng}&mentionId=${mention.id}`);
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left block bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors max-w-full overflow-hidden ${
        compact ? 'p-1' : 'p-[10px]'
      }`}
    >
      <div className={`flex items-start ${compact ? 'gap-1' : 'gap-2'}`}>
        {/* Mention Type Emoji */}
        {mention.mention_type && (
          <div className={`flex-shrink-0 text-gray-600 leading-none ${compact ? 'text-xs mt-0' : 'text-sm mt-0.5'}`}>
            {mention.mention_type.emoji}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {mention.mention_type && (
            <div className={`text-xs font-medium text-gray-600 ${compact ? 'mb-0 leading-tight' : 'mb-0.5'}`}>
              {mention.mention_type.name}
            </div>
          )}
          <p className={`text-xs text-gray-900 line-clamp-2 ${compact ? 'leading-tight' : ''}`}>
            {truncatedDescription}
          </p>
        </div>

        {/* Image Thumbnail (if available) */}
        {mention.image_url && (
          <div className="flex-shrink-0">
            <img
              src={mention.image_url}
              alt="Mention"
              className={`rounded-md object-cover border border-gray-200 ${compact ? 'w-7 h-7' : 'w-10 h-10'}`}
            />
          </div>
        )}
      </div>
    </button>
  );
}
