'use client';

import { useState, useEffect } from 'react';
import { PublicMapPinService } from '@/features/map-pins/services/publicMapPinService';
import type { MapPin } from '@/types/map-pin';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import ProfilePhoto from '@/components/ProfilePhoto';
import { Account } from '@/features/auth';

interface MentionsSecondaryContentProps {
  map?: MapboxMapInstance | null;
}

export default function MentionsSecondaryContent({ map }: MentionsSecondaryContentProps) {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPins = async () => {
      setIsLoading(true);
      try {
        const fetchedPins = await PublicMapPinService.getPins();
        setPins(fetchedPins);
      } catch (error) {
        console.error('[MentionsSecondaryContent] Error loading pins:', error);
        setPins([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadPins();

    // Listen for pin-created event to refresh list
    const handlePinCreatedEvent = async () => {
      try {
        const fetchedPins = await PublicMapPinService.getPins();
        setPins(fetchedPins);
      } catch (error) {
        console.error('[MentionsSecondaryContent] Error refreshing pins:', error);
      }
    };

    window.addEventListener('pin-created', handlePinCreatedEvent);
    return () => {
      window.removeEventListener('pin-created', handlePinCreatedEvent);
    };
  }, []);

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

  const getDisplayName = (account: MapPin['account']) => {
    if (!account) return 'Anonymous';
    return account.username || 'User';
  };

  if (isLoading) {
    return (
      <div className="text-xs text-gray-500 py-2">Loading pins...</div>
    );
  }

  if (pins.length === 0) {
    return (
      <div className="text-xs text-gray-500 py-2">No pins yet</div>
    );
  }

  return (
    <div className="space-y-1">
      {pins.map((pin) => {
        // Convert pin account to Account type for ProfilePhoto
        const accountForPhoto: Account | null = pin.account ? {
          id: pin.account.id,
          user_id: null,
          username: pin.account.username,
          first_name: null,
          last_name: null,
          image_url: pin.account.image_url,
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
          created_at: pin.created_at,
          updated_at: pin.updated_at || pin.created_at,
          last_visit: null,
        } : null;

        const handlePinClick = () => {
          if (!map) return;
          
          map.flyTo({
            center: [pin.lng, pin.lat],
            zoom: 15,
            duration: 1500,
          });

          // Dispatch event to select pin (if needed by other components)
          window.dispatchEvent(new CustomEvent('select-pin', {
            detail: { pinId: pin.id }
          }));
        };

        return (
          <div
            key={pin.id}
            onClick={handlePinClick}
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
                  {getDisplayName(pin.account)}
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-500 text-[10px] whitespace-nowrap">
                  {formatDate(pin.created_at)}
                </span>
              </div>
              {pin.description && (
                <div className="text-[10px] text-gray-500 truncate mt-0.5">
                  {pin.description}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
