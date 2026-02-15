'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  QuestionMarkCircleIcon,
  UserPlusIcon,
  ShieldCheckIcon,
  MapPinIcon,
  PhotoIcon,
  BookmarkIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  LockClosedIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface DocPage {
  slug: string;
  title: string;
  icon: string | null;
}

const ICON_MAP: Record<string, typeof InformationCircleIcon> = {
  InformationCircleIcon,
  UserPlusIcon,
  ShieldCheckIcon,
  MapPinIcon,
  PhotoIcon,
  BookmarkIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  LockClosedIcon,
  QuestionMarkCircleIcon,
};

interface DocsLeftSidebarProps {
  /** Current doc slug from path /docs/[slug]; used for active state and when no query */
  currentSlug?: string;
}

/**
 * Left Sidebar for Documentation page
 * Fetches doc list from docs.pages (Supabase) ordered by sort_order
 */
export default function DocsLeftSidebar({ currentSlug }: DocsLeftSidebarProps) {
  const searchParams = useSearchParams();
  const selectedDoc = currentSlug ?? searchParams.get('doc') ?? 'getting-started';
  const [pages, setPages] = useState<DocPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .schema('docs')
        .from('pages')
        .select('slug, title, icon')
        .order('sort_order', { ascending: true });

      if (!error && data) {
        setPages(data as DocPage[]);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Documentation</h2>
        <p className="text-xs text-foreground-subtle mt-1">Help & Guides</p>
      </div>

      {/* Navigation */}
      <div className="p-3 space-y-1">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 bg-surface-accent rounded-md animate-pulse" />
          ))
        ) : (
          pages.map((page) => {
            const Icon = (page.icon && ICON_MAP[page.icon]) || InformationCircleIcon;
            return (
              <Link
                key={page.slug}
                href={`/docs/${page.slug}`}
                className={`w-full flex items-center gap-3 px-2 py-2 text-sm rounded-md transition-colors ${
                  selectedDoc === page.slug
                    ? 'bg-surface-accent text-foreground'
                    : 'text-foreground-muted hover:bg-surface-accent hover:text-foreground'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-left">{page.title}</span>
              </Link>
            );
          })
        )}
      </div>

      {/* Help Link */}
      <div className="mt-auto px-3 pt-3 border-t border-border">
        <div className="bg-surface-accent rounded-md p-3">
          <div className="text-xs text-foreground-subtle mb-1">Need more help?</div>
          <a
            href="mailto:loveofminnesota@gmail.com"
            className="text-xs text-lake-blue hover:text-lake-blue-light underline"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
