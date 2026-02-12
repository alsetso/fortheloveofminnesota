'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChartBarIcon, EyeIcon } from '@heroicons/react/24/outline';
import ProfileCard from '@/features/profiles/components/ProfileCard';
import PinActivityFeed from '@/features/homepage/components/PinActivityFeed';
import ProfileMentionsSection from '@/app/[username]/ProfileMentionsSection';
import { CollectionService } from '@/features/collections/services/collectionService';
import type { ProfileAccount, ProfilePin } from '@/types/profile';
import type { Collection } from '@/types/collection';
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
  const [pins, setPins] = useState<ProfilePin[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [pinsLoading, setPinsLoading] = useState(true);

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

  // Profile card analytics: mapsCount = maps owned by account; mentionsCount = pins owned by account on the live map.
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

  // Fetch owner's pins and collections for map pins container
  useEffect(() => {
    if (!account?.id) {
      setPins([]);
      setCollections([]);
      setPinsLoading(false);
      return;
    }

    const fetchPinsAndCollections = async () => {
      setPinsLoading(true);
      try {
        // Fetch collections using service first
        let fetchedCollections: Collection[] = [];
        try {
          fetchedCollections = await CollectionService.getCollections(account.id);
          setCollections(fetchedCollections);
        } catch {
          setCollections([]);
        }

        // Get live map ID and name first
        const liveMapRes = await fetch('/api/maps?slug=live');
        if (!liveMapRes.ok) {
          setPins([]);
          return;
        }
        const liveMapData = await liveMapRes.json();
        const liveMap = liveMapData.maps?.[0];
        const liveMapId = liveMap?.id;
        const liveMapName = liveMap?.name || 'Live Map';
        
        if (!liveMapId) {
          setPins([]);
          return;
        }

        // Fetch all pins from live map (owner sees all, including private)
        const pinsRes = await fetch(`/api/maps/${liveMapId}/pins`, { credentials: 'include' });
        if (pinsRes.ok) {
          const pinsData = await pinsRes.json();
          // Filter to only pins owned by this account
          const accountPins = (pinsData.pins || []).filter((p: any) => p.account_id === account.id);
          
          // Fetch likes counts - query map_pins_likes directly via Supabase client-side
          const pinIds = accountPins.map((p: any) => p.id);
          let likesCounts = new Map<string, number>();
          if (pinIds.length > 0) {
            try {
              // Use the same approach as the page.tsx - fetch likes directly
              const { supabase } = await import('@/lib/supabase');
              const { data: likesData } = await supabase
                .from('map_pins_likes')
                .select('map_pin_id')
                .in('map_pin_id', pinIds);
              likesData?.forEach((like: { map_pin_id: string }) => {
                likesCounts.set(like.map_pin_id, (likesCounts.get(like.map_pin_id) || 0) + 1);
              });
            } catch {
              // Likes fetch failed, continue without likes
            }
          }
          
          // Map collections by ID for quick lookup (use fetchedCollections, not state)
          const collectionsMap = new Map(fetchedCollections.map(c => [c.id, c]));
          
          const transformedPins: ProfilePin[] = accountPins.map((pin: any) => {
            const collection = pin.collection_id && collectionsMap.has(pin.collection_id)
              ? collectionsMap.get(pin.collection_id)!
              : null;
            
            return {
              id: pin.id,
              lat: pin.lat,
              lng: pin.lng,
              description: pin.description,
              collection_id: pin.collection_id,
              collection: collection ? { id: collection.id, emoji: collection.emoji, title: collection.title } : null,
              mention_type: pin.mention_type ? { id: pin.mention_type.id, emoji: pin.mention_type.emoji, name: pin.mention_type.name } : null,
              visibility: pin.visibility || 'public',
              image_url: pin.image_url,
              video_url: pin.video_url,
              media_type: pin.media_type || 'none',
              view_count: pin.view_count || 0,
              likes_count: likesCounts.get(pin.id) || 0,
              created_at: pin.created_at,
              updated_at: pin.updated_at || pin.created_at,
              map_id: pin.map_id,
              map: { id: liveMapId, name: liveMapName, slug: 'live' },
            };
          });
          setPins(transformedPins);
        }
      } catch (error) {
        console.error('Error fetching pins and collections:', error);
        setPins([]);
        setCollections([]);
      } finally {
        setPinsLoading(false);
      }
    };

    fetchPinsAndCollections();
  }, [account?.id]);

  return (
    <div className="max-w-[800px] mx-auto space-y-3 p-3">
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <ProfileCard
          account={account}
          isOwnProfile={true}
          showViewProfile={false}
          showActionButtons={true}
          showQuickStats={true}
          quickStats={quickStats}
        />
      </div>
      <PinActivityFeed maps={feedMaps} activity={feedActivity} loading={feedLoading} showWhatYouCanPost={false} showMapPins={false} />
      
      {/* Map Pins Container with Toggle */}
      {!pinsLoading && pins.length > 0 && (
        <ProfileMentionsSection
          pins={pins}
          accountId={account.id}
          isOwnProfile={true}
          accountUsername={account.username}
          accountImageUrl={account.image_url}
          collections={collections}
        />
      )}
      
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <Link href="/analytics" className="block hover:bg-surface-accent dark:hover:bg-white/5 transition-colors rounded-md -m-[10px] p-[10px]">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ChartBarIcon className="w-4 h-4 text-foreground-muted" />
              <h3 className="text-xs font-semibold text-foreground">Analytics</h3>
            </div>
            <p className="text-xs text-foreground-muted">View your profile, mention, post, and map analytics</p>
            <div className="pt-1.5 border-t border-border-muted dark:border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground-muted">View analytics</span>
                <EyeIcon className="w-3 h-3 text-foreground-muted" />
              </div>
            </div>
          </div>
        </Link>
      </div>
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <Link href="/maps" className="block hover:bg-surface-accent dark:hover:bg-white/5 transition-colors rounded-md -m-[10px] p-[10px]">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ChartBarIcon className="w-4 h-4 text-foreground-muted" />
              <h3 className="text-xs font-semibold text-foreground">Live Map</h3>
            </div>
            <p className="text-xs text-foreground-muted">View real-time visit statistics and page analytics</p>
            <div className="pt-1.5 border-t border-border-muted dark:border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground-muted">View map</span>
                <EyeIcon className="w-3 h-3 text-foreground-muted" />
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
