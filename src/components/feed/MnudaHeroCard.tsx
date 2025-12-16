'use client';

import { useState } from 'react';
import { XMarkIcon, BuildingOfficeIcon, MapPinIcon, ChartBarIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function MnudaHeroCard() {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-3 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-0.5 hover:bg-gray-100 rounded-sm transition-colors z-10"
        aria-label="Close"
      >
        <XMarkIcon className="w-3.5 h-3.5 text-gray-500" />
      </button>
      
      <div className="p-[10px] space-y-3">
        {/* Header */}
        <div>
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">
            For the Love of Minnesota
          </p>
          <h3 className="text-xs font-semibold text-gray-900 mb-1">
            Archive Special Moments in Minnesota
          </h3>
        </div>

        {/* About */}
        <div>
          <h4 className="text-[10px] font-semibold text-gray-900 mb-1 uppercase tracking-wide">About</h4>
          <p className="text-xs text-gray-600 leading-relaxed">
            For the Love of Minnesota connects residents, neighbors, and professionals across the state. Drop a pin to archive a special part of your life in Minnesota.
          </p>
        </div>

        {/* Features */}
        <div>
          <h4 className="text-[10px] font-semibold text-gray-900 mb-1.5 uppercase tracking-wide">Features</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-start gap-1.5">
              <MapPinIcon className="w-3 h-3 text-gray-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-medium text-gray-900">Drop Pins</p>
                <p className="text-[10px] text-gray-500">Archive special places</p>
              </div>
            </div>
            <div className="flex items-start gap-1.5">
              <MapPinIcon className="w-3 h-3 text-gray-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-medium text-gray-900">Statewide</p>
                <p className="text-[10px] text-gray-500">All cities & counties</p>
              </div>
            </div>
            <div className="flex items-start gap-1.5">
              <UserGroupIcon className="w-3 h-3 text-gray-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-medium text-gray-900">Connect</p>
                <p className="text-[10px] text-gray-500">Residents & neighbors</p>
              </div>
            </div>
            <div className="flex items-start gap-1.5">
              <UserGroupIcon className="w-3 h-3 text-gray-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-medium text-gray-900">Share</p>
                <p className="text-[10px] text-gray-500">Your Minnesota story</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div>
          <h4 className="text-[10px] font-semibold text-gray-900 mb-1.5 uppercase tracking-wide">Pricing</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 border border-gray-200 rounded-md p-1.5">
              <p className="text-[10px] font-semibold text-gray-900 mb-0.5">Hobby</p>
              <p className="text-xs font-bold text-gray-900 mb-1">Free</p>
              <ul className="space-y-0.5">
                <li className="text-[10px] text-gray-600">10 pins</li>
                <li className="text-[10px] text-gray-600">3 areas</li>
                <li className="text-[10px] text-gray-600">Public posts</li>
              </ul>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-1.5">
              <p className="text-[10px] font-semibold text-gray-900 mb-0.5">Pro</p>
              <p className="text-xs font-bold text-gray-900 mb-1">$20/mo</p>
              <ul className="space-y-0.5">
                <li className="text-[10px] text-gray-600">Unlimited pins</li>
                <li className="text-[10px] text-gray-600">Unlimited areas</li>
                <li className="text-[10px] text-gray-600">Private posts</li>
              </ul>
            </div>
          </div>
          <Link 
            href="/account/billing" 
            className="mt-1.5 block text-[10px] text-gray-700 hover:text-gray-900 font-medium"
          >
            View full pricing →
          </Link>
        </div>
      </div>
    </div>
  );
}

