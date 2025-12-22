'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MentionService } from '@/features/mentions/services/mentionService';
import type { Mention } from '@/types/mention';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import { Account } from '@/features/auth';

interface MentionsSecondaryContentProps {
  map?: MapboxMapInstance | null;
}

export default function MentionsSecondaryContent({ map }: MentionsSecondaryContentProps) {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get current year from URL
  const currentYearParam = searchParams.get('year');
  const currentYear = currentYearParam ? parseInt(currentYearParam, 10) : null;

  // Generate 100 years of options (current year back to 100 years ago)
  const currentYearValue = new Date().getFullYear();
  const years = Array.from({ length: 101 }, (_, i) => currentYearValue - i);

  useEffect(() => {
    const loadMentions = async () => {
      setIsLoading(true);
      try {
        const fetchedMentions = await MentionService.getMentions(
          currentYear ? { year: currentYear } : undefined
        );
        setMentions(fetchedMentions);
      } catch (error) {
        console.error('[MentionsSecondaryContent] Error loading mentions:', error);
        setMentions([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadMentions();

    // Listen for mention-created event to refresh list
    const handleMentionCreatedEvent = async () => {
      try {
        const fetchedMentions = await MentionService.getMentions(
          currentYear ? { year: currentYear } : undefined
        );
        setMentions(fetchedMentions);
      } catch (error) {
        console.error('[MentionsSecondaryContent] Error refreshing mentions:', error);
      }
    };

    window.addEventListener('mention-created', handleMentionCreatedEvent);
    return () => {
      window.removeEventListener('mention-created', handleMentionCreatedEvent);
    };
  }, [currentYear]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks}w ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months}mo ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
  };

  const getDisplayName = (account: Mention['account']) => {
    if (!account) return 'Anonymous';
    return account.username || 'User';
  };

  const handleYearChange = (year: string) => {
    const url = new URL(window.location.href);
    
    if (year === '') {
      // Clear the year filter
      url.searchParams.delete('year');
    } else {
      // Set year filter
      url.searchParams.set('year', year);
    }
    
    router.push(url.pathname + url.search);
    
    // Trigger mentions reload
    window.dispatchEvent(new CustomEvent('mention-created'));
  };

  if (isLoading) {
    return (
      <div className="text-xs text-gray-500 py-2">Loading mentions...</div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Year Filter Dropdown */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Filter by Year
        </label>
        <select
          value={currentYear?.toString() || ''}
          onChange={(e) => handleYearChange(e.target.value)}
          className="w-full px-2 py-1.5 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-white"
        >
          <option value="">All Years</option>
          {years.map((year) => (
            <option key={year} value={year.toString()}>
              {year}
            </option>
          ))}
        </select>
        {currentYear && (
          <p className="text-[10px] text-gray-500 mt-0.5">
            Showing mentions from {currentYear}
          </p>
        )}
      </div>

      {mentions.length === 0 ? (
        <div className="text-xs text-gray-500 py-2">
          {currentYear ? `No mentions from ${currentYear}` : 'No mentions yet'}
        </div>
      ) : (
        <div className="space-y-1">
          {mentions.map((mention) => {
        // Convert mention account to Account type for ProfilePhoto
        const accountForPhoto: Account | null = mention.account ? {
          id: mention.account.id,
          user_id: null,
          username: mention.account.username,
          first_name: null,
          last_name: null,
          image_url: mention.account.image_url,
          email: null,
          phone: null,
          cover_image_url: null,
          bio: null,
          city_id: null,
          view_count: 0,
          role: 'general',
          traits: null,
          stripe_customer_id: null,
          plan: 'hobby',
          billing_mode: 'standard',
          subscription_status: null,
          stripe_subscription_id: null,
          onboarded: false,
          created_at: mention.created_at,
          updated_at: mention.updated_at || mention.created_at,
          last_visit: null,
        } : null;

        const handleMentionClick = () => {
          if (!map) return;
          
          map.flyTo({
            center: [mention.lng, mention.lat],
            zoom: 15,
            duration: 1500,
          });

          // Dispatch event to select mention (if needed by other components)
          window.dispatchEvent(new CustomEvent('select-mention-by-id', {
            detail: { mentionId: mention.id }
          }));
        };

        return (
          <div
            key={mention.id}
            onClick={handleMentionClick}
            className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-gray-50 transition-colors cursor-pointer"
          >
            {accountForPhoto && (
              <div className="flex-shrink-0">
                <ProfilePhoto account={accountForPhoto} size="xs" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-gray-900 truncate">
                  {getDisplayName(mention.account)}
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-500 text-[10px] whitespace-nowrap">
                  {formatDate(mention.created_at)}
                </span>
              </div>
              {mention.description && (
                <div className="text-[10px] text-gray-500 truncate mt-0.5">
                  {mention.description}
                </div>
              )}
            </div>
          </div>
          );
          })}
        </div>
      )}
    </div>
  );
}
