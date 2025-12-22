'use client';

import { ExtractedFeature } from '../services/featureService';
import { useMemo } from 'react';

interface CursorTrackerProps {
  feature: ExtractedFeature | null;
  className?: string;
}

/**
 * Compact cursor tracker showing current feature under cursor
 * Fixed at bottom of sidebar - shows what will be captured on click
 * 
 * Design: Ultra-compact government-style minimalism
 * - Tighter padding (px-2 py-1)
 * - Animated live indicator
 * - Single-line truncation with category context
 * - Smooth transitions on feature change
 */
export default function CursorTracker({ feature, className = '' }: CursorTrackerProps) {
  const displayText = useMemo(() => {
    if (!feature) return 'Hover map';
    
    // Prioritize name, fallback to label
    const primary = feature.name || feature.label;
    
    // Show category as secondary context only if name exists and differs
    const showCategory = feature.name && feature.label && feature.name !== feature.label;
    
    return showCategory ? `${primary} · ${feature.label}` : primary;
  }, [feature]);

  return (
    <div
      className={`flex items-center px-2 py-1 bg-white border border-gray-200 rounded-md transition-all duration-150 ${className}`}
    >
      {/* Feature info - Single line with smart truncation */}
      {feature ? (
        <span 
          className="text-xs text-gray-600 truncate min-w-0 flex-1 transition-colors duration-150"
          title={displayText}
        >
          {displayText}
        </span>
      ) : (
        <span className="text-xs text-gray-400 truncate flex-1">Hover map</span>
      )}
    </div>
  );
}

