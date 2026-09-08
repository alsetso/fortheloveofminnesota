'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthSafe } from '@/features/auth';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import type { DockPane } from '@/features/map/dockCore/core/dockPanes';
import { IconPlus, IconSparkles, IconSpinner } from '@/features/map/dockCore/core/icons';
import {
  DockActionRow,
  DockPaneShell,
  DockSection,
} from '@/features/map/dockCore/panes/DockPaneShell';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import AiMarkdown from '@/features/map/dockCore/panes/AiMarkdown';
import { SeatsReviewCarousel, type SeatsReviewDecision } from '@/features/map/dockCore/panes/SeatsReviewCarousel';
import type { SeatCompareCard } from '@/lib/ai/unitSeatsFacts';
import {
  buildFillAboutPrompt,
  buildFillOfficialsPrompt,
  detectPlaceAiTool,
  type PlaceAiTool,
} from '@/lib/ai/placeAiTools';
import { isLocalhostHost } from '@/lib/isLocalhostHost';
import { SUBJECT_TYPE_TERRITORY_UNIT } from '@/lib/ai/subjectTypes';

/** Human type label for prompts — e.g. "county", "city", "school district". */
function unitTypeLabel(kind: string | null, subtype: string | null): string {
  const k = (kind ?? '').trim().toLowerCase();
  const s = (subtype ?? '').trim().toLowerCase();
  if (k === 'ctu') {
    if (s === 'city') return 'city';
    if (s === 'township' || s === 'town') return 'township';
    return 'city or township';
  }
  if (k === 'county') return 'county';
  if (k === 'school_district') return 'school district';
  if (k === 'district') return 'congressional district';
  if (k === 'senate_district') return 'senate district';
  if (k === 'house_district') return 'house district';
  if (k === 'zipcode') return 'ZIP code';
  if (k) return k.replace(/_/g, ' ');
  return 'place';
}

type ThreadRow = {
  id: string;
  title: string | null;
  thread_key: string;
  updated_at: string;
};

type Citation = { url: string; title: string | null };

type FoundationRowStatus = 'pending' | 'accepted' | 'rejected';

type FoundationCompareRow = {
  key: string;
  label: string;
  existing: string;
  proposed: string;
  proposedValue?: string | number | string[];
  status: FoundationRowStatus;
};

type MessageMeta = {
  total_tokens?: number;
  web_search_used?: boolean;
  resolver?: string;
  citations?: Citation[];
  place_tool?: PlaceAiTool;
  foundation?: {
    applied?: boolean;
    status?: 'pending' | 'applied' | 'dismissed';
    labels?: string[];
    proposal_ids?: string[];
    rows?: FoundationCompareRow[];
    source_urls?: string[];
  };
  seats?: {
    applied?: boolean;
    status?: 'pending' | 'applied' | 'dismissed';
    cards?: SeatCompareCard[];
  };
};

type MessageRow = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  meta?: MessageMeta | null;
};

type View = 'threads' | 'chat';

/**
 * Slim Place AI chat — list first; open chat morphs header (back→chats, + new)
 * and pins the composer 1rem from the dock bottom.
 */
