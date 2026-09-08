'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageScroll } from '@/features/appShell/PageScroll';
import { APP_TAB_BAR_HEIGHT_PX } from '@/features/appShell/tabs';
import {
  formatThreadWhen,
  previewMessageContent,
  subjectTypeLabel,
  type ChatRecentMessage,
  type ChatThreadRow,
} from '@/features/chat/chatTypes';
import ChatComposer from '@/features/chat/ChatComposer';
import ChatDropSurface from '@/features/chat/ChatDropSurface';
import ChatThinkingConsole from '@/features/chat/ChatThinkingConsole';
import type { PendingChatAttachment } from '@/features/chat/uploadChatAttachment';
import { stashPendingChatTurn } from '@/features/chat/pendingChatTurn';
import ChatAccountUsageModal from '@/features/chat/ChatAccountUsageModal';
import type { ChatComposerSubmitPayload } from '@/features/chat/ChatComposer';
import type { AccountUsageResponse } from '@/features/chat/chatUsage';
import ChatThreadsSidebar from '@/features/chat/ChatThreadsSidebar';
import ChatTopChrome from '@/features/chat/ChatTopChrome';
import { IconChartBar, IconSpinner } from '@/features/map/dockCore/core/icons';
import { safePadBottomTabOrKeyboard } from '@/lib/despia/safeArea';
import {
  DEFAULT_ANSWER_MODE,
  readPreferredAnswerMode,
  writePreferredAnswerMode,
  type AnswerMode,
} from '@/lib/ai/answerModes';
import { HELPDESK_PATH } from '@/lib/routes/routePolicy';

function titleFromPrompt(content: string, attachmentNames: string[]): string {
  const line = content.trim().split(/\n/)[0]?.trim();
  if (line) return line.length > 48 ? `${line.slice(0, 45)}…` : line;
  const name = attachmentNames[0]?.trim();
  if (name) return name.length > 48 ? `${name.slice(0, 45)}…` : name;
  return 'New conversation';
}

const MD_QUERY = '(min-width: 768px)';

