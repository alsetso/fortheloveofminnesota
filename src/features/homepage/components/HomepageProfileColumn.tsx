'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BuildingOfficeIcon, ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { format, addDays, subDays, isToday, isSameDay, startOfDay } from 'date-fns';
import { useAccountData } from '@/features/account/hooks/useAccountData';
import type { ProfileAccount } from '@/types/profile';
import { getDisplayName } from '@/types/profile';

export default function HomepageProfileColumn() {
  const { account, userEmail } = useAccountData(true, 'profile');
  const [currentDate, setCurrentDate] = useState(startOfDay(new Date()));

  const today = startOfDay(new Date());

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

  // Get events for a specific day (empty for now)
  const getEventsForDay = (date: Date) => {
    return [];
  };

  if (!profileAccount) {
    return (
      <div className="bg-gray-100 border border-gray-200 rounded-md p-2">
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Sign in to view your profile</p>
        </div>
      </div>
    );
  }

  const displayName = getDisplayName(profileAccount);
  const profileLink = profileAccount.username 
    ? `/profile/${profileAccount.username}` 
    : null;

  return (
    <div className="space-y-2">
      {/* Profile Card */}
      <div className="bg-gray-100 border border-gray-200 rounded-md p-2 space-y-2">
        {/* Profile Image and Name */}
        <div className="flex items-center gap-2">
          {profileAccount.image_url ? (
            <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
              <Image
                src={profileAccount.image_url}
                alt={displayName}
                fill
                className="object-cover"
                sizes="40px"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 border border-gray-200">
              <span className="text-xs font-medium text-gray-500">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">
              {displayName}
            </p>
            {profileAccount.username && (
              <p className="text-[10px] text-gray-500 truncate">
                @{profileAccount.username}
              </p>
            )}
          </div>
        </div>

        {/* Bio */}
        {profileAccount.bio && (
          <p className="text-xs text-gray-600 line-clamp-2">
            {profileAccount.bio}
          </p>
        )}

        {/* View Profile Link */}
        {profileLink && (
          <Link
            href={profileLink}
            className="block w-full px-2 py-1.5 text-xs font-medium text-center text-gray-700 bg-white hover:bg-gray-50 rounded border border-gray-200 transition-colors"
          >
            View Profile
          </Link>
        )}
      </div>

      {/* 2026 Elections Section */}
      <div className="bg-white border border-gray-200 rounded-md p-2 space-y-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <BuildingOfficeIcon className="w-3 h-3 text-gray-700" />
            <h3 className="text-xs font-semibold text-gray-900">2026 Elections</h3>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            2026 is an important year for Minnesota government elections. Stay informed about candidates, voting, and how government works.
          </p>
        </div>
        <Link
          href="/gov"
          className="block w-full px-2 py-1.5 text-xs font-medium text-center text-gray-700 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
        >
          View Minnesota Gov
        </Link>
      </div>

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
        </div>
      </div>
    </div>
  );
}

