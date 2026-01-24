import Link from 'next/link';
import Image from 'next/image';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import { createServerClient } from '@/lib/supabaseServer';
import type { Database } from '@/types/supabase';
import { UserIcon } from '@heroicons/react/24/outline';
import PeopleSearchabilityToggle from './PeopleSearchabilityToggle';
import { getPaidPlanBorderClasses } from '@/lib/billing/planHelpers';
import { TRAIT_OPTIONS } from '@/types/profile';

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
  // Escape characters meaningful to LIKE patterns so user input behaves predictably.
  // Supabase uses Postgres LIKE/ILIKE; % and _ are wildcards, \ is escape.
  return raw.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const qRaw = getQueryStringValue(searchParams?.q);
  const q = qRaw.trim().slice(0, 80);
  // PostgREST `.or(...)` uses commas as top-level separators; strip commas from user input
  // so search never breaks when someone types "Last, First".
  const qNormalized = q.replaceAll(',', ' ');
  const qEscaped = escapeIlikeQuery(qNormalized);

  const supabase = createServerClient();
  let query = supabase
    .from('accounts')
    .select('id,username,first_name,last_name,image_url,bio,created_at,plan,traits')
    .not('username', 'is', null)
    .eq('search_visibility', true)
    .order('created_at', { ascending: false });

  if (qEscaped) {
    // Use explicit escape character for LIKE patterns.
    // PostgREST supports "ilike" but not a custom ESCAPE clause in the filter,
    // so we escape wildcards in user input and still use %...% wrapping.
    const pattern = `%${qEscaped}%`;
    query = query.or(
      [
        `username.ilike.${pattern}`,
        `first_name.ilike.${pattern}`,
        `last_name.ilike.${pattern}`,
      ].join(',')
    );
  }

  const { data, error } = await query.limit(500);
  const people: PublicAccount[] = (data ?? []) as PublicAccount[];

  return (
    <PageWrapper
      headerContent={null}
      searchComponent={<MapSearchInput />}
      searchResultsComponent={<SearchResults />}
      showAccountDropdown
    >
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

          {error && (
            <div className="border border-red-200 rounded-md bg-white p-[10px]">
              <p className="text-xs text-red-600">
                Failed to load people: {error.message}
              </p>
            </div>
          )}

          {!error && people.length === 0 && (
            <div className="border border-gray-200 rounded-md bg-white p-[10px]">
              <p className="text-xs text-gray-500">No public accounts found.</p>
            </div>
          )}

          {!error && people.length > 0 && (
            <div className="space-y-2">
              {people.map((person) => {
                const username = person.username ?? '';
                const displayName =
                  [person.first_name, person.last_name].filter(Boolean).join(' ') ||
                  (username ? `@${username}` : 'User');
                
                // Map trait IDs to labels
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
    </PageWrapper>
  );
}

