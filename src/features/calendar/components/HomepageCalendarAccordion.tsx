'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDownIcon, CalendarIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { format, addDays, isToday, isSameDay, startOfDay } from 'date-fns';
import { EventService } from '@/features/events/services/eventService';
import type { Event } from '@/types/event';
import Link from 'next/link';
import Image from 'next/image';
import { isSameDayCentral } from '@/lib/timezone';
import { getSourceInitials, getSourceColor } from '@/features/news/utils/newsHelpers';

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

export default function HomepageCalendarAccordion() {
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [events, setEvents] = useState<Event[]>([]);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const today = startOfDay(new Date());

  // Generate 7 days starting from today
  const sevenDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(today, i));
    }
    return days;
  }, [today]);

  // Fetch events and news for the next 7 days (only once on mount)
  useEffect(() => {
    // Skip if already fetched
    if (hasFetchedRef.current) {
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const startDate = today.toISOString();
        const endDate = addDays(today, 7).toISOString();
        
        // Fetch events
        const fetchedEvents = await EventService.getEvents({
          start_date: startDate,
          end_date: endDate,
          archived: false,
          visibility: 'public',
        });

        setEvents(fetchedEvents);

        // Fetch news (only once on initial load)
        try {
          const newsResponse = await fetch('/api/news/latest');
          const newsData = await newsResponse.json();
          if (newsData.success && newsData.data?.articles) {
            setNewsArticles(newsData.data.articles as NewsArticle[]);
          }
        } catch (newsErr) {
          // Non-blocking: if news fails, continue without it
          console.warn('Failed to fetch news:', newsErr);
        }

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

  // Get news articles for a specific day (using Central Time)
  const getNewsForDay = (date: Date) => {
    return newsArticles.filter(article => {
      try {
        // Compare dates in Central Time to align with Minnesota timezone
        return isSameDayCentral(article.publishedAt, date);
      } catch {
        return false;
      }
    });
  };

  // Get selected day's events and news
  const selectedDayEvents = getEventsForDay(selectedDate);
  const selectedDayNews = getNewsForDay(selectedDate);
  const todayEvents = getEventsForDay(today);

  return (
    <section className="space-y-3">
      {/* CALENDAR Section Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-gray-700" />
        <h2 className="text-sm font-semibold text-gray-900">CALENDAR</h2>
        </div>
        <p className="text-xs text-gray-600">
          View community events and news on a daily calendar. Navigate forward and back up to 365 days.
        </p>
      </div>

      {/* Selected Day Display */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-900">
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </span>
          {isToday(selectedDate) && (
            <span className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
              Today
            </span>
          )}
          {(selectedDayEvents.length > 0 || selectedDayNews.length > 0) && (
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500">
              {selectedDayEvents.length > 0 && (
                <span>{selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''}</span>
              )}
              {selectedDayEvents.length > 0 && selectedDayNews.length > 0 && <span>•</span>}
              {selectedDayNews.length > 0 && (
                <span>{selectedDayNews.length} news</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 7-Day Calendar Grid */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <div className="grid grid-cols-7 gap-1.5 mb-3">
          {sevenDays.map((date) => {
            const dayEvents = getEventsForDay(date);
            const dayNews = getNewsForDay(date);
            const isTodayDate = isToday(date);
            const isSelected = isSameDay(date, selectedDate);
            
            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(startOfDay(date))}
                className={`bg-white border rounded-md p-1.5 min-h-[60px] transition-colors text-left ${
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
                    isSelected ? 'text-gray-900' : isTodayDate ? 'text-red-500' : 'text-gray-900'
                  }`}>
                    {format(date, 'd')}
                  </span>
                  {(dayEvents.length > 0 || dayNews.length > 0) && (
                    <span className={`text-[8px] ${
                      isSelected ? 'text-gray-700' : isTodayDate ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {dayEvents.length > 0 && dayNews.length > 0 
                        ? `${dayEvents.length}/${dayNews.length}`
                        : dayEvents.length > 0 
                        ? dayEvents.length 
                        : dayNews.length}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <Link
          href="/calendar"
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-900 hover:underline transition-colors"
        >
          <span>View Full Calendar</span>
          <ChevronDownIcon className="w-3 h-3 rotate-[-90deg]" />
        </Link>
      </div>

      {/* Selected Day's Events and News */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <p className="text-xs text-gray-600">Loading...</p>
        </div>
      ) : error ? (
        <div className="bg-white border border-red-200 rounded-md p-[10px]">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Events Section */}
          {selectedDayEvents.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-3 h-3 text-gray-700" />
                <h3 className="text-xs font-semibold text-gray-900">
                  Events ({selectedDayEvents.length})
                </h3>
              </div>
              <div className="space-y-1.5">
                {selectedDayEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/calendar/events#event-${event.id}`}
                    className="block bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-semibold text-gray-900 line-clamp-2">
                        {event.title}
                      </h4>
                      {event.description && (
                        <p className="text-[10px] text-gray-600 line-clamp-2">
                          {event.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        <div className="flex items-center gap-0.5">
                          <ClockIcon className="w-3 h-3" />
                          <span>
                            {format(new Date(event.start_date), 'h:mm a')}
                            {event.end_date && ` - ${format(new Date(event.end_date), 'h:mm a')}`}
                          </span>
                        </div>
                        {event.location_name && (
                          <>
                            <span>•</span>
                            <div className="flex items-center gap-0.5">
                              <MapPinIcon className="w-3 h-3" />
                              <span className="truncate">{event.location_name}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* News Section */}
          {selectedDayNews.length > 0 && (
            <div className="space-y-2">
              {selectedDayEvents.length > 0 && (
                <div className="border-t border-gray-200 pt-3" />
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-900">
                  News ({selectedDayNews.length})
                </span>
              </div>
              <div className="space-y-1.5">
                {selectedDayNews.map((article) => {
                  const sourceInitials = getSourceInitials(article.source.name);
                  const sourceColor = getSourceColor(article.source.name);
                  
                  return (
                      <Link
                      key={article.id}
                        href={`/news/${article.id}`}
                      className="flex items-start gap-2 bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 transition-colors"
                    >
                      {/* Photo Image */}
                      {article.photoUrl ? (
                        <div className="relative flex-shrink-0 w-16 h-16 rounded border border-gray-200 overflow-hidden bg-gray-100">
                          <Image
                            src={article.photoUrl}
                            alt={article.title}
                            fill
                            className="object-cover"
                            sizes="64px"
                            unoptimized
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className={`flex-shrink-0 w-16 h-16 rounded border border-gray-200 ${sourceColor.bg} flex items-center justify-center`}>
                          <span className={`text-[10px] font-semibold ${sourceColor.text} leading-none`}>
                          {sourceInitials}
                        </span>
                      </div>
                      )}
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <h4 className="text-xs font-semibold text-gray-900 line-clamp-2">
                          {article.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                          <span>{article.source.name}</span>
                          <span>•</span>
                          <div className="flex items-center gap-0.5">
                            <ClockIcon className="w-3 h-3" />
                            <span>{format(new Date(article.publishedAt), 'h:mm a')}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {selectedDayEvents.length === 0 && selectedDayNews.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-md p-[10px]">
              <p className="text-xs text-gray-600">
                No events or news for {format(selectedDate, 'MMMM d, yyyy')}.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
