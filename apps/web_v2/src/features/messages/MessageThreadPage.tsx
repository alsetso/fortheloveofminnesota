'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSafe } from '@/features/auth';
import { DmPeerAvatar } from '@/features/messages/DmPeerAvatar';
import {
  dmPeerDisplayName,
  fetchDmThread,
  markDmThreadSeen,
  sendDmMessage,
  type DmMessage,
  type DmPeerAccount,
} from '@/features/messages/messagesApi';
import { IconArrowLeft } from '@/features/map/dockCore/core/icons';
import { safePadBottom, safePadTop } from '@/lib/despia/safeArea';
import { MESSAGES_PATH } from '@/lib/routes/routePolicy';

function bubbleTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * /message/thread/:id — clean iMessage-style conversation.
 */
export default function MessageThreadPage({ threadId }: { threadId: string }) {
  const router = useRouter();
  const { account } = useAuthSafe();
  const [peer, setPeer] = useState<DmPeerAccount | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DmMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      setError(null);
      try {
        const data = await fetchDmThread(threadId, signal);
        if (signal?.aborted) return;
        setMessages(data.messages);
        setPeer(data.other_account);
        setViewerId(data.viewer_account_id);
        void markDmThreadSeen(threadId);
      } catch (e: unknown) {
        if (signal?.aborted) return;
        setError(e instanceof Error ? e.message : 'Failed to load');
        setMessages([]);
      }
    },
    [threadId],
  );

  useEffect(() => {
    const ac = new AbortController();
    void reload(ac.signal);
    return () => ac.abort();
  }, [reload]);

  useLayoutEffect(() => {
    if (messages && messages.length > 0) scrollToBottom(false);
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(120, Math.max(36, el.scrollHeight))}px`;
  }, [draft]);

  const onBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(MESSAGES_PATH);
  };

  const onSend = async () => {
    const text = draft.trim();
    if (!text || sending || !account?.id) return;
    setSending(true);
    setDraft('');
    const optimistic: DmMessage = {
      id: `local-${Date.now()}`,
      body: text,
      sender_id: account.id,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...(prev ?? []), optimistic]);
    requestAnimationFrame(() => scrollToBottom(true));
    try {
      const saved = await sendDmMessage(threadId, text);
      setMessages((prev) =>
        (prev ?? []).map((m) => (m.id === optimistic.id ? saved : m)),
      );
    } catch {
      setMessages((prev) => (prev ?? []).filter((m) => m.id !== optimistic.id));
      setDraft(text);
      setError('Couldn’t send. Try again.');
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void onSend();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void onSend();
    }
  };

  const title = dmPeerDisplayName(peer);
  const canSend = Boolean(draft.trim()) && !sending && Boolean(account?.id);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f5f1]">
      <header
        className="shrink-0 border-b border-black/[0.08] bg-[#f7f5f1]/95 backdrop-blur-md"
        style={{ paddingTop: safePadTop('0.15rem') }}
      >
        <div className="flex h-12 items-center gap-1 px-1">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="inline-flex items-center gap-0.5 py-1.5 pl-1 pr-1 text-[17px] text-lake-blue active:opacity-60"
          >
            <IconArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 pr-8">
            <DmPeerAvatar peer={peer} size={28} />
            <h1 className="truncate text-[16px] font-semibold tracking-tight text-foreground">
              {peer ? title : 'Messages'}
            </h1>
          </div>
        </div>
      </header>

      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {error && messages?.length === 0 ? (
          <p className="px-2 py-10 text-center text-[14px] text-foreground-muted">{error}</p>
        ) : messages === null ? (
          <p className="px-2 py-10 text-center text-[14px] text-foreground-muted">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="px-2 py-10 text-center text-[14px] text-foreground-muted">
            Say hello to start the conversation.
          </p>
        ) : (
          <div className="mx-auto flex max-w-xl flex-col gap-1.5">
            {messages.map((msg, i) => {
              const mine = msg.sender_id === (viewerId ?? account?.id);
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const samePrev =
                prev &&
                prev.sender_id === msg.sender_id &&
                new Date(msg.created_at).getTime() -
                  new Date(prev.created_at).getTime() <
                  2 * 60 * 1000;
              const sameNext =
                next &&
                next.sender_id === msg.sender_id &&
                new Date(next.created_at).getTime() -
                  new Date(msg.created_at).getTime() <
                  2 * 60 * 1000;
              const showTime = !sameNext;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${mine ? 'items-end' : 'items-start'} ${
                    samePrev ? '' : 'mt-2'
                  }`}
                >
                  <div
                    className={`max-w-[78%] whitespace-pre-wrap break-words px-3.5 py-2 text-[16px] leading-[1.3] ${
                      mine
                        ? 'bg-lake-blue text-white'
                        : 'bg-white text-foreground ring-1 ring-black/[0.06]'
                    } ${
                      mine
                        ? samePrev && sameNext
                          ? 'rounded-2xl rounded-r-md'
                          : samePrev
                            ? 'rounded-2xl rounded-tr-md'
                            : sameNext
                              ? 'rounded-2xl rounded-br-md'
                              : 'rounded-2xl'
                        : samePrev && sameNext
                          ? 'rounded-2xl rounded-l-md'
                          : samePrev
                            ? 'rounded-2xl rounded-tl-md'
                            : sameNext
                              ? 'rounded-2xl rounded-bl-md'
                              : 'rounded-2xl'
                    }`}
                  >
                    {msg.body}
                  </div>
                  {showTime ? (
                    <span className="mt-1 px-1 text-[11px] tabular-nums text-foreground-muted">
                      {bubbleTime(msg.created_at)}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="shrink-0 border-t border-black/[0.08] bg-[#f7f5f1]"
        style={{ paddingBottom: safePadBottom('0.55rem') }}
      >
        <div className="flex items-end gap-2 px-3 pt-2">
          <div className="flex min-w-0 flex-1 items-end rounded-[22px] border border-black/[0.1] bg-white px-3.5 py-1.5">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Message"
              aria-label="Message"
              className="max-h-[120px] min-h-[36px] w-full resize-none bg-transparent py-1.5 text-[16px] leading-[1.3] text-foreground outline-none placeholder:text-foreground-muted"
            />
          </div>
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send"
            className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lake-blue text-white transition active:scale-95 disabled:opacity-35"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M3.4 20.6 21 12 3.4 3.4l.1 6.7L15 12 3.5 13.9z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
