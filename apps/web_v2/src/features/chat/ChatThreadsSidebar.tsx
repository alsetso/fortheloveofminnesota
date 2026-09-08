'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  formatThreadWhen,
  subjectTypeLabel,
  type ChatThreadRow,
} from '@/features/chat/chatTypes';
import {
  IconPlus,
  IconSpinner,
  IconX,
} from '@/features/map/dockCore/core/icons';
import { safePadBottom, safePadTop } from '@/lib/despia/safeArea';
import { HELPDESK_PATH } from '@/lib/routes/routePolicy';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';

type ChatThreadsSidebarProps = {
  open: boolean;
  onClose: () => void;
  /** Highlight the active conversation when on a thread route. */
  activeThreadId?: string | null;
};

/**
 * Left overlay thread list — slides over chat content without pushing it.
 */
export default function ChatThreadsSidebar({
  open,
  onClose,
  activeThreadId = null,
}: ChatThreadsSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [threads, setThreads] = useState<ChatThreadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/threads', {
        credentials: 'include',
        signal,
      });
      const json = (await res.json().catch(() => ({}))) as {
        comingSoon?: boolean;
        error?: string;
        threads?: ChatThreadRow[];
      };
      if (json.comingSoon) {
        setThreads([]);
        return;
      }
      if (!res.ok) {
        setError(json.error || 'Could not load threads');
        return;
      }
      setThreads(json.threads ?? []);
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setError('Could not load threads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const goNew = () => {
    onClose();
    if (pathname !== HELPDESK_PATH) router.push(HELPDESK_PATH);
  };

  return (
    <div
      className={`fixed inset-0 ${Z_LAYER_CLASS.APP_OVERLAY} ${
        open ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close threads"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={`absolute inset-0 bg-black/25 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <aside
        id="chat-threads-sidebar"
        role="dialog"
        aria-modal="true"
        aria-label="Threads"
        className={`absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-[#f7f5f1] shadow-xl transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          paddingTop: safePadTop('0.35rem'),
          paddingBottom: safePadBottom('0.5rem'),
        }}
      >
        <div className="flex h-11 shrink-0 items-center gap-2 px-3">
          <h2 className="min-w-0 flex-1 truncate px-1 text-[17px] font-semibold text-foreground">
            Threads
          </h2>
          <button
            type="button"
            onClick={goNew}
            aria-label="New conversation"
            className="grid h-9 w-9 place-items-center rounded-full text-foreground transition active:bg-black/[0.06]"
          >
            <IconPlus className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-foreground transition active:bg-black/[0.06]"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          {loading && threads.length === 0 ? (
            <div className="flex justify-center py-16">
              <IconSpinner className="h-5 w-5 animate-spin text-foreground-muted" />
            </div>
          ) : error && threads.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[14px] text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-3 text-[14px] font-medium text-foreground"
              >
                Try again
              </button>
            </div>
          ) : threads.length === 0 ? (
            <p className="px-5 py-12 text-center text-[14px] text-foreground-muted">
              No threads yet
            </p>
          ) : (
            <ul className="pb-4">
              {threads.map((thread) => {
                const href = `${HELPDESK_PATH}/${thread.id}`;
                const active = activeThreadId === thread.id;
                return (
                  <li key={thread.id}>
                    <Link
                      href={href}
                      onClick={onClose}
                      className={`block px-4 py-3 transition active:bg-black/[0.04] ${
                        active ? 'bg-black/[0.05]' : ''
                      }`}
                    >
                      <span className="block truncate text-[15px] font-medium text-foreground">
                        {thread.title?.trim() || 'New conversation'}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-foreground-muted">
                        {subjectTypeLabel(thread.subject_type)}
                        {' · '}
                        {formatThreadWhen(thread.updated_at)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
