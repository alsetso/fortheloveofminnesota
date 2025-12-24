'use client';

import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { ExtractedFeature, getFeatureActions } from '../services/featureService';
import { CATEGORY_CONFIG } from '../constants/categories';

interface FeatureCardProps {
  feature: ExtractedFeature;
  onAction?: (actionId: string, feature: ExtractedFeature) => void;
  className?: string;
}

/**
 * Card displaying captured feature metadata
 * Shows in location details when user clicks on map
 */
export default function FeatureCard({
  feature,
  onAction,
  className = '',
}: FeatureCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = CATEGORY_CONFIG[feature.category];
  const actions = getFeatureActions(feature);
  const hasProperties = Object.keys(feature.properties).length > 0;

  return (
    <div className={`border-t border-gray-100 pt-2 mt-2 ${className}`}>
      {/* Header with icon and name */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-sm">{feature.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-gray-700 truncate">
              {feature.name || feature.label}
            </span>
            {feature.name && (
              <span className="text-[10px] text-gray-400">· {feature.label}</span>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {actions.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => onAction?.(action.id, feature)}
              className="text-[10px] text-gray-500 hover:text-gray-900 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Expandable metadata */}
      {hasProperties && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            {isExpanded ? (
              <ChevronUpIcon className="w-2.5 h-2.5" />
            ) : (
              <ChevronDownIcon className="w-2.5 h-2.5" />
            )}
            <span>{isExpanded ? 'Hide' : 'Show'} metadata</span>
          </button>

          {isExpanded && (
            <div className="mt-1.5 space-y-0.5 bg-gray-50 rounded px-2 py-1.5">
              <div className="text-[10px] text-gray-500">
                <span className="text-gray-400">layer:</span> {feature.layerId}
              </div>
              {feature.sourceLayer && (
                <div className="text-[10px] text-gray-500">
                  <span className="text-gray-400">source:</span> {feature.sourceLayer}
                </div>
              )}
              {feature.name && (
                <div className="text-[10px] text-gray-500">
                  <span className="text-gray-400">name:</span> {feature.name}
                </div>
              )}
              {Object.entries(feature.properties).map(([key, value]) => (
                <div key={key} className="text-[10px] text-gray-500">
                  <span className="text-gray-400">{key}:</span> {String(value)}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Layer badge for features without properties */}
      {!hasProperties && (
        <div className="text-[10px] text-gray-400">
          Layer: {feature.layerId}
        </div>
      )}
    </div>
  );
}



