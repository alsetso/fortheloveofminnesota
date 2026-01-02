'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { CalendarIcon, ClockIcon, MapPinIcon, UserIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { format, addDays, isToday, isSameDay, startOfDay } from 'date-fns';
import { EventService } from '@/features/events/services/eventService';
import type { Event } from '@/types/event';
import Link from 'next/link';
import { isSameDayCentral } from '@/lib/timezone';
import NewsSecondaryContent from '@/features/sidebar/components/NewsSecondaryContent';
import { useAccountData } from '@/features/account/hooks/useAccountData';
import ProfileCard from '@/features/profiles/components/ProfileCard';
import type { ProfileAccount } from '@/types/profile';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';

interface NewsArticle {
  id: string;
  title: string;
  link: string;
  snippet: string;
  publishedAt: string;
  source: {
    name: string;
  };
}

export default function MapsSidebarContent() {
  const { account, userEmail } = useAccountData(true, 'profile');
  const { openWelcome } = useAppModalContextSafe();
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);
  const [privateMaps, setPrivateMaps] = useState<Array<{ id: string; title: string }>>([]);
  const [loadingMaps, setLoadingMaps] = useState(false);

  // Convert Account to ProfileAccount format
  const profileAccount: ProfileAccount | null = useMemo(() => {
    if (!account) return null;
    
    return {
      id: account.id,
      username: account.username,
      first_name: account.first_name,
      last_name: account.last_name,
      email: userEmail,
      phone: account.phone,
      image_url: account.image_url,
      cover_image_url: account.cover_image_url,
      bio: account.bio,
      city_id: account.city_id,
      view_count: account.view_count || 0,
      traits: account.traits,
      user_id: account.user_id,
      created_at: account.created_at,
    };
  }, [account, userEmail]);

  const today = startOfDay(new Date());

  // Generate 7 days starting from today
  const sevenDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(today, i));
    }
    return days;
  }, [today]);

  // Fetch events for the next 7 days (only once on mount)
  useEffect(() => {
    if (hasFetchedRef.current) {
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const startDate = today.toISOString();
        const endDate = addDays(today, 7).toISOString();
        
        const fetchedEvents = await EventService.getEvents({
          start_date: startDate,
          end_date: endDate,
          archived: false,
          visibility: 'public',
        });

        setEvents(fetchedEvents);
        hasFetchedRef.current = true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load events');
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [today]);

  // Fetch private maps for authenticated users
  useEffect(() => {
    if (!account) {
      setPrivateMaps([]);
      return;
    }

    const fetchPrivateMaps = async () => {
      setLoadingMaps(true);
      try {
        const response = await fetch(`/api/maps?account_id=${account.id}&visibility=private`);
        const data = await response.json();
        if (data.maps) {
          setPrivateMaps(data.maps.slice(0, 5).map((m: { id: string; title: string }) => ({
            id: m.id,
            title: m.title,
          })));
        }
      } catch (err) {
        console.error('Error fetching private maps:', err);
      } finally {
        setLoadingMaps(false);
      }
    };

    fetchPrivateMaps();
  }, [account]);

  // Get events for a specific day
  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      const eventStart = startOfDay(new Date(event.start_date));
      const eventEnd = event.end_date ? startOfDay(new Date(event.end_date)) : null;
      const dayStart = startOfDay(date);
      
      return isSameDay(eventStart, dayStart) ||
             (eventEnd && isSameDay(eventEnd, dayStart)) ||
             (eventStart <= dayStart && eventEnd && eventEnd >= dayStart);
    });
  };

  // Get selected day's events
  const selectedDayEvents = getEventsForDay(selectedDate);
  const todayEvents = getEventsForDay(today);

  const formatEventTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'h:mm a');
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-3">
      {/* Profile Card */}
      {profileAccount ? (
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <ProfileCard 
            account={profileAccount} 
            isOwnProfile={false}
          />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-900">Sign In</p>
                <p className="text-[10px] text-gray-600">Sign in to view your profile</p>
              </div>
            </div>
            <button
              onClick={() => openWelcome()}
              className="w-full text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md py-1.5 px-3 transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      )}

      {/* Private Maps */}
      {account && (
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <div className="text-xs font-semibold text-gray-900 mb-2">Private Maps</div>
          {loadingMaps ? (
            <div className="text-xs text-gray-600">Loading...</div>
          ) : privateMaps.length === 0 ? (
            <div className="text-xs text-gray-500">No private maps</div>
          ) : (
            <div className="space-y-1">
              {privateMaps.map((map) => (
                <Link
                  key={map.id}
                  href={`/map/${map.id}`}
                  className="flex items-center gap-1.5 p-1.5 rounded-md hover:bg-gray-50 transition-colors group"
                >
                  <EyeSlashIcon className="w-3 h-3 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
                  <span className="text-xs text-gray-700 truncate flex-1">{map.title}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7-Day Calendar Carousel */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <div className="text-xs font-semibold text-gray-900 mb-2">Calendar</div>
        <div className="grid grid-cols-7 gap-1">
          {sevenDays.map((date) => {
            const dayEvents = getEventsForDay(date);
            const isTodayDate = isToday(date);
            const isSelected = isSameDay(date, selectedDate);
            
            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(startOfDay(date))}
                className={`bg-white border rounded-md p-1 min-h-[50px] transition-colors text-left ${
                  isSelected
                    ? 'border-gray-900 border-2 bg-gray-50'
                    : isTodayDate
                    ? 'border-red-500 border-2'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span className={`text-[9px] font-medium ${
                    isSelected ? 'text-gray-900' : isTodayDate ? 'text-red-500' : 'text-gray-600'
                  }`}>
                    {format(date, 'EEE')}
                  </span>
                  <span className={`text-xs font-semibold ${
                    isSelected ? 'text-gray-900' : isTodayDate ? 'text-red-500' : 'text-gray-700'
                  }`}>
                    {format(date, 'd')}
                  </span>
                  {(dayEvents.length > 0) && (
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
                      <span className="text-[8px] text-gray-500">{dayEvents.length}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Events Section */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-gray-900">Events</div>
        </div>

        {loading && (
          <div className="text-xs text-gray-600">Loading events...</div>
        )}

        {!loading && selectedDayEvents.length === 0 && (
          <div className="text-xs text-gray-600">No events for this day.</div>
        )}

        {!loading && selectedDayEvents.length > 0 && (
          <div className="space-y-1.5">
            {selectedDayEvents.slice(0, 5).map((event) => (
              <Link
                key={event.id}
                href={`/calendar/events/${event.id}`}
                className="block p-1.5 rounded-md hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-gray-900 line-clamp-2">
                    {event.title}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                    {event.start_date && (
                      <div className="flex items-center gap-0.5">
                        <ClockIcon className="w-3 h-3" />
                        <span>{formatEventTime(event.start_date)}</span>
                      </div>
                    )}
                    {event.location_address && (
                      <>
                        <span>•</span>
                        <div className="flex items-center gap-0.5">
                          <MapPinIcon className="w-3 h-3" />
                          <span className="truncate">{event.location_address}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            ))}
            {selectedDayEvents.length > 5 && (
              <div className="text-[10px] text-gray-500 text-center pt-1">
                +{selectedDayEvents.length - 5} more
              </div>
            )}
          </div>
        )}
      </div>

      {/* News Section */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <NewsSecondaryContent />
      </div>
    </div>
  );
}

