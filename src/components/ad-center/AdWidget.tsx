'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Ad {
  id: string;
  campaign_id: string;
  title: string;
  description?: string;
  image_url?: string;
  link_url?: string;
  ad_type?: string;
  status: string;
  created_at: string;
}

/**
 * Ad Widget - Displays active ads from the ad system
 */
export default function AdWidget() {
  const [ad, setAd] = useState<Ad | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAd = async () => {
      try {
        const response = await fetch('/api/ads?limit=1', {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch ad');
        }

        const data = await response.json();
        if (data.ads && data.ads.length > 0) {
          setAd(data.ads[0]);
        }
      } catch (err) {
        console.error('Error fetching ad:', err);
        setError(err instanceof Error ? err.message : 'Failed to load ad');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAd();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-surface-accent rounded-md p-3 border border-border-muted dark:border-white/10">
        <div className="text-center py-4">
          <div className="text-xs text-foreground-muted">Loading ad...</div>
        </div>
      </div>
    );
  }

  if (error || !ad) {
    return null;
  }

  const adContent = (
    <div className="bg-surface-accent rounded-md p-3 border border-border-muted dark:border-white/10">
      {ad.image_url && (
        <div className="mb-2 rounded-md overflow-hidden">
          <img
            src={ad.image_url}
            alt={ad.title}
            className="w-full h-auto object-cover"
          />
        </div>
      )}
      <div className="space-y-1">
        <div className="text-xs font-semibold text-foreground">{ad.title}</div>
        {ad.description && (
          <div className="text-[10px] text-foreground-muted line-clamp-2">
            {ad.description}
          </div>
        )}
        <div className="text-[10px] text-foreground-subtle">Sponsored</div>
      </div>
    </div>
  );

  if (ad.link_url) {
    return (
      <Link href={ad.link_url} target="_blank" rel="noopener noreferrer">
        {adContent}
      </Link>
    );
  }

  return adContent;
}
