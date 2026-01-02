'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { format, addDays, subDays, isToday, isSameDay, startOfDay } from 'date-fns';
import { EventService } from '@/features/events/services/eventService';
import type { Event } from '@/types/event';
import Link from 'next/link';
import Image from 'next/image';
import { getDateStringCentral, isSameDayCentral } from '@/lib/timezone';
import { getSourceInitials, getSourceColor } from '@/features/news/utils/newsHelpers';
import { useAuthStateSafe } from '@/features/auth';

interface NewsArticle {
  id: string;
  article_id: string;
  title: string;
  link: string;
  snippet: string;
  photoUrl: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
  source: {
    name: string;
    url: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    publicationId: string;
  };
}

export default function HomepageNewsCalendarColumn() {
  const { account } = useAuthStateSafe();
  const isAdmin = account?.role === 'admin';

  const [currentDate, setCurrentDate] = useState(startOfDay(new Date()));
  const [events, setEvents] = useState<Event[]>([]);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newsDisplayCount, setNewsDisplayCount] = useState<{ [dateKey: string]: number }>({});
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const hasFetchedRef = useRef(false);

  const today = startOfDay(new Date());

  // Generate 7 days centered on currentDate (3 before, current, 3 after)
  const sevenDays = useMemo(() => {
    const days = [];
    const start = subDays(currentDate, 3);
    for (let i = 0; i < 7; i++) {
      days.push(addDays(start, i));
    }
    return days;
  }, [currentDate]);

  // Navigation functions
  const goToPreviousDay = () => {
    setCurrentDate(prev => subDays(prev, 1));
  };

  const goToNextDay = () => {
    setCurrentDate(prev => addDays(prev, 1));
  };

  const goToToday = () => {
    setCurrentDate(startOfDay(new Date()));
  };

  // Fetch events and news (only once on mount)
  useEffect(() => {
    // Skip if already fetched
    if (hasFetchedRef.current) {
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch events for a wider range
        const startDate = subDays(today, 30).toISOString();
        const endDate = addDays(today, 30).toISOString();
        
        const fetchedEvents = await EventService.getEvents({
          start_date: startDate,
          end_date: endDate,
          archived: false,
          visibility: 'public',
        });

        setEvents(fetchedEvents);

        // Fetch news (only once on initial load) - from news.generated table
        try {
          const newsResponse = await fetch('/api/news/latest');
          if (!newsResponse.ok) {
            throw new Error(`Failed to fetch news: ${newsResponse.status}`);
          }
          const newsData = await newsResponse.json();
          if (newsData.success && newsData.data) {
            // Articles are already in the correct format from news.generated
            if (newsData.data.articles) {
            setNewsArticles(newsData.data.articles as NewsArticle[]);
            }
            // Store generatedAt timestamp
            setGeneratedAt(newsData.data.generatedAt || newsData.data.createdAt || null);
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
  }, []); // Empty deps - only fetch once

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

  // Get news articles for a specific day (using published_date if available, otherwise publishedAt)
  const getNewsForDay = (date: Date) => {
    const dateStr = getDateStringCentral(date);
    return newsArticles.filter(article => {
      try {
        // Use published_date if available (from news.generated), otherwise fall back to publishedAt
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

  // Get selected day's events and news
  const selectedDayEvents = getEventsForDay(currentDate);
  const allSelectedDayNews = getNewsForDay(currentDate);
  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const displayedCount = newsDisplayCount[dateKey] || 5;
  const selectedDayNews = allSelectedDayNews.slice(0, displayedCount);
  const hasMoreNews = allSelectedDayNews.length > displayedCount;

  const handleLoadMoreNews = () => {
    setNewsDisplayCount(prev => ({
      ...prev,
      [dateKey]: displayedCount + 5,
    }));
  };

  // Check if news was generated in the last 24 hours
  const isRecent = generatedAt ? (() => {
    try {
      const genDate = new Date(generatedAt);
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return genDate >= twentyFourHoursAgo;
    } catch {
      return false;
    }
  })() : false;

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/news/generate', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate news');
      }

      // Refresh the news list after generation
      const newsResponse = await fetch('/api/news/latest');
      if (newsResponse.ok) {
        const newsData = await newsResponse.json();
        if (newsData.success && newsData.data) {
          if (newsData.data.articles) {
            setNewsArticles(newsData.data.articles as NewsArticle[]);
          }
          setGeneratedAt(newsData.data.generatedAt || newsData.data.createdAt || null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate news');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Calendar Section */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-gray-700" />
          <h2 className="text-sm font-semibold text-gray-900">CALENDAR</h2>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousDay}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
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
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
              title="Next day"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* 7-Day Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {sevenDays.map((date) => {
            const dayEvents = getEventsForDay(date);
            const dayNews = getNewsForDay(date);
            const isTodayDate = isToday(date);
            const isSelected = isSameDay(date, currentDate);
            
            return (
              <button
                key={date.toISOString()}
                onClick={() => setCurrentDate(startOfDay(date))}
                className={`bg-white border rounded-md p-[10px] min-h-[60px] transition-colors text-left ${
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
                    <span className={`text-[8px] mt-1 ${
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

        {/* Selected Day Info */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">
              {format(currentDate, 'MMM d')}
            </h3>
            {isToday(currentDate) && (
              <span className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                Today
              </span>
            )}
          </div>
          {(selectedDayEvents.length > 0 || allSelectedDayNews.length > 0) && (
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500">
              {selectedDayEvents.length > 0 && (
                <span>{selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''}</span>
              )}
              {selectedDayEvents.length > 0 && allSelectedDayNews.length > 0 && <span>•</span>}
              {allSelectedDayNews.length > 0 && (
                <span>{allSelectedDayNews.length} news</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* News Section */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">NEWS</span>
          <div className="ml-auto flex items-center gap-2">
            {isAdmin && !isRecent && (
              <button
                onClick={handleGenerate}
                disabled={generating || loading}
                className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
                {generating ? 'Generating...' : 'Generate new'}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-4">
            <p className="text-xs text-gray-600">Loading...</p>
          </div>
        ) : error ? (
          <div className="py-4">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        ) : allSelectedDayNews.length > 0 ? (
          <div className="space-y-1.5">
            {selectedDayNews.map((article) => {
              const sourceInitials = getSourceInitials(article.source.name);
              const sourceColor = getSourceColor(article.source.name);
              
              return (
                <Link
                  key={article.id}
                  href={`/news/${article.id}`}
                  className="flex items-start gap-2 p-2 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                >
                  {/* Photo Image */}
                  {article.photoUrl ? (
                    <div className="relative flex-shrink-0 w-12 h-12 rounded border border-gray-200 overflow-hidden bg-gray-100">
                      <Image
                        src={article.photoUrl}
                        alt={article.title}
                        fill
                        className="object-cover"
                        sizes="48px"
                        unoptimized
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className={`flex-shrink-0 w-12 h-12 rounded border border-gray-200 ${sourceColor.bg} flex items-center justify-center`}>
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
                      <span className="truncate">{article.source.name}</span>
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
            
            {/* Load More Button */}
            {hasMoreNews && (
              <button
                onClick={handleLoadMoreNews}
                className="w-full px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded transition-colors border border-gray-200"
              >
                Load More ({allSelectedDayNews.length - displayedCount} remaining)
              </button>
            )}
          </div>
        ) : (
          <div className="py-4">
            <p className="text-xs text-gray-600">
              No news for {format(currentDate, 'MMMM d, yyyy')}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