function subscribeMd(onChange: () => void) {
  const mql = window.matchMedia(MD_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getMdSnapshot() {
  return window.matchMedia(MD_QUERY).matches;
}

function getMdServerSnapshot() {
  return false;
}

function useIsDesktop() {
  return useSyncExternalStore(subscribeMd, getMdSnapshot, getMdServerSnapshot);
}

/**
 * /helpdesk — one composer tree. Desktop: centered hero pill. Mobile: title +
 * composer centered as one group above the tab bar.
 */
export default function ChatPage() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [threads, setThreads] = useState<ChatThreadRow[]>([]);
  const [recentMessages, setRecentMessages] = useState<ChatRecentMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [comingSoon, setComingSoon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [answerMode, setAnswerMode] = useState<AnswerMode>(DEFAULT_ANSWER_MODE);
  const [usageOpen, setUsageOpen] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<AccountUsageResponse | null>(null);
  const [attachments, setAttachments] = useState<PendingChatAttachment[]>([]);
  const [launching, setLaunching] = useState<{
    content: string;
    attachments: PendingChatAttachment[];
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setError(null);
    try {
      const res = await fetch('/api/ai/threads', {
        credentials: 'include',
        signal,
      });
      const json = (await res.json().catch(() => ({}))) as {
        comingSoon?: boolean;
        message?: string;
        error?: string;
        threads?: ChatThreadRow[];
        recent_messages?: ChatRecentMessage[];
      };
      if (json.comingSoon) {
        setComingSoon(true);
        setThreads([]);
        setRecentMessages([]);
        return;
      }
      if (!res.ok) {
        setError(json.error || 'Could not load chats');
        return;
      }
      setComingSoon(false);
      setThreads(json.threads ?? []);
      setRecentMessages(json.recent_messages ?? []);
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setError('Could not load chats');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const openUsage = useCallback(async () => {
    setUsageOpen(true);
    setUsageLoading(true);
    setUsageError(null);
    try {
      const res = await fetch('/api/ai/usage', { credentials: 'include' });
      const json = (await res.json().catch(() => ({}))) as AccountUsageResponse & {
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
  }, []);

  const startThread = useCallback(
    async (payload: ChatComposerSubmitPayload) => {
      const content = payload.content.trim();
      if ((!content && payload.attachmentIds.length === 0) || creating || comingSoon) {
        return;
      }
      const sentAttachments = attachments.filter((a) =>
        payload.attachmentIds.includes(a.id),
      );

      // Instant post: clear composer and show the turn before the network round-trip.
      setCreating(true);
      setError(null);
      setPrompt('');
      setAttachments([]);
      setLaunching({ content, attachments: sentAttachments });

      try {
        const createRes = await fetch('/api/ai/threads', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: titleFromPrompt(
              content,
              sentAttachments.map((a) => a.original_name || '').filter(Boolean),
            ),
          }),
        });
        const createJson = (await createRes.json().catch(() => ({}))) as {
          comingSoon?: boolean;
          error?: string;
          thread?: ChatThreadRow;
        };
        if (createJson.comingSoon) {
          setComingSoon(true);
          setLaunching(null);
          setPrompt(content);
          setAttachments(sentAttachments);
          return;
        }
        if (!createRes.ok || !createJson.thread) {
          setError(createJson.error || 'Could not start chat');
          setLaunching(null);
          setPrompt(content);
          setAttachments(sentAttachments);
          return;
        }

        const threadId = createJson.thread.id;
        stashPendingChatTurn(threadId, {
          content,
          attachmentIds: payload.attachmentIds,
          attachments: sentAttachments,
          mode: payload.mode,
        });
        router.push(`${HELPDESK_PATH}/${threadId}`);
      } catch {
        setError('Could not start chat');
        setLaunching(null);
        setPrompt(content);
        setAttachments(sentAttachments);
      } finally {
        setCreating(false);
      }
    },
    [attachments, comingSoon, creating, router],
  );

  const composerDisabled = creating || comingSoon;

  const composer = (
    <ChatComposer
      id="chat-main-prompt"
      variant={isDesktop ? 'hero' : 'bar'}
      value={prompt}
      onChange={setPrompt}
      onSubmit={(payload) => void startThread(payload)}
      disabled={composerDisabled}
      submitting={creating}
      inputRef={textareaRef}
      attachments={attachments}
      onAttachmentsChange={setAttachments}
      mode={answerMode}
      onModeChange={onModeChange}
    />
  );

  const recentLinks =
    !comingSoon && !launching && recentMessages.length > 0 ? (
      <ul className="mt-5 w-full max-w-xl space-y-1 text-left">
        {recentMessages.map((msg) => (
          <li key={msg.id}>
            <Link
              href={`${HELPDESK_PATH}/${msg.thread_id}`}
              className="block truncate rounded-xl px-3 py-2 text-[14px] text-foreground-muted transition hover:bg-black/[0.04] hover:text-foreground active:bg-black/[0.06]"
            >
              {previewMessageContent(msg.content)}
            </Link>
          </li>
        ))}
      </ul>
    ) : null;

  const titleBlock = comingSoon ? (
    <div className="text-center">
      <p className="text-[17px] font-semibold text-foreground">Coming soon</p>
      <p className="mt-2 text-[15px] text-foreground-muted">
        Account chat is warming up.
      </p>
    </div>
  ) : (
    <h2
      className={`text-center font-semibold tracking-tight text-foreground ${
        isDesktop ? 'text-[32px]' : 'text-[26px]'
      }`}
    >
      Where should we begin?
    </h2>
  );

  const launchingTurn = launching ? (
    <div className="flex w-full max-w-xl flex-col gap-5 px-1">
      <div className="flex flex-col items-end">
        {launching.attachments.length > 0 ? (
          <ul className="mb-2 flex max-w-[85%] flex-wrap justify-end gap-2">
            {launching.attachments.map((att) => (
              <li key={att.id}>
                {att.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={att.previewUrl || att.public_url}
                    alt={att.original_name || 'Attachment'}
                    className="max-h-40 max-w-full rounded-2xl object-cover ring-1 ring-black/[0.06]"
                  />
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-2xl bg-[rgba(180,156,120,0.22)] px-3 py-2 text-[13px] font-medium text-foreground">
                    <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-bold">
                      PDF
                    </span>
                    <span className="max-w-[10rem] truncate">
                      {att.original_name || 'Document'}
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {launching.content.trim() ? (
          <div className="max-w-[85%] rounded-[22px] bg-[rgba(180,156,120,0.22)] px-4 py-2.5 text-left text-[16px] leading-relaxed text-foreground">
            <p className="whitespace-pre-wrap">{launching.content}</p>
          </div>
        ) : null}
      </div>
      <ChatThinkingConsole milestones={[]} active />
    </div>
  ) : null;

  return (
    <>
      <ChatDropSurface
        disabled={composerDisabled}
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        className="bg-[#f7f5f1]"
      >
        <ChatTopChrome
          title="Helpdesk"
          threadsOpen={threadsOpen}
          onOpenThreads={() => setThreadsOpen(true)}
          right={
            <button
              type="button"
              onClick={() => void openUsage()}
              aria-label="Account usage"
              disabled={loading || comingSoon}
              className="grid h-9 w-9 place-items-center rounded-full transition active:bg-black/[0.06] disabled:opacity-40"
            >
              <IconChartBar className="h-5 w-5" />
            </button>
          }
        />

        {isDesktop ? (
          <PageScroll onRefresh={launching ? undefined : () => load()}>
            {launching ? (
              <section className="mx-auto flex w-full max-w-2xl flex-col px-6 pb-10 pt-8">
                {launchingTurn}
              </section>
            ) : (
              <>
                <section className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 pb-10 pt-[min(18vh,7rem)] text-center">
                  {titleBlock}
                  <div className="mt-8 w-full max-w-xl">{composer}</div>
                  {recentLinks}
                  {error ? (
                    <p className="mt-4 text-[13px] text-red-700">{error}</p>
                  ) : null}
                </section>

                {loading ? (
                  <div className="flex justify-center py-10">
                    <IconSpinner className="h-5 w-5 animate-spin text-foreground-muted" />
                  </div>
                ) : threads.length === 0 || comingSoon ? null : (
                  <ul className="mx-auto w-full max-w-2xl divide-y divide-black/[0.06] border-t border-black/[0.06]">
                    {threads.map((thread) => (
                      <li key={thread.id}>
                        <Link
                          href={`${HELPDESK_PATH}/${thread.id}`}
                          className="flex items-center gap-3 px-6 py-3.5 transition active:bg-black/[0.03]"
                        >
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block truncate text-[16px] font-medium text-foreground">
                              {thread.title?.trim() || 'New conversation'}
                            </span>
                            <span className="mt-0.5 block text-[13px] text-foreground-muted">
                              {subjectTypeLabel(thread.subject_type)}
                              {' · '}
                              {formatThreadWhen(thread.updated_at)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </PageScroll>
        ) : launching ? (
          <div
            className="flex min-h-0 flex-1 flex-col px-6 pt-4"
            style={{
              paddingBottom: safePadBottomTabOrKeyboard(
                APP_TAB_BAR_HEIGHT_PX,
                '1.75rem',
              ),
            }}
          >
            {launchingTurn}
          </div>
        ) : (
          <div
            className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6"
            style={{
              // Clear the tab bar, then add air so the group sits with the title.
              paddingBottom: safePadBottomTabOrKeyboard(
                APP_TAB_BAR_HEIGHT_PX,
                '1.75rem',
              ),
            }}
          >
            <div className="flex w-full max-w-xl flex-col items-center">
              {titleBlock}
              <div data-chat-composer-dock="" className="mt-7 w-full">
                {composer}
              </div>
              {recentLinks}
              {error ? (
                <p className="mt-4 text-center text-[13px] text-red-700">{error}</p>
              ) : null}
            </div>
          </div>
        )}
      </ChatDropSurface>

      <ChatAccountUsageModal
        open={usageOpen}
        onClose={() => setUsageOpen(false)}
        loading={usageLoading}
        error={usageError}
        data={usageData}
      />

      <ChatThreadsSidebar
        open={threadsOpen}
        onClose={() => setThreadsOpen(false)}
      />
    </>
  );
}
