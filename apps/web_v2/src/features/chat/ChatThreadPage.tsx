'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  type ChatMessageRow,
  type ChatThreadRow,
} from '@/features/chat/chatTypes';
import ChatComposer, {
  type ChatComposerSubmitPayload,
} from '@/features/chat/ChatComposer';
import ChatDropSurface from '@/features/chat/ChatDropSurface';
import ChatMessageToolbar, {
  type ChatToolbarCitation,
} from '@/features/chat/ChatMessageToolbar';
import ChatThinkingConsole from '@/features/chat/ChatThinkingConsole';
import ChatThreadsSidebar from '@/features/chat/ChatThreadsSidebar';
import ChatThreadUsageModal from '@/features/chat/ChatThreadUsageModal';
import ChatTopChrome from '@/features/chat/ChatTopChrome';
import type { ThreadUsageResponse } from '@/features/chat/chatUsage';
import { consumeChatMessageStream } from '@/features/chat/consumeChatMessageStream';
import {
  claimPendingChatKickoff,
  releasePendingChatKickoff,
} from '@/features/chat/pendingChatTurn';
import type { PendingChatAttachment } from '@/features/chat/uploadChatAttachment';
import { parseAttachmentsFromMeta } from '@/lib/ai/chatAttachments';
import type { SubjectResponseMilestone } from '@/lib/ai/subjectResponseMilestones';
import AiMarkdown from '@/features/map/dockCore/panes/AiMarkdown';
import {
  IconChartBar,
  IconEllipsis,
  IconPencil,
  IconSpinner,
  IconTrash,
} from '@/features/map/dockCore/core/icons';
import { safePadBottomKeyboard } from '@/lib/despia/safeArea';
import {
  DEFAULT_ANSWER_MODE,
  readPreferredAnswerMode,
  writePreferredAnswerMode,
  type AnswerMode,
} from '@/lib/ai/answerModes';
import { HELPDESK_PATH } from '@/lib/routes/routePolicy';

