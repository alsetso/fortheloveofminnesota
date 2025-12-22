'use client';

import { useState } from 'react';
import { XMarkIcon, ChartBarIcon, LockClosedIcon, SparklesIcon } from '@heroicons/react/24/outline';
import PinStatsCard from './PinStatsCard';
import PinViewersList from './PinViewersList';

interface PinAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pinId: string;
  pinName?: string;
  isOwner?: boolean;
  isPro?: boolean;
  onUpgrade?: () => void;
}

export default function PinAnalyticsModal({ 
  isOpen, 
  onClose, 
  pinId, 
  pinName,
  isOwner = false,
  isPro = false,
  onUpgrade
}: PinAnalyticsModalProps) {
  // Default to 'overview', or 'viewers' if owner
  const [activeTab, setActiveTab] = useState<'overview' | 'viewers' | 'trends'>('overview');

  if (!isOpen) return null;

  // Non-owners can only see overview and trends
  const availableTabs = isOwner 
    ? ['overview', 'viewers', 'trends'] as const
    : ['overview', 'trends'] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg border border-gray-200 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-gray-600" />
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Pin Analytics</h2>
              {pinName && (
                <p className="text-xs text-gray-500 mt-0.5">{pinName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
              activeTab === 'overview'
                ? 'text-gray-900 border-gray-900 bg-white'
                : 'text-gray-500 hover:text-gray-700 border-transparent'
            }`}
          >
            Overview
          </button>
          {isOwner && (
            <button
              onClick={() => setActiveTab('viewers')}
              className={`flex-1 px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
                activeTab === 'viewers'
                  ? 'text-gray-900 border-gray-900 bg-white'
                  : 'text-gray-500 hover:text-gray-700 border-transparent'
              }`}
            >
              Viewers
            </button>
          )}
          <button
            onClick={() => setActiveTab('trends')}
            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
              activeTab === 'trends'
                ? 'text-gray-900 border-gray-900 bg-white'
                : 'text-gray-500 hover:text-gray-700 border-transparent'
            }`}
          >
            Trends
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'overview' && (
            <div className="space-y-3">
              <PinStatsCard pinId={pinId} />
              {/* Show preview of viewers for owners, full list for pro */}
              {isOwner && isPro && (
                <PinViewersList pinId={pinId} limit={5} showHeader={true} />
              )}
              {/* Show blurred preview with upgrade CTA for non-pro owners */}
              {isOwner && !isPro && (
                <ViewersUpgradeOverlay onUpgrade={onUpgrade} />
              )}
            </div>
          )}

          {activeTab === 'viewers' && isOwner && (
            <div className="relative">
              {isPro ? (
                <PinViewersList pinId={pinId} limit={50} showHeader={false} />
              ) : (
                <ViewersUpgradeOverlay onUpgrade={onUpgrade} fullHeight />
              )}
            </div>
          )}

          {activeTab === 'trends' && (
            <div className="space-y-3">
              <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                <h3 className="text-xs font-semibold text-gray-900 mb-3">View Trends</h3>
                <div className="text-xs text-gray-500">
                  Trend visualization coming soon. Check back for detailed analytics charts.
                </div>
              </div>
              <PinStatsCard pinId={pinId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Upgrade overlay shown when user is owner but not pro
 */
function ViewersUpgradeOverlay({ 
  onUpgrade,
  fullHeight = false 
}: { 
  onUpgrade?: () => void;
  fullHeight?: boolean;
}) {
  return (
    <div className={`relative ${fullHeight ? 'min-h-[300px]' : ''}`}>
      {/* Blurred placeholder content */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2 filter blur-sm select-none pointer-events-none">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-3 h-3 bg-gray-300 rounded" />
          <div className="h-3 w-24 bg-gray-200 rounded" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-200 rounded-full" />
            <div className="flex-1">
              <div className="h-3 w-32 bg-gray-200 rounded mb-1" />
              <div className="h-2 w-20 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Overlay CTA */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-md">
        <div className="text-center p-4 max-w-xs">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full mb-3">
            <LockClosedIcon className="w-5 h-5 text-gray-600" />
          </div>
          <h4 className="text-sm font-semibold text-gray-900 mb-1">
            See Who&apos;s Viewing
          </h4>
          <p className="text-xs text-gray-600 mb-3">
            Upgrade to Pro to see the full list of people who have viewed your pin.
          </p>
          <button
            onClick={onUpgrade}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors"
          >
            <SparklesIcon className="w-3.5 h-3.5" />
            Upgrade to Pro
          </button>
        </div>
      </div>
    </div>
  );
}


