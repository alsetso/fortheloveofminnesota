'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';

type MentionType = { id: string; emoji: string; name: string };

export default function MentionTypeCards() {
  const supabase = useSupabaseClient();
  const [mentionTypes, setMentionTypes] = useState<MentionType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMentionTypes = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('mention_types')
          .select('id, emoji, name')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setMentionTypes((data || []) as MentionType[]);
      } catch (err) {
        console.error('Failed to fetch mention types:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMentionTypes();
  }, [supabase]);

  if (loading) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">What you can post</p>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-md p-[10px] h-12 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (mentionTypes.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">What you can post</p>
      <div className="grid grid-cols-2 gap-2">
        {mentionTypes.map((type) => (
          <Link
            key={type.id}
            href={`/live?mention_type_id=${encodeURIComponent(type.id)}#contribute`}
            className="flex items-center gap-2 bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm flex-shrink-0">{type.emoji}</span>
            <span className="text-xs font-medium text-gray-900 truncate">{type.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
