'use client';

import { useState, useEffect, useMemo } from 'react';
import { MapPinIcon, EyeIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useAuth } from '@/features/auth';

type TimeFilter = '24h' | '7d' | 'all';

interface Mention {
  id: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  view_count: number;
}

/**
 * Live Page Stats Component
 * Displays 24-hour and total visit statistics for the /live page
 * Also shows user's mentions with view counts filtered by time period
 */
export default function LivePageStats() {
  const { user } = useAuth();
  const [visitStats, setVisitStats] = useState<{ last24Hours: number; previous24Hours: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [mentionsLoading, setMentionsLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  // Calculate if trending (volume + growth)
  const isTrending = useMemo(() => {
    if (!visitStats) return false;
    const { last24Hours, previous24Hours } = visitStats;
    
    // Minimum volume threshold: 30+ visits
    if (last24Hours < 30) return false;
    
    // If no previous data, any volume >= 30 is trending
    if (previous24Hours === 0) return true;
    
    // Calculate growth percentage
    const growth = ((last24Hours - previous24Hours) / previous24Hours) * 100;
    
    // Trending if 20%+ growth
    return growth >= 20;
  }, [visitStats]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/analytics/homepage-stats');
        if (response.ok) {
          const data = await response.json();
          setVisitStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch homepage stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch user's mentions when time filter changes (only if authenticated)
  useEffect(() => {
    if (!user) {
      setMentions([]);
      setMentionsLoading(false);
      return;
    }

    const fetchMentions = async () => {
      setMentionsLoading(true);
      try {
        const response = await fetch(`/api/analytics/user-mentions?timeFilter=${timeFilter}`);
        if (response.ok) {
          const data = await response.json();
          setMentions(data.mentions || []);
        } else if (response.status === 401) {
          // User not authenticated - clear mentions
          setMentions([]);
        }
      } catch (error) {
        console.error('Failed to fetch user mentions:', error);
        setMentions([]);
      } finally {
        setMentionsLoading(false);
      }
    };

    fetchMentions();
  }, [timeFilter, user]);

  if (loading && !visitStats) {
    return (
      <div className="p-3 bg-gray-50 rounded-md">
        <p className="text-xs text-gray-500 mb-1">Live Page Visits</p>
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!visitStats) {
    return (
      <div className="p-3 bg-gray-50 rounded-md">
        <p className="text-xs text-gray-500 mb-1">Live Page Visits</p>
        <p className="text-sm text-gray-400">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-500">Last 24 Hours</p>
          {isTrending && <span className="text-sm">🔥</span>}
        </div>
        <p className="text-2xl font-semibold text-gray-900">
          {visitStats.last24Hours.toLocaleString()}
        </p>
        {visitStats.previous24Hours > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            Previous 24h: {visitStats.previous24Hours.toLocaleString()}
          </p>
        )}
      </div>
      
      <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
        <p className="text-xs font-medium text-gray-500 mb-2">Total Visits</p>
        <p className="text-2xl font-semibold text-gray-900">
          {visitStats.total.toLocaleString()}
        </p>
      </div>

      {/* User Mentions Section */}
      <div className="border-t border-gray-200 pt-3 mt-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <MapPinIcon className="w-4 h-4 text-gray-500" />
            <p className="text-xs font-semibold text-gray-900">Your Mentions</p>
          </div>
          {user && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTimeFilter('24h')}
                className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                  timeFilter === '24h'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                24h
              </button>
              <button
                onClick={() => setTimeFilter('7d')}
                className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                  timeFilter === '7d'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                7d
              </button>
              <button
                onClick={() => setTimeFilter('all')}
                className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                  timeFilter === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
            </div>
          )}
        </div>

        {!user ? (
          <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
            <p className="text-xs text-gray-600 text-center">
              You need to sign in to see your mention analytics
            </p>
          </div>
        ) : mentionsLoading ? (
          <div className="p-3 bg-gray-50 rounded-md">
            <p className="text-xs text-gray-500">Loading mentions...</p>
          </div>
        ) : mentions.length === 0 ? (
          <div className="p-3 bg-gray-50 rounded-md">
            <p className="text-xs text-gray-500">
              {timeFilter === '24h' 
                ? 'No mentions in the last 24 hours'
                : timeFilter === '7d'
                ? 'No mentions in the last 7 days'
                : 'No mentions yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {mentions.map((mention) => (
              <Link
                key={mention.id}
                href={`/mention/${mention.id}`}
                className="block p-2 bg-gray-50 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-start gap-2">
                  {mention.image_url && (
                    <div className="relative w-12 h-12 rounded-md overflow-hidden bg-gray-200 flex-shrink-0">
                      <img
                        src={mention.image_url}
                        alt="Mention"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-900 line-clamp-2 mb-1">
                      {mention.description || 'No description'}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                      <div className="flex items-center gap-1">
                        <EyeIcon className="w-3 h-3" />
                        <span>{mention.view_count || 0} views</span>
                      </div>
                      <span>
                        {new Date(mention.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
