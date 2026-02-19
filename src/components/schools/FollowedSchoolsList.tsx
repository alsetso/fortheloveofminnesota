'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AcademicCapIcon,
  MapPinIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';

interface FollowedSchool {
  id: string;
  name: string;
  slug: string;
  address?: string;
  school_type?: string;
  enrollment?: number;
  grade_low?: number;
  grade_high?: number;
  phone?: string;
  website_url?: string;
  district_id?: string;
  primary_color?: string | null;
  secondary_color?: string | null;
  mascot_name?: string | null;
  tagline?: string | null;
}

function formatGrades(low?: number, high?: number): string | null {
  if (low == null && high == null) return null;
  const lo = low === 0 ? 'K' : String(low ?? '?');
  const hi = high != null ? String(high) : '?';
  return `${lo}–${hi}`;
}

function formatSchoolType(type?: string): string | null {
  if (!type) return null;
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function SchoolCardSkeleton() {
  return (
    <div className="border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-surface p-[10px] space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-md bg-surface-accent animate-pulse flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="h-3.5 w-40 rounded bg-surface-accent animate-pulse" />
          <div className="h-3 w-24 rounded bg-surface-accent animate-pulse" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-3 w-16 rounded bg-surface-accent animate-pulse" />
        <div className="h-3 w-20 rounded bg-surface-accent animate-pulse" />
      </div>
    </div>
  );
}

export default function FollowedSchoolsList() {
  const { account } = useAuthStateSafe();
  const [schools, setSchools] = useState<FollowedSchool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account?.id) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchFollowed() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/atlas/schools/following', {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setSchools(data.schools ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load schools');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchFollowed();
    return () => { cancelled = true; };
  }, [account?.id]);

  if (!account) {
    return (
      <div className="max-w-[600px] mx-auto w-full px-4 py-6">
        <div className="text-center py-12">
          <AcademicCapIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sign in to see your schools</p>
          <p className="text-xs text-gray-500">Follow schools to track them here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[600px] mx-auto w-full px-4 py-6 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold text-gray-900 dark:text-foreground">Your Schools</h1>
        <span className="text-xs text-gray-500">
          {!isLoading && `${schools.length} following`}
        </span>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <SchoolCardSkeleton />
          <SchoolCardSkeleton />
          <SchoolCardSkeleton />
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/50 rounded-md p-3">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {!isLoading && !error && schools.length === 0 && (
        <div className="text-center py-12">
          <AcademicCapIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">No schools followed yet</p>
          <p className="text-xs text-gray-500 mb-3">Follow schools from their profile pages to see them here.</p>
          <Link
            href="/explore/schools"
            className="inline-block text-xs text-lake-blue hover:text-lake-blue/80 transition-colors"
          >
            Browse schools
          </Link>
        </div>
      )}

      {!isLoading && schools.length > 0 && (
        <div className="space-y-2">
          {schools.map((school) => {
            const grades = formatGrades(school.grade_low, school.grade_high);
            const type = formatSchoolType(school.school_type);
            const accentColor = school.primary_color || '#3b82f6';

            return (
              <Link
                key={school.id}
                href={`/school/${school.slug}`}
                className="block border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-surface hover:bg-gray-50 dark:hover:bg-surface-accent transition-colors"
              >
                <div className="p-[10px] space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: accentColor + '18' }}
                    >
                      <AcademicCapIcon
                        className="w-4 h-4"
                        style={{ color: accentColor }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-900 dark:text-foreground truncate">
                          {school.name}
                        </span>
                        {type && (
                          <span className="text-[10px] text-gray-500 px-1.5 py-0.5 bg-gray-100 dark:bg-surface-accent rounded flex-shrink-0">
                            {type}
                          </span>
                        )}
                      </div>
                      {school.mascot_name && (
                        <p className="text-xs text-gray-500 truncate">{school.mascot_name}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500 pl-10">
                    {grades && (
                      <span className="flex items-center gap-1">
                        <AcademicCapIcon className="w-3 h-3" />
                        Grades {grades}
                      </span>
                    )}
                    {school.enrollment != null && (
                      <span className="flex items-center gap-1">
                        <UserGroupIcon className="w-3 h-3" />
                        {school.enrollment.toLocaleString()}
                      </span>
                    )}
                    {school.address && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPinIcon className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{school.address}</span>
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
