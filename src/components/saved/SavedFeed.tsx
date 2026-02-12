'use client';

import { useState } from 'react';
import { 
  MapPinIcon, 
  DocumentTextIcon, 
  ChatBubbleLeftRightIcon,
  PhotoIcon,
  BookmarkIcon,
  UserCircleIcon,
  CalendarIcon,
  HeartIcon,
  ShareIcon,
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkIconSolid } from '@heroicons/react/24/solid';
import ProfilePhoto from '@/components/shared/ProfilePhoto';

interface SavedItem {
  id: string;
  type: 'pin' | 'post' | 'mention' | 'photo';
  title: string;
  author: {
    username: string;
    name?: string;
    avatar?: string;
  };
  savedAt: string;
  content?: string;
  location?: string;
  image?: string;
  likes?: number;
  isLiked?: boolean;
}

/**
 * Saved Feed - Display saved/bookmarked content from other users
 * Pins, posts, mentions, photos from Love of Minnesota community
 */
export default function SavedFeed() {
  const [selectedItem, setSelectedItem] = useState<SavedItem | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Mock saved items
  const savedItems: SavedItem[] = [
    {
      id: '1',
      type: 'pin',
      title: 'Beautiful Lake Harriet Sunset Spot',
      author: { username: 'sarah_mn', name: 'Sarah Johnson' },
      savedAt: '2024-12-15',
      location: 'Lake Harriet, Minneapolis',
      image: '🌅',
      likes: 24,
    },
    {
      id: '2',
      type: 'post',
      title: 'Best State Fair Food Recommendations',
      author: { username: 'minnesota_foodie', name: 'Mike Chen' },
      savedAt: '2024-12-10',
      content: 'Here are my top picks for must-try foods at the Minnesota State Fair...',
      likes: 156,
      isLiked: true,
    },
    {
      id: '3',
      type: 'mention',
      title: 'Hidden Gem: North Shore Waterfall',
      author: { username: 'outdoor_explorer', name: 'Emma Davis' },
      savedAt: '2024-12-05',
      location: 'North Shore, MN',
      content: 'Found this amazing waterfall just off the trail...',
      likes: 89,
    },
    {
      id: '4',
      type: 'photo',
      title: 'Fall Colors at Minnehaha Falls',
      author: { username: 'nature_lover', name: 'Alex Thompson' },
      savedAt: '2024-11-28',
      location: 'Minnehaha Falls, Minneapolis',
      image: '🍂',
      likes: 203,
      isLiked: true,
    },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pin':
        return MapPinIcon;
      case 'post':
        return DocumentTextIcon;
      case 'mention':
        return ChatBubbleLeftRightIcon;
      case 'photo':
        return PhotoIcon;
      default:
        return BookmarkIcon;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'pin':
        return 'bg-blue-500';
      case 'post':
        return 'bg-green-500';
      case 'mention':
        return 'bg-purple-500';
      case 'photo':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="max-w-[800px] mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Saved Items</h1>
        <p className="text-sm text-white/60">
          Content you've saved from the Love of Minnesota community
        </p>
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 p-1 bg-surface rounded-lg inline-flex">
          {(['list', 'grid'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-lake-blue text-white'
                  : 'text-white/70 hover:text-white hover:bg-surface-accent'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        <div className="text-xs text-white/60">
          {savedItems.length} saved items
        </div>
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {savedItems.map((item) => {
            const TypeIcon = getTypeIcon(item.type);
            const typeColor = getTypeColor(item.type);
            
            return (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="bg-surface border border-white/10 rounded-md p-4 cursor-pointer hover:border-white/20 transition-colors"
              >
                <div className="flex gap-3">
                  {/* Type Badge */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-md ${typeColor} flex items-center justify-center`}>
                    <TypeIcon className="w-5 h-5 text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-white mb-1 truncate">
                          {item.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-white/60">
                          <div className="flex items-center gap-1.5">
                            <UserCircleIcon className="w-3 h-3" />
                            <span className="truncate">{item.author.name || item.author.username}</span>
                          </div>
                          <span>·</span>
                          <div className="flex items-center gap-1.5">
                            <CalendarIcon className="w-3 h-3" />
                            <span>Saved {new Date(item.savedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <BookmarkIconSolid className="w-5 h-5 text-lake-blue flex-shrink-0" />
                    </div>

                    {/* Location */}
                    {item.location && (
                      <div className="flex items-center gap-1.5 text-xs text-white/70 mb-2">
                        <MapPinIcon className="w-3 h-3" />
                        <span>{item.location}</span>
                      </div>
                    )}

                    {/* Content Preview */}
                    {item.content && (
                      <p className="text-xs text-white/70 mb-3 line-clamp-2">
                        {item.content}
                      </p>
                    )}

                    {/* Image Placeholder */}
                    {item.image && (
                      <div className="w-full h-48 bg-surface-accent rounded-md mb-3 flex items-center justify-center border border-white/10">
                        <span className="text-4xl">{item.image}</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-4 pt-3 border-t border-white/10">
                      <button className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors">
                        <HeartIcon className={`w-4 h-4 ${item.isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                        <span>{item.likes || 0}</span>
                      </button>
                      <button className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors">
                        <ShareIcon className="w-4 h-4" />
                        <span>Share</span>
                      </button>
                      <button className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors">
                        <BookmarkIconSolid className="w-4 h-4 text-lake-blue" />
                        <span>Saved</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 gap-3">
          {savedItems.map((item) => {
            const TypeIcon = getTypeIcon(item.type);
            const typeColor = getTypeColor(item.type);
            
            return (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="bg-surface border border-white/10 rounded-md overflow-hidden cursor-pointer hover:border-white/20 transition-colors"
              >
                {/* Image/Preview */}
                <div className="aspect-square bg-surface-accent flex items-center justify-center relative">
                  {item.image ? (
                    <span className="text-6xl">{item.image}</span>
                  ) : (
                    <TypeIcon className="w-16 h-16 text-white/30" />
                  )}
                  <div className={`absolute top-2 right-2 w-8 h-8 rounded-md ${typeColor} flex items-center justify-center`}>
                    <TypeIcon className="w-4 h-4 text-white" />
                  </div>
                  <BookmarkIconSolid className="absolute top-2 left-2 w-5 h-5 text-lake-blue" />
                </div>
                
                {/* Content */}
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-white mb-1 line-clamp-1">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <span>{item.author.name || item.author.username}</span>
                    {item.likes && (
                      <>
                        <span>·</span>
                        <span>{item.likes} likes</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {savedItems.length === 0 && (
        <div className="text-center py-12 border border-white/10 border-dashed rounded-md bg-surface/50">
          <BookmarkIcon className="w-16 h-16 text-white/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Saved Items Yet</h3>
          <p className="text-sm text-white/60 mb-4">
            Start saving pins, posts, and content from the Love of Minnesota community
          </p>
          <button className="px-4 py-2 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-sm font-medium">
            Explore Community
          </button>
        </div>
      )}
    </div>
  );
}
