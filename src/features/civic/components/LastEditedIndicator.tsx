'use client';

import { useEffect, useState } from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { formatDistanceToNow } from 'date-fns';
import type { CivicTable } from '../utils/permissions';

interface LastEditedIndicatorProps {
  tableName: CivicTable;
  recordId: string;
  className?: string;
}

export default function LastEditedIndicator({ 
  tableName, 
  recordId,
  className = '' 
}: LastEditedIndicatorProps) {
  const supabase = useSupabaseClient();
  const [lastEdit, setLastEdit] = useState<{
    account_username: string | null;
    account_first_name: string | null;
    account_last_name: string | null;
    created_at: string;
  } | null>(null);

  useEffect(() => {
    const fetchLastEdit = async () => {
      const { data, error } = await supabase
        .from('civic_events')
        .select('account_username, account_first_name, account_last_name, created_at')
        .eq('table_name', tableName)
        .eq('record_id', recordId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setLastEdit(data);
      }
    };

    fetchLastEdit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName, recordId]);

  if (!lastEdit) return null;

  const getAccountName = (): string => {
    if (lastEdit.account_username) return lastEdit.account_username;
    if (lastEdit.account_first_name || lastEdit.account_last_name) {
      return [lastEdit.account_first_name, lastEdit.account_last_name].filter(Boolean).join(' ');
    }
    return 'a community member';
  };

  return (
    <div className={`flex items-center gap-1 text-[10px] text-gray-500 ${className}`}>
      <ClockIcon className="w-3 h-3" />
      <span>
        Last edited {formatDistanceToNow(new Date(lastEdit.created_at), { addSuffix: true })} by{' '}
        <span className="font-medium text-gray-600">{getAccountName()}</span>
      </span>
    </div>
  );
}

