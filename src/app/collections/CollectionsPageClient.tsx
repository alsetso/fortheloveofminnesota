'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuthStateSafe } from '@/features/auth';

export default function CollectionsPageClient() {
  const supabase = useSupabaseClient();
  const { account } = useAuthStateSafe();
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const { data, error } = await supabase
          .from('collections')
          .select(`
            *,
            account:accounts(id, username, first_name, last_name, image_url)
          `)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setCollections(data || []);
      } catch (error) {
        console.error('Error fetching collections:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCollections();
  }, [supabase]);

  return (
    <div className="p-[10px]">
      <div className="mb-4">
        <h1 className="text-sm font-semibold text-foreground mb-0.5">Collections</h1>
        <p className="text-xs text-foreground-muted">Browse all collections</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-xs text-foreground-muted">Loading collections...</p>
        </div>
      ) : collections.length === 0 ? (
        <div className="bg-surface border border-border p-[10px] rounded-md">
          <p className="text-xs text-foreground-muted">No collections yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {collections.map((collection) => (
            <Link
              key={collection.id}
              href={
                collection.account?.username
                  ? `/${encodeURIComponent(collection.account.username)}/${encodeURIComponent(collection.title.toLowerCase().replace(/\s+/g, '-'))}`
                  : '#'
              }
              className="bg-surface border border-border p-[10px] rounded-md hover:bg-surface-accent transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{collection.emoji || '📍'}</span>
                <span className="text-xs font-medium text-foreground truncate flex-1">
                  {collection.title}
                </span>
              </div>
              {collection.description && (
                <p className="text-[10px] text-foreground-muted line-clamp-2">
                  {collection.description}
                </p>
              )}
              {collection.account?.username && (
                <p className="text-[10px] text-foreground-subtle mt-1">
                  by @{collection.account.username}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
