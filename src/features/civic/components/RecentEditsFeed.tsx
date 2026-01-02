'use client';

import { useState, useEffect } from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface RecentEditsFeedProps {
  limit?: number;
}

interface EditEvent {
  id: string;
  table_name: string;
  record_id: string;
  field_name: string;
  account_username: string | null;
  account_first_name: string | null;
  account_last_name: string | null;
  created_at: string;
  edit_reason: string | null;
}

export default function RecentEditsFeed({ limit = 50 }: RecentEditsFeedProps) {
  const supabase = useSupabaseClient();
  const [events, setEvents] = useState<EditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentEdits = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('civic_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        setEvents(data || []);
      } catch (error) {
        console.error('Error fetching recent edits:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentEdits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <p className="text-xs text-gray-600">Loading recent edits...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <p className="text-xs text-gray-500">No recent edits</p>
      </div>
    );
  }

  const getAccountName = (event: EditEvent): string => {
    if (event.account_username) return event.account_username;
    if (event.account_first_name || event.account_last_name) {
      return [event.account_first_name, event.account_last_name].filter(Boolean).join(' ');
    }
    return 'Anonymous';
  };

  const getEntityLink = (event: EditEvent): string => {
    if (event.table_name === 'orgs') {
      return `/gov/org/${event.record_id}`;
    } else if (event.table_name === 'people') {
      return `/gov/person/${event.record_id}`;
    }
    return '/gov';
  };

  const getEntityLabel = (event: EditEvent): string => {
    return `${event.table_name.slice(0, -1)}`; // Remove 's' from plural
  };

  return (
    <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
      <h3 className="text-xs font-semibold text-gray-900">Recent Community Edits</h3>
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
                  <span className="text-[10px] text-gray-500">edited</span>
                  <span className="text-xs font-medium text-gray-700">
                    {event.field_name}
                  </span>
                  <span className="text-[10px] text-gray-500">on</span>
                  <Link
                    href={getEntityLink(event)}
                    className="text-xs font-medium text-gray-700 hover:text-gray-900 hover:underline"
                  >
                    {getEntityLabel(event)}
                  </Link>
                </div>
                {event.edit_reason && (
                  <div className="text-[10px] text-gray-600 italic pl-1">
                    "{event.edit_reason}"
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-gray-500 flex-shrink-0">
                <ClockIcon className="w-3 h-3" />
                <span>{formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Link
        href="/gov"
        className="block text-center text-[10px] text-gray-500 hover:text-gray-700 pt-1 border-t border-gray-200"
      >
        View All Edits →
      </Link>
    </div>
  );
}

