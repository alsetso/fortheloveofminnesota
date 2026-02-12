'use client';

import { useState, useEffect, useCallback } from 'react';
import PinActivityFeed from './PinActivityFeed';
import MentionTypeCards from './MentionTypeCards';
import HeroSection from '@/components/landing/HeroSection';
import HomepageMapView from './HomepageMapView';
import { useAuthStateSafe } from '@/features/auth';
import type { FeedMap, FeedPinActivity } from '@/app/api/feed/pin-activity/route';

interface LiveMention {
  id: string;
  map_id: string;
  lat: number | null;
  lng: number | null;
  description: string | null;
  image_url: string | null;
  video_url: string | null;
  media_type: 'image' | 'video' | 'none' | null;
  account_id: string | null;
  created_at: string;
  accounts: {
    image_url: string | null;
  } | null;
  mention_type: {
    id: string;
    emoji: string;
    name: string;
  } | null;
}

export default function HomeFeedContent() {
  const { account } = useAuthStateSafe();
  const isAdmin = account?.role === 'admin';
  const [feedMaps, setFeedMaps] = useState<FeedMap[]>([]);
  const [feedActivity, setFeedActivity] = useState<FeedPinActivity[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  const fetchFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      if (account) {
        // Authenticated: fetch all maps user is part of (including live) and their pin activity
        const res = await fetch('/api/feed/pin-activity', { credentials: 'include' });
        if (!res.ok) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[HomeFeedContent] Feed API error:', res.status, res.statusText);
          }
          setFeedMaps([]);
          setFeedActivity([]);
          return;
        }
        const data = await res.json();
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[HomeFeedContent] Feed data:', { 
            mapsCount: data.maps?.length || 0, 
            activityCount: data.activity?.length || 0 
          });
        }
        
        setFeedMaps(data.maps ?? []);
        setFeedActivity(data.activity ?? []);
      } else {
        // Logged out: fetch public pins from live map
        const res = await fetch('/api/maps/live/pins', { credentials: 'include' });
        if (!res.ok) {
          setFeedMaps([]);
          setFeedActivity([]);
          return;
        }
        const responseData = await res.json();
        // API returns { pins: [...], mentions: [...] (backward compat), count: ... }
        const livePins: any[] = responseData.pins || responseData.mentions || [];
        
        if (process.env.NODE_ENV === 'development' && livePins.length === 0) {
          console.log('[HomeFeedContent] No live pins found:', { responseData });
        }
        
        // Transform live pins to FeedPinActivity format
        const transformedActivity: FeedPinActivity[] = livePins.map((pin: any) => {
          // Handle accounts - could be object or array
          const accountsData = pin.accounts || (Array.isArray(pin.accounts) ? pin.accounts[0] : null);
          
          return {
            id: pin.id,
            map_id: pin.map_id,
            lat: pin.lat,
            lng: pin.lng,
            description: pin.description || pin.body || null,
            caption: pin.caption || null,
            emoji: pin.emoji || null,
            image_url: pin.image_url,
            video_url: pin.video_url,
            media_type: pin.media_type,
            account_id: pin.account_id || pin.author_account_id || null,
            created_at: pin.created_at,
            map: {
              id: pin.map_id,
              name: 'Live Map',
              slug: 'live',
            },
            account: accountsData ? {
              id: pin.account_id || pin.author_account_id || '',
              username: null, // API doesn't return username for anonymous users
              image_url: accountsData.image_url || null,
            } : null,
            mention_type: pin.mention_type,
            tagged_accounts: null,
          };
        });
        
        // Set live map info
        if (livePins.length > 0 && livePins[0].map_id) {
          setFeedMaps([{
            id: livePins[0].map_id,
            name: 'Live Map',
            slug: 'live',
          }]);
        } else {
          setFeedMaps([]);
        }
        setFeedActivity(transformedActivity);
      }
    } catch {
      setFeedMaps([]);
      setFeedActivity([]);
    } finally {
      setFeedLoading(false);
    }
  }, [account]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  return (
    <div className="w-full">
      {/* Main Content - Centered */}
      <div className="max-w-[600px] mx-auto space-y-3 px-4">
        {/* Show hero section only when user is not logged in */}
        {!account && <HeroSection />}
        {/* Admin sections - shown only to admins */}
        {isAdmin && (
          <>
            <MentionTypeCards isAdmin={isAdmin} />
          </>
        )}
        {/* Mapbox container showing all mentions */}
        <HomepageMapView />
        <PinActivityFeed 
          maps={feedMaps} 
          activity={feedActivity} 
          loading={feedLoading} 
          showPersonalCollections={false}
          showWhatYouCanPost={false}
        />
      </div>
    </div>
  );
}
