'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, ClockIcon, MapPinIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { format, addDays, subDays, isToday, isSameDay, startOfDay, differenceInDays, parse } from 'date-fns';
import { EventService } from '@/features/events/services/eventService';
import type { Event } from '@/types/event';
import Link from 'next/link';
import Image from 'next/image';
import { getStartOfDayCentral, isSameDayCentral, getDateStringCentral } from '@/lib/timezone';
import { getSourceInitials, getSourceColor } from '@/features/news/utils/newsHelpers';
import { useAuthStateSafe } from '@/features/auth';

interface NewsArticle {
  id: string;
  title: string;
  link: string;
  snippet: string;
  publishedAt: string;
  photoUrl?: string | null;
  source: {
    name: string;
  };
}

export default function CalendarPageClient() {
  // Initialize date from URL parameter if present
  const [currentDate, setCurrentDate] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const dateParam = params.get('date');
      if (dateParam) {
        try {
          const parsed = parse(dateParam, 'yyyy-MM-dd', new Date());
          if (!isNaN(parsed.getTime())) {
            return startOfDay(parsed);
          }
        } catch {
          // Invalid date, use today
        }
      }
    }
    return new Date();
  });
  
  const [events, setEvents] = useState<Event[]>([]);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [datesWithNews, setDatesWithNews] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  
  const { account } = useAuthStateSafe();
  const isAdmin = account?.role === 'admin';

  // Check if news was generated in the last 24 hours
  const isRecent = useMemo(() => {
    if (!generatedAt) return false;
    try {
      const genDate = new Date(generatedAt);
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return genDate >= twentyFourHoursAgo;
    } catch {
      return false;
    }
  }, [generatedAt]);

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
  const newsSectionRef = useRef<HTMLDivElement>(null);
  
  // Calculate the date range key for the current view
  const currentRangeKey = useMemo(() => {
    const start = subDays(currentDate, 3);
    const end = addDays(currentDate, 3);
    return `${start.toISOString()}-${end.toISOString()}`;
  }, [currentDate]);

  // Handle URL hash for scrolling to news section
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash === '#news' && newsSectionRef.current) {
        setTimeout(() => {
          newsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [currentDate]);

  // Fetch generatedAt date for admin generate button
  useEffect(() => {
    if (isAdmin) {
      const fetchGeneratedAt = async () => {
        try {
          const response = await fetch('/api/news/latest');
          const data = await response.json();
          if (data.success && data.data) {
            setGeneratedAt(data.data.generatedAt || data.data.createdAt || null);
          }
        } catch (err) {
          console.warn('Failed to fetch generatedAt:', err);
        }
      };
      fetchGeneratedAt();
    }
  }, [isAdmin]);

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

        // Fetch news for the date range
          try {
          const startDateStr = getDateStringCentral(subDays(currentDate, 3));
          const endDateStr = getDateStringCentral(addDays(currentDate, 3));
          
          const newsResponse = await fetch(`/api/news/by-date?startDate=${startDateStr}&endDate=${endDateStr}`);
            const newsData = await newsResponse.json();
            if (newsData.success && newsData.data?.articles) {
              setNewsArticles(newsData.data.articles as NewsArticle[]);
            }
          } catch (newsErr) {
            console.warn('Failed to fetch news:', newsErr);
          }

        // Fetch dates with news for highlighting (wider range)
        try {
          const todayStr = getDateStringCentral(today);
          const rangeStart = getDateStringCentral(subDays(today, 30));
          const rangeEnd = getDateStringCentral(addDays(today, 30));
          
          const datesResponse = await fetch(`/api/news/dates-with-news?startDate=${rangeStart}&endDate=${rangeEnd}`);
          const datesData = await datesResponse.json();
          if (datesData.success && datesData.data?.dates) {
            setDatesWithNews(datesData.data.dates);
          }
        } catch (datesErr) {
          console.warn('Failed to fetch dates with news:', datesErr);
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

  // Get news articles for a specific day (using published_date from API)
  const getNewsForDay = (date: Date) => {
    const dateStr = getDateStringCentral(date);
    return newsArticles.filter(article => {
      try {
        // Use published_date if available, otherwise fall back to publishedAt
        const articleDate = (article as any).published_date || article.publishedAt;
        if ((article as any).published_date) {
          return (article as any).published_date === dateStr;
        }
        return isSameDayCentral(articleDate, date);
      } catch {
        return false;
      }
    });
  };

  // Get news count for a specific day
  const getNewsCountForDay = (date: Date): number => {
    const dateStr = getDateStringCentral(date);
    return datesWithNews[dateStr] || 0;
  };

  // Handle date picker jump
  const handleDateJump = () => {
    if (!datePickerValue) return;
    
    try {
      const parsedDate = parse(datePickerValue, 'yyyy-MM-dd', new Date());
      if (!isNaN(parsedDate.getTime())) {
        setCurrentDate(startOfDay(parsedDate));
        setShowDatePicker(false);
        setDatePickerValue('');
      }
    } catch {
      // Invalid date, ignore
    }
  };

  // Handle news generation
  const handleGenerateNews = async () => {
    setGenerating(true);
    setGenerateError(null);

    try {
      const response = await fetch('/api/news/generate', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate news');
      }

      // Refresh news after generation
      const newsResponse = await fetch('/api/news/latest');
      const newsData = await newsResponse.json();
      if (newsData.success && newsData.data) {
        if (newsData.data.articles) {
          setNewsArticles(newsData.data.articles as NewsArticle[]);
        }
        setGeneratedAt(newsData.data.generatedAt || newsData.data.createdAt || null);
      }

      // Refresh dates with news
      try {
        const todayStr = getDateStringCentral(today);
        const rangeStart = getDateStringCentral(subDays(today, 30));
        const rangeEnd = getDateStringCentral(addDays(today, 30));
        
        const datesResponse = await fetch(`/api/news/dates-with-news?startDate=${rangeStart}&endDate=${rangeEnd}`);
        const datesData = await datesResponse.json();
        if (datesData.success && datesData.data?.dates) {
          const datesMap: Record<string, number> = {};
          datesData.data.dates.forEach((d: { date: string; article_count: number }) => {
            datesMap[d.date] = d.article_count;
          });
          setDatesWithNews(datesMap);
        }
      } catch (datesErr) {
        console.warn('Failed to refresh dates with news:', datesErr);
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate news');
    } finally {
      setGenerating(false);
    }
  };


  // Check if can navigate
  const canGoBack = currentDate > minDate;
  const canGoForward = currentDate < maxDate;

  return (
    <div className="space-y-3">
      {/* CALENDAR Section Header */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-gray-700" />
            <h2 className="text-sm font-semibold text-gray-900">CALENDAR</h2>
          </div>
          {/* Admin Generate News Button */}
          {isAdmin && (
            <button
              onClick={handleGenerateNews}
              disabled={generating || isRecent}
              className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? 'Generating...' : isRecent ? 'Generated Recently' : 'Generate News'}
            </button>
          )}
        </div>
        <p className="text-xs text-gray-600">
          View community events and news on a daily calendar. Navigate forward and back up to 365 days.
        </p>
        {isAdmin && generateError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-[10px]">
            <p className="text-xs text-red-600">{generateError}</p>
          </div>
        )}
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

            {/* Date Picker / Jump to Date */}
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="px-2 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors flex items-center gap-1"
                title="Jump to date"
              >
                <MagnifyingGlassIcon className="w-3 h-3" />
                <span>Jump</span>
              </button>
              
              {showDatePicker && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-2 z-10">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={datePickerValue}
                      onChange={(e) => setDatePickerValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleDateJump();
                        }
                      }}
                      className="px-2 py-1 text-xs text-gray-900 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                      placeholder="YYYY-MM-DD"
                    />
                    <button
                      onClick={handleDateJump}
                      className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    >
                      Go
                    </button>
                  </div>
                </div>
              )}
            </div>
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
              {(dayEvents.length > 0 || getNewsForDay(date).length > 0 || getNewsCountForDay(date) > 0) && (
                <div className="text-[9px] text-gray-500 mt-1 space-y-0.5">
                  {dayEvents.length > 0 && (
                    <div>{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</div>
                  )}
                  {(getNewsForDay(date).length > 0 || getNewsCountForDay(date) > 0) && (
                    <div className="flex items-center gap-1">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[8px] font-semibold">
                        {getNewsForDay(date).length || getNewsCountForDay(date)}
                      </span>
                      <span>news</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Visual indicator for days with news (if not loaded yet) */}
              {getNewsForDay(date).length === 0 && getNewsCountForDay(date) > 0 && (
                <div className="mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span className="text-[9px] text-gray-500">{getNewsCountForDay(date)} news</span>
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
        <div className="space-y-3">
          {/* Events Section */}
          {getEventsForDay(currentDate).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-3 h-3 text-gray-700" />
                <h3 className="text-xs font-semibold text-gray-900">
                  Events ({getEventsForDay(currentDate).length})
                </h3>
              </div>
              <div className="space-y-1.5">
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
              </div>
            </div>
          )}

          {/* News Section */}
          {getNewsForDay(currentDate).length > 0 && (
            <div ref={newsSectionRef} id="news" className="space-y-2">
              {getEventsForDay(currentDate).length > 0 && (
                <div className="border-t border-gray-200 pt-3" />
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-900">
                  News ({getNewsForDay(currentDate).length})
                </span>
              </div>
              <div className="space-y-1.5">
                {getNewsForDay(currentDate).map((article) => {
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

