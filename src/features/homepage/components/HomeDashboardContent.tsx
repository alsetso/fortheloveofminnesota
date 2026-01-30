'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChartBarIcon, EyeIcon } from '@heroicons/react/24/outline';
import ProfileCard from '@/features/profiles/components/ProfileCard';
import PinActivityFeed from '@/features/homepage/components/PinActivityFeed';
import type { ProfileAccount } from '@/types/profile';
import type { FeedMap, FeedPinActivity } from '@/app/api/feed/pin-activity/route';

interface HomeDashboardContentProps {
  account: ProfileAccount;
}

export default function HomeDashboardContent({ account }: HomeDashboardContentProps) {
  const [feedMaps, setFeedMaps] = useState<FeedMap[]>([]);
  const [feedActivity, setFeedActivity] = useState<FeedPinActivity[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [quickStats, setQuickStats] = useState<{ mapsCount?: number; mentionsCount?: number }>({});
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (!account?.id) {
      setFeedMaps([]);
      setFeedActivity([]);
      setFeedLoading(false);
      return;
    }
    const fetchFeed = async () => {
      setFeedLoading(true);
      try {
        const res = await fetch(
          `/api/feed/pin-activity?account_id=${encodeURIComponent(account.id)}`,
          { credentials: 'include' }
        );
        if (!res.ok) {
          setFeedMaps([]);
          setFeedActivity([]);
          return;
        }
        const data = await res.json();
        setFeedMaps(data.maps ?? []);
        setFeedActivity(data.activity ?? []);
      } catch {
        setFeedMaps([]);
        setFeedActivity([]);
      } finally {
        setFeedLoading(false);
      }
    };
    fetchFeed();
  }, [account?.id]);

  useEffect(() => {
    if (!account?.id) {
      setQuickStats({});
      return;
    }
    const fetchQuickStats = async () => {
      setLoadingStats(true);
      try {
        const mapsResponse = await fetch(`/api/maps?account_id=${account.id}`);
        const mapsCount = mapsResponse.ok ? ((await mapsResponse.json()).maps?.length ?? 0) : 0;
        const liveMapResponse = await fetch('/api/maps?slug=live');
        let mentionsCount = 0;
        if (liveMapResponse.ok) {
          const liveMapData = await liveMapResponse.json();
          const liveMapId = liveMapData.maps?.[0]?.id;
          if (liveMapId) {
            const pinsRes = await fetch(`/api/maps/${liveMapId}/pins`, { credentials: 'include' });
            if (pinsRes.ok) {
              const pinsData = await pinsRes.json();
              mentionsCount = pinsData.pins?.filter((p: { account_id?: string }) => p.account_id === account.id)?.length ?? 0;
            }
          }
        }
        setQuickStats({ mapsCount, mentionsCount });
      } catch {
        setQuickStats({});
      } finally {
        setLoadingStats(false);
      }
    };
    fetchQuickStats();
  }, [account?.id]);

  return (
    <div className="max-w-md mx-auto space-y-3">
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <ProfileCard
          account={account}
          isOwnProfile={true}
          showViewProfile={false}
          showActionButtons={true}
          showQuickStats={true}
          quickStats={quickStats}
        />
      </div>
      <PinActivityFeed maps={feedMaps} activity={feedActivity} loading={feedLoading} />
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <Link href="/analytics" className="block hover:bg-gray-50 transition-colors rounded-md -m-[10px] p-[10px]">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ChartBarIcon className="w-4 h-4 text-gray-600" />
              <h3 className="text-xs font-semibold text-gray-900">Analytics</h3>
            </div>
            <p className="text-xs text-gray-600">View your profile, mention, post, and map analytics</p>
            <div className="pt-1.5 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">View analytics</span>
                <EyeIcon className="w-3 h-3 text-gray-500" />
              </div>
            </div>
          </div>
        </Link>
      </div>
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <Link href="/live" className="block hover:bg-gray-50 transition-colors rounded-md -m-[10px] p-[10px]">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ChartBarIcon className="w-4 h-4 text-gray-600" />
              <h3 className="text-xs font-semibold text-gray-900">Live Map</h3>
            </div>
            <p className="text-xs text-gray-600">View real-time visit statistics and page analytics</p>
            <div className="pt-1.5 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">View map</span>
                <EyeIcon className="w-3 h-3 text-gray-500" />
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
