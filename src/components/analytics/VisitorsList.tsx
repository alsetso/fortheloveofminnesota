'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Visitor {
  account_id: string;
  account_username: string | null;
  account_first_name: string | null;
  account_last_name: string | null;
  account_image_url: string | null;
  viewed_at: string;
  view_count: number;
}

interface VisitorsListProps {
  page_url?: string;
  pin_id?: string;
}

export default function VisitorsList({ page_url, pin_id }: VisitorsListProps) {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!page_url && !pin_id) {
      setLoading(false);
      return;
    }

    const fetchVisitors = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const params = new URLSearchParams({
          limit: '50',
          offset: '0',
        });
        
        if (page_url) params.set('page_url', page_url);
        if (pin_id) params.set('pin_id', pin_id);

        const response = await fetch(`/api/analytics/visitors?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to load visitors');
          setLoading(false);
          return;
        }

        setVisitors(data.visitors || []);
      } catch (err) {
        console.error('Error fetching visitors:', err);
        setError('Failed to load visitors');
      } finally {
        setLoading(false);
      }
    };

    fetchVisitors();
  }, [page_url, pin_id]);

  if (loading) {
    return (
      <div className="hidden bg-white rounded-lg border border-gray-200 p-4">
        <div className="text-center text-gray-500 text-sm py-2">Loading visitors...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hidden bg-white rounded-lg border border-gray-200 p-4">
        <div className="text-center text-red-600 text-sm py-2">{error}</div>
      </div>
    );
  }

  if (visitors.length === 0) {
    return (
      <div className="hidden bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Visitors</h3>
        <p className="text-gray-500 text-sm text-center py-2">No visitors yet.</p>
      </div>
    );
  }

  return (
    <div className="hidden bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Visitors</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {visitors.map((visitor) => {
          const displayName = visitor.account_first_name && visitor.account_last_name
            ? `${visitor.account_first_name} ${visitor.account_last_name}`
            : visitor.account_username || visitor.account_first_name || 'Anonymous';

          const Wrapper = 'div';
          const wrapperProps = {};

          return (
            <Wrapper
              key={visitor.account_id}
              {...wrapperProps}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              {visitor.account_image_url ? (
                <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                  <Image
                    src={visitor.account_image_url}
                    alt={displayName}
                    width={32}
                    height={32}
                    className="w-full h-full object-cover rounded-full"
                    unoptimized={visitor.account_image_url.includes('supabase.co')}
                  />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-gray-500 font-medium text-xs">
                    {displayName.charAt(0)}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 group-hover:text-gold-600 transition-colors truncate">
                  {displayName}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(visitor.viewed_at), { addSuffix: true })}
                  {visitor.view_count > 1 && ` · ${visitor.view_count}`}
                </p>
              </div>
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}

