'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '@/lib/supabase';
import { useAuthStateSafe } from '@/features/auth';
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
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface DocPage {
  slug: string;
  title: string;
  body: string;
  icon: string | null;
  sort_order: number;
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

interface DocsContentProps {
  /** Current doc slug from path /docs/[slug] */
  slug?: string;
}

/**
 * Documentation Content — fetches from docs.pages, renders Markdown body.
 */
export default function DocsContent({ slug: slugProp }: DocsContentProps) {
  const searchParams = useSearchParams();
  const docSlug = slugProp ?? searchParams.get('doc') ?? 'getting-started';
  const { account } = useAuthStateSafe();
  const isAdmin = account?.role === 'admin';

  const [pages, setPages] = useState<DocPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchPages = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .schema('docs')
      .from('pages')
      .select('slug, title, body, icon, sort_order')
      .order('sort_order', { ascending: true });
    if (!error && data) setPages(data as DocPage[]);
  }, []);

  useEffect(() => {
    fetchPages().finally(() => setLoading(false));
  }, [fetchPages]);

  useEffect(() => {
    setIsEditing(false);
  }, [docSlug]);

  const currentPage = useMemo(
    () => pages.find((p) => p.slug === docSlug) ?? pages[0] ?? null,
    [pages, docSlug],
  );

  const currentIndex = useMemo(
    () => (currentPage ? pages.findIndex((p) => p.slug === currentPage.slug) : -1),
    [pages, currentPage],
  );

  const prevPage = currentIndex > 0 ? pages[currentIndex - 1] : null;
  const nextPage = currentIndex >= 0 && currentIndex < pages.length - 1 ? pages[currentIndex + 1] : null;

  const Icon = currentPage?.icon ? (ICON_MAP[currentPage.icon] || InformationCircleIcon) : InformationCircleIcon;

  const startEditing = useCallback(() => {
    if (!currentPage) return;
    setEditBody(currentPage.body);
    setSaveError(null);
    setIsEditing(true);
  }, [currentPage]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setSaveError(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!currentPage) return;
    setSaving(true);
    setSaveError(null);
    const { error } = await (supabase as any)
      .schema('docs')
      .from('pages')
      .update({ body: editBody, updated_at: new Date().toISOString() })
      .eq('slug', currentPage.slug);
    setSaving(false);
    if (error) {
      setSaveError(error.message ?? 'Failed to save');
      return;
    }
    setPages((prev) =>
      prev.map((p) => (p.slug === currentPage.slug ? { ...p, body: editBody } : p)),
    );
    setIsEditing(false);
  }, [currentPage, editBody]);

  if (loading) {
    return (
      <div className="max-w-[800px] mx-auto w-full px-4 py-6 space-y-4">
        <div className="h-8 w-64 bg-surface-accent rounded animate-pulse" />
        <div className="h-4 w-48 bg-surface-accent rounded animate-pulse" />
        <div className="bg-surface border border-border rounded-md p-6 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-4 bg-surface-accent rounded animate-pulse"
              style={{ width: `${65 + (i % 3) * 12}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!currentPage) {
    return (
      <div className="max-w-[800px] mx-auto w-full px-4 py-6">
        <p className="text-sm text-foreground-muted mb-2">Document not found.</p>
        <Link href="/docs/getting-started" className="text-sm text-lake-blue hover:text-lake-blue-light underline">
          Back to Documentation
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Icon className="w-6 h-6 text-foreground-subtle shrink-0" />
          <h1 className="text-2xl font-bold text-foreground">{currentPage.title}</h1>
          {isAdmin && (
            <div className="ml-auto flex items-center gap-2">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={startEditing}
                  className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground hover:bg-gray-50 border border-gray-200 rounded-md transition-colors"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                  Edit
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={saveEdit}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-white bg-gray-700 hover:bg-gray-800 disabled:opacity-50 border border-gray-200 rounded-md transition-colors"
                  >
                    <CheckIcon className="w-4 h-4" />
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground hover:bg-gray-50 border border-gray-200 rounded-md transition-colors"
                  >
                    <XMarkIcon className="w-4 h-4" />
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <p className="text-sm text-foreground-subtle">
          Documentation and help guides for Love of Minnesota
        </p>
        {isAdmin && saveError && (
          <p className="mt-2 text-xs text-red-600">{saveError}</p>
        )}
      </div>

      {/* Body: view (Markdown) or edit (textarea) */}
      <div className="bg-surface border border-border rounded-md p-6 prose-docs">
        {isEditing ? (
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            className="w-full min-h-[320px] p-0 text-sm text-foreground-muted font-mono bg-transparent border-0 resize-y focus:outline-none focus:ring-0"
            placeholder="Markdown content…"
            spellCheck={false}
          />
        ) : (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children }) => (
              <h2 className="text-base font-semibold text-foreground mt-6 mb-3 first:mt-0">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">{children}</h3>
            ),
            p: ({ children }) => (
              <p className="text-sm text-foreground-muted mb-3 leading-relaxed">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside space-y-1.5 text-sm text-foreground-muted ml-2 mb-3">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-foreground-muted ml-2 mb-3">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="text-sm text-foreground-muted">{children}</li>
            ),
            strong: ({ children }) => (
              <strong className="text-foreground font-semibold">{children}</strong>
            ),
            a: ({ href, children }) => {
              const isInternal = href?.startsWith('/');
              if (isInternal) {
                return (
                  <Link href={href!} className="text-lake-blue hover:text-lake-blue-light underline">
                    {children}
                  </Link>
                );
              }
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-lake-blue hover:text-lake-blue-light underline">
                  {children}
                </a>
              );
            },
            table: ({ children }) => (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm border border-border rounded-md">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-surface-accent text-foreground">{children}</thead>
            ),
            th: ({ children }) => (
              <th className="text-left text-xs font-semibold px-3 py-2 border-b border-border">{children}</th>
            ),
            td: ({ children }) => (
              <td className="text-xs text-foreground-muted px-3 py-2 border-b border-border">{children}</td>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-border pl-3 my-3 text-sm text-foreground-subtle italic">
                {children}
              </blockquote>
            ),
            code: ({ children, className }) => {
              const isBlock = className?.includes('language-');
              if (isBlock) {
                return (
                  <code className="block bg-surface-accent rounded-md p-3 text-xs text-foreground overflow-x-auto my-3 font-mono">
                    {children}
                  </code>
                );
              }
              return (
                <code className="bg-surface-accent px-1 py-0.5 rounded text-xs text-foreground font-mono">
                  {children}
                </code>
              );
            },
            pre: ({ children }) => <pre className="my-3">{children}</pre>,
            hr: () => <hr className="border-border my-4" />,
          }}
        >
          {currentPage.body}
        </ReactMarkdown>
        )}
      </div>

      {/* Prev / Next Navigation */}
      <div className="mt-6 pt-6 border-t border-border flex items-center justify-between">
        {prevPage ? (
          <Link
            href={`/docs/${prevPage.slug}`}
            className="text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            ← {prevPage.title}
          </Link>
        ) : (
          <span />
        )}
        {nextPage ? (
          <Link
            href={`/docs/${nextPage.slug}`}
            className="text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            {nextPage.title} →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
