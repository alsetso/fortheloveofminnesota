'use client';

import { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/solid';
import { useAuthStateSafe } from '@/features/auth';
import ProfilePhoto from '@/components/shared/ProfilePhoto';

interface Story {
  id: string;
  username: string;
  avatar?: string;
  image?: string;
  color?: string;
  icon?: string;
}

interface StoriesProps {
  stories?: Story[];
}

/**
 * Horizontal scrolling stories component with Create Story card and colorful backgrounds
 */
export default function Stories({ stories = [] }: StoriesProps) {
  const { account } = useAuthStateSafe();
  const [activeStory, setActiveStory] = useState<string | null>(null);

  // Mock stories with colorful backgrounds
  const mockStories: Story[] = stories.length > 0 ? stories : [
    { id: '1', username: 'Lake Superior', color: 'bg-blue-500', icon: '🌊' },
    { id: '2', username: 'North Woods', color: 'bg-green-500', icon: '🌲' },
    { id: '3', username: 'Twin Cities', color: 'bg-purple-500', icon: '🏙️' },
    { id: '4', username: 'State Fair', color: 'bg-orange-500', icon: '🎡' },
  ];

  return (
    <div className="w-full overflow-x-auto scrollbar-hide pb-4">
      <div className="flex gap-3 px-4">
        {/* Create Story Card */}
        <button className="flex flex-col items-center gap-1.5 flex-shrink-0 min-w-[100px]">
          <div className="w-32 h-48 rounded-md bg-surface border border-white/10 relative overflow-hidden group cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
            {account && (
              <div className="absolute top-2 left-2">
                <div className="w-10 h-10 rounded-full bg-lake-blue flex items-center justify-center border-2 border-white/10">
                  <ProfilePhoto account={account} size="sm" editable={false} />
                </div>
              </div>
            )}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
              <div className="w-10 h-10 rounded-full bg-lake-blue flex items-center justify-center">
                <PlusIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="absolute bottom-2 left-0 right-0 text-center">
              <span className="text-xs font-medium text-white">Create Story</span>
            </div>
          </div>
        </button>

        {/* Story Cards */}
        {mockStories.map((story) => (
          <button
            key={story.id}
            onClick={() => setActiveStory(story.id)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 min-w-[100px]"
          >
            <div className={`w-32 h-48 rounded-md ${story.color || 'bg-gray-500'} relative overflow-hidden group cursor-pointer`}>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
              {story.icon && (
                <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <span className="text-lg">{story.icon}</span>
                </div>
              )}
              <div className="absolute bottom-2 left-0 right-0 text-center px-2">
                <span className="text-xs font-medium text-white truncate block">{story.username}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
