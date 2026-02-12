'use client';

import { MapPinIcon, CalendarIcon, TagIcon, UserIcon, LinkIcon } from '@heroicons/react/24/outline';

/**
 * Right Sidebar for Memories page
 * Selected memory details, metadata, related memories, pin links
 */
export default function MemoriesRightSidebar() {
  // Mock selected memory data
  const selectedMemory = {
    id: '1',
    title: 'Lake Superior Sunset',
    date: '2024-07-15',
    location: 'Duluth, MN',
    coordinates: { lat: 46.7867, lng: -92.1005 },
    tags: ['sunset', 'lake', 'summer', 'duluth'],
    people: ['Sarah', 'Mike'],
    linkedPins: ['Pin #123', 'Pin #456'],
    description: 'Beautiful sunset over Lake Superior. One of those perfect Minnesota summer evenings.',
  };

  const relatedMemories = [
    { id: '2', title: 'Duluth Harbor', date: '2024-07-14', thumbnail: '🌊' },
    { id: '3', title: 'Lake Walk', date: '2024-07-16', thumbnail: '🚶' },
  ];

  return (
    <div className="h-full flex flex-col p-3 overflow-y-auto">
      {selectedMemory ? (
        <div className="space-y-4">
          {/* Memory Details Header */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Memory Details</h3>
            <div className="bg-surface border border-white/10 rounded-md p-3">
              <h4 className="text-base font-semibold text-white mb-2">{selectedMemory.title}</h4>
              {selectedMemory.description && (
                <p className="text-xs text-white/70 mb-3">{selectedMemory.description}</p>
              )}
            </div>
          </div>

          {/* Date & Location */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-white/70">
              <CalendarIcon className="w-4 h-4" />
              <span>{new Date(selectedMemory.date).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/70">
              <MapPinIcon className="w-4 h-4" />
              <span>{selectedMemory.location}</span>
            </div>
            {selectedMemory.coordinates && (
              <div className="text-xs text-white/50 ml-6">
                {selectedMemory.coordinates.lat.toFixed(4)}, {selectedMemory.coordinates.lng.toFixed(4)}
              </div>
            )}
          </div>

          {/* Linked Pins */}
          {selectedMemory.linkedPins && selectedMemory.linkedPins.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-white/60 mb-2 flex items-center gap-1.5">
                <LinkIcon className="w-4 h-4" />
                Linked Pins
              </h4>
              <div className="space-y-1">
                {selectedMemory.linkedPins.map((pin, idx) => (
                  <button
                    key={idx}
                    className="w-full text-left px-2 py-1.5 bg-surface-accent rounded-md text-xs text-white/80 hover:bg-surface-accent/80 transition-colors"
                  >
                    {pin}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {selectedMemory.tags && selectedMemory.tags.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-white/60 mb-2 flex items-center gap-1.5">
                <TagIcon className="w-4 h-4" />
                Tags
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedMemory.tags.map((tag) => (
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

          {/* People */}
          {selectedMemory.people && selectedMemory.people.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-white/60 mb-2 flex items-center gap-1.5">
                <UserIcon className="w-4 h-4" />
                People
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedMemory.people.map((person) => (
                  <span
                    key={person}
                    className="px-2 py-1 bg-surface-accent rounded-md text-xs text-white/70"
                  >
                    {person}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-white/10 space-y-2">
            <button className="w-full px-3 py-2 bg-lake-blue text-white rounded-md hover:bg-lake-blue/90 transition-colors text-xs font-medium">
              Link to Pin
            </button>
            <button className="w-full px-3 py-2 bg-surface-accent text-white rounded-md hover:bg-surface-accent/80 transition-colors text-xs font-medium">
              Edit Memory
            </button>
          </div>

          {/* Related Memories */}
          {relatedMemories.length > 0 && (
            <div className="pt-3 border-t border-white/10">
              <h4 className="text-xs font-semibold text-white/60 mb-2">Related Memories</h4>
              <div className="space-y-2">
                {relatedMemories.map((memory) => (
                  <button
                    key={memory.id}
                    className="w-full flex items-center gap-2 p-2 bg-surface-accent rounded-md hover:bg-surface-accent/80 transition-colors text-left"
                  >
                    <span className="text-lg">{memory.thumbnail}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{memory.title}</div>
                      <div className="text-xs text-white/60">{memory.date}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-white/60">Select a memory to view details</p>
        </div>
      )}
    </div>
  );
}
