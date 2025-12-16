'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, EyeIcon, UserIcon, ChartBarIcon, ClockIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import PinStatsCard from './PinStatsCard';
import PinViewersList from './PinViewersList';

interface PinAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pinId: string;
  pinName?: string;
}

export default function PinAnalyticsModal({ isOpen, onClose, pinId, pinName }: PinAnalyticsModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'viewers' | 'trends'>('overview');

  if (!isOpen) return null;

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
              <PinViewersList pinId={pinId} limit={5} showHeader={true} />
            </div>
          )}

          {activeTab === 'viewers' && (
            <PinViewersList pinId={pinId} limit={50} showHeader={false} />
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
