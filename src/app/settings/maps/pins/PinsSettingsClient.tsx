'use client';

import { useState, useEffect } from 'react';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { useSettings } from '@/features/settings/contexts/SettingsContext';

export default function PinsSettingsClient() {
  const { account } = useSettings();
  const [pinDisplayGrouping, setPinDisplayGrouping] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load saved preference from localStorage or account settings
    const savedGrouping = localStorage.getItem('pinDisplayGrouping');
    if (savedGrouping !== null) {
      setPinDisplayGrouping(savedGrouping === 'true');
    }
    setLoading(false);
  }, []);

  const handleGroupingToggle = (value: boolean) => {
    setPinDisplayGrouping(value);
    localStorage.setItem('pinDisplayGrouping', value.toString());
    // Optionally sync with server/account settings
  };

  return (
    <div className="space-y-3">
      {/* Pin Display Settings */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Pin Display</h3>
        <p className="text-xs text-gray-500 mb-3">
          Control how pins appear on maps.
        </p>

        {/* Grouping Toggle */}
        <div className="flex items-center justify-between p-[10px] border border-gray-200 rounded-md">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <MapPinIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <h4 className="text-xs font-semibold text-gray-900">Grouping</h4>
            </div>
            <p className="text-xs text-gray-600">
              Group nearby pins together to reduce clutter on the map
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pinDisplayGrouping}
            onClick={() => handleGroupingToggle(!pinDisplayGrouping)}
            disabled={loading}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 ${
              pinDisplayGrouping 
                ? 'border-gray-300 bg-gray-900' 
                : 'border-gray-300 bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                pinDisplayGrouping ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Pin Preferences Info */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">About Pin Settings</h3>
        <div className="space-y-2 text-xs text-gray-600">
          <p>
            Pin display settings affect how pins are shown on maps across the platform.
          </p>
          <p>
            When grouping is enabled, pins that are close together will be clustered to improve map performance and readability.
          </p>
        </div>
      </div>
    </div>
  );
}
