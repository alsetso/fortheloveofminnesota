'use client';

import { useState, useEffect } from 'react';
import { MapPinIcon, ChevronDownIcon, ChevronUpIcon, EyeIcon } from '@heroicons/react/24/outline';
import { PublicMapPinService } from '@/features/_archive/map-pins/services/publicMapPinService';
import { AccountService } from '@/features/auth/services/memberService';
import { supabase } from '@/lib/supabase';
import type { MapPin } from '@/types/map-pin';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface UserPinsListProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
}

export default function UserPinsList({ map, mapLoaded }: UserPinsListProps) {
  const [userPins, setUserPins] = useState<MapPin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);

  // Get current user's account_id
  useEffect(() => {
    const loadAccount = async () => {
      try {
        const account = await AccountService.getCurrentAccount();
        if (account) {
          setAccountId(account.id);
        }
      } catch (error) {
        console.error('Error loading account:', error);
      }
    };
    loadAccount();
  }, []);

  // Fetch user's pins and subscribe to updates
  useEffect(() => {
    if (!accountId) {
      setUserPins([]);
      return;
    }

    let mounted = true;

    const loadUserPins = async () => {
      setIsLoading(true);
      try {
        // Fetch pins with view_count directly from database
        const { data: pinsData, error } = await supabase
          .from('pins')
          .select('*')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        if (mounted) {
          // Ensure no duplicate pins by id
          const pinsMap = new Map<string, MapPin>();
          (pinsData || []).forEach((pin) => {
            if (pin.id && !pinsMap.has(pin.id)) {
              pinsMap.set(pin.id, pin as MapPin);
            }
          });
          setUserPins(Array.from(pinsMap.values()));
        }
      } catch (error) {
        console.error('Error loading user pins:', error);
        if (mounted) {
          setUserPins([]);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadUserPins();

    // Subscribe to real-time updates (fires on INSERT, UPDATE, DELETE)
    const subscription = PublicMapPinService.subscribeToPins((payload) => {
      if (!mounted) return;
      
      // Only reload if the pin belongs to this user
      const isUserPin = 
        (payload.new && payload.new.account_id === accountId) ||
        (payload.old && payload.old.account_id === accountId);
      
      if (isUserPin) {
        // For UPDATE events, try to update just view_count if it's the only change
        if (payload.eventType === 'UPDATE' && payload.new && payload.old) {
          const viewCountChanged = payload.new.view_count !== payload.old.view_count;
          if (viewCountChanged) {
            // Update just the view_count for this pin
            setUserPins(prev => prev.map(pin => 
              pin.id === payload.new!.id 
                ? { ...pin, view_count: payload.new!.view_count || 0 }
                : pin
            ));
            return; // Skip full reload
          }
        }
        // For INSERT/DELETE or other UPDATEs, reload full list
        loadUserPins();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [accountId]);

  // Periodic refresh of view counts when list is open (every 30 seconds)
  useEffect(() => {
    if (!accountId || isCollapsed) return;

    const refreshViewCounts = async () => {
      try {
        const { data: pinsData } = await supabase
          .from('pins')
          .select('id, view_count')
          .eq('account_id', accountId);
        
        if (pinsData) {
          setUserPins(prev => {
            const updatedMap = new Map(prev.map(pin => [pin.id, pin]));
            pinsData.forEach(updated => {
              if (updated.id && updatedMap.has(updated.id)) {
                updatedMap.set(updated.id, {
                  ...updatedMap.get(updated.id)!,
                  view_count: updated.view_count || 0,
                });
              }
            });
            return Array.from(updatedMap.values());
          });
        }
      } catch (error) {
        // Silently fail - don't break the UI
      }
    };

    // Refresh immediately when list opens
    refreshViewCounts();

    // Then refresh every 30 seconds
    const interval = setInterval(refreshViewCounts, 30000);

    return () => clearInterval(interval);
  }, [accountId, isCollapsed]);

  const handlePinClick = (pin: MapPin) => {
    if (!map || !mapLoaded) return;
    
    const mapboxMap = map as any;
    mapboxMap.flyTo({
      center: [pin.lng, pin.lat],
      zoom: 15,
      duration: 1000,
    });
  };

  if (!accountId || userPins.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-4 left-4 z-50">
      <div className="bg-white border border-gray-200 rounded-md shadow-lg">
        {/* Header */}
        <div 
          className="flex items-center justify-between p-[10px] border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center gap-1.5">
            <MapPinIcon className="w-3.5 h-3.5 text-gray-600" />
            <span className="text-xs font-semibold text-gray-900">
              My Pins ({userPins.length})
            </span>
          </div>
          {isCollapsed ? (
            <ChevronDownIcon className="w-3.5 h-3.5 text-gray-500" />
          ) : (
            <ChevronUpIcon className="w-3.5 h-3.5 text-gray-500" />
          )}
        </div>

        {/* Pins List */}
        {!isCollapsed && (
          <div className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="p-[10px] text-xs text-gray-500">Loading...</div>
            ) : userPins.length === 0 ? (
              <div className="p-[10px] text-xs text-gray-500">No pins yet</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {userPins.map((pin) => (
                  <button
                    key={pin.id}
                    onClick={() => handlePinClick(pin)}
                    className="w-full text-left p-[10px] hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-0.5">
                        <MapPinIcon className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-medium text-gray-900 truncate">
                            {pin.description || 'Pin'}
                          </div>
                          {typeof pin.view_count === 'number' && pin.view_count > 0 && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <EyeIcon className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                {pin.view_count}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {new Date(pin.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
