'use client';

/**
 * Explore content component for bottom button popup
 * Full-height modal for exploring content
 */
export default function ExploreContent() {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Explore</h3>
        <p className="text-xs text-gray-500">Discover places, people, and content</p>
      </div>
      
      <div className="space-y-2">
        <div className="p-[10px] border border-gray-200 rounded-md bg-white">
          <p className="text-xs text-gray-600">Explore content coming soon</p>
        </div>
      </div>
    </div>
  );
}
