'use client';

import { 
  BookmarkIcon,
  MapPinIcon,
  UserCircleIcon,
  CalendarIcon,
  ShareIcon,
  LinkIcon,
  HeartIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkIconSolid } from '@heroicons/react/24/solid';
import ProfilePhoto from '@/components/shared/ProfilePhoto';

/**
 * Right Sidebar for Saved page
 * Selected item details, actions, author info, related content
 */
export default function SavedRightSidebar() {
  // Mock selected item
  const selectedItem = {
    id: '1',
    type: 'pin',
    title: 'Beautiful Lake Harriet Sunset Spot',
    author: {
      username: 'sarah_mn',
      name: 'Sarah Johnson',
      avatar: null,
    },
    savedAt: '2024-12-15',
    location: 'Lake Harriet, Minneapolis',
    coordinates: { lat: 44.9275, lng: -93.3081 },
    description: 'Perfect spot to watch the sunset over Lake Harriet. Best during summer months when the sky is clear.',
    tags: ['sunset', 'lake', 'minneapolis', 'summer'],
    likes: 24,
    isLiked: true,
    originalUrl: '/pin/123',
  };

  const relatedSaved = [
    { id: '2', title: 'Lake Calhoun Viewpoint', type: 'pin', savedAt: '2024-12-10' },
    { id: '3', title: 'Chain of Lakes Guide', type: 'post', savedAt: '2024-12-08' },
  ];

  return (
    <div className="h-full flex flex-col p-3 overflow-y-auto">
      {selectedItem ? (
        <div className="space-y-4">
          {/* Item Header */}
          <div>
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">Saved Item</h3>
              <BookmarkIconSolid className="w-5 h-5 text-lake-blue" />
            </div>
            <div className="bg-surface border border-white/10 rounded-md p-3">
              <h4 className="text-base font-semibold text-white mb-1">{selectedItem.title}</h4>
              <div className="flex items-center gap-2 text-xs text-white/60 mb-2">
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-md">
                  Pin
                </span>
                <span>Saved {new Date(selectedItem.savedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Author Info */}
          <div>
            <h4 className="text-xs font-semibold text-white/60 mb-2">From</h4>
            <div className="flex items-center gap-2 p-2 bg-surface-accent rounded-md">
              <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center">
                <UserCircleIcon className="w-5 h-5 text-white/60" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {selectedItem.author.name || selectedItem.author.username}
                </div>
                <div className="text-xs text-white/60 truncate">
                  @{selectedItem.author.username}
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          {selectedItem.location && (
            <div>
              <h4 className="text-xs font-semibold text-white/60 mb-2 flex items-center gap-1.5">
                <MapPinIcon className="w-4 h-4" />
                Location
              </h4>
              <div className="bg-surface-accent rounded-md p-3">
                <div className="text-sm text-white mb-1">{selectedItem.location}</div>
                {selectedItem.coordinates && (
                  <div className="text-xs text-white/50">
                    {selectedItem.coordinates.lat.toFixed(4)}, {selectedItem.coordinates.lng.toFixed(4)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {selectedItem.description && (
            <div>
              <h4 className="text-xs font-semibold text-white/60 mb-2">Description</h4>
              <p className="text-sm text-white/80">{selectedItem.description}</p>
            </div>
          )}

          {/* Tags */}
          {selectedItem.tags && selectedItem.tags.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-white/60 mb-2">Tags</h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedItem.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-surface-accent rounded-md text-xs text-white/70"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-white/10 space-y-2">
            <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-xs font-medium">
              <LinkIcon className="w-4 h-4" />
              View Original
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button className="flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-accent text-white rounded-md hover:bg-surface-accent/80 transition-colors text-xs">
                <ShareIcon className="w-4 h-4" />
                Share
              </button>
              <button className="flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-accent text-white rounded-md hover:bg-surface-accent/80 transition-colors text-xs">
                <HeartIcon className={`w-4 h-4 ${selectedItem.isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                {selectedItem.likes}
              </button>
            </div>
            <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 rounded-md hover:bg-red-500/30 transition-colors text-xs font-medium">
              <TrashIcon className="w-4 h-4" />
              Remove from Saved
            </button>
          </div>

          {/* Related Saved Items */}
          {relatedSaved.length > 0 && (
            <div className="pt-3 border-t border-white/10">
              <h4 className="text-xs font-semibold text-white/60 mb-2">Related Saved</h4>
              <div className="space-y-2">
                {relatedSaved.map((item) => (
                  <button
                    key={item.id}
                    className="w-full text-left p-2 bg-surface-accent rounded-md hover:bg-surface-accent/80 transition-colors"
                  >
                    <div className="text-xs font-medium text-white mb-0.5">{item.title}</div>
                    <div className="text-xs text-white/60">
                      {item.type} · Saved {new Date(item.savedAt).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Save Info */}
          <div className="pt-3 border-t border-white/10">
            <div className="text-xs text-white/50">
              <div className="flex items-center gap-1.5 mb-1">
                <CalendarIcon className="w-3 h-3" />
                <span>Saved on {new Date(selectedItem.savedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</span>
              </div>
              <div className="text-white/40 text-[10px] mt-2">
                You can access this saved item anytime from your saved collection
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <BookmarkIcon className="w-12 h-12 text-white/30 mx-auto mb-3" />
          <p className="text-sm text-white/60">Select a saved item to view details</p>
        </div>
      )}
    </div>
  );
}