function parseReasoningSummary(
  meta: Record<string, unknown> | null | undefined,
): string | null {
  const raw = meta?.reasoning_summary;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function parseCitationsFromMeta(
  meta: Record<string, unknown> | null | undefined,
): ChatToolbarCitation[] {
  const raw = meta?.citations;
  if (!Array.isArray(raw)) return [];
  const out: ChatToolbarCitation[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const url = typeof r.url === 'string' ? r.url : null;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({
      url,
      title: typeof r.title === 'string' ? r.title : null,
    });
  }
  return out;
}

/**
 * /helpdesk/[threadId] — conversation push. Footer nav is hidden so the composer
 * owns the bottom edge. Messages live in `ai.subject_messages`.
 */
export default function ChatThreadPage({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [thread, setThread] = useState<Pick<
    ChatThreadRow,
    'id' | 'title' | 'subject_type' | 'subject_id'
  > | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [comingSoon, setComingSoon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [answerMode, setAnswerMode] = useState<AnswerMode>(DEFAULT_ANSWER_MODE);
  const [attachments, setAttachments] = useState<PendingChatAttachment[]>([]);
  const [milestones, setMilestones] = useState<SubjectResponseMilestone[]>([]);
  const [usageOpen, setUsageOpen] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<ThreadUsageResponse | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setError(null);
    try {
      const res = await fetch(`/api/ai/threads/${threadId}/messages`, {
        credentials: 'include',
        signal,
      });
      const json = (await res.json().catch(() => ({}))) as {
        comingSoon?: boolean;
        error?: string;
        thread?: ChatThreadRow;
        messages?: ChatMessageRow[];
      };
      if (json.comingSoon) {
        setComingSoon(true);
        return;
      }
      if (!res.ok) {
        setError(json.error || 'Could not load conversation');
        return;
      }
      setComingSoon(false);
      if (json.thread) {
        setThread({
          id: json.thread.id,
          title: json.thread.title,
          subject_type: json.thread.subject_type,
          subject_id: json.thread.subject_id,
        });
        setTitleDraft(json.thread.title?.trim() || 'Helpdesk');
      }
      setMessages((prev) => {
        const server = json.messages ?? [];
        if (server.length > 0) return server;
        // Keep an in-flight optimistic first turn while the stream starts.
        const optimistic = prev.filter((m) => m.id.startsWith('optimistic_'));
        return optimistic.length > 0 ? optimistic : server;
      });
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setError('Could not load conversation');
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  useEffect(() => {
    setAnswerMode(readPreferredAnswerMode());
  }, []);

  const onModeChange = useCallback((mode: AnswerMode) => {
    setAnswerMode(mode);
    writePreferredAnswerMode(mode);
  }, []);


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending, milestones.length]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const commitTitle = useCallback(async () => {
    if (!thread || savingTitle) return;
    const next = titleDraft.trim().slice(0, 120);
    const current = thread.title?.trim() || 'Helpdesk';
    if (!next || next === current) {
      setTitleDraft(current);
      return;
    }
    setSavingTitle(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/threads/${threadId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: next }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        thread?: ChatThreadRow;
      };
      if (!res.ok || !json.thread) {
        setError(json.error || 'Could not rename');
        setTitleDraft(current);
        return;
      }
      setThread({
        ...thread,
        title: json.thread.title,
      });
      setTitleDraft(json.thread.title?.trim() || next);
    } catch {
      setError('Could not rename');
      setTitleDraft(current);
    } finally {
      setSavingTitle(false);
    }
  }, [savingTitle, thread, threadId, titleDraft]);

  const startRename = useCallback(() => {
    setMenuOpen(false);
    requestAnimationFrame(() => {
      const el = titleRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
  }, []);

  const send = useCallback(
    async (payload: {
      content: string;
      attachmentIds: string[];
      mode?: AnswerMode;
      /** Use when firing before React state has the attachments (pending first turn). */
      attachmentSnapshot?: PendingChatAttachment[];
    }) => {
      const content = payload.content.trim();
      if (
        (!content && payload.attachmentIds.length === 0) ||
        sending ||
        comingSoon
      ) {
        return;
      }
      setSending(true);
      setError(null);
      setDraft('');
      setMilestones([]);
      const pool = payload.attachmentSnapshot ?? attachments;
      const sentAttachments = pool.filter((a) =>
        payload.attachmentIds.includes(a.id),
      );
      setAttachments([]);

      const optimisticId = `optimistic_${crypto.randomUUID()}`;
      const optimisticUser: ChatMessageRow = {
        id: optimisticId,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
        meta:
          sentAttachments.length > 0
            ? {
                attachments: sentAttachments.map((a) => ({
                  id: a.id,
                  public_url: a.previewUrl || a.public_url,
                  mime_type: a.mime_type,
                  original_name: a.original_name,
                  file_size: a.file_size,
                  kind: a.kind,
                })),
              }
            : null,
      };
      setMessages((prev) => [...prev, optimisticUser]);

      const rollbackOptimistic = () => {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setDraft(content);
        setAttachments(sentAttachments);
        setMilestones([]);
      };

      try {
        const turnMode = payload.mode ?? answerMode;
        const result = await consumeChatMessageStream(
          threadId,
          {
            content,
            attachment_ids: payload.attachmentIds,
            mode: turnMode,
          },
          {
            onMilestone: (m) => setMilestones((prev) => [...prev, m]),
            onUser: (userMessage) => {
              setMessages((prev) =>
                prev.map((msg) => (msg.id === optimisticId ? userMessage : msg)),
              );
            },
          },
        );

        if (!result.ok) {
          if (result.comingSoon) {
            setComingSoon(true);
            rollbackOptimistic();
            return;
          }
          setError(result.error || 'Send failed');
          rollbackOptimistic();
          return;
        }

        setMessages((prev) => {
          const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
          const hasUser = result.userMessage
            ? withoutOptimistic.some((m) => m.id === result.userMessage!.id)
            : true;
          const next = [...withoutOptimistic];
          if (result.userMessage && !hasUser) next.push(result.userMessage);
          next.push(result.assistantMessage);
          return next;
        });
        setMilestones([]);

        if (
          thread &&
          (!thread.title ||
            thread.title === 'New conversation' ||
            thread.title === 'New chat')
        ) {
          const nextTitle = content
            ? content.length > 48
              ? `${content.slice(0, 45)}…`
              : content
            : sentAttachments[0]?.original_name || 'Attachment';
          setThread({ ...thread, title: nextTitle });
          setTitleDraft(nextTitle);
        }
      } catch {
        setError('Send failed');
        rollbackOptimistic();
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
    },
    [answerMode, attachments, comingSoon, sending, thread, threadId],
  );

  const sendRef = useRef(send);
  sendRef.current = send;

  // Kick off a stashed first turn ASAP (don't wait for message history load).
  useEffect(() => {
    if (comingSoon) return;
    const pending = claimPendingChatKickoff(threadId);
    if (!pending) return;
    if (pending.mode) {
      setAnswerMode(pending.mode);
      writePreferredAnswerMode(pending.mode);
    }
    void sendRef
      .current({
        content: pending.content,
        attachmentIds: pending.attachmentIds,
        attachmentSnapshot: pending.attachments,
        mode: pending.mode,
      })
      .finally(() => {
        releasePendingChatKickoff(threadId);
      });
  }, [comingSoon, threadId]);

  const openUsage = useCallback(async () => {
    setMenuOpen(false);
    setUsageOpen(true);
    setUsageLoading(true);
    setUsageError(null);
    try {
      const res = await fetch(`/api/ai/threads/${threadId}/usage`, {
        credentials: 'include',
      });
      const json = (await res.json().catch(() => ({}))) as ThreadUsageResponse & {
        error?: string;
        comingSoon?: boolean;
      };
      if (json.comingSoon) {
        setComingSoon(true);
        setUsageOpen(false);
        return;
      }
      if (!res.ok) {
        setUsageError(json.error || 'Could not load usage');
        setUsageData(null);
        return;
      }
      setUsageData({
        thread: json.thread,
        account: json.account,
        by_mode: json.by_mode ?? [],
        recent: json.recent ?? [],
      });
    } catch {
      setUsageError('Could not load usage');
      setUsageData(null);
    } finally {
      setUsageLoading(false);
    }
  }, [threadId]);

  const deleteThread = useCallback(async () => {
    setMenuOpen(false);
    if (!confirm('Delete this chat? Messages will be removed.')) return;
    try {
      const res = await fetch(`/api/ai/threads/${threadId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error || 'Could not delete');
        return;
      }
      router.replace(HELPDESK_PATH);
    } catch {
      setError('Could not delete');
    }
  }, [router, threadId]);

  return (
    <>
      <ChatDropSurface
        disabled={comingSoon || (loading && messages.length === 0)}
        threadId={threadId}
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        className="bg-[#f7f5f1]"
      >
        <ChatTopChrome
          threadsOpen={threadsOpen}
          onOpenThreads={() => setThreadsOpen(true)}
          titleSlot={
            <input
              ref={titleRef}
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => void commitTitle()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
                if (e.key === 'Escape') {
                  setTitleDraft(thread?.title?.trim() || 'Helpdesk');
                  (e.target as HTMLInputElement).blur();
                }
              }}
              disabled={loading || comingSoon || savingTitle}
              aria-label="Thread title"
              maxLength={120}
              className="w-full truncate bg-transparent text-center text-[16px] font-semibold text-foreground outline-none placeholder:text-foreground-muted disabled:opacity-60"
              placeholder="Helpdesk"
            />
          }
          right={
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => void openUsage()}
                aria-label="Thread usage"
                disabled={loading || comingSoon}
                className="grid h-9 w-9 place-items-center rounded-full transition active:bg-black/[0.06] disabled:opacity-40"
              >
                <IconChartBar className="h-5 w-5" />
              </button>
              <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Thread options"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                disabled={loading || comingSoon}
                className="grid h-9 w-9 place-items-center rounded-full transition active:bg-black/[0.06] disabled:opacity-40"
              >
                <IconEllipsis className="h-5 w-5" />
              </button>
              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-20 mt-1 min-w-[10.5rem] overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/[0.08]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={startRename}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] font-medium text-foreground transition active:bg-black/[0.04]"
                  >
                    <IconPencil className="h-4 w-4 text-foreground-muted" />
                    Rename
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void deleteThread()}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] font-medium text-red-700 transition active:bg-black/[0.04]"
                  >
                    <IconTrash className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              ) : null}
              </div>
            </div>
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4">
          {loading && messages.length === 0 ? (
            <div className="flex justify-center py-16">
              <IconSpinner className="h-6 w-6 animate-spin text-foreground-muted" />
            </div>
          ) : comingSoon ? (
            <p className="py-16 text-center text-[14px] text-foreground-muted">
              Chat is coming soon.
            </p>
          ) : error && messages.length === 0 ? (
            <p className="py-16 text-center text-[14px] text-red-700">{error}</p>
          ) : messages.length === 0 ? (
            <p className="py-16 text-center text-[14px] text-foreground-muted">
              Ask anything about Minnesota — this thread is yours.
            </p>
          ) : (
            <ul className="space-y-5">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                const msgAttachments = parseAttachmentsFromMeta(
                  (msg.meta ?? null) as Record<string, unknown> | null,
                );
                if (isUser) {
                  return (
                    <li key={msg.id} className="flex flex-col items-end">
                      {msgAttachments.length > 0 ? (
                        <ul className="mb-2 flex max-w-[85%] flex-wrap justify-end gap-2">
                          {msgAttachments.map((att) => (
                            <li key={att.id}>
                              {att.kind === 'image' ? (
                                <a
                                  href={att.public_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block overflow-hidden rounded-2xl ring-1 ring-black/[0.06]"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={att.public_url}
                                    alt={att.original_name || 'Attachment'}
                                    className="max-h-56 max-w-full object-cover"
                                  />
                                </a>
                              ) : (
                                <a
                                  href={att.public_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 rounded-2xl bg-[rgba(180,156,120,0.22)] px-3 py-2 text-[13px] font-medium text-foreground"
                                >
                                  <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-bold">
                                    PDF
                                  </span>
                                  <span className="max-w-[10rem] truncate">
                                    {att.original_name || 'Document'}
                                  </span>
                                </a>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {msg.content?.trim() ? (
                        <div className="max-w-[85%] rounded-[22px] bg-[rgba(180,156,120,0.22)] px-4 py-2.5 text-[16px] leading-relaxed text-foreground">
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      ) : null}
                      <div className="max-w-[85%]">
                        <ChatMessageToolbar
                          content={msg.content}
                          createdAt={msg.created_at}
                          align="end"
                        />
                      </div>
                    </li>
                  );
                }
                return (
                  <li
                    key={msg.id}
                    className="w-full text-[16px] leading-relaxed text-foreground"
                  >
                    <AiMarkdown content={msg.content} />
                    <ChatMessageToolbar
                      content={msg.content}
                      createdAt={msg.created_at}
                      align="start"
                      reasoningSummary={parseReasoningSummary(
                        (msg.meta ?? null) as Record<string, unknown> | null,
                      )}
                      citations={parseCitationsFromMeta(
                        (msg.meta ?? null) as Record<string, unknown> | null,
                      )}
                    />
                  </li>
                );
              })}
              {sending ? (
                <li className="pt-1">
                  <ChatThinkingConsole milestones={milestones} active />
                </li>
              ) : null}
            </ul>
          )}
          {error && messages.length > 0 ? (
            <p className="mt-3 text-center text-[13px] text-red-700">{error}</p>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div
          data-chat-composer-dock=""
          className="shrink-0 bg-[#f7f5f1] px-3 pt-2"
          style={{ paddingBottom: safePadBottomKeyboard('0.5rem') }}
        >
          <ChatComposer
            id="chat-thread-prompt"
            variant="bar"
            value={draft}
            onChange={setDraft}
            onSubmit={(payload) => void send(payload)}
            disabled={comingSoon || (loading && messages.length === 0)}
            submitting={sending}
            inputRef={inputRef}
            placeholder="Message…"
            threadId={threadId}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            mode={answerMode}
            onModeChange={onModeChange}
          />
        </div>
      </ChatDropSurface>

      <ChatThreadUsageModal
        open={usageOpen}
        onClose={() => setUsageOpen(false)}
        loading={usageLoading}
        error={usageError}
        data={usageData}
      />

      <ChatThreadsSidebar
        open={threadsOpen}
        onClose={() => setThreadsOpen(false)}
        activeThreadId={threadId}
      />
    </>
  );
}
