'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { UserIcon } from '@heroicons/react/24/outline';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import PeopleSearchabilityToggle from './PeopleSearchabilityToggle';
import { getPaidPlanBorderClasses } from '@/lib/billing/planHelpers';
import { TRAIT_OPTIONS } from '@/types/profile';
import type { Database } from '@/types/supabase';

type PublicAccount = Pick<
  Database['public']['Tables']['accounts']['Row'],
  'id' | 'username' | 'first_name' | 'last_name' | 'image_url' | 'bio' | 'created_at' | 'plan' | 'traits'
>;

function getQueryStringValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

function escapeIlikeQuery(raw: string): string {
  return raw.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

interface PeoplePageClientProps {
  searchParams?: Record<string, string | string[] | undefined>;
  isAuthenticated: boolean;
}

export default function PeoplePageClient({ searchParams, isAuthenticated }: PeoplePageClientProps) {
  const { openWelcome } = useAppModalContextSafe();
  const [people, setPeople] = useState<PublicAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const qRaw = getQueryStringValue(searchParams?.q);
  const q = qRaw.trim().slice(0, 80);
  const qNormalized = q.replaceAll(',', ' ');
  const qEscaped = escapeIlikeQuery(qNormalized);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const fetchPeople = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (qEscaped) {
          params.set('q', qEscaped);
        }
        const response = await fetch(`/api/people?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setPeople(data.people || []);
        } else {
          setError('Failed to load people');
        }
      } catch (err) {
        console.error('Error fetching people:', err);
        setError('Failed to load people');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPeople();
  }, [isAuthenticated, qEscaped]);

  if (!isAuthenticated) {
    return (
      <div className="h-full overflow-y-auto scrollbar-hide">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <h1 className="text-sm font-semibold text-gray-900">People</h1>
              <p className="text-xs text-gray-500">Public searchable accounts</p>
            </div>
          </div>

          <div className="border border-gray-200 rounded-md bg-white p-[10px]">
            <div className="text-center py-8 space-y-3">
              <p className="text-xs text-gray-600">Sign in to view people</p>
              <button
                onClick={openWelcome}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <h1 className="text-sm font-semibold text-gray-900">People</h1>
            <p className="text-xs text-gray-500">Public searchable accounts</p>
          </div>
          <PeopleSearchabilityToggle />
        </div>

        <form action="/people" method="get" className="flex items-center gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search by name or username…"
            className="flex-1 border border-gray-200 rounded-md px-2 py-1.5 text-xs text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
            autoComplete="off"
            inputMode="search"
            aria-label="Search people"
          />
          <button
            type="submit"
            className="border border-gray-200 rounded-md px-2 py-1.5 text-xs font-medium text-gray-900 hover:bg-gray-50 transition-colors"
          >
            Search
          </button>
          {q && (
            <Link
              href="/people"
              className="border border-gray-200 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Clear
            </Link>
          )}
        </form>

        {isLoading && (
          <div className="border border-gray-200 rounded-md bg-white p-[10px]">
            <p className="text-xs text-gray-500">Loading...</p>
          </div>
        )}

        {error && (
          <div className="border border-red-200 rounded-md bg-white p-[10px]">
            <p className="text-xs text-red-600">
              Failed to load people: {error}
            </p>
          </div>
        )}

        {!isLoading && !error && people.length === 0 && (
          <div className="border border-gray-200 rounded-md bg-white p-[10px]">
            <p className="text-xs text-gray-500">No public accounts found.</p>
          </div>
        )}

        {!isLoading && !error && people.length > 0 && (
          <div className="space-y-2">
            {people.map((person) => {
              const username = person.username ?? '';
              const displayName =
                [person.first_name, person.last_name].filter(Boolean).join(' ') ||
                (username ? `@${username}` : 'User');
              
              const traitLabels = person.traits
                ? person.traits
                    .map(traitId => TRAIT_OPTIONS.find(t => t.id === traitId)?.label)
                    .filter(Boolean) as string[]
                : [];

              return (
                <Link
                  key={person.id}
                  href={username ? `/profile/${username}` : '/settings'}
                  className="block border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors p-[10px] group"
                >
                  <div className="flex items-start gap-2">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center ${getPaidPlanBorderClasses(person.plan)}`}>
                      <div className="w-full h-full rounded-full overflow-hidden bg-white">
                        {person.image_url ? (
                          <Image
                            src={person.image_url}
                            alt={displayName}
                            width={32}
                            height={32}
                            className="w-full h-full object-cover rounded-full"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center rounded-full">
                            <UserIcon className="w-4 h-4 text-gray-500" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-gray-900 truncate">
                            {displayName}
                          </div>
                          {username && (
                            <div className="text-xs text-gray-500 truncate">
                              @{username}
                            </div>
                          )}
                        </div>
                      </div>

                      {traitLabels.length > 0 && (
                        <div className="overflow-hidden transition-all duration-200 ease-in-out max-h-0 group-hover:max-h-10">
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {traitLabels.map((label, index) => (
                              <span
                                key={index}
                                className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {person.bio && (
                        <div className="overflow-hidden transition-all duration-200 ease-in-out max-h-0 group-hover:max-h-[3rem]">
                          <p className="text-xs text-gray-600 line-clamp-2 pt-0.5">
                            {person.bio}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
