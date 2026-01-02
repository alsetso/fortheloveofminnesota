'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClockIcon, UserIcon, ChevronDownIcon, ChevronUpIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuthStateSafe } from '@/features/auth';
import { useToast } from '@/features/ui/hooks/useToast';
import { formatDistanceToNow, format } from 'date-fns';
import type { CivicTable } from '../utils/permissions';
import { revertCivicEdit } from '../utils/civicEditLogger';
import Link from 'next/link';

interface EntityEditHistoryProps {
  tableName: CivicTable;
  recordId: string;
  recordName?: string;
  showHeader?: boolean;
}

interface EditEvent {
  id: string;
  table_name: string;
  record_id: string;
  field_name: string;
  account_id: string;
  old_value: string | null;
  new_value: string | null;
  edit_reason: string | null;
  created_at: string;
  account_username: string | null;
  account_first_name: string | null;
  account_last_name: string | null;
}

interface Contributor {
  account_id: string;
  account_username: string | null;
  account_first_name: string | null;
  account_last_name: string | null;
  edit_count: number;
  last_edit: string;
}

export default function EntityEditHistory({ 
  tableName, 
  recordId, 
  recordName,
  showHeader = true 
}: EntityEditHistoryProps) {
  const supabase = useSupabaseClient();
  const { account } = useAuthStateSafe();
  const { success, error: showError } = useToast();
  const [events, setEvents] = useState<EditEvent[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showContributors, setShowContributors] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [revertingEventId, setRevertingEventId] = useState<string | null>(null);
  const EVENTS_PER_PAGE = 20;

  // Initial fetch - separate from loadMore to avoid dependency issues
  useEffect(() => {
    let cancelled = false;
    
    const fetchInitialHistory = async () => {
      setLoading(true);
      setPage(1);
      try {
        const from = 0;
        const to = EVENTS_PER_PAGE - 1;
        
        const { data: eventsData, error: eventsError } = await supabase
          .from('civic_events')
          .select('*')
          .eq('table_name', tableName)
          .eq('record_id', recordId)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (cancelled) return;

        if (eventsError) throw eventsError;
        
        const newEvents = eventsData || [];
        setEvents(newEvents);
        setHasMore(newEvents.length === EVENTS_PER_PAGE);
        
        // Calculate contributors from new events
        const contributorMap = new Map<string, Contributor>();
        newEvents.forEach((event) => {
          const existing = contributorMap.get(event.account_id);
          if (existing) {
            existing.edit_count += 1;
            if (new Date(event.created_at) > new Date(existing.last_edit)) {
              existing.last_edit = event.created_at;
            }
          } else {
            contributorMap.set(event.account_id, {
              account_id: event.account_id,
              account_username: event.account_username,
              account_first_name: event.account_first_name,
              account_last_name: event.account_last_name,
              edit_count: 1,
              last_edit: event.created_at,
            });
          }
        });

        setContributors(
          Array.from(contributorMap.values())
            .sort((a, b) => b.edit_count - a.edit_count)
        );
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching edit history:', error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchInitialHistory();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName, recordId]);

  const loadMore = useCallback(async () => {
    if (loading) return;
    
    const nextPage = page + 1;
    setLoading(true);
    try {
      const from = (nextPage - 1) * EVENTS_PER_PAGE;
      const to = from + EVENTS_PER_PAGE - 1;
      
      const { data: eventsData, error: eventsError } = await supabase
        .from('civic_events')
        .select('*')
        .eq('table_name', tableName)
        .eq('record_id', recordId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (eventsError) throw eventsError;
      
      const newEvents = eventsData || [];
      
      setEvents(prev => {
        const allEvents = [...prev, ...newEvents];
        
        // Calculate contributors from all loaded events
        const contributorMap = new Map<string, Contributor>();
        allEvents.forEach((event) => {
          const existing = contributorMap.get(event.account_id);
          if (existing) {
            existing.edit_count += 1;
            if (new Date(event.created_at) > new Date(existing.last_edit)) {
              existing.last_edit = event.created_at;
            }
          } else {
            contributorMap.set(event.account_id, {
              account_id: event.account_id,
              account_username: event.account_username,
              account_first_name: event.account_first_name,
              account_last_name: event.account_last_name,
              edit_count: 1,
              last_edit: event.created_at,
            });
          }
        });

        setContributors(
          Array.from(contributorMap.values())
            .sort((a, b) => b.edit_count - a.edit_count)
        );
        
        return allEvents;
      });
      
      setHasMore(newEvents.length === EVENTS_PER_PAGE);
      setPage(nextPage);
    } catch (error) {
      console.error('Error loading more edit history:', error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, loading, tableName, recordId]);


  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <p className="text-xs text-gray-600">Loading edit history...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <p className="text-xs text-gray-500">No edit history yet</p>
      </div>
    );
  }

  // Get total count for display (we'll need to fetch this separately or estimate)
  const totalEdits = events.length + (hasMore ? '+' : '');
  const uniqueContributors = contributors.length;
  const lastEdit = events[0]?.created_at;

  const getAccountName = (event: EditEvent): string => {
    if (event.account_username) return event.account_username;
    if (event.account_first_name || event.account_last_name) {
      return [event.account_first_name, event.account_last_name].filter(Boolean).join(' ');
    }
    return 'Anonymous';
  };

  const formatValue = (value: string | null, maxLength: number = 100): string => {
    if (value === null || value === '') return '(empty)';
    if (value.length > maxLength) return `${value.slice(0, maxLength)}...`;
    return value;
  };

  const handleRevert = useCallback(async (event: EditEvent) => {
    if (!account?.id) {
      showError('You must be signed in to revert edits');
      return;
    }

    if (!confirm(`Revert ${event.field_name} back to "${formatValue(event.old_value, 50)}"? This will create a new edit entry.`)) {
      return;
    }

    setRevertingEventId(event.id);
    try {
      const { error } = await revertCivicEdit(
        event.id,
        account.id,
        supabase,
        `Reverted edit from ${formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}`
      );

      if (error) {
        showError(error.message || 'Failed to revert edit');
        return;
      }

      success('Edit reverted successfully');
      
      // Refresh the events list
      const { data: eventsData, error: eventsError } = await supabase
        .from('civic_events')
        .select('*')
        .eq('table_name', tableName)
        .eq('record_id', recordId)
        .order('created_at', { ascending: false })
        .range(0, EVENTS_PER_PAGE - 1);

      if (!eventsError && eventsData) {
        setEvents(eventsData);
        setPage(1);
        setHasMore(eventsData.length === EVENTS_PER_PAGE);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to revert edit');
    } finally {
      setRevertingEventId(null);
    }
  }, [account, supabase, tableName, recordId, success, showError]);

  return (
    <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
      {showHeader && (
        <div className="border-b border-gray-200 pb-2">
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-xs font-semibold text-gray-900">Edit History</h3>
            <div className="flex items-center gap-2 text-[10px] text-gray-600">
              <span>{totalEdits} edit{totalEdits !== 1 ? 's' : ''}</span>
              <span>•</span>
              <span>{uniqueContributors} contributor{uniqueContributors !== 1 ? 's' : ''}</span>
            </div>
          </div>
          {lastEdit && (
            <p className="text-[10px] text-gray-500">
              Last edited {formatDistanceToNow(new Date(lastEdit), { addSuffix: true })} by {getAccountName(events[0])}
            </p>
          )}
        </div>
      )}

      {/* Contributors Summary */}
      {contributors.length > 0 && (
        <div className="border-b border-gray-200 pb-2">
          <button
            onClick={() => setShowContributors(!showContributors)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-[10px] font-medium text-gray-700">
              Contributors ({contributors.length})
            </span>
            {showContributors ? (
              <ChevronUpIcon className="w-3 h-3 text-gray-500" />
            ) : (
              <ChevronDownIcon className="w-3 h-3 text-gray-500" />
            )}
          </button>
          {showContributors && (
            <div className="mt-1.5 space-y-1">
              {contributors.map((contributor) => (
                <div
                  key={contributor.account_id}
                  className="flex items-center justify-between text-[10px] text-gray-600"
                >
                  <span className="font-medium">
                    {contributor.account_username || 
                     [contributor.account_first_name, contributor.account_last_name].filter(Boolean).join(' ') ||
                     'Anonymous'}
                  </span>
                  <span className="text-gray-500">
                    {contributor.edit_count} edit{contributor.edit_count !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Events */}
      <div className="space-y-1.5">
        {events.map((event) => (
          <div
            key={event.id}
            className="border-b border-gray-100 last:border-0 pb-1.5 last:pb-0"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium text-gray-900">
                    {getAccountName(event)}
                  </span>
                  <span className="text-[10px] text-gray-500">changed</span>
                  <span className="text-xs font-medium text-gray-700">
                    {event.field_name}
                  </span>
                </div>
                <div className="text-[10px] text-gray-600 space-y-0.5 pl-1">
                  <div>
                    <span className="text-gray-500">from:</span>{' '}
                    <span className="font-medium break-words">{formatValue(event.old_value)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">to:</span>{' '}
                    <span className="font-medium break-words">{formatValue(event.new_value)}</span>
                  </div>
                  {event.edit_reason && (
                    <div className="mt-0.5 pt-0.5 border-t border-gray-100">
                      <span className="text-gray-500 italic">Reason:</span>{' '}
                      <span className="text-gray-700">{event.edit_reason}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <div className="flex items-center gap-1 text-[10px] text-gray-500">
                  <ClockIcon className="w-3 h-3" />
                  <span>{formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}</span>
                </div>
                <div className="text-[10px] text-gray-400">
                  {format(new Date(event.created_at), 'MMM d, yyyy h:mm a')}
                </div>
                {account && event.old_value !== null && (
                  <button
                    onClick={() => handleRevert(event)}
                    disabled={revertingEventId === event.id}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Revert this edit"
                  >
                    {revertingEventId === event.id ? (
                      <>
                        <div className="w-2.5 h-2.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        <span>Reverting...</span>
                      </>
                    ) : (
                      <>
                        <ArrowPathIcon className="w-2.5 h-2.5" />
                        <span>Revert</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="w-full text-[10px] text-gray-500 hover:text-gray-700 text-center py-1 border-t border-gray-200 pt-2 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}

