'use client';

import { useState, useEffect } from 'react';
import PinActivityFeed from './PinActivityFeed';
import HomeSidebar from './HomeSidebar';
import HeroSection from '@/components/landing/HeroSection';
import type { FeedMap, FeedPinActivity } from '@/app/api/feed/pin-activity/route';

export default function HomeFeedContent() {
  const [feedMaps, setFeedMaps] = useState<FeedMap[]>([]);
  const [feedActivity, setFeedActivity] = useState<FeedPinActivity[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      setFeedLoading(true);
      try {
        const res = await fetch('/api/feed/pin-activity', { credentials: 'include' });
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
  }, []);

  return (
    <div className="w-full relative">
      {/* Left Sidebar - Desktop only, positioned independently */}
      <div className="hidden lg:block absolute left-0 top-0 w-64">
        <div className="sticky top-6">
          <HomeSidebar maps={feedMaps} loading={feedLoading} />
        </div>
      </div>

      {/* Main Content - Centered independently */}
      <div className="max-w-md mx-auto space-y-3 px-4">
        <HeroSection />
        <PinActivityFeed maps={feedMaps} activity={feedActivity} loading={feedLoading} showPersonalCollections={false} />
      </div>
    </div>
  );
}
