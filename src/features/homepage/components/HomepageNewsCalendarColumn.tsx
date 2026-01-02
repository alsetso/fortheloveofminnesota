'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { format, addDays, subDays, isToday, isSameDay, startOfDay } from 'date-fns';
import { EventService } from '@/features/events/services/eventService';
import type { Event } from '@/types/event';

export default function HomepageNewsCalendarColumn() {
  const [currentDate, setCurrentDate] = useState(startOfDay(new Date()));
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  // Get selected day's events
  const selectedDayEvents = getEventsForDay(currentDate);

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
                  {dayEvents.length > 0 && (
                    <span className={`text-[8px] mt-1 ${
                      isSelected ? 'text-gray-700' : isTodayDate ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {dayEvents.length}
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
          {selectedDayEvents.length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500">
              <span>{selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