export default function DockTerritoryAiPane({
  pane,
}: {
  pane: Extract<DockPane, { id: 'subpage' }>;
}) {
  const unitId = pane.slug?.trim() ?? '';
  const placeTitle = pane.title?.trim() || 'Place';
  const initialQuery = pane.query?.trim() ?? '';
  const { account } = useAuthSafe();
  const { setTerritoryAiChrome } = useMapDock();
  const localhost =
    typeof window !== 'undefined' && isLocalhostHost(window.location.hostname);

  const autoQueryFiredRef = useRef(false);

  const [comingSoon, setComingSoon] = useState(!localhost);
  const [unitKind, setUnitKind] = useState<string | null>(null);
  const [unitSubtype, setUnitSubtype] = useState<string | null>(null);
  const [unitName, setUnitName] = useState(placeTitle);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [view, setView] = useState<View>('threads');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [reviewingMessageId, setReviewingMessageId] = useState<string | null>(null);
  const [reviewingSeatsMessageId, setReviewingSeatsMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const createThreadRef = useRef<
    (initial?: string, title?: string, tool?: PlaceAiTool) => Promise<void>
  >(async () => {});
  const sendToThreadRef = useRef<
    (threadId: string, content: string, tool?: PlaceAiTool) => Promise<void>
  >(async () => {});

  const loadContext = useCallback(async () => {
    if (!unitId) return;
    setError(null);
    try {
      const res = await fetch(`/api/ai/territory/${unitId}`, { credentials: 'include' });
      const json = (await res.json().catch(() => ({}))) as {
        comingSoon?: boolean;
        error?: string;
        unit?: {
          name?: string | null;
          kind?: string | null;
          subtype?: string | null;
        };
      };
      if (json.comingSoon) {
        setComingSoon(true);
        return;
      }
      setComingSoon(false);
      if (json.unit) {
        if (json.unit.name?.trim()) setUnitName(json.unit.name.trim());
        setUnitKind(json.unit.kind ?? null);
        setUnitSubtype(json.unit.subtype ?? null);
      }
      if (!res.ok) setError(json.error ?? 'Could not load Place AI');
    } catch {
      setError('Could not load Place AI');
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  const loadThreads = useCallback(async () => {
    if (!unitId || !account) {
      setThreads([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/ai/subjects/${SUBJECT_TYPE_TERRITORY_UNIT}/${unitId}/threads`,
        { credentials: 'include' },
      );
      const json = (await res.json().catch(() => ({}))) as {
        threads?: ThreadRow[];
        comingSoon?: boolean;
      };
      if (json.comingSoon) {
        setComingSoon(true);
        return;
      }
      if (res.ok) setThreads(json.threads ?? []);
    } catch {
      /* keep list */
    }
  }, [account, unitId]);

  const loadMessages = useCallback(async (threadId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/ai/threads/${threadId}/messages`, {
        credentials: 'include',
      });
      const json = (await res.json().catch(() => ({}))) as {
        messages?: MessageRow[];
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? 'Could not load chat');
        return;
      }
      setMessages(json.messages ?? []);
    } catch {
      setError('Could not load chat');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (!comingSoon && account) void loadThreads();
  }, [account, comingSoon, loadThreads]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, view, sending]);

  const openThread = async (threadId: string) => {
    setActiveThreadId(threadId);
    setView('chat');
    setMessages([]);
    await loadMessages(threadId);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const createThread = async (
    initialMessage?: string,
    threadTitle?: string,
    tool: PlaceAiTool = 'chat',
  ) => {
    if (!account) {
      setError('Sign in to chat.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ai/subjects/${SUBJECT_TYPE_TERRITORY_UNIT}/${unitId}/threads`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title:
              threadTitle?.trim() ||
              (initialMessage?.trim()
                ? initialMessage.trim().slice(0, 48)
                : `Chat · ${placeTitle}`),
          }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        thread?: ThreadRow;
        error?: string;
        comingSoon?: boolean;
      };
      if (json.comingSoon) {
        setComingSoon(true);
        return;
      }
      if (!res.ok || !json.thread) {
        setError(json.error ?? 'Could not start chat');
        return;
      }
      setThreads((prev) => [json.thread!, ...prev]);
      setActiveThreadId(json.thread.id);
      setView('chat');
      setMessages([]);
      if (initialMessage?.trim()) {
        await sendToThread(json.thread.id, initialMessage.trim(), tool);
      } else {
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    } catch {
      setError('Could not start chat');
    } finally {
      setSending(false);
    }
  };

  const sendToThread = async (
    threadId: string,
    content: string,
    tool: PlaceAiTool = 'chat',
  ) => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/threads/${threadId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, tool }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        userMessage?: MessageRow;
        assistantMessage?: MessageRow;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? 'Could not send');
        return;
      }
      setMessages((prev) => [
        ...prev,
        ...(json.userMessage ? [json.userMessage] : []),
        ...(json.assistantMessage ? [json.assistantMessage] : []),
      ]);
      void loadThreads();
    } catch {
      setError('Could not send');
    } finally {
      setSending(false);
    }
  };

  const onSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    if (!activeThreadId) {
      await createThread(text, undefined, 'chat');
      return;
    }
    await sendToThread(activeThreadId, text, 'chat');
  };

  createThreadRef.current = createThread;
  sendToThreadRef.current = sendToThread;

  const runFillAbout = () => {
    if (!account || sending) return;
    const prompt = buildFillAboutPrompt(
      unitName.trim() || placeTitle,
      unitTypeLabel(unitKind, unitSubtype),
    );
    const title = `Fill About · ${(unitName.trim() || placeTitle).slice(0, 32)}`;
    if (view === 'chat' && activeThreadId) {
      void sendToThreadRef.current(activeThreadId, prompt, 'fill_about');
      return;
    }
    void createThreadRef.current(prompt, title, 'fill_about');
  };

  const runFillOfficials = () => {
    if (!account || sending) return;
    const prompt = buildFillOfficialsPrompt(
      unitName.trim() || placeTitle,
      unitTypeLabel(unitKind, unitSubtype),
    );
    const title = `Fill Officials · ${(unitName.trim() || placeTitle).slice(0, 32)}`;
    if (view === 'chat' && activeThreadId) {
      void sendToThreadRef.current(activeThreadId, prompt, 'fill_officials');
      return;
    }
    void createThreadRef.current(prompt, title, 'fill_officials');
  };

  // Auto-fire an initial prompt when the pane is opened with a pre-set query
  // (e.g. from the "Fill Officials · Place AI" button in the Seats section).
  useEffect(() => {
    if (!initialQuery || autoQueryFiredRef.current || loading || comingSoon || !account) return;
    autoQueryFiredRef.current = true;
    const tool = detectPlaceAiTool(initialQuery);
    const titlePrefix =
      tool === 'fill_about'
        ? 'Fill About'
        : tool === 'fill_officials'
          ? 'Fill Officials'
          : 'Chat';
    void createThreadRef.current(
      initialQuery,
      `${titlePrefix} · ${placeTitle.slice(0, 32)}`,
      tool,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, loading, comingSoon, account]);

  const reviewSeats = async (
    messageId: string,
    decisions: SeatsReviewDecision[],
  ) => {
    if (!unitId || reviewingSeatsMessageId || decisions.length === 0) return;
    setReviewingSeatsMessageId(messageId);
    setError(null);
    try {
      const res = await fetch(`/api/ai/territory/${unitId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review_seats',
          messageId,
          decisions,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: MessageRow;
      };
      if (!res.ok || !json.message) {
        setError(json.error ?? 'Could not apply seat review');
        return;
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, ...json.message! } : m)),
      );
    } catch {
      setError('Could not apply seat review');
    } finally {
      setReviewingSeatsMessageId(null);
    }
  };

  const reviewFoundation = async (
    messageId: string,
    decisions: Array<{ key: string; decision: 'accept' | 'reject' }>,
  ) => {
    if (!unitId || reviewingMessageId || decisions.length === 0) return;
    setReviewingMessageId(messageId);
    setError(null);
    try {
      const res = await fetch(`/api/ai/territory/${unitId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review_foundation',
          messageId,
          decisions,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: MessageRow;
      };
      if (!res.ok || !json.message) {
        setError(json.error ?? 'Could not apply review');
        return;
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, ...json.message! } : m)),
      );
    } catch {
      setError('Could not apply review');
    } finally {
      setReviewingMessageId(null);
    }
  };

  const backToChats = useCallback(() => {
    setView('threads');
    setActiveThreadId(null);
    setMessages([]);
    setDraft('');
  }, []);

  useEffect(() => {
    if (view !== 'chat') {
      setTerritoryAiChrome(null);
      return () => setTerritoryAiChrome(null);
    }
    setTerritoryAiChrome({
      onBackToChats: backToChats,
      onNewChat: () => {
        void createThreadRef.current();
      },
      newChatDisabled: sending || !account,
    });
    return () => setTerritoryAiChrome(null);
  }, [view, sending, account, backToChats, setTerritoryAiChrome]);

  if (!unitId) {
    return (
      <DockPaneShell>
        <p className="px-1 text-sm text-foreground-muted">Missing territory unit.</p>
      </DockPaneShell>
    );
  }

  if (loading && comingSoon && !localhost) {
    return (
      <DockPaneShell>
        <p className="flex items-center gap-2 px-1 text-sm text-foreground-muted">
          <IconSpinner className="h-4 w-4 animate-spin" />
          Loading…
        </p>
      </DockPaneShell>
    );
  }

  if (comingSoon && !localhost) {
    return (
      <DockPaneShell>
        <div className="space-y-3 pb-6 pt-1">
          <p className="text-sm leading-relaxed text-foreground-muted">
            Place AI is coming soon — ask about seats, website, and contact for {placeTitle}.
          </p>
        </div>
      </DockPaneShell>
    );
  }

  const typeLabel = unitTypeLabel(unitKind, unitSubtype);
  const fillAboutLabel = `Fill About · ${typeLabel}`;
  const fillOfficialsLabel = `Fill Officials · ${typeLabel}`;

  const footer =
    account ? (
      <div className="space-y-2.5">
        {/* Quick AI prompts — no bg, plain text links */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <button
            type="button"
            disabled={sending || loading}
            onClick={runFillOfficials}
            title={`Research current officials and seat holders for this ${typeLabel}`}
            aria-label={fillOfficialsLabel}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-lake-blue/70 transition hover:text-lake-blue disabled:opacity-40"
          >
            <IconSparkles className="h-3 w-3" />
            {fillOfficialsLabel}
          </button>
          <button
            type="button"
            disabled={sending || loading}
            onClick={runFillAbout}
            title={`Research ${typeLabel} overview, website, contact, population, and best/worst features`}
            aria-label={fillAboutLabel}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-lake-blue/70 transition hover:text-lake-blue disabled:opacity-40"
          >
            <IconSparkles className="h-3 w-3" />
            {fillAboutLabel}
          </button>
        </div>

        {/* Message input — no card bg, sits directly on the sheet glass */}
        {view === 'chat' ? (
          <div className="flex items-center gap-2 border-t border-map-ink-subtle pt-2">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message…"
              className="flex-1 bg-transparent py-2 px-0 text-[15px] leading-normal text-foreground outline-none placeholder:text-foreground-muted"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void onSend();
                }
              }}
              onFocus={() => {
                requestAnimationFrame(() => {
                  bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                });
              }}
            />
            <button
              type="button"
              disabled={sending || !draft.trim()}
              onClick={() => void onSend()}
              className="bg-map-chat-sent shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold disabled:opacity-35"
            >
              Send
            </button>
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <DockPaneShell footer={footer}>
      <div className="space-y-3 pb-2 pt-1">
        {loading ? (
          <p className="flex items-center gap-2 px-0.5 text-sm text-foreground-muted">
            <IconSpinner className="h-4 w-4 animate-spin" />
            Loading…
          </p>
        ) : null}

        {error ? (
          <p className="px-0.5 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        {view === 'threads' ? (
          <div className="space-y-4 px-0.5">
            {!account ? (
              <p className="text-sm text-foreground-muted">
                Sign in from the avatar to start or revisit chats for {placeTitle}.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void createThread()}
                  className="bg-map-chat-sent flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold disabled:opacity-40"
                >
                  <IconPlus className="h-4 w-4" />
                  Start new chat
                </button>

                {threads.length > 0 ? (
                  <DockSection title="Recent chats" subtitle="Tap to reopen.">
                    {threads.map((t) => (
                      <DockActionRow
                        key={t.id}
                        title={t.title?.trim() || 'Chat'}
                        subtitle={formatWhen(t.updated_at)}
                        onClick={() => void openThread(t.id)}
                      />
                    ))}
                  </DockSection>
                ) : !loading ? (
                  <p className="text-sm text-foreground-muted">
                    No chats yet. Start one to ask about {placeTitle}.
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {view === 'chat' ? (
          <div className="space-y-3 px-0.5">
            {messages.length === 0 && !sending ? (
              <p className="text-sm text-foreground-muted">
                Type a message below about {placeTitle}.
              </p>
            ) : null}
            {messages.map((m) => {
              const meta = (m.meta ?? {}) as MessageMeta;
              const citations = Array.isArray(meta.citations) ? meta.citations : [];
              return (
                <div
                  key={m.id}
                  className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-map-chat-sent ml-8 whitespace-pre-wrap'
                      : `mr-4 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} text-foreground`
                  }`}
                >
                  {m.role === 'assistant' ? <AiMarkdown content={m.content} /> : m.content}
                  {m.role === 'assistant' && meta.foundation?.rows?.length ? (
                    <FoundationReviewTable
                      rows={meta.foundation.rows}
                      status={meta.foundation.status}
                      busy={reviewingMessageId === m.id}
                      onDecide={(decisions) => void reviewFoundation(m.id, decisions)}
                    />
                  ) : null}
                  {m.role === 'assistant' && meta.seats?.cards?.length ? (
                    <SeatsReviewCarousel
                      unitId={unitId}
                      cards={meta.seats.cards}
                      status={meta.seats.status}
                      busy={reviewingSeatsMessageId === m.id}
                      onDecide={(decisions) => void reviewSeats(m.id, decisions)}
                    />
                  ) : null}
                  {m.role === 'assistant' && citations.length > 0 ? (
                    <div className="mt-3 border-t border-map-ink-subtle pt-2.5">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
                        Sources
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {citations.slice(0, 6).map((c, i) => {
                          let host = '';
                          try {
                            host = new URL(c.url).hostname.replace(/^www\./, '');
                          } catch {
                            host = '';
                          }
                          const label = c.title?.trim() || host || 'Source';
                          return (
                            <a
                              key={`${c.url}-${i}`}
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={c.url}
                              className="inline-flex max-w-full items-center rounded-full bg-lake-blue/15 px-2.5 py-1 text-[11px] font-medium text-lake-blue ring-1 ring-lake-blue/25 transition-colors hover:bg-lake-blue/25"
                            >
                              <span className="truncate">{label}</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {sending ? (
              <p className="flex items-center gap-2 text-sm text-foreground-muted">
                <IconSpinner className="h-4 w-4 animate-spin" />
                Thinking…
              </p>
            ) : null}
            <div ref={bottomRef} />
          </div>
        ) : null}
      </div>
    </DockPaneShell>
  );
}

function FoundationReviewTable({
  rows,
  status,
  busy,
  onDecide,
}: {
  rows: FoundationCompareRow[];
  status?: 'pending' | 'applied' | 'dismissed';
  busy: boolean;
  onDecide: (decisions: Array<{ key: string; decision: 'accept' | 'reject' }>) => void;
}) {
  const pending = rows.filter((r) => r.status === 'pending');
  const accepted = rows.filter((r) => r.status === 'accepted');
  const rejected = rows.filter((r) => r.status === 'rejected');

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-map-ink-subtle">
      <div className="flex items-center justify-between gap-2 border-b border-map-ink-subtle bg-black/[0.03] px-2.5 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
          Existing vs New
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse text-left text-[11px] leading-snug">
          <thead>
            <tr className="border-b border-map-ink-subtle text-foreground-muted">
              <th className="px-2.5 py-1.5 font-semibold">Field</th>
              <th className="px-2.5 py-1.5 font-semibold">Existing</th>
              <th className="px-2.5 py-1.5 font-semibold">New</th>
              <th className="px-2.5 py-1.5 font-semibold"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-map-ink-subtle/70 last:border-0">
                <td className="align-top px-2.5 py-2 font-medium text-foreground">{row.label}</td>
                <td className="align-top px-2.5 py-2 text-foreground-muted break-words">
                  {row.existing}
                </td>
                <td className="align-top px-2.5 py-2 text-foreground break-words">{row.proposed}</td>
                <td className="align-top px-2 py-2 whitespace-nowrap">
                  {row.status === 'pending' ? (
                    <span className="inline-flex gap-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onDecide([{ key: row.key, decision: 'accept' }])}
                        className="rounded-full bg-lake-blue/15 px-2 py-0.5 text-[10px] font-semibold text-lake-blue disabled:opacity-40"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onDecide([{ key: row.key, decision: 'reject' }])}
                        className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-semibold text-foreground-muted disabled:opacity-40"
                      >
                        Skip
                      </button>
                    </span>
                  ) : (
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide ${
                        row.status === 'accepted' ? 'text-lake-blue' : 'text-foreground-muted'
                      }`}
                    >
                      {row.status === 'accepted' ? 'Saved' : 'Skipped'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pending.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-map-ink-subtle px-2.5 py-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onDecide(pending.map((r) => ({ key: r.key, decision: 'accept' as const })))
            }
            className="rounded-full bg-lake-blue px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
          >
            Approve all
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onDecide(pending.map((r) => ({ key: r.key, decision: 'reject' as const })))
            }
            className="rounded-full bg-foreground/5 px-3 py-1 text-[11px] font-semibold text-foreground-muted disabled:opacity-40"
          >
            Skip remaining
          </button>
          {busy ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-foreground-muted">
              <IconSpinner className="h-3 w-3 animate-spin" />
              Saving…
            </span>
          ) : null}
        </div>
      ) : (
        <p className="border-t border-map-ink-subtle px-2.5 py-2 text-[11px] text-foreground-muted">
          {status === 'dismissed' || (!accepted.length && rejected.length)
            ? 'All suggested fields skipped — nothing saved.'
            : accepted.length
              ? `Saved ${accepted.length} field${accepted.length === 1 ? '' : 's'}${
                  rejected.length ? ` · skipped ${rejected.length}` : ''
                }.`
              : 'Review complete.'}
        </p>
      )}
    </div>
  );
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
