'use client';

import { useState, useEffect } from 'react';
import { MapPinIcon, EyeIcon, UserGroupIcon, ClockIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/features/auth';

interface PinViewStats {
  pin_id: string;
  pin_description: string | null;
  pin_type: string | null;
  pin_created_at: string;
  total_views: number;
  unique_viewers: number;
  last_viewed_at: string | null;
}

interface AnalyticsData {
  pins: PinViewStats[];
  totals: {
    total_pins: number;
    total_views: number;
    total_unique_viewers: number;
  };
}

export default function AnalyticsClient() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setError('Sign in to view analytics');
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/analytics/my-pins', { credentials: 'include' });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || 'Failed to load analytics');
        }

        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-gray-600">{error}</p>
      </div>
    );
  }

  if (!data || data.pins.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <MapPinIcon className="w-5 h-5 text-gray-400" />
        </div>
        <p className="text-xs font-medium text-gray-700 mb-1">No pins yet</p>
        <p className="text-xs text-gray-500">Create pins to track views</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-md p-[10px]">
          <div className="flex items-center gap-1.5 mb-1">
            <MapPinIcon className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Pins</span>
          </div>
          <div className="text-sm font-semibold text-gray-900">{data.totals.total_pins}</div>
        </div>
        <div className="bg-gray-50 rounded-md p-[10px]">
          <div className="flex items-center gap-1.5 mb-1">
            <EyeIcon className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Views</span>
          </div>
          <div className="text-sm font-semibold text-gray-900">
            {data.totals.total_views.toLocaleString()}
          </div>
        </div>
        <div className="bg-gray-50 rounded-md p-[10px]">
          <div className="flex items-center gap-1.5 mb-1">
            <UserGroupIcon className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Viewers</span>
          </div>
          <div className="text-sm font-semibold text-gray-900">
            {data.totals.total_unique_viewers.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Pin List */}
      <div className="border border-gray-200 rounded-md overflow-hidden">
        <div className="bg-gray-50 px-[10px] py-2 border-b border-gray-200">
          <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">
            Pin Views
          </span>
        </div>
        <div className="divide-y divide-gray-100">
          {data.pins.map((pin) => (
            <div key={pin.pin_id} className="px-[10px] py-2 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-gray-900 truncate block">
                    {pin.pin_description || 'Untitled Pin'}
                  </span>
                  {pin.pin_type && (
                    <p className="text-[10px] text-gray-500 truncate mt-0.5">{pin.pin_type}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <EyeIcon className="w-3 h-3 text-gray-400" />
                    <span className="text-xs font-medium text-gray-700">
                      {pin.total_views.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <UserGroupIcon className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-600">{pin.unique_viewers}</span>
                  </div>
                </div>
              </div>
              {pin.last_viewed_at && (
                <div className="flex items-center gap-1 mt-1">
                  <ClockIcon className="w-2.5 h-2.5 text-gray-400" />
                  <span className="text-[10px] text-gray-400">
                    {formatDistanceToNow(new Date(pin.last_viewed_at), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

