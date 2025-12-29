'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { format, addDays, subDays, isToday, isSameDay, startOfDay, differenceInDays } from 'date-fns';
import { EventService } from '@/features/events/services/eventService';
import type { Event } from '@/types/event';
import Link from 'next/link';
import { getStartOfDayCentral, isSameDayCentral } from '@/lib/timezone';

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

export default function CalendarPageClient() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate date range: 365 days from today
  const today = startOfDay(new Date());
  const maxDate = addDays(today, 365);
  const minDate = subDays(today, 365);

  // Generate daily blocks (7 days visible at a time, centered on currentDate)
  const dailyBlocks = useMemo(() => {
    const blocks = [];
    const start = subDays(currentDate, 3); // 3 days before
    const end = addDays(currentDate, 3); // 3 days after
    
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      blocks.push(date);
    }
    
    return blocks;
  }, [currentDate]);

  // Track which date ranges have been fetched using a ref to avoid re-renders
  const fetchedRangesRef = useRef<Set<string>>(new Set());
  
  // Calculate the date range key for the current view
  const currentRangeKey = useMemo(() => {
    const start = subDays(currentDate, 3);
    const end = addDays(currentDate, 3);
    return `${start.toISOString()}-${end.toISOString()}`;
  }, [currentDate]);

  // Fetch events and news for the visible date range (only once per range)
  useEffect(() => {
    // Skip if we've already fetched this range
    if (fetchedRangesRef.current.has(currentRangeKey)) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const startDate = subDays(currentDate, 3).toISOString();
        const endDate = addDays(currentDate, 3).toISOString();
        
        // Fetch events
        const fetchedEvents = await EventService.getEvents({
          start_date: startDate,
          end_date: endDate,
          archived: false,
        });

        // Merge with existing events (avoid duplicates)
        setEvents(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          const newEvents = fetchedEvents.filter(e => !existingIds.has(e.id));
          return [...prev, ...newEvents];
        });

        // Fetch news (only once on initial load)
        if (newsArticles.length === 0) {
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
        }
        
        // Mark this range as fetched
        fetchedRangesRef.current.add(currentRangeKey);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentDate, currentRangeKey]);

  // Navigation
  const goToPreviousDay = () => {
    const newDate = subDays(currentDate, 1);
    if (newDate >= minDate) {
      setCurrentDate(newDate);
    }
  };

  const goToNextDay = () => {
    const newDate = addDays(currentDate, 1);
    if (newDate <= maxDate) {
      setCurrentDate(newDate);
    }
  };

  const goToToday = () => {
    setCurrentDate(startOfDay(today));
  };

  // Get events for a specific day
  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      const eventStart = startOfDay(new Date(event.start_date));
      const eventEnd = event.end_date ? startOfDay(new Date(event.end_date)) : null;
      const dayStart = startOfDay(date);
      
      // Event is on this day if:
      // - Starts on this day, OR
      // - Ends on this day, OR
      // - Spans this day (starts before and ends after)
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

  // Helper functions for source display
  const getSourceInitials = (sourceName: string): string => {
    if (!sourceName) return 'NEW';
    const cleaned = sourceName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return cleaned.slice(0, 3) || 'NEW';
  };

  const getSourceColor = (sourceName: string): { bg: string; text: string } => {
    const softColors = [
      { bg: 'bg-blue-100', text: 'text-blue-700' },
      { bg: 'bg-green-100', text: 'text-green-700' },
      { bg: 'bg-purple-100', text: 'text-purple-700' },
      { bg: 'bg-pink-100', text: 'text-pink-700' },
      { bg: 'bg-yellow-100', text: 'text-yellow-700' },
      { bg: 'bg-indigo-100', text: 'text-indigo-700' },
      { bg: 'bg-teal-100', text: 'text-teal-700' },
      { bg: 'bg-orange-100', text: 'text-orange-700' },
      { bg: 'bg-cyan-100', text: 'text-cyan-700' },
      { bg: 'bg-rose-100', text: 'text-rose-700' },
      { bg: 'bg-amber-100', text: 'text-amber-700' },
      { bg: 'bg-violet-100', text: 'text-violet-700' },
    ];

    let hash = 0;
    for (let i = 0; i < sourceName.length; i++) {
      hash = sourceName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % softColors.length;
    return softColors[index];
  };

  // Check if can navigate
  const canGoBack = currentDate > minDate;
  const canGoForward = currentDate < maxDate;

  return (
    <div className="space-y-3">
      {/* CALENDAR Section Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-gray-700" />
          <h2 className="text-sm font-semibold text-gray-900">CALENDAR</h2>
        </div>
        <p className="text-xs text-gray-600">
          View community events on a daily calendar. Navigate forward and back up to 365 days.
        </p>
      </div>

      {/* Navigation Controls */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousDay}
              disabled={!canGoBack}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous day"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
            >
              Today
            </button>
            
            <button
              onClick={goToNextDay}
              disabled={!canGoForward}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next day"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">
              {format(currentDate, 'EEEE, MMMM d, yyyy')}
            </h3>
            {isToday(currentDate) && (
              <span className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                Today
              </span>
            )}
          </div>

          <Link
            href="/calendar/events"
            className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors flex items-center gap-1.5"
          >
            <CalendarIcon className="w-3 h-3" />
            <span>All Events</span>
          </Link>
        </div>
      </div>

      {/* Daily Blocks Grid */}
      <div className="grid grid-cols-7 gap-2">
        {dailyBlocks.map((date, index) => {
          const dayEvents = getEventsForDay(date);
          const isCurrentDay = isSameDay(date, currentDate);
          const isTodayDate = isToday(date);
          const daysFromToday = differenceInDays(date, today);
          
          return (
            <button
              key={date.toISOString()}
              onClick={() => setCurrentDate(startOfDay(date))}
              className={`bg-white border rounded-md p-[10px] min-h-[80px] transition-colors text-left ${
                isCurrentDay
                  ? 'border-gray-900 border-2 bg-gray-50'
                  : isTodayDate
                  ? 'border-red-500 border-2'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex flex-col">
                  <span className={`text-[10px] font-medium ${
                    isCurrentDay ? 'text-gray-900' : isTodayDate ? 'text-red-500' : 'text-gray-600'
                  }`}>
                    {format(date, 'EEE')}
                  </span>
                  <span className={`text-xs font-semibold ${
                    isCurrentDay ? 'text-gray-900' : isTodayDate ? 'text-red-500' : 'text-gray-700'
                  }`}>
                    {format(date, 'd')}
                  </span>
                </div>
                {daysFromToday !== 0 && (
                  <span className={`text-[9px] ${
                    daysFromToday > 0 ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    {Math.abs(daysFromToday)}d
                  </span>
                )}
              </div>

              {/* Event and News Count */}
              {(dayEvents.length > 0 || getNewsForDay(date).length > 0) && (
                <div className="text-[9px] text-gray-500 mt-1">
                  {dayEvents.length > 0 && (
                    <span>{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</span>
                  )}
                  {dayEvents.length > 0 && getNewsForDay(date).length > 0 && <span> • </span>}
                  {getNewsForDay(date).length > 0 && (
                    <span>{getNewsForDay(date).length} news</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Current Day Events and News Cards */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <p className="text-xs text-gray-600">Loading...</p>
        </div>
      ) : error ? (
        <div className="bg-white border border-red-200 rounded-md p-[10px]">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Events */}
          {getEventsForDay(currentDate).length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-gray-900">
                Events ({getEventsForDay(currentDate).length})
              </h3>
              {getEventsForDay(currentDate).map((event) => (
                <Link
                  key={event.id}
                  href={`/calendar/events#event-${event.id}`}
                  className="block bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 transition-colors"
                >
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-gray-900 line-clamp-2">{event.title}</h4>
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
            </>
          )}

          {/* News */}
          {getNewsForDay(currentDate).length > 0 && (
            <>
              {getEventsForDay(currentDate).length > 0 && <div className="pt-2" />}
              <h3 className="text-xs font-semibold text-gray-900">
                News ({getNewsForDay(currentDate).length})
              </h3>
              <div className="space-y-1.5">
                {getNewsForDay(currentDate).map((article) => {
                  const sourceInitials = getSourceInitials(article.source.name);
                  const sourceColor = getSourceColor(article.source.name);
                  
                  return (
                    <a
                      key={article.id}
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 transition-colors"
                    >
                      {/* Source Circle */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full ${sourceColor.bg} flex items-center justify-center border border-gray-200`}>
                        <span className={`text-[9px] font-semibold ${sourceColor.text} leading-none`}>
                          {sourceInitials}
                        </span>
                      </div>
                      
                      {/* Title */}
                      <span className="flex-1 text-xs font-medium text-gray-900 line-clamp-1 truncate">
                        {article.title}
                      </span>
                      
                      {/* Time */}
                      <div className="flex items-center gap-1 flex-shrink-0 text-[10px] text-gray-500">
                        <ClockIcon className="w-3 h-3" />
                        <span>{format(new Date(article.publishedAt), 'h:mm a')}</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            </>
          )}

          {/* Empty State */}
          {getEventsForDay(currentDate).length === 0 && getNewsForDay(currentDate).length === 0 && (
            <div className="bg-white border border-gray-200 rounded-md p-[10px]">
              <p className="text-xs text-gray-600">
                No events or news for {format(currentDate, 'MMMM d, yyyy')}.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

