'use client';

import { useState, useEffect } from 'react';
import { ClockIcon, UserIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import Image from 'next/image';

interface CommunityEditsClientProps {
  accountId: string | null;
}

interface EditEvent {
  id: string;
  table_name: string;
  record_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  account_id: string;
  account_username: string | null;
  account_first_name: string | null;
  account_last_name: string | null;
  created_at: string;
  edit_reason: string | null;
}

interface EditEventWithSlug extends EditEvent {
  entity_slug?: string | null;
  entity_name?: string | null;
  account_image_url?: string | null;
}

export default function CommunityEditsClient({ accountId }: CommunityEditsClientProps) {
  const supabase = useSupabaseClient();
  const [events, setEvents] = useState<EditEventWithSlug[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchEdits = async () => {
      setLoading(true);
      try {
        // Build query - filter by account_id if "mine" filter is selected
        let query = supabase
          .from('civic_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);

        if (filter === 'mine' && accountId) {
          query = query.eq('account_id', accountId);
        }

        const { data: editEvents, error: eventsError } = await query;

        if (eventsError) throw eventsError;

        if (!editEvents || editEvents.length === 0) {
          setEvents([]);
          setLoading(false);
          return;
        }

        // Get unique record IDs and table names to fetch slugs
        const orgIds = new Set<string>();
        const personIds = new Set<string>();
        const accountIds = new Set<string>();

        editEvents.forEach((event: any) => {
          const eventTyped = event as { table_name: string; record_id: string; account_id?: string };
          if (eventTyped.table_name === 'orgs') {
            orgIds.add(eventTyped.record_id);
          } else if (eventTyped.table_name === 'people') {
            personIds.add(eventTyped.record_id);
          }
          if (eventTyped.account_id) {
            accountIds.add(eventTyped.account_id);
          }
        });

        // Fetch orgs, people, and accounts to get slugs, names, and image_urls
        const [orgsResult, peopleResult, accountsResult] = await Promise.all([
          orgIds.size > 0
            ? supabase
                .from('orgs')
                .select('id, slug, name')
                .in('id', Array.from(orgIds))
            : Promise.resolve({ data: [], error: null }),
          personIds.size > 0
            ? supabase
                .from('people')
                .select('id, slug, name')
                .in('id', Array.from(personIds))
            : Promise.resolve({ data: [], error: null }),
          accountIds.size > 0
            ? supabase
                .from('accounts')
                .select('id, image_url')
                .in('id', Array.from(accountIds))
            : Promise.resolve({ data: [], error: null }),
        ]);

        const orgsMap = new Map(
          (orgsResult.data || []).map((org) => [org.id, { slug: org.slug, name: org.name }])
        );
        const peopleMap = new Map(
          (peopleResult.data || []).map((person) => [
            person.id,
            { slug: person.slug, name: person.name },
          ])
        );
        const accountsMap = new Map(
          (accountsResult.data || []).map((account) => [
            account.id,
            { image_url: account.image_url },
          ])
        );

        // Enrich events with slugs, names, and image_urls
        const enrichedEvents: EditEventWithSlug[] = editEvents.map((event) => {
          const account = accountsMap.get(event.account_id);
          const baseEvent = {
            ...event,
            account_image_url: account?.image_url || null,
          };

          const eventTyped = event as { table_name: string; record_id: string; account_id?: string; entity_slug?: string };
          if (eventTyped.table_name === 'orgs') {
            const org = orgsMap.get(eventTyped.record_id);
            return {
              ...baseEvent,
              entity_slug: org?.slug || null,
              entity_name: org?.name || null,
            };
          } else if (eventTyped.table_name === 'people') {
            const person = peopleMap.get(eventTyped.record_id);
            return {
              ...baseEvent,
              entity_slug: person?.slug || null,
              entity_name: person?.name || null,
            };
          }
          return baseEvent;
        });

        setEvents(enrichedEvents);
      } catch (error) {
        console.error('Error fetching user edits:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEdits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, filter]);

  const getAccountName = (event: EditEventWithSlug): string => {
    if (event.account_username) return `@${event.account_username}`;
    if (event.account_first_name || event.account_last_name) {
      return [event.account_first_name, event.account_last_name].filter(Boolean).join(' ');
    }
    return 'Anonymous';
  };

  const toggleEvent = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const isExpanded = (eventId: string) => expandedEvents.has(eventId);

  const hasDetails = (event: EditEventWithSlug): boolean => {
    return !!(event.old_value && event.new_value) || !!event.edit_reason;
  };

  const hasExpandableContent = (event: EditEventWithSlug): boolean => {
    return !!(event.old_value && event.new_value) || !!event.edit_reason;
  };

  const isImageUrl = (value: string | null): boolean => {
    if (!value) return false;
    return value.includes('.supabase.co/storage') && 
           (value.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) || value.includes('/storage/'));
  };

  const renderValue = (value: string | null, isOld: boolean = false) => {
    if (!value) {
      return <span className="text-gray-400 italic">(empty)</span>;
    }

    if (isImageUrl(value)) {
      return (
        <div className="mt-1">
          <Image
            src={value}
            alt={isOld ? 'Old value' : 'New value'}
            width={200}
            height={200}
            className="max-w-full h-auto rounded border border-gray-200"
            unoptimized
            onError={(e) => {
              // Fallback to text if image fails to load
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'block';
            }}
          />
          <div style={{ display: 'none' }} className="text-gray-700 break-words">
            {value}
          </div>
        </div>
      );
    }

    return <span className="text-gray-700 break-words">{value}</span>;
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <p className="text-xs text-gray-600">Loading edits...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-900">Community Edits</h2>
          {accountId && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`text-[10px] px-2 py-1 rounded transition-colors ${
                  filter === 'all'
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('mine')}
                className={`text-[10px] px-2 py-1 rounded transition-colors ${
                  filter === 'mine'
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Mine
              </button>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500">
          {filter === 'mine' ? "You haven't made any edits yet." : 'No edits found.'}
        </p>
        {filter === 'mine' && (
          <Link
            href="/gov"
            className="text-xs text-gray-500 hover:text-gray-700 inline-block"
          >
            Start editing →
          </Link>
        )}
      </div>
    );
  }

  const getEntityLink = (event: EditEventWithSlug): string => {
    if (event.table_name === 'orgs') {
      return event.entity_slug ? `/gov/org/${event.entity_slug}` : `/gov/org/${event.record_id}`;
    } else if (event.table_name === 'people') {
      // getCivicPersonBySlug accepts UUIDs, so we can use record_id directly
      return event.entity_slug
        ? `/gov/person/${event.entity_slug}`
        : `/gov/person/${event.record_id}`;
    }
    return '/gov';
  };

  const getEntityLabel = (event: EditEventWithSlug): string => {
    if (event.entity_name) {
      return event.entity_name;
    }
    return `${event.table_name.slice(0, -1)}`; // Remove 's' from plural
  };

  const getTableLabel = (tableName: string): string => {
    switch (tableName) {
      case 'orgs':
        return 'organization';
      case 'people':
        return 'person';
      case 'roles':
        return 'role';
      default:
        return tableName;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-900">
          {events.length} {events.length === 1 ? 'Edit' : 'Edits'}
          {filter === 'mine' && ' (Mine)'}
        </h2>
        {accountId && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`text-[10px] px-2 py-1 rounded transition-colors ${
                filter === 'all'
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('mine')}
              className={`text-[10px] px-2 py-1 rounded transition-colors ${
                filter === 'mine'
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Mine
            </button>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        {events.map((event) => {
          const expanded = isExpanded(event.id);
          const hasExpandable = hasExpandableContent(event);

          return (
            <div
              key={event.id}
              className="border-b border-gray-100 last:border-0 pb-1.5 last:pb-0"
            >
              <div
                className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 transition-colors rounded px-1 py-0.5 -mx-1"
                onClick={() => toggleEvent(event.id)}
              >
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {filter === 'all' && (
                      <>
                        <div className="flex items-center gap-1.5">
                          {/* Profile Photo */}
                          <div className="w-4 h-4 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                            {event.account_image_url ? (
                              <Image
                                src={event.account_image_url}
                                alt={getAccountName(event)}
                                width={16}
                                height={16}
                                className="object-cover rounded-full"
                                unoptimized={
                                  event.account_image_url.startsWith('data:') ||
                                  event.account_image_url.includes('supabase.co')
                                }
                              />
                            ) : (
                              <UserIcon className="w-3 h-3 text-gray-400" />
                            )}
                          </div>
                          <span className="text-xs font-medium text-gray-900">
                            {getAccountName(event)}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500">edited</span>
                      </>
                    )}
                    <span className="text-xs font-medium text-gray-700">
                      {event.field_name}
                    </span>
                    <span className="text-[10px] text-gray-500">on</span>
                    <Link
                      href={getEntityLink(event)}
                      className="text-xs font-medium text-gray-700 hover:text-gray-900 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {getEntityLabel(event)}
                    </Link>
                    <span className="text-[10px] text-gray-500">
                      ({getTableLabel((event as { table_name: string }).table_name)})
                    </span>
                  </div>
                  {expanded && (
                    <div className="text-[10px] text-gray-600 pl-1 mt-1.5 border-t border-gray-100 pt-1.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <div className="text-gray-500 font-medium">Old Value</div>
                          <div className={`text-gray-700 ${event.old_value ? 'line-through' : ''}`}>
                            {renderValue(event.old_value, true)}
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-gray-500 font-medium">New Value</div>
                          <div className="text-gray-700">
                            {renderValue(event.new_value, false)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {expanded && event.edit_reason && (
                    <div className="text-[10px] text-gray-600 italic pl-1 mt-1">
                      "{event.edit_reason}"
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-500 flex-shrink-0">
                  <div className="flex items-center mr-0.5">
                    {expanded ? (
                      <ChevronUpIcon className="w-3 h-3 text-gray-500" />
                    ) : (
                      <ChevronDownIcon className="w-3 h-3 text-gray-500" />
                    )}
                  </div>
                  <ClockIcon className="w-3 h-3" />
                  <span>
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

