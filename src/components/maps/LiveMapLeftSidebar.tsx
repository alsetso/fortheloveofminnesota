'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PlusIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MapPinIcon,
  UserIcon,
  Cog6ToothIcon,
  ClockIcon,
  MapIcon,
} from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuthStateSafe, AccountService } from '@/features/auth';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';

interface MentionType {
  id: string;
  emoji: string;
  name: string;
  slug: string;
}

export interface LiveMapLeftSidebarProps {
  /** Map display options - only shown when auth */
  showOnlyMyPins?: boolean;
  onShowOnlyMyPinsChange?: (v: boolean) => void;
  timeFilter?: '24h' | '7d' | null;
  onTimeFilterChange?: (v: '24h' | '7d' | null) => void;
  pinDisplayGrouping?: boolean;
  onPinDisplayGroupingChange?: (v: boolean) => void;
}

/**
 * Left Sidebar for /maps (Live Map) page
 * - Auth: Profile card (public pin count), Add to Map, filters, map settings
 * - Non-auth: Sign-in CTA, filters only
 */
export default function LiveMapLeftSidebar({
  showOnlyMyPins = false,
  onShowOnlyMyPinsChange,
  timeFilter = null,
  onTimeFilterChange,
  pinDisplayGrouping = false,
  onPinDisplayGroupingChange,
}: LiveMapLeftSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabaseClient();
  const { account, activeAccountId } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const isAuthenticated = Boolean(account || activeAccountId);
  const accountId = activeAccountId || account?.id || null;

  const [mentionTypes, setMentionTypes] = useState<MentionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [publicPinCount, setPublicPinCount] = useState<number | null>(null);
  const [settingsExpanded, setSettingsExpanded] = useState(false);

  // Parse type param as CSV for multi-select
  const selectedTypeSlugs = useMemo(() => {
    const typeParam = searchParams.get('type');
    if (!typeParam) return [];
    return typeParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [searchParams]);

  // Fetch mention types
  useEffect(() => {
    const fetchMentionTypes = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('mention_types')
          .select('id, emoji, name')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;

        const typesWithSlugs = (data || []).map((type: any) => ({
          ...type,
          slug: mentionTypeNameToSlug(type.name),
        }));

        setMentionTypes(typesWithSlugs);
      } catch (error) {
        console.error('Failed to fetch mention types:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMentionTypes();
  }, [supabase]);

  // Fetch public pin count for auth user
  useEffect(() => {
    if (!accountId || !isAuthenticated) {
      setPublicPinCount(null);
      return;
    }

    const fetchPublicPinCount = async () => {
      try {
        const res = await fetch(
          `/api/accounts/${accountId}/pins?visibility=public&limit=1`
        );
        if (res.ok) {
          const data = await res.json();
          setPublicPinCount(data.total ?? 0);
        } else {
          setPublicPinCount(0);
        }
      } catch {
        setPublicPinCount(0);
      }
    };

    fetchPublicPinCount();
  }, [accountId, isAuthenticated]);

  const handleContributeClick = useCallback(() => {
    if (!isAuthenticated) {
      openWelcome();
      return;
    }
    // Navigate to maps - user can select a location and add via type filter flow
    router.push('/maps');
  }, [isAuthenticated, router, openWelcome]);

  const handleTypeToggle = useCallback(
    (slug: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const isSelected = selectedTypeSlugs.includes(slug);
      const next = isSelected
        ? selectedTypeSlugs.filter((s) => s !== slug)
        : [...selectedTypeSlugs, slug];
      if (next.length === 0) {
        params.delete('type');
      } else {
        params.set('type', next.join(','));
      }
      const qs = params.toString();
      const currentPath =
        typeof window !== 'undefined' ? window.location.pathname : '/';
      router.push(qs ? `${currentPath}?${qs}` : currentPath);
    },
    [router, searchParams, selectedTypeSlugs]
  );

  const handleClearFilter = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('type');
    const qs = params.toString();
    const currentPath =
      typeof window !== 'undefined' ? window.location.pathname : '/';
    router.push(qs ? `${currentPath}?${qs}` : currentPath);
  }, [router, searchParams]);

  const profileHref = account?.username ? `/${account.username}` : '/settings';

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide bg-surface border-r border-gray-200 dark:border-white/10">
      {/* Header - compact */}
      <div className="p-2 border-b border-gray-200 dark:border-white/10">
        <h2 className="text-xs font-semibold text-gray-900 dark:text-foreground">
          Live Map
        </h2>
      </div>

      {/* Auth: Profile card with public pin count */}
      {isAuthenticated && account && (
        <div className="p-2 border-b border-gray-200 dark:border-white/10">
          <Link
            href={profileHref}
            className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
              {account.image_url ? (
                <Image
                  src={account.image_url}
                  alt={AccountService.getDisplayName(account) || 'Profile'}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                  unoptimized={
                    account.image_url.startsWith('data:') ||
                    account.image_url.includes('supabase.co')
                  }
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-gray-500" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 dark:text-foreground truncate">
                {AccountService.getDisplayName(account) || 'Profile'}
              </p>
              <div className="flex items-center gap-1">
                <MapPinIcon className="w-3 h-3 text-gray-500" />
                <span className="text-[10px] text-gray-500">
                  {publicPinCount !== null
                    ? `${publicPinCount} public pin${publicPinCount !== 1 ? 's' : ''}`
                    : '—'}
                </span>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Non-auth: Sign-in CTA */}
      {!isAuthenticated && (
        <div className="p-2 border-b border-gray-200 dark:border-white/10">
          <button
            onClick={openWelcome}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 rounded-md transition-colors"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Sign in to contribute</span>
          </button>
        </div>
      )}

      {/* Add to Map - auth only */}
      {isAuthenticated && (
        <div className="p-2 border-b border-gray-200 dark:border-white/10">
          <button
            onClick={handleContributeClick}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-xs font-medium"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Add to Map</span>
          </button>
        </div>
      )}

      {/* Explore - counties, cities, districts */}
      <div className="p-2 border-b border-gray-200 dark:border-white/10">
        <Link
          href="/explore"
          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border border-gray-200 dark:border-white/10 text-gray-700 dark:text-foreground-muted hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-foreground transition-colors text-xs font-medium"
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span>Explore</span>
        </Link>
      </div>

      {/* Mention Type Filters - pill cards, wrap */}
      <div className="flex-1 p-2 space-y-2 min-h-0 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FunnelIcon className="w-3 h-3 text-gray-500" />
            <span className="text-xs font-medium text-gray-900 dark:text-foreground">
              Filter by Type
            </span>
          </div>
          {selectedTypeSlugs.length > 0 && (
            <button
              onClick={handleClearFilter}
              className="text-[10px] text-gray-500 hover:text-gray-700 dark:hover:text-foreground-muted transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-7 w-16 bg-gray-100 dark:bg-white/5 rounded-md animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {mentionTypes.map((type) => {
              const isSelected = selectedTypeSlugs.includes(type.slug);
              return (
                <button
                  key={type.id}
                  onClick={() => handleTypeToggle(type.slug)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700'
                      : 'bg-white dark:bg-white/5 text-gray-700 dark:text-foreground-muted border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-foreground'
                  }`}
                >
                  <span className="text-sm flex-shrink-0">{type.emoji}</span>
                  <span>{type.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Map Settings - auth only, collapsible */}
      {isAuthenticated &&
        (onShowOnlyMyPinsChange ||
          onTimeFilterChange ||
          onPinDisplayGroupingChange) && (
          <div className="border-t border-gray-200 dark:border-white/10">
            <button
              onClick={() => setSettingsExpanded((v) => !v)}
              className="w-full flex items-center justify-between p-2 text-xs font-medium text-gray-700 dark:text-foreground-muted hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Cog6ToothIcon className="w-3.5 h-3.5" />
                <span>Map Settings</span>
              </div>
              {settingsExpanded ? (
                <ChevronUpIcon className="w-3.5 h-3.5" />
              ) : (
                <ChevronDownIcon className="w-3.5 h-3.5" />
              )}
            </button>

            {settingsExpanded && (
              <div className="px-2 pb-2 space-y-1.5">
                {onShowOnlyMyPinsChange && (
                  <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showOnlyMyPins}
                      onChange={(e) =>
                        onShowOnlyMyPinsChange(e.target.checked)
                      }
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-gray-700 dark:text-foreground">
                      Only my pins
                    </span>
                  </label>
                )}

                {onTimeFilterChange && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 px-2">
                      <ClockIcon className="w-3 h-3 text-gray-500" />
                      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                        Time
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {(['24h', '7d'] as const).map((opt) => (
                        <button
                          key={opt}
                          onClick={() =>
                            onTimeFilterChange(
                              timeFilter === opt ? null : opt
                            )
                          }
                          className={`flex-1 px-2 py-1 text-[10px] rounded-md transition-colors ${
                            timeFilter === opt
                              ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                              : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-foreground-muted hover:bg-gray-200 dark:hover:bg-white/10'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {onPinDisplayGroupingChange && (
                  <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pinDisplayGrouping}
                      onChange={(e) =>
                        onPinDisplayGroupingChange(e.target.checked)
                      }
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-gray-700 dark:text-foreground">
                      Group pins
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>
        )}
    </div>
  );
}
