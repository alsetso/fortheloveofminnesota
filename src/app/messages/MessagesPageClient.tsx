'use client';

import { useState, useEffect } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuthStateSafe } from '@/features/auth';

export default function MessagesPageClient() {
  const supabase = useSupabaseClient();
  const { account } = useAuthStateSafe();
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account?.id) return;

    const fetchThreads = async () => {
      try {
        const { data, error } = await (supabase as any)
          .schema('messaging')
          .from('threads')
          .select(`
            *,
            thread_participants!inner(account_id),
            messages(messages.*)
          `)
          .eq('thread_participants.account_id', account.id)
          .order('updated_at', { ascending: false });

        if (error) throw error;
        setThreads(data || []);
      } catch (error) {
        console.error('Error fetching threads:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchThreads();
  }, [account?.id, supabase]);

  return (
    <div className="p-[10px]">
      <div className="mb-4">
        <h1 className="text-sm font-semibold text-foreground mb-0.5">Messages</h1>
        <p className="text-xs text-foreground-muted">Your conversations</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-xs text-foreground-muted">Loading messages...</p>
        </div>
      ) : threads.length === 0 ? (
        <div className="bg-surface border border-border p-[10px] rounded-md">
          <p className="text-xs text-foreground-muted">No messages yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map((thread) => (
            <div
              key={thread.id}
              className="bg-surface border border-border p-[10px] rounded-md hover:bg-surface-accent transition-colors"
            >
              <p className="text-xs font-medium text-foreground">{thread.subject || 'Untitled'}</p>
              <p className="text-[10px] text-foreground-muted mt-0.5">
                {thread.messages?.length || 0} messages
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
