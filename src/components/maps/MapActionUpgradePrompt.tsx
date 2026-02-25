'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import type { PlanLevel } from '@/lib/maps/permissions';

interface MapActionUpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  action: 'pins' | 'areas' | 'posts' | 'clicks';
  requiredPlan: PlanLevel;
  currentPlan?: PlanLevel;
}

export default function MapActionUpgradePrompt({
  isOpen,
  onClose,
  action,
  requiredPlan,
  currentPlan,
}: MapActionUpgradePromptProps) {
  if (!isOpen) return null;

  const actionLabels = {
    pins: 'add pins',
    areas: 'draw areas',
    posts: 'create posts',
    clicks: 'click on the map',
  };

  const planLabels: Record<PlanLevel, string> = {
    hobby: 'Hobby',
    contributor: 'Contributor',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-white rounded-md border border-gray-200 shadow-xl max-w-md w-full mx-4 p-[10px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Plan Required
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
        
        <p className="text-xs text-gray-600 mb-3">
          This map requires a <strong className="font-semibold text-gray-900">{planLabels[requiredPlan]}</strong> plan to {actionLabels[action]}.
          {currentPlan && (
            <> You currently have a <strong className="font-semibold text-gray-900">{planLabels[currentPlan]}</strong> plan.</>
          )}
        </p>
        
        <div className="flex items-center gap-2">
          <Link
            href="/pricing"
            className="flex-1 px-3 py-2 text-xs font-semibold bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors text-center"
            onClick={onClose}
          >
            Upgrade to {planLabels[requiredPlan]}
          </Link>
          <Link
            href="/pricing"
            className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            onClick={onClose}
          >
            Learn More
          </Link>
        </div>
      </div>
    </div>
  );
}
