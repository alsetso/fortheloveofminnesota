'use client';

import { ExtractedFeature } from '../services/featureService';

interface CursorTrackerProps {
  feature: ExtractedFeature | null;
  className?: string;
}

/**
 * Compact cursor tracker showing current feature under cursor
 * Fixed at bottom of sidebar - shows what will be captured on click
 */
export default function CursorTracker({ feature, className = '' }: CursorTrackerProps) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1.5 bg-white border border-gray-200 rounded-md ${className}`}
    >
      {/* Live indicator */}
      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />

      {/* Feature info - All in a single row */}
      {feature ? (
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
          <span className="text-xs flex-shrink-0">{feature.icon}</span>
          <span className="text-xs text-gray-600 truncate min-w-0">
            {feature.name || feature.label}
          </span>
          {feature.name && (
            <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:inline whitespace-nowrap">· {feature.label}</span>
          )}
        </div>
      ) : (
        <span className="text-xs text-gray-400 truncate flex-1">Hover map</span>
      )}
    </div>
  );
}
