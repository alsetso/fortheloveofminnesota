'use client';

import { useState } from 'react';
import { PhotoIcon, MapPinIcon, CalendarIcon, TagIcon } from '@heroicons/react/24/outline';

interface Memory {
  id: string;
  image?: string;
  title?: string;
  date?: string;
  location?: string;
  tags?: string[];
  description?: string;
}

/**
 * Memories Feed - Timeline view with photos
 * Personal vault style for Minnesota memories
 */
export default function MemoriesFeed() {
  const [viewMode, setViewMode] = useState<'timeline' | 'grid' | 'map'>('timeline');
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);

  // Mock memories data
  const memories: Memory[] = [
    {
      id: '1',
      title: 'Lake Superior Sunset',
      date: '2024-07-15',
      location: 'Duluth, MN',
      tags: ['sunset', 'lake', 'summer'],
      description: 'Beautiful sunset over Lake Superior',
    },
    {
      id: '2',
      title: 'State Fair 2024',
      date: '2024-08-25',
      location: 'St. Paul, MN',
      tags: ['fair', 'food', 'family'],
      description: 'Annual Minnesota State Fair visit',
    },
    {
      id: '3',
      title: 'North Woods Hike',
      date: '2024-09-10',
      location: 'Boundary Waters, MN',
      tags: ['hiking', 'nature', 'outdoors'],
      description: 'Fall colors in the North Woods',
    },
  ];

  return (
    <div className="max-w-[800px] mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">My Minnesota Memories</h1>
        <p className="text-sm text-white/60">
          Your personal vault of Minnesota moments, photos, and stories
        </p>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center gap-2 mb-6 p-1 bg-surface rounded-lg inline-flex">
        {(['timeline', 'grid', 'map'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === mode
                ? 'bg-lake-blue text-white'
                : 'text-white/70 hover:text-white hover:bg-surface-accent'
            }`}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div className="space-y-6">
          {memories.map((memory, index) => (
            <div key={memory.id} className="relative">
              {/* Timeline Line */}
              {index < memories.length - 1 && (
                <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-white/10" />
              )}
              
              {/* Memory Card */}
              <div className="flex gap-4">
                {/* Date Badge */}
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-surface border-2 border-white/10 flex items-center justify-center">
                    <CalendarIcon className="w-6 h-6 text-white/60" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-surface border border-white/10 rounded-md p-4">
                  {/* Image Placeholder */}
                  <div className="w-full h-64 bg-surface-accent rounded-md mb-3 flex items-center justify-center border border-white/10">
                    <PhotoIcon className="w-16 h-16 text-white/30" />
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 mb-2 text-xs text-white/60">
                    {memory.date && (
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon className="w-4 h-4" />
                        <span>{new Date(memory.date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {memory.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPinIcon className="w-4 h-4" />
                        <span>{memory.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  {memory.title && (
                    <h3 className="text-lg font-semibold text-white mb-2">{memory.title}</h3>
                  )}

                  {/* Description */}
                  {memory.description && (
                    <p className="text-sm text-white/80 mb-3">{memory.description}</p>
                  )}

                  {/* Tags */}
                  {memory.tags && memory.tags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <TagIcon className="w-4 h-4 text-white/60" />
                      {memory.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-surface-accent rounded-md text-xs text-white/70"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/10">
                    <button className="text-xs text-white/70 hover:text-white transition-colors">
                      Link to Pin
                    </button>
                    <button className="text-xs text-white/70 hover:text-white transition-colors">
                      Edit
                    </button>
                    <button className="text-xs text-white/70 hover:text-white transition-colors">
                      Share
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Empty State - Add First Memory */}
          <div className="text-center py-12 border border-white/10 border-dashed rounded-md bg-surface/50">
            <PhotoIcon className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Start Your Memory Collection</h3>
            <p className="text-sm text-white/60 mb-4">
              Upload photos, link to map pins, and preserve your Minnesota moments
            </p>
            <button className="px-4 py-2 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-sm font-medium">
              Upload Your First Memory
            </button>
          </div>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-3 gap-3">
          {[...memories, ...memories, ...memories].map((memory, idx) => (
            <div
              key={`${memory.id}-${idx}`}
              className="aspect-square bg-surface border border-white/10 rounded-md overflow-hidden cursor-pointer hover:border-white/20 transition-colors"
            >
              <div className="w-full h-full bg-surface-accent flex items-center justify-center">
                <PhotoIcon className="w-12 h-12 text-white/30" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Map View */}
      {viewMode === 'map' && (
        <div className="h-[600px] bg-surface border border-white/10 rounded-md flex items-center justify-center">
          <div className="text-center">
            <MapPinIcon className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <p className="text-sm text-white/60">Map view coming soon</p>
            <p className="text-xs text-white/50 mt-2">
              See your memories pinned on a map of Minnesota
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
