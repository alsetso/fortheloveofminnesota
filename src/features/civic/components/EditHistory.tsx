'use client';

import { useState, useEffect } from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { formatDistanceToNow } from 'date-fns';
import type { CivicTable } from '../utils/permissions';

interface EditHistoryProps {
  tableName: CivicTable;
  recordId: string;
  limit?: number;
}

interface EditEvent {
  id: string;
  table_name: string;
  record_id: string;
  field_name: string;
  account_id: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  account_username: string | null;
  account_first_name: string | null;
  account_last_name: string | null;
}

export default function EditHistory({ tableName, recordId, limit = 20 }: EditHistoryProps) {
  const supabase = useSupabaseClient();
  const [events, setEvents] = useState<EditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('civic_events')
          .select('*')
          .eq('table_name', tableName)
          .eq('record_id', recordId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        setEvents(data || []);
      } catch (error) {
        console.error('Error fetching edit history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [tableName, recordId, limit, supabase]);

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
        <p className="text-xs text-gray-500">No edit history</p>
      </div>
    );
  }

  const displayEvents = expanded ? events : events.slice(0, 5);
  const hasMore = events.length > 5;

  const getAccountName = (event: EditEvent): string => {
    if (event.account_username) return event.account_username;
    if (event.account_first_name || event.account_last_name) {
      return [event.account_first_name, event.account_last_name].filter(Boolean).join(' ');
    }
    return 'Anonymous';
  };

  const formatValue = (value: string | null): string => {
    if (value === null || value === '') return '(empty)';
    if (value.length > 50) return `${value.slice(0, 50)}...`;
    return value;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-900">Edit History</h3>
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-gray-500 hover:text-gray-700"
          >
            {expanded ? 'Show Less' : `Show All (${events.length})`}
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {displayEvents.map((event) => (
          <div
            key={event.id}
            className="border-b border-gray-100 last:border-0 pb-1.5 last:pb-0"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-gray-900">
                    {getAccountName(event)}
                  </span>
                  <span className="text-[10px] text-gray-500">changed</span>
                  <span className="text-xs font-medium text-gray-700">
                    {event.field_name}
                  </span>
                </div>
                <div className="text-[10px] text-gray-600 space-y-0.5">
                  <div>
                    <span className="text-gray-500">from:</span>{' '}
                    <span className="font-medium">{formatValue(event.old_value)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">to:</span>{' '}
                    <span className="font-medium">{formatValue(event.new_value)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-gray-500 flex-shrink-0">
                <ClockIcon className="w-3 h-3" />
                <span>{formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

